/**
 * Grid Renderer Module
 * Canvas-based grid preview with zoom, pan, and cell highlighting
 */

class GridRenderer {
  constructor(canvasElement, wrapperElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.wrapper = wrapperElement;

    // Grid data
    this.gridData = null; // 2D array of color values
    this.threadCount = 100;
    this.boardCount = 50;

    // View state
    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Sizing
    this.cellSize = 12;
    this.headerSize = 35;
    this.minCellSize = 4;
    this.maxCellSize = 40;

    // Colors
    this.bgColor = '#1a1a2e';
    this.gridLineColor = 'rgba(255, 255, 255, 0.08)';
    this.gridLine10Color = 'rgba(255, 255, 255, 0.18)';
    this.headerBgColor = '#141428';
    this.headerTextColor = 'rgba(255, 255, 255, 0.5)';
    this.cellBorderColor = 'rgba(255, 255, 255, 0.03)';

    // Hover
    this.hoverCell = null;

    this._initEvents();
    this._resize();
  }

  _initEvents() {
    // Resize observer
    this.resizeObserver = new ResizeObserver(() => this._resize());
    this.resizeObserver.observe(this.wrapper);

    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this._onMouseUp());
    this.canvas.addEventListener('mouseleave', () => this._onMouseLeave());
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', () => this._onMouseUp());
  }

  _resize() {
    const rect = this.wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(dpr, dpr);

    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;

    this.render();
  }

  setGridData(data, threadCount, boardCount) {
    this.gridData = data;
    this.threadCount = threadCount;
    this.boardCount = boardCount;
    this.fitToView();
  }

  fitToView() {
    if (!this.canvasWidth || !this.canvasHeight) return;

    const availW = this.canvasWidth - this.headerSize - 10;
    const availH = this.canvasHeight - this.headerSize - 10;

    const cellW = availW / this.threadCount;
    const cellH = availH / this.boardCount;
    this.cellSize = Math.max(this.minCellSize, Math.min(cellW, cellH, this.maxCellSize));

    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.render();
  }

  zoomIn() {
    this.zoom = Math.min(5, this.zoom * 1.3);
    this.render();
  }

  zoomOut() {
    this.zoom = Math.max(0.2, this.zoom / 1.3);
    this.render();
  }

  resetView() {
    this.fitToView();
  }

  _onMouseDown(e) {
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.canvas.style.cursor = 'grabbing';
  }

  _onMouseMove(e) {
    if (this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.render();
    } else {
      // Hover detection
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cell = this._screenToCell(mx, my);
      if (cell && (!this.hoverCell || cell.col !== this.hoverCell.col || cell.row !== this.hoverCell.row)) {
        this.hoverCell = cell;
        this.render();
      } else if (!cell && this.hoverCell) {
        this.hoverCell = null;
        this.render();
      }
    }
  }

  _onMouseUp() {
    this.isDragging = false;
    this.canvas.style.cursor = 'crosshair';
  }

  _onMouseLeave() {
    this.isDragging = false;
    this.hoverCell = null;
    this.canvas.style.cursor = 'crosshair';
    this.render();
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.2, Math.min(5, this.zoom * factor));

    // Zoom towards mouse
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    this.offsetX = mx - (mx - this.offsetX) * (this.zoom / oldZoom);
    this.offsetY = my - (my - this.offsetY) * (this.zoom / oldZoom);

    this.render();
  }

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      this.isDragging = true;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
    }
  }

  _onTouchMove(e) {
    if (e.touches.length === 1 && this.isDragging) {
      e.preventDefault();
      const dx = e.touches[0].clientX - this.lastMouseX;
      const dy = e.touches[0].clientY - this.lastMouseY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastMouseX = e.touches[0].clientX;
      this.lastMouseY = e.touches[0].clientY;
      this.render();
    }
  }

  _screenToCell(screenX, screenY) {
    const s = this.cellSize * this.zoom;
    const startX = this.headerSize + this.offsetX;
    const startY = this.headerSize + this.offsetY;

    const col = Math.floor((screenX - startX) / s);
    const row = Math.floor((screenY - startY) / s);

    if (col >= 0 && col < this.threadCount && row >= 0 && row < this.boardCount) {
      return { col, row };
    }
    return null;
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    if (!w || !h) return;

    // Clear
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, w, h);

    if (!this.gridData) {
      this._drawPlaceholder();
      return;
    }

    const s = this.cellSize * this.zoom;
    const startX = this.headerSize + this.offsetX;
    const startY = this.headerSize + this.offsetY;

    // Determine visible range
    const colStart = Math.max(0, Math.floor(-this.offsetX / s));
    const colEnd = Math.min(this.threadCount, Math.ceil((w - this.headerSize - this.offsetX) / s));
    const rowStart = Math.max(0, Math.floor(-this.offsetY / s));
    const rowEnd = Math.min(this.boardCount, Math.ceil((h - this.headerSize - this.offsetY) / s));

    // Draw cells
    for (let row = rowStart; row < rowEnd; row++) {
      for (let col = colStart; col < colEnd; col++) {
        const x = startX + col * s;
        const y = startY + row * s;

        if (x + s < 0 || x > w || y + s < 0 || y > h) continue;

        const color = this.gridData[row] ? this.gridData[row][col] : null;

        if (color && color !== '#ffffff' && color !== '#fefefe' && color !== 'bg') {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, s, s);
        }

        // Cell border
        if (s > 6) {
          ctx.strokeStyle = this.cellBorderColor;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, s, s);
        }
      }
    }

    // Draw major grid lines (every 10)
    ctx.strokeStyle = this.gridLine10Color;
    ctx.lineWidth = 1;
    for (let col = 0; col <= this.threadCount; col += 10) {
      const x = startX + col * s;
      if (x >= this.headerSize && x <= w) {
        ctx.beginPath();
        ctx.moveTo(x, this.headerSize);
        ctx.lineTo(x, Math.min(h, startY + this.boardCount * s));
        ctx.stroke();
      }
    }
    for (let row = 0; row <= this.boardCount; row += 10) {
      const y = startY + row * s;
      if (y >= this.headerSize && y <= h) {
        ctx.beginPath();
        ctx.moveTo(this.headerSize, y);
        ctx.lineTo(Math.min(w, startX + this.threadCount * s), y);
        ctx.stroke();
      }
    }

    // Draw headers background
    ctx.fillStyle = this.headerBgColor;
    ctx.fillRect(0, 0, w, this.headerSize);
    ctx.fillRect(0, 0, this.headerSize, h);

    // Draw column numbers (x-axis = thread positions, 1-indexed)
    ctx.fillStyle = this.headerTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fontSize = Math.max(7, Math.min(11, s * 0.7));
    ctx.font = `500 ${fontSize}px 'Inter', sans-serif`;

    const labelStep = s > 15 ? 5 : (s > 8 ? 10 : 20);

    for (let col = 0; col < this.threadCount; col++) {
      if ((col + 1) % labelStep !== 0 && col !== 0) continue;
      const x = startX + col * s + s / 2;
      if (x >= this.headerSize && x <= w) {
        ctx.fillText(String(col + 1), x, this.headerSize / 2);
      }
    }

    // Draw row numbers (y-axis = board positions, numbered bottom-to-top)
    ctx.textAlign = 'right';
    for (let row = 0; row < this.boardCount; row++) {
      if ((row + 1) % labelStep !== 0 && row !== 0) continue;
      const y = startY + row * s + s / 2;
      const displayRow = this.boardCount - row; // Bottom-to-top numbering
      if (y >= this.headerSize && y <= h) {
        ctx.fillText(String(displayRow), this.headerSize - 5, y);
      }
    }

    // Draw hover highlight
    if (this.hoverCell) {
      const hx = startX + this.hoverCell.col * s;
      const hy = startY + this.hoverCell.row * s;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx, hy, s, s);

      // Tooltip
      const displayRow = this.boardCount - this.hoverCell.row;
      const displayCol = this.hoverCell.col + 1;
      const tooltip = `Row: ${displayRow}, Col: ${displayCol}`;
      ctx.font = '500 11px Inter, sans-serif';
      const tw = ctx.measureText(tooltip).width + 12;
      let tx = hx + s + 5;
      let ty = hy - 5;
      if (tx + tw > w) tx = hx - tw - 5;
      if (ty < this.headerSize + 5) ty = hy + s + 5;

      ctx.fillStyle = 'rgba(10, 14, 26, 0.9)';
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, 24, 4);
      ctx.fill();
      ctx.fillStyle = '#f0f4ff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tooltip, tx + 6, ty + 12);
    }

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY, this.threadCount * s, this.boardCount * s);
  }

  _drawPlaceholder() {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '400 14px Inter, sans-serif';
    ctx.fillText('Upload a design image to preview the grid', w / 2, h / 2);
  }

  destroy() {
    this.resizeObserver.disconnect();
  }
}

// Export for module or global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GridRenderer;
}
