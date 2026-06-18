/**
 * Image to Textile BMP Converter
 * Converts PNG/JPG designs into pixel-perfect BMP files for ArahPaint weaving software.
 *
 * Features:
 * - Resize to exact grid dimensions (Thread × Board)
 * - Quantize colors to clean textile palette
 * - Generate uncompressed 24-bit BMP files
 * - Live preview with before/after comparison
 */

class BmpConverter {
  constructor() {
    // DOM refs
    this.uploadZone = document.getElementById('conv-upload-zone');
    this.fileInput = document.getElementById('conv-file-input');
    this.previewImg = document.getElementById('conv-preview-img');
    this.previewName = document.getElementById('conv-preview-name');
    this.previewSize = document.getElementById('conv-preview-size');
    this.widthInput = document.getElementById('conv-width');
    this.heightInput = document.getElementById('conv-height');
    this.colorCountInput = document.getElementById('conv-color-count');
    this.convertBtn = document.getElementById('conv-convert-btn');
    this.downloadBtn = document.getElementById('conv-download-btn');
    this.useInCalcBtn = document.getElementById('conv-use-in-calc-btn');
    this.beforeCanvas = document.getElementById('conv-before-canvas');
    this.afterCanvas = document.getElementById('conv-after-canvas');
    this.beforePlaceholder = document.getElementById('conv-before-placeholder');
    this.afterPlaceholder = document.getElementById('conv-after-placeholder');
    this.paletteContainer = document.getElementById('conv-palette');

    this.imageFile = null;
    this.originalImage = null;
    this.convertedBlob = null;
    this.convertedDataUrl = null;

    // Textile color palette — clean, saturated colors used in weaving
    this.textilePalette = [
      { name: 'White',      r: 255, g: 255, b: 255 },
      { name: 'Black',      r: 0,   g: 0,   b: 0   },
      { name: 'Red',        r: 255, g: 0,   b: 0   },
      { name: 'Green',      r: 0,   g: 255, b: 0   },
      { name: 'Blue',       r: 0,   g: 0,   b: 255 },
      { name: 'Yellow',     r: 255, g: 255, b: 0   },
      { name: 'Cyan',       r: 0,   g: 255, b: 255 },
      { name: 'Magenta',    r: 255, g: 0,   b: 255 },
      { name: 'Orange',     r: 255, g: 128, b: 0   },
      { name: 'Purple',     r: 128, g: 0,   b: 128 },
      { name: 'Dark Red',   r: 139, g: 0,   b: 0   },
      { name: 'Dark Green', r: 0,   g: 100, b: 0   },
      { name: 'Dark Blue',  r: 0,   g: 0,   b: 139 },
      { name: 'Brown',      r: 139, g: 69,  b: 19  },
      { name: 'Pink',       r: 255, g: 105, b: 180 },
      { name: 'Gray',       r: 128, g: 128, b: 128 },
    ];

    this._bindEvents();
  }

