/**
 * Weaving Punching Card Calculator
 * Core Application Logic
 *
 * Processes weaving design images (BMP/PNG) and generates
 * punching card descriptions for the weaving industry.
 */

// ============================================
// IMAGE PROCESSING MODULE
// ============================================

class ImageProcessor {
  /**
   * Load an image file and extract pixel grid data
   * @param {File} file - Image file (BMP, PNG, JPG)
   * @param {number} threadCount - Number of columns (width)
   * @param {number} boardCount - Number of rows (height)
   * @returns {Promise<{gridData: string[][], colors: Map}>}
   */
  static async processImage(file, threadCount, boardCount) {
    const img = await ImageProcessor._loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const pixels = imageData.data;

    // Find content bounds to avoid 1px border padding issues
    let contentMinY = img.height;
    for (let y = 0; y < img.height; y++) {
      let hasContent = false;
      for (let x = 0; x < img.width; x++) {
        const idx = (y * img.width + x) * 4;
        const brightness = (pixels[idx] * 299 + pixels[idx+1] * 587 + pixels[idx+2] * 114) / 1000;
        if (brightness <= 220) { hasContent = true; break; }
      }
      if (hasContent) { contentMinY = y; break; }
    }
    if (contentMinY === img.height) contentMinY = 0;

    // Calculate cell size based on content height if it's close to boardCount
    const cellW = img.width / threadCount;
    const cellH = Math.min((img.height - contentMinY) / boardCount, img.height / boardCount);

    // Build grid data (row 0 = top of image = highest board number)
    const gridData = [];
    const colorMap = new Map(); // hex -> {count, r, g, b}

    for (let row = 0; row < boardCount; row++) {
      const rowData = [];
      for (let col = 0; col < threadCount; col++) {
        // Sample center of each cell
        const sampleX = Math.floor(col * cellW + cellW / 2);
        const sampleY = Math.floor(contentMinY + row * cellH + cellH / 2);

        // Also sample a few surrounding points for better accuracy
        const color = ImageProcessor._sampleColor(pixels, img.width, sampleX, sampleY, cellW, cellH);
        const hex = ImageProcessor._rgbToHex(color.r, color.g, color.b);
        const classified = ImageProcessor._classifyColor(color.r, color.g, color.b);

        rowData.push(classified);

        if (classified !== '#ffffff') {
          if (!colorMap.has(classified)) {
            colorMap.set(classified, { count: 0, r: color.r, g: color.g, b: color.b, hex: classified });
          }
          colorMap.get(classified).count++;
        }
      }
      gridData.push(rowData);
    }

    return { gridData, colors: colorMap, imageWidth: img.width, imageHeight: img.height };
  }

