/**
 * Weaving Design Creator
 * Grid-based pattern designer for creating weaving designs from scratch.
 *
 * Features:
 * - Customizable W×H grid
 * - Drawing tools: Draw, Erase, Fill, Eyedropper, Line, Rectangle
 * - Mirror mode (horizontal/vertical symmetry)
 * - RGB color picker with textile presets
 * - AI Pattern Generator (procedural algorithms)
 * - BMP export
 * - Integration with Punch Calculator & BMP Converter
 */

class DesignCreator {
  constructor() {
    // Grid state
    this.gridWidth = 100;
    this.gridHeight = 50;
    this.gridData = null;       // 2D array [row][col] of hex color strings
    this.gridCreated = false;

    // History (undo/redo)
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 50;

    // Canvas/view state
    this.canvas = document.getElementById('designer-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.wrapper = document.getElementById('designer-canvas-wrapper');
    this.placeholder = document.getElementById('designer-placeholder');

    this.zoom = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.headerSize = 35;
    this.cellSize = 12;
    this.minCellSize = 4;
    this.maxCellSize = 40;

    // Drawing state
    this.currentTool = 'draw';
    this.currentColor = '#000000';
    this.isDrawing = false;
    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.hoverCell = null;

    // Line/Rect tool
    this.lineStart = null;
    this.rectStart = null;
    this.previewCells = [];

    // Mirror
    this.mirrorH = false;
    this.mirrorV = false;

    // Saved swatches
    this.savedSwatches = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8000'];

    // Canvas colors
    this.bgColor = '#1a1a2e';
    this.gridLineColor = 'rgba(255, 255, 255, 0.08)';
    this.gridLine10Color = 'rgba(255, 255, 255, 0.18)';
    this.headerBgColor = '#141428';
    this.headerTextColor = 'rgba(255, 255, 255, 0.5)';
    this.cellBorderColor = 'rgba(255, 255, 255, 0.03)';

    // DOM refs
    this.widthInput = document.getElementById('des-width');
    this.heightInput = document.getElementById('des-height');
    this.createGridBtn = document.getElementById('des-create-grid-btn');
    this.colorPicker = document.getElementById('des-color-picker');
    this.colorHexInput = document.getElementById('des-color-hex');
    this.colorRInput = document.getElementById('des-color-r');
    this.colorGInput = document.getElementById('des-color-g');
    this.colorBInput = document.getElementById('des-color-b');
    this.swatchContainer = document.getElementById('des-swatches');
    this.presetContainer = document.getElementById('des-presets');
    this.undoBtn = document.getElementById('des-undo-btn');
    this.redoBtn = document.getElementById('des-redo-btn');
    this.clearBtn = document.getElementById('des-clear-btn');
    this.exportBmpBtn = document.getElementById('des-export-bmp-btn');
    this.useCalcBtn = document.getElementById('des-use-calc-btn');
    this.gridInfoEl = document.getElementById('des-grid-info');

    // AI pattern refs
    this.aiPatternSelect = document.getElementById('des-ai-pattern');
    this.aiScaleInput = document.getElementById('des-ai-scale');
    this.aiScaleValue = document.getElementById('des-ai-scale-value');
    this.aiColor1 = document.getElementById('des-ai-color1');
    this.aiColor2 = document.getElementById('des-ai-color2');
    this.aiGenerateBtn = document.getElementById('des-ai-generate-btn');

    // Textile color presets
    this.textilePresets = [
      { name: 'Black',      hex: '#000000' },
      { name: 'White',      hex: '#ffffff' },
      { name: 'Red',        hex: '#ff0000' },
      { name: 'Green',      hex: '#00ff00' },
      { name: 'Blue',       hex: '#0000ff' },
      { name: 'Yellow',     hex: '#ffff00' },
      { name: 'Cyan',       hex: '#00ffff' },
      { name: 'Magenta',    hex: '#ff00ff' },
      { name: 'Orange',     hex: '#ff8000' },
      { name: 'Purple',     hex: '#800080' },
      { name: 'Dark Red',   hex: '#8b0000' },
      { name: 'Dark Green', hex: '#006400' },
      { name: 'Dark Blue',  hex: '#00008b' },
      { name: 'Brown',      hex: '#8b4513' },
      { name: 'Pink',       hex: '#ff69b4' },
      { name: 'Gray',       hex: '#808080' },
    ];

    this._bindEvents();
    this._renderPresets();
    this._renderSwatches();
    this._updateColorInputs(this.currentColor);
    this._updateHistoryButtons();
    this._resize();
  }

  // =============================================
  // EVENT BINDING
  // =============================================

  _bindEvents() {
    // Create grid
    this.createGridBtn.addEventListener('click', () => this._createGrid());

    // Tool buttons
    document.querySelectorAll('.des-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTool = btn.dataset.tool;
        document.querySelectorAll('.des-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.lineStart = null;
        this.rectStart = null;
        this.previewCells = [];
        this.render();
      });
    });