  _bindEvents() {
    // Upload
    this.uploadZone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) this._handleFile(e.target.files[0]);
    });

    // Drag and drop
    this.uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadZone.classList.add('drag-over');
    });
    this.uploadZone.addEventListener('dragleave', () => {
      this.uploadZone.classList.remove('drag-over');
    });
    this.uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        this._handleFile(e.dataTransfer.files[0]);
      }
    });

    // Change image
    document.getElementById('conv-preview-change')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fileInput.click();
    });

    // Convert
    this.convertBtn.addEventListener('click', () => this._convert());

    // Download
    this.downloadBtn.addEventListener('click', () => this._download());

    // Use in calculator
    this.useInCalcBtn.addEventListener('click', () => this._useInCalculator());
  }

  _handleFile(file) {
    const validExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExts.includes(ext) && !file.type.startsWith('image/')) {
      this._showToast('Please upload an image file (PNG, JPG, etc.)', 'error');
      return;
    }

    this.imageFile = file;
    const url = URL.createObjectURL(file);

    // Load image to get dimensions
    const img = new Image();
    img.onload = () => {
      this.originalImage = img;

      // Update preview
      this.previewImg.src = url;
      document.getElementById('conv-preview-name').textContent = file.name;
      document.getElementById('conv-preview-size').textContent =
        `${img.width}×${img.height}px · ${this._formatFileSize(file.size)}`;
      this.uploadZone.classList.add('has-image');

      // Draw before canvas
      this._drawBeforePreview(img);

      this.convertBtn.disabled = false;
      this._showToast('Image loaded — ready to convert', 'success');
    };
    img.src = url;
  }

  _drawBeforePreview(img) {
    this.beforePlaceholder.classList.add('hidden');
    const canvas = this.beforeCanvas;
    const wrapper = canvas.parentElement;
    const maxW = wrapper.clientWidth || 400;
    const maxH = 300;

    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  async _convert() {
    if (!this.originalImage) return;

    const targetW = parseInt(this.widthInput.value) || 100;
    const targetH = parseInt(this.heightInput.value) || 50;
    const maxColors = parseInt(this.colorCountInput.value) || 8;
    const img = this.originalImage;

    // Step 1: Read the ORIGINAL image at full resolution (no resize yet)
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = img.width;
    srcCanvas.height = img.height;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.imageSmoothingEnabled = false;
    srcCtx.drawImage(img, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, img.width, img.height).data;

    // Pre-quantize EVERY source pixel to its nearest palette color
    // This avoids anti-aliased intermediate colors entirely
    const activePalette = this.textilePalette.slice(0, maxColors);
    const srcQuantized = new Uint8Array(img.width * img.height); // palette index per pixel

    for (let i = 0; i < img.width * img.height; i++) {
      const si = i * 4;
      const r = srcData[si], g = srcData[si + 1], b = srcData[si + 2];

      let bestDist = Infinity;
      let bestIdx = 0;
      for (let p = 0; p < activePalette.length; p++) {
        const c = activePalette[p];
        const dr = r - c.r, dg = g - c.g, db = b - c.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = p;
        }
      }
      srcQuantized[i] = bestIdx;
    }

    // Step 2: Area-averaging with MAJORITY VOTE downsampling
    // For each output pixel, find the rectangular block of source pixels
    // that maps to it, then pick the palette color that appears most often
    const usedColors = new Map();
    const outPixels = new Uint8ClampedArray(targetW * targetH * 4);
    const votes = new Uint32Array(activePalette.length);

    for (let y = 0; y < targetH; y++) {
      // Source row range for this output row
      const srcY0 = Math.floor(y * img.height / targetH);
      const srcY1 = Math.min(Math.floor((y + 1) * img.height / targetH), img.height);

      for (let x = 0; x < targetW; x++) {
        // Source col range for this output col
        const srcX0 = Math.floor(x * img.width / targetW);
        const srcX1 = Math.min(Math.floor((x + 1) * img.width / targetW), img.width);

        // Count votes from all source pixels in this block
        votes.fill(0);
        for (let sy = srcY0; sy < srcY1; sy++) {
          for (let sx = srcX0; sx < srcX1; sx++) {
            votes[srcQuantized[sy * img.width + sx]]++;
          }
        }

        // Find the palette color with the most votes
        let bestVotes = -1;
        let bestIdx = 0;
        for (let p = 0; p < activePalette.length; p++) {
          if (votes[p] > bestVotes) {
            bestVotes = votes[p];
            bestIdx = p;
          }
        }

        const bestColor = activePalette[bestIdx];
        const outIdx = (y * targetW + x) * 4;
        outPixels[outIdx]     = bestColor.r;
        outPixels[outIdx + 1] = bestColor.g;
        outPixels[outIdx + 2] = bestColor.b;
        outPixels[outIdx + 3] = 255;

        const key = `${bestColor.r},${bestColor.g},${bestColor.b}`;
        usedColors.set(key, (usedColors.get(key) || 0) + 1);
      }
    }

    // Step 3: Write result to a canvas for preview
    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetW;
    outCanvas.height = targetH;
    const outCtx = outCanvas.getContext('2d');
    const outImageData = outCtx.createImageData(targetW, targetH);
    outImageData.data.set(outPixels);
    outCtx.putImageData(outImageData, 0, 0);

    // Step 4: Draw after preview
    this._drawAfterPreview(outCanvas, targetW, targetH);

    // Step 5: Show palette
    this._showPalette(usedColors, activePalette);

    // Step 6: Generate BMP blob
    this.convertedBlob = this._generateBMP(outPixels, targetW, targetH);
    this.convertedDataUrl = URL.createObjectURL(this.convertedBlob);

    // Enable download and use-in-calc
    this.downloadBtn.disabled = false;
    this.useInCalcBtn.disabled = false;

    this._showToast(`Converted to ${targetW}×${targetH} BMP with ${usedColors.size} colors`, 'success');
  }

  _drawAfterPreview(srcCanvas, w, h) {
    this.afterPlaceholder.classList.add('hidden');
    const canvas = this.afterCanvas;
    const wrapper = canvas.parentElement;
    const maxW = wrapper.clientWidth || 400;
    const maxH = 300;

    // Scale up so individual pixels are visible
    const scale = Math.min(maxW / w, maxH / h);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(srcCanvas, 0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    const cellW = canvas.width / w;
    const cellH = canvas.height / h;
    if (cellW > 3) {
      for (let x = 0; x <= w; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cellW, 0);
        ctx.lineTo(x * cellW, canvas.height);
        ctx.stroke();
      }
    }
    if (cellH > 3) {
      for (let y = 0; y <= h; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cellH);
        ctx.lineTo(canvas.width, y * cellH);
        ctx.stroke();
      }
    }
  }

  _showPalette(usedColors, palette) {
    this.paletteContainer.innerHTML = '';
    const total = [...usedColors.values()].reduce((a, b) => a + b, 0);

    for (const color of palette) {
      const key = `${color.r},${color.g},${color.b}`;
      const count = usedColors.get(key) || 0;
      if (count === 0) continue;

      const pct = ((count / total) * 100).toFixed(1);
      const hex = '#' + [color.r, color.g, color.b].map(c => c.toString(16).padStart(2, '0')).join('');

      const el = document.createElement('div');
      el.className = 'conv-palette-item';
      el.innerHTML = `
        <div class="conv-palette-swatch" style="background:${hex}"></div>
        <div class="conv-palette-info">
          <span class="conv-palette-name">${color.name}</span>
          <span class="conv-palette-pct">${pct}%</span>
        </div>
      `;
      this.paletteContainer.appendChild(el);
    }
  }

  /**
   * Generate a 24-bit uncompressed BMP file
   * BMP stores rows bottom-to-top with each row padded to 4-byte boundary
   */
  _generateBMP(pixels, width, height) {
    const rowSize = Math.ceil((width * 3) / 4) * 4; // Each row padded to 4 bytes
    const pixelDataSize = rowSize * height;
    const fileSize = 54 + pixelDataSize; // 14 (file header) + 40 (info header) + pixel data

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // ---- BMP File Header (14 bytes) ----
    view.setUint8(0, 0x42);  // 'B'
    view.setUint8(1, 0x4D);  // 'M'
    view.setUint32(2, fileSize, true);
    view.setUint16(6, 0, true);  // Reserved
    view.setUint16(8, 0, true);  // Reserved
    view.setUint32(10, 54, true); // Pixel data offset

    // ---- BMP Info Header (40 bytes) ----
    view.setUint32(14, 40, true);       // Header size
    view.setInt32(18, width, true);      // Width
    view.setInt32(22, height, true);     // Height (positive = bottom-to-top)
    view.setUint16(26, 1, true);         // Color planes
    view.setUint16(28, 24, true);        // Bits per pixel
    view.setUint32(30, 0, true);         // Compression (none)
    view.setUint32(34, pixelDataSize, true);
    view.setInt32(38, 2835, true);       // Horizontal resolution (72 DPI)
    view.setInt32(42, 2835, true);       // Vertical resolution
    view.setUint32(46, 0, true);         // Colors in palette
    view.setUint32(50, 0, true);         // Important colors

    // ---- Pixel Data ----
    // BMP stores rows bottom-to-top, in BGR order
    const data = new Uint8Array(buffer);
    for (let y = 0; y < height; y++) {
      const bmpRow = height - 1 - y; // Flip vertically
      const rowOffset = 54 + bmpRow * rowSize;

      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const dstIdx = rowOffset + x * 3;

        data[dstIdx]     = pixels[srcIdx + 2]; // B
        data[dstIdx + 1] = pixels[srcIdx + 1]; // G
        data[dstIdx + 2] = pixels[srcIdx];     // R
      }
      // Padding bytes are already 0 from ArrayBuffer initialization
    }

    return new Blob([buffer], { type: 'image/bmp' });
  }

  _download() {
    if (!this.convertedBlob) return;
    const baseName = this.imageFile
      ? this.imageFile.name.replace(/\.[^.]+$/, '')
      : 'design';
    const w = this.widthInput.value || 100;
    const h = this.heightInput.value || 50;

    const a = document.createElement('a');
    a.href = this.convertedDataUrl;
    a.download = `${baseName}_${w}x${h}.bmp`;
    a.click();
    this._showToast('BMP file downloaded', 'success');
  }

  _useInCalculator() {
    if (!this.convertedBlob) return;

    const w = parseInt(this.widthInput.value) || 100;
    const h = parseInt(this.heightInput.value) || 50;
    const baseName = this.imageFile
      ? this.imageFile.name.replace(/\.[^.]+$/, '')
      : 'design';

    // Create a File object from the blob
    const bmpFile = new File([this.convertedBlob], `${baseName}.bmp`, { type: 'image/bmp' });

    // Switch to calculator tab
    document.querySelector('.app-tab[data-tool="calculator"]').click();

    // Feed the file into the calculator's upload handler
    if (window.app) {
      // Set configuration
      document.getElementById('thread-count').value = w;
      document.getElementById('board-count').value = h;
      if (!document.getElementById('design-name').value) {
        document.getElementById('design-name').value = baseName;
      }
      // Trigger the file handler
      window.app._handleFile(bmpFile);
      this._showToast('BMP sent to calculator — click "Process Design"', 'success');
    }
  }

  _showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  _formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.bmpConverter = new BmpConverter();
});