  static _loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      const url = URL.createObjectURL(file);
      img.src = url;
    });
  }

  static _sampleColor(pixels, imgWidth, cx, cy, cellW, cellH) {
    // Multi-point sampling for accuracy
    const offsets = [
      [0, 0],
      [-Math.floor(cellW * 0.2), -Math.floor(cellH * 0.2)],
      [Math.floor(cellW * 0.2), -Math.floor(cellH * 0.2)],
      [-Math.floor(cellW * 0.2), Math.floor(cellH * 0.2)],
      [Math.floor(cellW * 0.2), Math.floor(cellH * 0.2)],
    ];

    let totalR = 0, totalG = 0, totalB = 0, count = 0;

    for (const [dx, dy] of offsets) {
      const x = Math.max(0, cx + dx);
      const y = Math.max(0, cy + dy);
      const idx = (y * imgWidth + x) * 4;

      if (idx >= 0 && idx < pixels.length - 3) {
        totalR += pixels[idx];
        totalG += pixels[idx + 1];
        totalB += pixels[idx + 2];
        count++;
      }
    }

    return {
      r: Math.round(totalR / count),
      g: Math.round(totalG / count),
      b: Math.round(totalB / count)
    };
  }

  /**
   * Classify a pixel color into a standard color category
   * Uses color distance to handle anti-aliasing and slight variations
   */
  static _classifyColor(r, g, b) {
    // Known colors with thresholds
    const knownColors = [
      { name: 'white', hex: '#ffffff', r: 255, g: 255, b: 255, threshold: 60 },
      { name: 'black', hex: '#000000', r: 0, g: 0, b: 0, threshold: 80 },
      { name: 'red', hex: '#ff0000', r: 255, g: 0, b: 0, threshold: 100 },
      { name: 'green', hex: '#00ff00', r: 0, g: 255, b: 0, threshold: 100 },
      { name: 'blue', hex: '#0000ff', r: 0, g: 0, b: 255, threshold: 100 },
      { name: 'yellow', hex: '#ffff00', r: 255, g: 255, b: 0, threshold: 100 },
      { name: 'magenta', hex: '#ff00ff', r: 255, g: 0, b: 255, threshold: 100 },
      { name: 'cyan', hex: '#00ffff', r: 0, g: 255, b: 255, threshold: 100 },
      { name: 'orange', hex: '#ff8000', r: 255, g: 128, b: 0, threshold: 80 },
      { name: 'purple', hex: '#800080', r: 128, g: 0, b: 128, threshold: 80 },
      { name: 'brown', hex: '#8b4513', r: 139, g: 69, b: 19, threshold: 60 },
      { name: 'pink', hex: '#ff69b4', r: 255, g: 105, b: 180, threshold: 80 },
      { name: 'darkred', hex: '#8b0000', r: 139, g: 0, b: 0, threshold: 70 },
      { name: 'darkgreen', hex: '#006400', r: 0, g: 100, b: 0, threshold: 70 },
      { name: 'darkblue', hex: '#00008b', r: 0, g: 0, b: 139, threshold: 70 },
      { name: 'gray', hex: '#808080', r: 128, g: 128, b: 128, threshold: 40 },
    ];

    // Brightness check - very light colors are white
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness > 220) return '#ffffff';

    let bestMatch = null;
    let bestDist = Infinity;

    for (const color of knownColors) {
      if (color.name === 'white') continue;
      const dist = Math.sqrt(
        (r - color.r) ** 2 +
        (g - color.g) ** 2 +
        (b - color.b) ** 2
      );
      if (dist < color.threshold && dist < bestDist) {
        bestDist = dist;
        bestMatch = color;
      }
    }

    if (bestMatch) return bestMatch.hex;

    // If no good match, use the raw hex but snap to nearest
    if (brightness < 50) return '#000000'; // Very dark = black
    return ImageProcessor._rgbToHex(r, g, b);
  }

  static _rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  }
}


// ============================================
// RANGE CALCULATOR MODULE
// ============================================

class RangeCalculator {
  /**
   * Analyze grid data and produce punching card descriptions for each color
   * @param {string[][]} gridData - 2D array [row][col] of hex colors
   * @param {number} threadCount - Total threads (columns)
   * @param {number} boardCount - Total boards (rows)
   * @returns {Map<string, {rows: Array}>}
   */
  static analyze(gridData, threadCount, boardCount) {
    const colorResults = new Map();

    // Process each row (bottom-to-top: row 1 = last array index)
    for (let displayRow = 1; displayRow <= boardCount; displayRow++) {
      // displayRow 1 = bottom of image = last array row
      const arrayRow = boardCount - displayRow;

      if (!gridData[arrayRow]) continue;

      // Collect columns per color for this row
      const colorCols = new Map();

      for (let col = 0; col < threadCount; col++) {
        const color = gridData[arrayRow][col];
        if (color && color !== '#ffffff') {
          if (!colorCols.has(color)) {
            colorCols.set(color, []);
          }
          colorCols.get(color).push(col + 1); // 1-indexed columns
        }
      }

      // Add to results
      for (const [color, cols] of colorCols) {
        if (!colorResults.has(color)) {
          colorResults.set(color, []);
        }
        const ranges = RangeCalculator._groupConsecutive(cols);
        const formatted = RangeCalculator._formatRanges(ranges);
        colorResults.get(color).push({
          row: displayRow,
          columns: cols,
          ranges: ranges,
          formatted: formatted
        });
      }
    }

    return colorResults;
  }

  /**
   * Group consecutive numbers into ranges
   * [30, 31, 32, 33, 68, 69, 70, 71] => [[30,33], [68,71]]
   * [50, 51] => [[50,51]]
   * [44, 45, 49, 52, 56, 57] => [[44,45], [49,49], [52,52], [56,57]]
   */
  static _groupConsecutive(nums) {
    if (nums.length === 0) return [];

    const sorted = [...nums].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push([start, end]);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push([start, end]);

    return ranges;
  }