    // Mirror toggles
    document.getElementById('des-mirror-h')?.addEventListener('click', (e) => {
      this.mirrorH = !this.mirrorH;
      e.currentTarget.classList.toggle('active', this.mirrorH);
    });
    document.getElementById('des-mirror-v')?.addEventListener('click', (e) => {
      this.mirrorV = !this.mirrorV;
      e.currentTarget.classList.toggle('active', this.mirrorV);
    });

    // Color picker
    this.colorPicker.addEventListener('input', (e) => {
      this.currentColor = e.target.value;
      this._updateColorInputs(this.currentColor);
    });

    // Hex input
    this.colorHexInput.addEventListener('change', (e) => {
      let hex = e.target.value.trim();
      if (!hex.startsWith('#')) hex = '#' + hex;
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        this.currentColor = hex.toLowerCase();
        this.colorPicker.value = this.currentColor;
        this._updateColorInputs(this.currentColor);
      }
    });

    // RGB inputs
    [this.colorRInput, this.colorGInput, this.colorBInput].forEach(inp => {
      inp.addEventListener('change', () => {
        const r = Math.max(0, Math.min(255, parseInt(this.colorRInput.value) || 0));
        const g = Math.max(0, Math.min(255, parseInt(this.colorGInput.value) || 0));
        const b = Math.max(0, Math.min(255, parseInt(this.colorBInput.value) || 0));
        this.currentColor = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
        this.colorPicker.value = this.currentColor;
        this._updateColorInputs(this.currentColor);
      });
    });

    // Add to swatches
    document.getElementById('des-add-swatch')?.addEventListener('click', () => {
      if (!this.savedSwatches.includes(this.currentColor)) {
        this.savedSwatches.push(this.currentColor);
        this._renderSwatches();
      }
    });

    // Undo/Redo
    this.undoBtn.addEventListener('click', () => this.undo());
    this.redoBtn.addEventListener('click', () => this.redo());

    // Clear
    this.clearBtn.addEventListener('click', () => {
      if (!this.gridCreated) return;
      if (confirm('Clear the entire grid?')) {
        this._clearGrid();
      }
    });

    // Export BMP
    this.exportBmpBtn.addEventListener('click', () => this._exportBMP());

    // Use in Calculator
    this.useCalcBtn.addEventListener('click', () => this._useInCalculator());

    // AI generate
    this.aiGenerateBtn.addEventListener('click', () => this._generateAIPattern());
    this.aiScaleInput?.addEventListener('input', () => {
      if (this.aiScaleValue) this.aiScaleValue.textContent = this.aiScaleInput.value;
    });

    // Canvas zoom
    document.getElementById('des-zoom-in')?.addEventListener('click', () => this.zoomIn());
    document.getElementById('des-zoom-out')?.addEventListener('click', () => this.zoomOut());
    document.getElementById('des-zoom-reset')?.addEventListener('click', () => this.fitToView());

    // Canvas events
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this._onMouseLeave());
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch events
    this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', () => this._onTouchEnd());

    // Resize
    this.resizeObserver = new ResizeObserver(() => this._resize());
    this.resizeObserver.observe(this.wrapper);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only handle if designer panel is active
      const panel = document.getElementById('tool-designer');
      if (!panel || !panel.classList.contains('active')) return;

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        this.undo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        this.redo();
      } else if (e.key === 'd' || e.key === 'D') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
          this._setTool('draw');
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
          this._setTool('erase');
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
          this._setTool('fill');
        }
      } else if (e.key === 'i' || e.key === 'I') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
          this._setTool('eyedropper');
        }
      }
    });
  }

  _setTool(tool) {
    this.currentTool = tool;
    document.querySelectorAll('.des-tool-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    this.lineStart = null;
    this.rectStart = null;
    this.previewCells = [];
    this.render();
  }

  // =============================================
  // GRID MANAGEMENT
  // =============================================

  _createGrid() {
    const w = Math.max(1, Math.min(2000, parseInt(this.widthInput.value) || 100));
    const h = Math.max(1, Math.min(2000, parseInt(this.heightInput.value) || 50));
    this.widthInput.value = w;
    this.heightInput.value = h;

    this.gridWidth = w;
    this.gridHeight = h;
    this.gridData = [];

    for (let row = 0; row < h; row++) {
      this.gridData.push(new Array(w).fill('#ffffff'));
    }

    this.gridCreated = true;
    this.history = [];
    this.historyIndex = -1;
    this._saveHistory();
    this._updateHistoryButtons();

    // Update UI
    this.placeholder.classList.add('hidden');
    this.gridInfoEl.textContent = `${w} × ${h} grid`;
    this.exportBmpBtn.disabled = false;
    this.useCalcBtn.disabled = false;
    this.clearBtn.disabled = false;
    this.aiGenerateBtn.disabled = false;

    this.fitToView();
    this._showToast(`Created ${w}×${h} grid`, 'success');
  }

  _clearGrid() {
    if (!this.gridCreated) return;
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        this.gridData[row][col] = '#ffffff';
      }
    }
    this._saveHistory();
    this.render();
    this._showToast('Grid cleared', 'info');
  }

  // =============================================
  // HISTORY (UNDO/REDO)
  // =============================================

  _saveHistory() {
    // Trim any future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    // Deep copy the grid
    const snapshot = this.gridData.map(row => [...row]);
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
    this._updateHistoryButtons();
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.gridData = this.history[this.historyIndex].map(row => [...row]);
    this._updateHistoryButtons();
    this.render();
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.gridData = this.history[this.historyIndex].map(row => [...row]);
    this._updateHistoryButtons();
    this.render();
  }

  _updateHistoryButtons() {
    if (this.undoBtn) this.undoBtn.disabled = this.historyIndex <= 0;
    if (this.redoBtn) this.redoBtn.disabled = this.historyIndex >= this.history.length - 1;
  }

  // =============================================
  // CANVAS RENDERING
  // =============================================

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

  fitToView() {
    if (!this.canvasWidth || !this.canvasHeight || !this.gridCreated) return;

    const availW = this.canvasWidth - this.headerSize - 10;
    const availH = this.canvasHeight - this.headerSize - 10;

    const cellW = availW / this.gridWidth;
    const cellH = availH / this.gridHeight;
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

  render() {
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    if (!w || !h) return;

    // Clear
    ctx.fillStyle = this.bgColor;
    ctx.fillRect(0, 0, w, h);

    if (!this.gridCreated || !this.gridData) {
      return;
    }

    const s = this.cellSize * this.zoom;
    const startX = this.headerSize + this.offsetX;
    const startY = this.headerSize + this.offsetY;

    // Visible range
    const colStart = Math.max(0, Math.floor(-this.offsetX / s));
    const colEnd = Math.min(this.gridWidth, Math.ceil((w - this.headerSize - this.offsetX) / s));
    const rowStart = Math.max(0, Math.floor(-this.offsetY / s));
    const rowEnd = Math.min(this.gridHeight, Math.ceil((h - this.headerSize - this.offsetY) / s));

    // Draw cells
    for (let row = rowStart; row < rowEnd; row++) {
      for (let col = colStart; col < colEnd; col++) {
        const x = startX + col * s;
        const y = startY + row * s;
        if (x + s < 0 || x > w || y + s < 0 || y > h) continue;

        const color = this.gridData[row][col];
        if (color && color !== '#ffffff') {
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

    // Preview cells (for line/rect tool)
    if (this.previewCells.length > 0) {
      ctx.fillStyle = this.currentColor + '88'; // Semi-transparent
      for (const { col, row } of this.previewCells) {
        const x = startX + col * s;
        const y = startY + row * s;
        ctx.fillRect(x, y, s, s);
      }
    }

    // Major grid lines (every 10)
    ctx.strokeStyle = this.gridLine10Color;
    ctx.lineWidth = 1;
    for (let col = 0; col <= this.gridWidth; col += 10) {
      const x = startX + col * s;
      if (x >= this.headerSize && x <= w) {
        ctx.beginPath();
        ctx.moveTo(x, this.headerSize);
        ctx.lineTo(x, Math.min(h, startY + this.gridHeight * s));
        ctx.stroke();
      }
    }
    for (let row = 0; row <= this.gridHeight; row += 10) {
      const y = startY + row * s;
      if (y >= this.headerSize && y <= h) {
        ctx.beginPath();
        ctx.moveTo(this.headerSize, y);
        ctx.lineTo(Math.min(w, startX + this.gridWidth * s), y);
        ctx.stroke();
      }
    }

    // Headers background
    ctx.fillStyle = this.headerBgColor;
    ctx.fillRect(0, 0, w, this.headerSize);
    ctx.fillRect(0, 0, this.headerSize, h);

    // Column numbers
    ctx.fillStyle = this.headerTextColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.max(7, Math.min(11, s * 0.7));
    ctx.font = `500 ${fontSize}px 'Inter', sans-serif`;
    const labelStep = s > 15 ? 5 : (s > 8 ? 10 : 20);

    for (let col = 0; col < this.gridWidth; col++) {
      if ((col + 1) % labelStep !== 0 && col !== 0) continue;
      const x = startX + col * s + s / 2;
      if (x >= this.headerSize && x <= w) {
        ctx.fillText(String(col + 1), x, this.headerSize / 2);
      }
    }

    // Row numbers (bottom-to-top)
    ctx.textAlign = 'right';
    for (let row = 0; row < this.gridHeight; row++) {
      if ((row + 1) % labelStep !== 0 && row !== 0) continue;
      const y = startY + row * s + s / 2;
      const displayRow = this.gridHeight - row;
      if (y >= this.headerSize && y <= h) {
        ctx.fillText(String(displayRow), this.headerSize - 5, y);
      }
    }

    // Hover highlight
    if (this.hoverCell) {
      const hx = startX + this.hoverCell.col * s;
      const hy = startY + this.hoverCell.row * s;

      // Highlight main cell
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx, hy, s, s);

      // Show mirror cells
      if (this.mirrorH || this.mirrorV) {
        const mirrors = this._getMirrorCells(this.hoverCell.col, this.hoverCell.row);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        for (const m of mirrors) {
          const mx = startX + m.col * s;
          const my = startY + m.row * s;
          ctx.strokeRect(mx, my, s, s);
        }
        ctx.setLineDash([]);
      }

      // Tooltip
      const displayRow = this.gridHeight - this.hoverCell.row;
      const displayCol = this.hoverCell.col + 1;
      const cellColor = this.gridData[this.hoverCell.row]?.[this.hoverCell.col] || '#ffffff';
      const tooltip = `Row: ${displayRow}, Col: ${displayCol} [${cellColor}]`;
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

    // Outer border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY, this.gridWidth * s, this.gridHeight * s);
  }

  // =============================================
  // MOUSE / TOUCH EVENTS
  // =============================================

  _screenToCell(screenX, screenY) {
    const s = this.cellSize * this.zoom;
    const startX = this.headerSize + this.offsetX;
    const startY = this.headerSize + this.offsetY;
    const col = Math.floor((screenX - startX) / s);
    const row = Math.floor((screenY - startY) / s);
    if (col >= 0 && col < this.gridWidth && row >= 0 && row < this.gridHeight) {
      return { col, row };
    }
    return null;
  }

  _onMouseDown(e) {
    if (!this.gridCreated) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Middle click or right click = pan
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    const cell = this._screenToCell(mx, my);
    if (!cell) {
      // Click outside grid = pan
      this.isPanning = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    this.isDrawing = true;

    switch (this.currentTool) {
      case 'draw':
        this._paintCell(cell.col, cell.row, this.currentColor);
        break;
      case 'erase':
        this._paintCell(cell.col, cell.row, '#ffffff');
        break;
      case 'fill':
        this._floodFill(cell.col, cell.row, this.currentColor);
        this._saveHistory();
        break;
      case 'eyedropper':
        this._pickColor(cell.col, cell.row);
        break;
      case 'line':
        if (!this.lineStart) {
          this.lineStart = cell;
        } else {
          this._drawLine(this.lineStart.col, this.lineStart.row, cell.col, cell.row, this.currentColor);
          this.lineStart = null;
          this.previewCells = [];
          this._saveHistory();
        }
        break;
      case 'rect':
        if (!this.rectStart) {
          this.rectStart = cell;
        } else {
          this._drawRect(this.rectStart.col, this.rectStart.row, cell.col, cell.row, this.currentColor);
          this.rectStart = null;
          this.previewCells = [];
          this._saveHistory();
        }
        break;
    }
    this.render();
  }

  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (this.isPanning) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.render();
      return;
    }

    const cell = this._screenToCell(mx, my);

    // Update cursor
    if (cell) {
      switch (this.currentTool) {
        case 'draw': case 'erase': this.canvas.style.cursor = 'crosshair'; break;
        case 'fill': this.canvas.style.cursor = 'cell'; break;
        case 'eyedropper': this.canvas.style.cursor = 'copy'; break;
        case 'line': case 'rect': this.canvas.style.cursor = 'crosshair'; break;
        default: this.canvas.style.cursor = 'crosshair';
      }
    } else {
      this.canvas.style.cursor = 'grab';
    }

    if (this.isDrawing && cell) {
      if (this.currentTool === 'draw') {
        this._paintCell(cell.col, cell.row, this.currentColor);
      } else if (this.currentTool === 'erase') {
        this._paintCell(cell.col, cell.row, '#ffffff');
      }
    }

    // Preview for line/rect
    if (cell) {
      if (this.currentTool === 'line' && this.lineStart) {
        this.previewCells = this._getLineCells(this.lineStart.col, this.lineStart.row, cell.col, cell.row);
      } else if (this.currentTool === 'rect' && this.rectStart) {
        this.previewCells = this._getRectCells(this.rectStart.col, this.rectStart.row, cell.col, cell.row);
      }
    }

    // Hover
    if (cell && (!this.hoverCell || cell.col !== this.hoverCell.col || cell.row !== this.hoverCell.row)) {
      this.hoverCell = cell;
      this.render();
    } else if (!cell && this.hoverCell) {
      this.hoverCell = null;
      this.render();
    } else if (this.previewCells.length > 0) {
      this.render();
    }
  }

  _onMouseUp(e) {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = 'crosshair';
      return;
    }
    if (this.isDrawing) {
      this.isDrawing = false;
      if (this.currentTool === 'draw' || this.currentTool === 'erase') {
        this._saveHistory();
      }
    }
  }

  _onMouseLeave() {
    this.isDrawing = false;
    this.isPanning = false;
    this.hoverCell = null;
    this.canvas.style.cursor = 'crosshair';
    this.render();
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.2, Math.min(5, this.zoom * factor));

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
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;
      const cell = this._screenToCell(mx, my);

      if (cell && (this.currentTool === 'draw' || this.currentTool === 'erase')) {
        this.isDrawing = true;
        const color = this.currentTool === 'erase' ? '#ffffff' : this.currentColor;
        this._paintCell(cell.col, cell.row, color);
        this.render();
      } else {
        this.isPanning = true;
        this.lastMouseX = touch.clientX;
        this.lastMouseY = touch.clientY;
      }
    }
  }

  _onTouchMove(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];

      if (this.isPanning) {
        const dx = touch.clientX - this.lastMouseX;
        const dy = touch.clientY - this.lastMouseY;
        this.offsetX += dx;
        this.offsetY += dy;
        this.lastMouseX = touch.clientX;
        this.lastMouseY = touch.clientY;
        this.render();
      } else if (this.isDrawing) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = touch.clientX - rect.left;
        const my = touch.clientY - rect.top;
        const cell = this._screenToCell(mx, my);
        if (cell) {
          const color = this.currentTool === 'erase' ? '#ffffff' : this.currentColor;
          this._paintCell(cell.col, cell.row, color);
          this.render();
        }
      }
    }
  }

  _onTouchEnd() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this._saveHistory();
    }
    this.isPanning = false;
  }

  // =============================================
  // DRAWING TOOLS
  // =============================================

  _paintCell(col, row, color) {
    if (!this.gridData || row < 0 || row >= this.gridHeight || col < 0 || col >= this.gridWidth) return;
    this.gridData[row][col] = color;

    // Mirror
    const mirrors = this._getMirrorCells(col, row);
    for (const m of mirrors) {
      this.gridData[m.row][m.col] = color;
    }
  }

  _getMirrorCells(col, row) {
    const cells = [];
    if (this.mirrorH) {
      const mCol = this.gridWidth - 1 - col;
      if (mCol !== col) cells.push({ col: mCol, row });
    }
    if (this.mirrorV) {
      const mRow = this.gridHeight - 1 - row;
      if (mRow !== row) cells.push({ col, row: mRow });
    }
    if (this.mirrorH && this.mirrorV) {
      const mCol = this.gridWidth - 1 - col;
      const mRow = this.gridHeight - 1 - row;
      if (mCol !== col || mRow !== row) cells.push({ col: mCol, row: mRow });
    }
    return cells;
  }

  _floodFill(col, row, newColor) {
    if (!this.gridData) return;
    const targetColor = this.gridData[row][col];
    if (targetColor === newColor) return;

    const stack = [{ col, row }];
    const visited = new Set();

    while (stack.length > 0) {
      const { col: c, row: r } = stack.pop();
      const key = `${c},${r}`;
      if (visited.has(key)) continue;
      if (c < 0 || c >= this.gridWidth || r < 0 || r >= this.gridHeight) continue;
      if (this.gridData[r][c] !== targetColor) continue;

      visited.add(key);
      this.gridData[r][c] = newColor;

      // Mirror
      const mirrors = this._getMirrorCells(c, r);
      for (const m of mirrors) {
        this.gridData[m.row][m.col] = newColor;
      }

      stack.push({ col: c + 1, row: r });
      stack.push({ col: c - 1, row: r });
      stack.push({ col: c, row: r + 1 });
      stack.push({ col: c, row: r - 1 });
    }
    this.render();
  }

  _pickColor(col, row) {
    if (!this.gridData) return;
    const color = this.gridData[row][col];
    this.currentColor = color === '#ffffff' ? '#000000' : color;
    this.colorPicker.value = this.currentColor;
    this._updateColorInputs(this.currentColor);
    this._setTool('draw');
    this._showToast(`Picked color: ${this.currentColor}`, 'info');
  }

  _getLineCells(x0, y0, x1, y1) {
    // Bresenham's line algorithm
    const cells = [];
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0, y = y0;
    while (true) {
      cells.push({ col: x, row: y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return cells;
  }

  _drawLine(x0, y0, x1, y1, color) {
    const cells = this._getLineCells(x0, y0, x1, y1);
    for (const { col, row } of cells) {
      this._paintCell(col, row, color);
    }
    this.render();
  }

  _getRectCells(x0, y0, x1, y1) {
    const cells = [];
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Only border cells
        if (y === minY || y === maxY || x === minX || x === maxX) {
          cells.push({ col: x, row: y });
        }
      }
    }
    return cells;
  }

  _drawRect(x0, y0, x1, y1, color) {
    const cells = this._getRectCells(x0, y0, x1, y1);
    for (const { col, row } of cells) {
      this._paintCell(col, row, color);
    }
    this.render();
  }

  // =============================================
  // COLOR SYSTEM
  // =============================================

  _updateColorInputs(hex) {
    this.colorPicker.value = hex;
    this.colorHexInput.value = hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    this.colorRInput.value = r;
    this.colorGInput.value = g;
    this.colorBInput.value = b;

    // Update the color preview swatch
    const preview = document.getElementById('des-color-preview');
    if (preview) preview.style.background = hex;
  }

  _renderPresets() {
    if (!this.presetContainer) return;
    this.presetContainer.innerHTML = '';
    for (const preset of this.textilePresets) {
      const swatch = document.createElement('div');
      swatch.className = 'des-preset-swatch';
      swatch.style.background = preset.hex;
      swatch.title = preset.name;
      swatch.addEventListener('click', () => {
        this.currentColor = preset.hex;
        this._updateColorInputs(preset.hex);
      });
      this.presetContainer.appendChild(swatch);
    }
  }

  _renderSwatches() {
    if (!this.swatchContainer) return;
    this.swatchContainer.innerHTML = '';
    for (const hex of this.savedSwatches) {
      const swatch = document.createElement('div');
      swatch.className = 'des-swatch';
      swatch.style.background = hex;
      swatch.title = hex;
      swatch.addEventListener('click', () => {
        this.currentColor = hex;
        this._updateColorInputs(hex);
      });
      swatch.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.savedSwatches = this.savedSwatches.filter(s => s !== hex);
        this._renderSwatches();
      });
      this.swatchContainer.appendChild(swatch);
    }
  }

  // =============================================
  // AI PATTERN GENERATOR
  // =============================================

  _generateAIPattern() {
    if (!this.gridCreated) {
      this._showToast('Create a grid first', 'error');
      return;
    }

    const pattern = this.aiPatternSelect.value;
    const scale = parseInt(this.aiScaleInput.value) || 4;
    const color1 = this.aiColor1.value;
    const color2 = this.aiColor2.value;

    switch (pattern) {
      case 'twill':        this._patternTwill(scale, color1, color2); break;
      case 'satin':        this._patternSatin(scale, color1, color2); break;
      case 'diamond':      this._patternDiamond(scale, color1, color2); break;
      case 'herringbone':  this._patternHerringbone(scale, color1, color2); break;
      case 'chevron':      this._patternChevron(scale, color1, color2); break;
      case 'checkerboard': this._patternCheckerboard(scale, color1, color2); break;
      case 'stripes-h':    this._patternStripes(scale, color1, color2, 'h'); break;
      case 'stripes-v':    this._patternStripes(scale, color1, color2, 'v'); break;
      case 'stripes-d':    this._patternStripes(scale, color1, color2, 'd'); break;
      case 'zigzag':       this._patternZigzag(scale, color1, color2); break;
      case 'basket':       this._patternBasket(scale, color1, color2); break;
      case 'random':       this._patternRandom(scale, color1, color2); break;
      default:             this._patternTwill(scale, color1, color2);
    }

    this._saveHistory();
    this.render();
    this._showToast(`Generated ${pattern} pattern`, 'success');
  }

  _patternTwill(scale, c1, c2) {
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const pos = (c + r) % (scale * 2);
        this.gridData[r][c] = pos < scale ? c1 : c2;
      }
    }
  }

  _patternSatin(scale, c1, c2) {
    const step = Math.max(2, scale);
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const shifted = (c + r * Math.floor(step / 2)) % step;
        this.gridData[r][c] = shifted === 0 ? c1 : c2;
      }
    }
  }

  _patternDiamond(scale, c1, c2) {
    const period = scale * 2;
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const cx = c % period;
        const cy = r % period;
        const dx = Math.min(cx, period - cx);
        const dy = Math.min(cy, period - cy);
        this.gridData[r][c] = (dx + dy) < scale ? c1 : c2;
      }
    }
  }

  _patternHerringbone(scale, c1, c2) {
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const block = Math.floor(r / scale) % 2;
        let pos;
        if (block === 0) {
          pos = (c + r) % (scale * 2);
        } else {
          pos = (c - r + scale * 4) % (scale * 2);
        }
        this.gridData[r][c] = pos < scale ? c1 : c2;
      }
    }
  }

  _patternChevron(scale, c1, c2) {
    const period = scale * 2;
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const cx = c % period;
        const dy = cx < scale ? cx : period - cx;
        const pos = (r + dy) % period;
        this.gridData[r][c] = pos < scale ? c1 : c2;
      }
    }
  }

  _patternCheckerboard(scale, c1, c2) {
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const bx = Math.floor(c / scale) % 2;
        const by = Math.floor(r / scale) % 2;
        this.gridData[r][c] = (bx + by) % 2 === 0 ? c1 : c2;
      }
    }
  }

  _patternStripes(scale, c1, c2, dir) {
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        let pos;
        if (dir === 'h') pos = r % (scale * 2);
        else if (dir === 'v') pos = c % (scale * 2);
        else pos = (c + r) % (scale * 2);
        this.gridData[r][c] = pos < scale ? c1 : c2;
      }
    }
  }

  _patternZigzag(scale, c1, c2) {
    const period = scale * 2;
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const rr = r % period;
        const offset = rr < scale ? rr : period - rr;
        const pos = (c + offset) % period;
        this.gridData[r][c] = pos < scale ? c1 : c2;
      }
    }
  }

  _patternBasket(scale, c1, c2) {
    const period = scale * 2;
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const bx = Math.floor(c / scale) % 2;
        const by = Math.floor(r / scale) % 2;
        const inner = (bx + by) % 2 === 0;
        if (inner) {
          this.gridData[r][c] = (c % scale < Math.floor(scale / 2)) ? c1 : c2;
        } else {
          this.gridData[r][c] = (r % scale < Math.floor(scale / 2)) ? c1 : c2;
        }
      }
    }
  }

  _patternRandom(scale, c1, c2) {
    // Random geometric — combine random shapes
    // Start with background
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        this.gridData[r][c] = c2;
      }
    }

    const shapes = Math.floor(Math.random() * 15) + 10;
    for (let i = 0; i < shapes; i++) {
      const type = Math.floor(Math.random() * 4);
      const cx = Math.floor(Math.random() * this.gridWidth);
      const cy = Math.floor(Math.random() * this.gridHeight);
      const size = Math.floor(Math.random() * scale * 3) + scale;

      if (type === 0) {
        // Rectangle
        for (let r = cy; r < Math.min(cy + size, this.gridHeight); r++) {
          for (let c = cx; c < Math.min(cx + size, this.gridWidth); c++) {
            this.gridData[r][c] = c1;
          }
        }
      } else if (type === 1) {
        // Diamond
        for (let r = -size; r <= size; r++) {
          for (let c = -size; c <= size; c++) {
            if (Math.abs(r) + Math.abs(c) <= size) {
              const rr = cy + r;
              const cc = cx + c;
              if (rr >= 0 && rr < this.gridHeight && cc >= 0 && cc < this.gridWidth) {
                this.gridData[rr][cc] = c1;
              }
            }
          }
        }
      } else if (type === 2) {
        // Horizontal line
        const r = cy;
        if (r >= 0 && r < this.gridHeight) {
          for (let c = cx; c < Math.min(cx + size * 2, this.gridWidth); c++) {
            this.gridData[r][c] = c1;
          }
        }
      } else {
        // Cross
        for (let d = -size; d <= size; d++) {
          const rr = cy + d;
          const cc = cx + d;
          if (rr >= 0 && rr < this.gridHeight && cx >= 0 && cx < this.gridWidth) {
            this.gridData[rr][cx] = c1;
          }
          if (cy >= 0 && cy < this.gridHeight && cc >= 0 && cc < this.gridWidth) {
            this.gridData[cy][cc] = c1;
          }
        }
      }
    }
  }

  // =============================================
  // BMP EXPORT
  // =============================================

  _exportBMP() {
    if (!this.gridCreated || !this.gridData) {
      this._showToast('Create a grid first', 'error');
      return;
    }

    // Check if grid has any non-white content
    let hasContent = false;
    for (let r = 0; r < this.gridHeight && !hasContent; r++) {
      for (let c = 0; c < this.gridWidth && !hasContent; c++) {
        if (this.gridData[r][c] !== '#ffffff') hasContent = true;
      }
    }
    if (!hasContent) {
      this._showToast('Grid is empty — draw something first', 'error');
      return;
    }

    // Convert grid to pixel array
    const pixels = new Uint8ClampedArray(this.gridWidth * this.gridHeight * 4);
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const idx = (r * this.gridWidth + c) * 4;
        const hex = this.gridData[r][c];
        const rgb = this._hexToRgb(hex);
        pixels[idx]     = rgb.r;
        pixels[idx + 1] = rgb.g;
        pixels[idx + 2] = rgb.b;
        pixels[idx + 3] = 255;
      }
    }

    const blob = this._generateBMP(pixels, this.gridWidth, this.gridHeight);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weaving_design_${this.gridWidth}x${this.gridHeight}.bmp`;
    a.click();
    URL.revokeObjectURL(url);

    this._showToast(`Exported ${this.gridWidth}×${this.gridHeight} BMP`, 'success');
  }

  /**
   * Generate a 24-bit uncompressed BMP (same approach as converter.js)
   */
  _generateBMP(pixels, width, height) {
    const rowSize = Math.ceil((width * 3) / 4) * 4;
    const pixelDataSize = rowSize * height;
    const fileSize = 54 + pixelDataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // BMP File Header (14 bytes)
    view.setUint8(0, 0x42);  // 'B'
    view.setUint8(1, 0x4D);  // 'M'
    view.setUint32(2, fileSize, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint32(10, 54, true);

    // BMP Info Header (40 bytes)
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, height, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(30, 0, true);
    view.setUint32(34, pixelDataSize, true);
    view.setInt32(38, 2835, true);
    view.setInt32(42, 2835, true);
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);

    // Pixel Data (bottom-to-top, BGR)
    const data = new Uint8Array(buffer);
    for (let y = 0; y < height; y++) {
      const bmpRow = height - 1 - y;
      const rowOffset = 54 + bmpRow * rowSize;
      for (let x = 0; x < width; x++) {
        const srcIdx = (y * width + x) * 4;
        const dstIdx = rowOffset + x * 3;
        data[dstIdx]     = pixels[srcIdx + 2]; // B
        data[dstIdx + 1] = pixels[srcIdx + 1]; // G
        data[dstIdx + 2] = pixels[srcIdx];     // R
      }
    }

    return new Blob([buffer], { type: 'image/bmp' });
  }

  // =============================================
  // INTEGRATION
  // =============================================

  _useInCalculator() {
    if (!this.gridCreated || !this.gridData) return;

    // Convert to pixel array
    const pixels = new Uint8ClampedArray(this.gridWidth * this.gridHeight * 4);
    for (let r = 0; r < this.gridHeight; r++) {
      for (let c = 0; c < this.gridWidth; c++) {
        const idx = (r * this.gridWidth + c) * 4;
        const hex = this.gridData[r][c];
        const rgb = this._hexToRgb(hex);
        pixels[idx]     = rgb.r;
        pixels[idx + 1] = rgb.g;
        pixels[idx + 2] = rgb.b;
        pixels[idx + 3] = 255;
      }
    }

    const blob = this._generateBMP(pixels, this.gridWidth, this.gridHeight);
    const bmpFile = new File([blob], `weaving_design.bmp`, { type: 'image/bmp' });

    // Switch to calculator tab
    document.querySelector('.app-tab[data-tool="calculator"]').click();

    // Feed into calculator
    if (window.app) {
      document.getElementById('thread-count').value = this.gridWidth;
      document.getElementById('board-count').value = this.gridHeight;
      if (!document.getElementById('design-name').value) {
        document.getElementById('design-name').value = 'Custom Design';
      }
      window.app._handleFile(bmpFile);
      this._showToast('Design sent to Punch Calculator — click "Process Design"', 'success');
    }
  }

  // =============================================
  // UTILITIES
  // =============================================

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return { r, g, b };
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.designCreator = new DesignCreator();
});