  /**
   * Format ranges into the weaving notation
   * Rules:
   * - Single number: "50"
   * - Two consecutive: "45- 46" (single dash with space — matching docx style)
   * - Three+ consecutive: "48--53" (double dash)
   * - Ranges separated by ", "
   * - Row ends with "||"
   */
  static _formatRanges(ranges) {
    const parts = [];

    for (const [start, end] of ranges) {
      if (start === end) {
        parts.push(String(start));
      } else if (end - start === 1) {
        // Two consecutive - separate by comma in buta 50 format
        parts.push(`${start}, ${end}`);
      } else {
        // Three or more consecutive - double dash
        parts.push(`${start}--${end}`);
      }
    }

    return parts.join(', ') + '||';
  }
}


// ============================================
// OUTPUT GENERATOR MODULE
// ============================================

class OutputGenerator {
  /**
   * Generate the full output text
   * @param {string} designName - Name of the design
   * @param {number} threadCount - Thread count
   * @param {number} boardCount - Board count
   * @param {Map} colorResults - Results from RangeCalculator
   * @param {Map} colorLabels - User-defined labels for colors
   * @param {Map} colorTypes - 'primary' or 'mina' for each color
   * @returns {string}
   */
  static generateText(designName, threadCount, boardCount, colorResults, colorLabels, colorTypes) {
    let output = '';

    // Separate primary and mina colors
    const primaryColors = [];
    const minaColors = [];

    for (const [color, rows] of colorResults) {
      const type = colorTypes.get(color) || 'primary';
      if (type === 'primary') {
        primaryColors.push({ color, rows });
      } else {
        minaColors.push({ color, rows, label: colorLabels.get(color) || 'MINA' });
      }
    }

    // Primary section
    if (primaryColors.length > 0) {
      output += `${designName}\n`;
      output += `Thread : ${threadCount}  Board : ${boardCount}\n`;
      output += `Description\n`;

      // Merge all primary color rows together by row number
      const allPrimaryRows = new Map();
      for (const { rows } of primaryColors) {
        for (const rowData of rows) {
          if (!allPrimaryRows.has(rowData.row)) {
            allPrimaryRows.set(rowData.row, []);
          }
          allPrimaryRows.get(rowData.row).push(...rowData.columns);
        }
      }

      // Sort by row number and format
      const sortedRows = [...allPrimaryRows.entries()].sort((a, b) => a[0] - b[0]);
      for (const [rowNum, columns] of sortedRows) {
        const uniqueCols = [...new Set(columns)].sort((a, b) => a - b);
        const ranges = RangeCalculator._groupConsecutive(uniqueCols);
        const formatted = RangeCalculator._formatRanges(ranges);
        output += `${rowNum}:> ${formatted}\n`;
      }
    }

    // Mina sections
    for (const { label, rows } of minaColors) {
      output += `\n\n${label}\n`;
      output += `Thread : ${threadCount}  Board : ${boardCount}\n`;
      output += `Description\n`;

      const sortedRows = [...rows].sort((a, b) => a.row - b.row);
      for (const rowData of sortedRows) {
        output += `${rowData.row}:> ${rowData.formatted}\n`;
      }
    }

    return output;
  }

  /**
   * Generate a downloadable TXT file
   */
  static downloadTXT(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Generate a basic DOCX file using raw XML
   * (No external library needed)
   */
  static downloadDOCX(text, filename) {
    const lines = text.split('\n');
    let bodyXml = '';

    for (const line of lines) {
      const escapedLine = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      // Check if it's a header line (design name, Thread/Board, Description, MINA, etc.)
      const isHeader = /^(Thread|Board|Description|MINA)/i.test(line.trim()) ||
        (line.trim().length > 0 && !/^\d+:\>/.test(line.trim()) && line.trim() !== '');

      const isBold = isHeader && !/^\d+:\>/.test(line.trim());

      bodyXml += `<w:p>`;
      if (isBold) {
        bodyXml += `<w:pPr><w:rPr><w:b/></w:rPr></w:pPr>`;
      }
      bodyXml += `<w:r>`;
      if (isBold) {
        bodyXml += `<w:rPr><w:b/></w:rPr>`;
      }
      bodyXml += `<w:t xml:space="preserve">${escapedLine}</w:t>`;
      bodyXml += `</w:r></w:p>`;
    }

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mo="http://schemas.microsoft.com/office/mac/office/2008/main"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mv="urn:schemas-microsoft-com:mac:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>${bodyXml}</w:body>
</w:document>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

    // Create ZIP (DOCX is a ZIP file)
    OutputGenerator._createDocxZip({
      '[Content_Types].xml': contentTypesXml,
      '_rels/.rels': relsXml,
      'word/document.xml': docXml,
      'word/_rels/document.xml.rels': wordRelsXml
    }, filename);
  }

  static async _createDocxZip(files, filename) {
    // Use JSZip-like approach with raw ZIP construction
    // For simplicity, we'll create a basic uncompressed ZIP
    const encoder = new TextEncoder();
    const parts = [];
    const centralDir = [];
    let offset = 0;

    for (const [path, content] of Object.entries(files)) {
      const data = encoder.encode(content);
      const pathBytes = encoder.encode(path);

      // Local file header
      const localHeader = new Uint8Array(30 + pathBytes.length);
      const view = new DataView(localHeader.buffer);
      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true); // Version needed
      view.setUint16(6, 0, true); // General purpose flag
      view.setUint16(8, 0, true); // Compression method (stored)
      view.setUint16(10, 0, true); // Last mod time
      view.setUint16(12, 0, true); // Last mod date
      view.setUint32(14, OutputGenerator._crc32(data), true); // CRC-32
      view.setUint32(18, data.length, true); // Compressed size
      view.setUint32(22, data.length, true); // Uncompressed size
      view.setUint16(26, pathBytes.length, true); // Filename length
      view.setUint16(28, 0, true); // Extra field length
      localHeader.set(pathBytes, 30);

      // Central directory entry
      const centralEntry = new Uint8Array(46 + pathBytes.length);
      const cView = new DataView(centralEntry.buffer);
      cView.setUint32(0, 0x02014b50, true); // Central dir signature
      cView.setUint16(4, 20, true); // Version made by
      cView.setUint16(6, 20, true); // Version needed
      cView.setUint16(8, 0, true); // General purpose flag
      cView.setUint16(10, 0, true); // Compression method
      cView.setUint16(12, 0, true); // Last mod time
      cView.setUint16(14, 0, true); // Last mod date
      cView.setUint32(16, OutputGenerator._crc32(data), true); // CRC-32
      cView.setUint32(20, data.length, true); // Compressed size
      cView.setUint32(24, data.length, true); // Uncompressed size
      cView.setUint16(28, pathBytes.length, true); // Filename length
      cView.setUint16(30, 0, true); // Extra field length
      cView.setUint16(32, 0, true); // Comment length
      cView.setUint16(34, 0, true); // Disk number start
      cView.setUint16(36, 0, true); // Internal attributes
      cView.setUint32(38, 0, true); // External attributes
      cView.setUint32(42, offset, true); // Relative offset of local header
      centralEntry.set(pathBytes, 46);

      parts.push(localHeader);
      parts.push(data);
      centralDir.push(centralEntry);
      offset += localHeader.length + data.length;
    }

    // End of central directory
    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const entry of centralDir) {
      parts.push(entry);
      centralDirSize += entry.length;
    }

    const endRecord = new Uint8Array(22);
    const eView = new DataView(endRecord.buffer);
    eView.setUint32(0, 0x06054b50, true); // End signature
    eView.setUint16(4, 0, true); // Disk number
    eView.setUint16(6, 0, true); // Start disk
    eView.setUint16(8, centralDir.length, true); // Entries on disk
    eView.setUint16(10, centralDir.length, true); // Total entries
    eView.setUint32(12, centralDirSize, true); // Central dir size
    eView.setUint32(16, centralDirOffset, true); // Central dir offset
    eView.setUint16(20, 0, true); // Comment length
    parts.push(endRecord);

    // Merge all parts
    const totalSize = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalSize);
    let pos = 0;
    for (const part of parts) {
      result.set(part, pos);
      pos += part.length;
    }

    const blob = new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.docx';
    a.click();
    URL.revokeObjectURL(url);
  }

  static _crc32(data) {
    let crc = 0xFFFFFFFF;
    const table = OutputGenerator._crc32Table();
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  static _crc32Table() {
    if (OutputGenerator._crcTable) return OutputGenerator._crcTable;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    OutputGenerator._crcTable = table;
    return table;
  }
}


// ============================================
// COLOR UTILITIES
// ============================================

class ColorUtils {
  static getColorName(hex) {
    const names = {
      '#000000': 'Black',
      '#ff0000': 'Red',
      '#00ff00': 'Green',
      '#0000ff': 'Blue',
      '#ffff00': 'Yellow',
      '#ff00ff': 'Magenta',
      '#00ffff': 'Cyan',
      '#ff8000': 'Orange',
      '#800080': 'Purple',
      '#8b4513': 'Brown',
      '#ff69b4': 'Pink',
      '#8b0000': 'Dark Red',
      '#006400': 'Dark Green',
      '#00008b': 'Dark Blue',
      '#808080': 'Gray',
    };
    return names[hex] || hex;
  }

  static getDefaultType(hex) {
    // Black is primary by default, all others are mina
    return hex === '#000000' ? 'primary' : 'mina';
  }

  static getDefaultLabel(hex) {
    if (hex === '#000000') return '';
    return 'MINA';
  }
}


// ============================================
// APP CONTROLLER
// ============================================

class App {
  constructor() {
    // State
    this.imageFile = null;
    this.gridData = null;
    this.colorResults = null;
    this.detectedColors = new Map();
    this.colorLabels = new Map();
    this.colorTypes = new Map();

    // DOM refs
    this.uploadZone = document.getElementById('upload-zone');
    this.fileInput = document.getElementById('file-input');
    this.uploadPreview = document.querySelector('.upload-preview');
    this.previewImg = document.getElementById('preview-img');
    this.previewName = document.getElementById('preview-name');
    this.previewSize = document.getElementById('preview-size');
    this.designNameInput = document.getElementById('design-name');
    this.threadInput = document.getElementById('thread-count');
    this.boardInput = document.getElementById('board-count');
    this.processBtn = document.getElementById('process-btn');
    this.colorListEl = document.getElementById('color-list');
    this.outputTextEl = document.getElementById('output-text');
    this.gridCanvas = document.getElementById('grid-canvas');
    this.canvasWrapper = document.getElementById('canvas-wrapper');
    this.canvasPlaceholder = document.getElementById('canvas-placeholder');
    this.statusText = document.getElementById('status-text');
    this.statusDot = document.getElementById('status-dot');
    this.loadingOverlay = document.getElementById('loading-overlay');
    this.loadingText = document.getElementById('loading-text');

    // Grid renderer
    this.gridRenderer = new GridRenderer(this.gridCanvas, this.canvasWrapper);

    this._bindEvents();
    this._updateStatus('Ready', 'ready');
  }

  _bindEvents() {
    // Upload
    this.uploadZone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this._onFileSelected(e));

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

    // Change image button
    document.querySelector('.upload-preview-change')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fileInput.click();
    });

    // Process button
    this.processBtn.addEventListener('click', () => this._processImage());

    // Export buttons
    document.getElementById('export-txt')?.addEventListener('click', () => this._exportTXT());
    document.getElementById('export-docx')?.addEventListener('click', () => this._exportDOCX());
    document.getElementById('copy-output')?.addEventListener('click', () => this._copyOutput());

    // Canvas controls
    document.getElementById('zoom-in')?.addEventListener('click', () => this.gridRenderer.zoomIn());
    document.getElementById('zoom-out')?.addEventListener('click', () => this.gridRenderer.zoomOut());
    document.getElementById('zoom-reset')?.addEventListener('click', () => this.gridRenderer.resetView());

    // Output tabs
    document.querySelectorAll('.output-tab').forEach(tab => {
      tab.addEventListener('click', () => this._switchOutputTab(tab.dataset.tab));
    });

    // Auto-detect board count from design name
    this.designNameInput.addEventListener('input', () => {
      const name = this.designNameInput.value;
      const match = name.match(/(\d+)\s*$/);
      if (match) {
        this.boardInput.value = match[1];
      }
    });
  }

  _onFileSelected(e) {
    if (e.target.files.length > 0) {
      this._handleFile(e.target.files[0]);
    }
  }

  _handleFile(file) {
    const validTypes = ['image/bmp', 'image/png', 'image/jpeg', 'image/gif', 'image/x-ms-bmp'];
    const validExts = ['.bmp', '.png', '.jpg', '.jpeg', '.gif'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      this._showToast('Please upload an image file (BMP, PNG, JPG)', 'error');
      return;
    }

    this.imageFile = file;

    // Update preview
    this.previewImg.src = URL.createObjectURL(file);
    this.previewName.textContent = file.name;
    this.previewSize.textContent = this._formatFileSize(file.size);
    this.uploadZone.classList.add('has-image');

    // Auto-set design name from filename
    const baseName = file.name.replace(/\.[^.]+$/, '');
    if (!this.designNameInput.value) {
      this.designNameInput.value = baseName;
    }

    // Try to detect board count from filename
    const match = baseName.match(/(\d+)/);
    if (match && !this.boardInput.value) {
      this.boardInput.value = match[1];
    }

    this.processBtn.disabled = false;
    this._showToast('Image loaded successfully', 'success');
    this._updateStatus('Image loaded — Ready to process', 'ready');
  }

  async _processImage() {
    if (!this.imageFile) return;

    const threadCount = parseInt(this.threadInput.value) || 100;
    const boardCount = parseInt(this.boardInput.value) || 50;
    const designName = this.designNameInput.value || 'Design';

    this._showLoading('Processing image...');
    this._updateStatus('Processing...', 'processing');

    try {
      // Process image
      this._setLoadingText('Analyzing pixels...');
      const { gridData, colors } = await ImageProcessor.processImage(
        this.imageFile, threadCount, boardCount
      );
      this.gridData = gridData;
      this.detectedColors = colors;

      // Update grid renderer
      this._setLoadingText('Rendering grid preview...');
      this.gridRenderer.setGridData(gridData, threadCount, boardCount);
      this.canvasPlaceholder.classList.add('hidden');

      // Setup color palette
      this._setupColorPalette(colors);

      // Calculate ranges
      this._setLoadingText('Calculating ranges...');
      this.colorResults = RangeCalculator.analyze(gridData, threadCount, boardCount);

      // Generate output
      this._setLoadingText('Generating output...');
      this._generateOutput(designName, threadCount, boardCount);

      this._hideLoading();
      this._updateStatus(`Processed: ${threadCount}×${boardCount} grid, ${colors.size} colors detected`, 'ready');
      this._showToast('Processing complete!', 'success');

    } catch (error) {
      console.error('Processing error:', error);
      this._hideLoading();
      this._updateStatus('Error processing image', 'ready');
      this._showToast('Error: ' + error.message, 'error');
    }
  }

  _setupColorPalette(colors) {
    this.colorListEl.innerHTML = '';

    if (colors.size === 0) {
      this.colorListEl.innerHTML = '<div class="no-colors">No colors detected</div>';
      return;
    }

    // Sort colors: black first, then by pixel count
    const sorted = [...colors.entries()].sort((a, b) => {
      if (a[0] === '#000000') return -1;
      if (b[0] === '#000000') return 1;
      return b[1].count - a[1].count;
    });

    for (const [hex, info] of sorted) {
      const defaultType = ColorUtils.getDefaultType(hex);
      const defaultLabel = ColorUtils.getDefaultLabel(hex);

      if (!this.colorTypes.has(hex)) {
        this.colorTypes.set(hex, defaultType);
      }
      if (!this.colorLabels.has(hex)) {
        this.colorLabels.set(hex, defaultLabel);
      }

      const item = document.createElement('div');
      item.className = 'color-item';
      item.innerHTML = `
        <div class="color-swatch" style="background:${hex}"></div>
        <div class="color-info">
          <div class="color-name">${ColorUtils.getColorName(hex)}</div>
          <div class="color-count">${info.count.toLocaleString()} pixels</div>
          ${defaultType === 'mina' ? `
            <input type="text" class="color-label-input" 
              placeholder="Label (e.g., MINA)" 
              value="${this.colorLabels.get(hex)}"
              data-color="${hex}">
          ` : ''}
        </div>
        <select class="color-type-select" data-color="${hex}">
          <option value="primary" ${this.colorTypes.get(hex) === 'primary' ? 'selected' : ''}>Primary</option>
          <option value="mina" ${this.colorTypes.get(hex) === 'mina' ? 'selected' : ''}>Mina</option>
          <option value="ignore" ${this.colorTypes.get(hex) === 'ignore' ? 'selected' : ''}>Ignore</option>
        </select>
      `;

      // Event listeners for type and label changes
      const select = item.querySelector('.color-type-select');
      select.addEventListener('change', (e) => {
        this.colorTypes.set(hex, e.target.value);
        this._regenerateOutput();
        // Toggle label input visibility
        this._setupColorPalette(this.detectedColors);
      });

      const labelInput = item.querySelector('.color-label-input');
      if (labelInput) {
        labelInput.addEventListener('input', (e) => {
          this.colorLabels.set(hex, e.target.value);
          this._regenerateOutput();
        });
      }

      this.colorListEl.appendChild(item);
    }
  }

  _generateOutput(designName, threadCount, boardCount) {
    if (!this.colorResults) return;

    // Filter out ignored colors
    const filteredResults = new Map();
    for (const [color, rows] of this.colorResults) {
      if (this.colorTypes.get(color) !== 'ignore') {
        filteredResults.set(color, rows);
      }
    }

    const text = OutputGenerator.generateText(
      designName, threadCount, boardCount,
      filteredResults, this.colorLabels, this.colorTypes
    );

    this.outputTextEl.textContent = text;
    this.outputTextEl.classList.remove('empty');

    // Enable export buttons
    document.getElementById('export-txt').disabled = false;
    document.getElementById('export-docx').disabled = false;
    document.getElementById('copy-output').disabled = false;
  }

  _regenerateOutput() {
    if (!this.colorResults) return;
    const designName = this.designNameInput.value || 'Design';
    const threadCount = parseInt(this.threadInput.value) || 100;
    const boardCount = parseInt(this.boardInput.value) || 50;
    this._generateOutput(designName, threadCount, boardCount);
  }

  _switchOutputTab(tab) {
    document.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.output-tab[data-tab="${tab}"]`)?.classList.add('active');

    const textView = document.getElementById('output-text-view');
    const gridView = document.getElementById('output-grid-view');

    if (tab === 'text') {
      textView.style.display = 'block';
      gridView.style.display = 'none';
    } else if (tab === 'grid') {
      textView.style.display = 'none';
      gridView.style.display = 'block';
      this._renderGridTable();
    }
  }

  _renderGridTable() {
    if (!this.gridData) return;
    const container = document.getElementById('output-grid-view');
    const threadCount = parseInt(this.threadInput.value) || 100;
    const boardCount = parseInt(this.boardInput.value) || 50;

    let html = '<table><thead><tr><th></th>';
    for (let c = 1; c <= threadCount; c++) {
      html += `<th>${c}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (let r = 0; r < boardCount; r++) {
      const displayRow = boardCount - r;
      html += `<tr><td>${displayRow}</td>`;
      for (let c = 0; c < threadCount; c++) {
        const color = this.gridData[r] ? this.gridData[r][c] : '#ffffff';
        if (color && color !== '#ffffff') {
          html += `<td class="cell-filled" style="background:${color}"></td>`;
        } else {
          html += `<td></td>`;
        }
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  _exportTXT() {
    const text = this.outputTextEl.textContent;
    if (!text) return;
    const name = this.designNameInput.value || 'output';
    OutputGenerator.downloadTXT(text, name);
    this._showToast('TXT file downloaded', 'success');
  }

  _exportDOCX() {
    const text = this.outputTextEl.textContent;
    if (!text) return;
    const name = this.designNameInput.value || 'output';
    OutputGenerator.downloadDOCX(text, name);
    this._showToast('DOCX file downloaded', 'success');
  }

  _copyOutput() {
    const text = this.outputTextEl.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this._showToast('Copied to clipboard', 'success');
    }).catch(() => {
      this._showToast('Copy failed', 'error');
    });
  }

  // ---- UI Helpers ----

  _showLoading(text) {
    this.loadingOverlay.classList.add('active');
    this.loadingText.textContent = text;
  }

  _setLoadingText(text) {
    this.loadingText.textContent = text;
  }

  _hideLoading() {
    this.loadingOverlay.classList.remove('active');
  }

  _updateStatus(text, state) {
    this.statusText.textContent = text;
    this.statusDot.className = 'status-dot ' + state;
  }

  _showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };

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


// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
