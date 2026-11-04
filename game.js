/**
 * Blockfall - Main Game Engine
 * Strictly adheres to blockfall-gameplay-srs.md and blockfall-design-spec.md
 */

(() => {
  'use strict';

  // --- Constants & Shape Definitions ---
  const GRID_SIZE = 8;
  const GAP_SIZE = 3;
  const STORAGE_KEY_BEST = 'blockfall_best_score';
  const STORAGE_KEY_HIGHLIGHT = 'blockfall_highlight_clears';
  const STORAGE_KEY_SOUND = 'blockfall_sound_enabled';

  const BLOCK_COLORS = [
    { varName: 'var(--block-1)', rawOklch: 'oklch(0.72 0.19 25)' },  // coral
    { varName: 'var(--block-2)', rawOklch: 'oklch(0.82 0.17 75)' },  // amber
    { varName: 'var(--block-3)', rawOklch: 'oklch(0.78 0.20 145)' }, // lime
    { varName: 'var(--block-4)', rawOklch: 'oklch(0.72 0.15 230)' }, // sky
    { varName: 'var(--block-5)', rawOklch: 'oklch(0.70 0.20 340)' }, // pink
    { varName: 'var(--block-6)', rawOklch: 'oklch(0.80 0.14 190)' }  // teal
  ];

  // 13 discrete shape matrices with Rebalanced Spawning Weights:
  // L-shapes lowered to weight 1 (curbing over-occurrence)
  // Small blocks (1-4 cells): weight 1
  // Medium blocks (T, Z): weight 2
  // Large blocks (Rect 2x3, 3x2, Square 3x3): weight 3
  const SHAPE_DEFINITIONS = [
    // 1: Dot 1x1 (1 cell - small)
    { name: '1x1', matrix: [[1]], weight: 1 },
    // 2: Square 2x2 (4 cells - small)
    { name: '2x2', matrix: [[1, 1], [1, 1]], weight: 1 },
    // 3: Square 3x3 (9 cells - large)
    { name: '3x3', matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], weight: 3 },
    // 4: Horizontal Line 1x4 (4 cells - small)
    { name: '1x4', matrix: [[1, 1, 1, 1]], weight: 1 },
    // 5: Vertical Line 4x1 (4 cells - small)
    { name: '4x1', matrix: [[1], [1], [1], [1]], weight: 1 },
    // 6: Rectangle 2x3 (6 cells - large)
    { name: '2x3', matrix: [[1, 1, 1], [1, 1, 1]], weight: 3 },
    // 7: Rectangle 3x2 (6 cells - large)
    { name: '3x2', matrix: [[1, 1], [1, 1], [1, 1]], weight: 3 },
    // 8: Horizontal T-Shape (4 cells - medium)
    { name: 'T-Shape', matrix: [[1, 1, 1], [0, 1, 0]], weight: 2 },
    // 9: Horizontal Z-Shape (4 cells - medium)
    { name: 'Z-Shape', matrix: [[1, 1, 0], [0, 1, 1]], weight: 2 },
    // 10: L-Shape Top-Left (5 cells - lowered to weight 1)
    { name: 'L-TL', matrix: [[1, 1, 1], [1, 0, 0], [1, 0, 0]], weight: 1 },
    // 11: L-Shape Top-Right (5 cells - lowered to weight 1)
    { name: 'L-TR', matrix: [[1, 1, 1], [0, 0, 1], [0, 0, 1]], weight: 1 },
    // 12: L-Shape Bottom-Left (5 cells - lowered to weight 1)
    { name: 'L-BL', matrix: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], weight: 1 },
    // 13: L-Shape Bottom-Right (5 cells - lowered to weight 1)
    { name: 'L-BR', matrix: [[0, 0, 1], [0, 0, 1], [1, 1, 1]], weight: 1 }
  ];

  // Pre-calculate cell count for each shape definition
  SHAPE_DEFINITIONS.forEach(def => {
    def.cellCount = def.matrix.reduce((sum, row) => sum + row.reduce((rSum, c) => rSum + c, 0), 0);
  });

  // Silent 48-byte WAV data URI to unlock mobile audio hardware & bypass iOS silent switch
  const SILENT_WAV_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

  // --- Audio Synthesis via Web Audio API ---
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.isUnlocked = false;
      this.isMuted = false;
      this.silentAudio = null;
      this.setupGlobalUnlock();
    }

    setupGlobalUnlock() {
      // Touch/pointer activation events for iOS & Android
      const unlockEvents = ['touchstart', 'touchend', 'pointerdown', 'pointerup', 'click', 'keydown'];
      const unlockHandler = () => {
        this.unlockAudio();
      };
      unlockEvents.forEach(evt => window.addEventListener(evt, unlockHandler, { capture: true, passive: true }));
    }

    unlockAudio() {
      // 1. Play HTML5 silent audio element to force iOS into 'playback' session (bypasses hardware mute switch)
      if (!this.silentAudio) {
        try {
          this.silentAudio = new Audio(SILENT_WAV_URI);
          this.silentAudio.setAttribute('playsinline', '');
          this.silentAudio.setAttribute('webkit-playsinline', '');
        } catch (e) {}
      }
      if (this.silentAudio) {
        this.silentAudio.play().catch(() => {});
      }

      // 2. Instantiate or resume Web Audio Context
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }

      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        if (!this.isUnlocked) {
          try {
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            source.start(0);
            this.isUnlocked = true;
          } catch (e) {}
        }
      }
    }

    init() {
      this.unlockAudio();
    }

    playSound(generatorFn) {
      if (this.isMuted) return;
      this.unlockAudio();
      if (!this.ctx) return;

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          if (this.ctx && this.ctx.state === 'running') {
            generatorFn(this.ctx);
          }
        }).catch(() => {});
      } else {
        generatorFn(this.ctx);
      }
    }

    playPickup() {
      this.playSound((ctx) => {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.08);
      });
    }

    playPlacement() {
      this.playSound((ctx) => {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Optimized frequency range (240Hz -> 120Hz) audible on phone/tablet speakers
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
      });
    }

    playLineClear() {
      this.playSound((ctx) => {
        const now = ctx.currentTime;
        // Upbeat harmonic chime (D5, F#5, A5, D6)
        const notes = [587.33, 739.99, 880.00, 1174.66];
        notes.forEach((freq, idx) => {
          const startTime = now + idx * 0.05;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.28, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.35);
        });
      });
    }

    playGameOver() {
      this.playSound((ctx) => {
        const now = ctx.currentTime;
        // Descending minor cadence audible on mobile speakers
        const notes = [520.0, 466.16, 415.30, 349.23];
        notes.forEach((freq, idx) => {
          const startTime = now + idx * 0.12;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.25, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.5);
        });
      });
    }
  }

  // --- Confetti Particle System ---
  class ConfettiManager {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.animId = null;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.scale(dpr, dpr);
      this.width = rect.width;
      this.height = rect.height;
    }

    burst() {
      this.resize();
      // Burst ~140 particles from center
      const count = 140;
      const originX = this.width / 2;
      const originY = this.height / 2;

      for (let i = 0; i < count; i++) {
        const colorObj = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
        this.particles.push({
          x: originX,
          y: originY,
          vx: (Math.random() - 0.5) * 14,             // random vx ±7
          vy: -(Math.random() * 14 + 2),              // vy -2 to -16
          gravity: 0.4,
          w: Math.random() * 6 + 6,
          h: Math.random() * 4 + 4,
          color: colorObj.rawOklch,
          angle: Math.random() * Math.PI * 2,
          angularVel: (Math.random() - 0.5) * 0.2,
          life: 90,                                  // ~90 frames (~1.5s)
          maxLife: 90
        });
      }

      if (!this.animId) {
        this.loop();
      }
    }

    loop() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.angularVel;
        p.life--;

        const alpha = Math.min(1, p.life / 20);

        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.angle);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = alpha;
        this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        this.ctx.restore();

        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      if (this.particles.length > 0) {
        this.animId = requestAnimationFrame(() => this.loop());
      } else {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.animId = null;
      }
    }
  }

  // --- Main Game Controller ---
  class Game {
    constructor() {
      // DOM Elements
      this.boardEl = document.getElementById('board');
      this.trayEl = document.getElementById('tray');
      this.currentScoreEl = document.getElementById('current-score');
      this.bestScoreEl = document.getElementById('best-score');
      this.finalScoreEl = document.getElementById('final-score');
      this.gameOverModal = document.getElementById('game-over-modal');
      this.playAgainBtn = document.getElementById('play-again-btn');
      this.confettiCanvas = document.getElementById('confetti-canvas');
      this.highlightSlider = document.getElementById('highlight-slider');
      this.toggleSoundBtn = document.getElementById('toggle-sound-btn');

      // Managers
      this.sound = new SoundManager();
      this.confetti = new ConfettiManager(this.confettiCanvas);

      // State
      this.grid = []; // 8x8 array of color string or null
      this.trayPieces = [null, null, null];
      this.currentScore = 0;
      this.bestScore = 0;
      this.isGameOver = false;

      // Settings: Sound (enabled by default)
      const storedSound = localStorage.getItem(STORAGE_KEY_SOUND);
      this.soundEnabled = (storedSound === null) ? true : (storedSound === 'true');
      this.sound.isMuted = !this.soundEnabled;

      // Settings: Line completion highlight slider (enabled by default)
      const storedHighlight = localStorage.getItem(STORAGE_KEY_HIGHLIGHT);
      this.highlightClearsEnabled = (storedHighlight === null) ? true : (storedHighlight === 'true');

      // Drag State
      this.activeDrag = null;

      this.init();
    }

    init() {
      this.loadBestScore();
      this.updateHighlightSliderState();
      this.updateSoundButtonState();
      this.createBoardCells();
      this.bindEvents();
      this.startNewGame();
    }

    loadBestScore() {
      const stored = localStorage.getItem(STORAGE_KEY_BEST);
      this.bestScore = stored ? parseInt(stored, 10) || 0 : 0;
      this.bestScoreEl.textContent = this.bestScore;
    }

    saveBestScore() {
      if (this.currentScore > this.bestScore) {
        this.bestScore = this.currentScore;
        this.bestScoreEl.textContent = this.bestScore;
        localStorage.setItem(STORAGE_KEY_BEST, this.bestScore.toString());
      }
    }

    updateSoundButtonState() {
      if (!this.toggleSoundBtn) return;
      const onIcon = this.toggleSoundBtn.querySelector('.sound-icon-on');
      const offIcon = this.toggleSoundBtn.querySelector('.sound-icon-off');

      if (this.soundEnabled) {
        this.toggleSoundBtn.classList.add('active');
        this.toggleSoundBtn.setAttribute('title', 'Sound: ON (click to mute)');
        if (onIcon) onIcon.style.display = 'block';
        if (offIcon) offIcon.style.display = 'none';
      } else {
        this.toggleSoundBtn.classList.remove('active');
        this.toggleSoundBtn.setAttribute('title', 'Sound: MUTED (click to enable)');
        if (onIcon) onIcon.style.display = 'none';
        if (offIcon) offIcon.style.display = 'block';
      }
      this.sound.isMuted = !this.soundEnabled;
    }

    updateHighlightSliderState() {
      if (!this.highlightSlider) return;
      this.highlightSlider.checked = this.highlightClearsEnabled;
    }

    createBoardCells() {
      this.boardEl.innerHTML = '';
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.row = r;
          cell.dataset.col = c;
          this.boardEl.appendChild(cell);
        }
      }
    }

    getCellEl(r, c) {
      return this.boardEl.children[r * GRID_SIZE + c];
    }

    bindEvents() {
      this.playAgainBtn.addEventListener('click', () => {
        this.sound.init();
        this.startNewGame();
      });

      if (this.toggleSoundBtn) {
        this.toggleSoundBtn.addEventListener('click', () => {
          this.soundEnabled = !this.soundEnabled;
          localStorage.setItem(STORAGE_KEY_SOUND, this.soundEnabled.toString());
          this.sound.unlockAudio();
          this.updateSoundButtonState();
          if (this.soundEnabled) {
            this.sound.playPickup(); // Play confirmation chirp
          }
        });
      }

      if (this.highlightSlider) {
        this.highlightSlider.addEventListener('change', () => {
          this.sound.init();
          this.highlightClearsEnabled = this.highlightSlider.checked;
          localStorage.setItem(STORAGE_KEY_HIGHLIGHT, this.highlightClearsEnabled.toString());
          // Update live preview if dragging
          if (this.activeDrag && this.activeDrag.validTarget) {
            this.renderPlacementPreview(
              this.activeDrag.piece.matrix,
              this.activeDrag.validTarget.row,
              this.activeDrag.validTarget.col,
              this.activeDrag.piece.colorVar
            );
          }
        });
      }

      // Prevent default pull-to-refresh or page bouncing during dragging
      document.addEventListener('touchmove', (e) => {
        if (this.activeDrag) {
          e.preventDefault();
        }
      }, { passive: false });

      // Prevent accidental double-tap and double-click zooming across touch/mobile devices
      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      }, { passive: false });

      document.addEventListener('dblclick', (e) => {
        e.preventDefault();
      }, { passive: false });

      // Prevent Safari multi-touch gesture zoom
      ['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
        document.addEventListener(evt, (e) => e.preventDefault(), { passive: false });
      });

      window.addEventListener('resize', () => {
        this.confetti.resize();
      });
    }

    startNewGame() {
      this.isGameOver = false;
      this.gameOverModal.classList.add('hidden');
      this.currentScore = 0;
      this.currentScoreEl.textContent = '0';

      // Reset grid
      this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cell = this.getCellEl(r, c);
          cell.className = 'cell';
          cell.style.backgroundColor = '';
        }
      }

      this.refillTray();
    }

    // --- Weighted Tray & Piece Generation ---
    getRandomWeightedShape() {
      const totalWeight = SHAPE_DEFINITIONS.reduce((acc, def) => acc + def.weight, 0);
      let rand = Math.random() * totalWeight;
      for (const def of SHAPE_DEFINITIONS) {
        if (rand < def.weight) {
          return def;
        }
        rand -= def.weight;
      }
      return SHAPE_DEFINITIONS[SHAPE_DEFINITIONS.length - 1];
    }

    refillTray() {
      for (let i = 0; i < 3; i++) {
        const shapeDef = this.getRandomWeightedShape();
        const colorDef = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
        this.trayPieces[i] = {
          id: 'piece-' + Date.now() + '-' + i + '-' + Math.random(),
          name: shapeDef.name,
          matrix: shapeDef.matrix,
          cellCount: shapeDef.cellCount,
          colorVar: colorDef.varName,
          rawOklch: colorDef.rawOklch
        };
      }
      this.renderTray();
      this.checkGameOver();
    }

    renderTray() {
      const slotEls = this.trayEl.querySelectorAll('.tray-slot');
      slotEls.forEach((slotEl, idx) => {
        slotEl.innerHTML = '';
        const piece = this.trayPieces[idx];
        if (piece) {
          const pieceEl = this.createTrayPieceElement(piece, idx);
          slotEl.appendChild(pieceEl);
        }
      });
    }

    createTrayPieceElement(piece, slotIndex) {
      const rows = piece.matrix.length;
      const cols = piece.matrix[0].length;

      const pieceEl = document.createElement('div');
      pieceEl.className = 'tray-piece';
      pieceEl.style.gridTemplateColumns = `repeat(${cols}, var(--tray-cell-size, 20px))`;
      pieceEl.style.gridTemplateRows = `repeat(${rows}, var(--tray-cell-size, 20px))`;
      pieceEl.dataset.slot = slotIndex;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cellEl = document.createElement('div');
          if (piece.matrix[r][c] === 1) {
            cellEl.className = 'piece-cell';
            cellEl.style.backgroundColor = piece.colorVar;
          } else {
            cellEl.className = 'empty-cell';
          }
          pieceEl.appendChild(cellEl);
        }
      }

      pieceEl.addEventListener('pointerdown', (e) => this.onPointerDownPiece(e, piece, slotIndex, pieceEl));

      return pieceEl;
    }

    // --- Drag and Drop Handling ---
    onPointerDownPiece(e, piece, slotIndex, pieceEl) {
      if (this.isGameOver || this.activeDrag) return;
      e.preventDefault();

      this.sound.init();
      this.sound.playPickup();

      const isTouch = (e.pointerType === 'touch');

      // Measure current board cell dimensions for exact 1:1 drag proxy sizing
      const firstBoardCell = this.boardEl.children[0];
      const cellRect = firstBoardCell.getBoundingClientRect();
      const cellSize = cellRect.width;

      const rows = piece.matrix.length;
      const cols = piece.matrix[0].length;
      const proxyWidth = cols * cellSize + (cols - 1) * GAP_SIZE;
      const proxyHeight = rows * cellSize + (rows - 1) * GAP_SIZE;

      // Create Drag Proxy
      const proxy = document.createElement('div');
      proxy.className = 'drag-proxy';
      proxy.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;
      proxy.style.gridTemplateRows = `repeat(${rows}, ${cellSize}px)`;
      proxy.style.width = `${proxyWidth}px`;
      proxy.style.height = `${proxyHeight}px`;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const pCell = document.createElement('div');
          if (piece.matrix[r][c] === 1) {
            pCell.className = 'proxy-cell';
            pCell.style.width = `${cellSize}px`;
            pCell.style.height = `${cellSize}px`;
            pCell.style.backgroundColor = piece.colorVar;
          } else {
            pCell.className = 'proxy-empty';
            pCell.style.width = `${cellSize}px`;
            pCell.style.height = `${cellSize}px`;
          }
          proxy.appendChild(pCell);
        }
      }

      document.body.appendChild(proxy);

      // Hide tray piece while dragging
      pieceEl.style.visibility = 'hidden';

      this.activeDrag = {
        piece,
        slotIndex,
        pieceEl,
        proxy,
        cellSize,
        rows,
        cols,
        proxyWidth,
        proxyHeight,
        isTouch,
        pointerId: e.pointerId,
        validTarget: null
      };

      this.updateDragPosition(e.clientX, e.clientY);

      const onPointerMove = (moveEvent) => {
        if (!this.activeDrag || moveEvent.pointerId !== this.activeDrag.pointerId) return;
        this.updateDragPosition(moveEvent.clientX, moveEvent.clientY);
      };

      const onPointerUp = (upEvent) => {
        if (!this.activeDrag || upEvent.pointerId !== this.activeDrag.pointerId) return;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        this.finishDrag();
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    }

    updateDragPosition(clientX, clientY) {
      const drag = this.activeDrag;
      if (!drag) return;

      // Touch offset: 60px above contact point; Mouse: centered on cursor
      const offsetY = drag.isTouch ? -60 : 0;
      const posX = clientX;
      const posY = clientY + offsetY;

      drag.proxy.style.left = `${posX}px`;
      drag.proxy.style.top = `${posY}px`;

      // Determine top-left corner of the proxy in screen coordinates
      const proxyTopLeftX = posX - drag.proxyWidth / 2;
      const proxyTopLeftY = posY - drag.proxyHeight / 2;

      // Board origin cell coordinates
      const originCell = this.boardEl.children[0].getBoundingClientRect();
      const step = drag.cellSize + GAP_SIZE;

      // Snap origin cell calculation
      const targetCol = Math.round((proxyTopLeftX - originCell.left) / step);
      const targetRow = Math.round((proxyTopLeftY - originCell.top) / step);

      // Validate placement
      if (this.canPlacePiece(drag.piece.matrix, targetRow, targetCol)) {
        drag.validTarget = { row: targetRow, col: targetCol };
        this.renderPlacementPreview(drag.piece.matrix, targetRow, targetCol, drag.piece.colorVar);
      } else {
        drag.validTarget = null;
        this.clearPlacementPreview();
      }
    }

    renderPlacementPreview(matrix, startR, startC, colorVar) {
      this.clearPlacementPreview();
      const rows = matrix.length;
      const cols = matrix[0].length;

      // 1. Render piece preview on target cells
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (matrix[r][c] === 1) {
            const cellEl = this.getCellEl(startR + r, startC + c);
            if (cellEl) {
              cellEl.classList.add('preview');
              cellEl.style.backgroundColor = colorVar;
            }
          }
        }
      }

      // 2. If line completion highlight is enabled, detect rows and columns that would complete
      if (this.highlightClearsEnabled) {
        const completedRows = [];
        const completedCols = [];

        for (let r = 0; r < GRID_SIZE; r++) {
          let full = true;
          for (let c = 0; c < GRID_SIZE; c++) {
            const isPieceCell = (r >= startR && r < startR + rows && c >= startC && c < startC + cols && matrix[r - startR][c - startC] === 1);
            if (this.grid[r][c] === null && !isPieceCell) {
              full = false;
              break;
            }
          }
          if (full) completedRows.push(r);
        }

        for (let c = 0; c < GRID_SIZE; c++) {
          let full = true;
          for (let r = 0; r < GRID_SIZE; r++) {
            const isPieceCell = (r >= startR && r < startR + rows && c >= startC && c < startC + cols && matrix[r - startR][c - startC] === 1);
            if (this.grid[r][c] === null && !isPieceCell) {
              full = false;
              break;
            }
          }
          if (full) completedCols.push(c);
        }

        // Highlight cells in completing rows
        completedRows.forEach(r => {
          for (let c = 0; c < GRID_SIZE; c++) {
            const cellEl = this.getCellEl(r, c);
            if (cellEl) cellEl.classList.add('line-clear-preview');
          }
        });

        // Highlight cells in completing columns
        completedCols.forEach(c => {
          for (let r = 0; r < GRID_SIZE; r++) {
            const cellEl = this.getCellEl(r, c);
            if (cellEl) cellEl.classList.add('line-clear-preview');
          }
        });
      }
    }

    clearPlacementPreview() {
      const highlighted = this.boardEl.querySelectorAll('.cell.preview, .cell.line-clear-preview');
      highlighted.forEach(cell => {
        cell.classList.remove('preview', 'line-clear-preview');
        const r = parseInt(cell.dataset.row, 10);
        const c = parseInt(cell.dataset.col, 10);
        cell.style.backgroundColor = this.grid[r][c] || '';
      });
    }

    finishDrag() {
      const drag = this.activeDrag;
      if (!drag) return;

      this.clearPlacementPreview();
      drag.proxy.remove();

      if (drag.validTarget) {
        // Successful placement
        this.placePiece(drag.piece, drag.validTarget.row, drag.validTarget.col);
        this.trayPieces[drag.slotIndex] = null;
        drag.pieceEl.remove();

        // Check if all 3 tray pieces have been placed
        const remaining = this.trayPieces.filter(p => p !== null);
        if (remaining.length === 0) {
          this.refillTray();
        } else {
          this.checkGameOver();
        }
      } else {
        // Snaps back
        drag.pieceEl.style.visibility = 'visible';
      }

      this.activeDrag = null;
    }

    canPlacePiece(matrix, startR, startC) {
      const rows = matrix.length;
      const cols = matrix[0].length;

      // Boundary check
      if (startR < 0 || startC < 0 || startR + rows > GRID_SIZE || startC + cols > GRID_SIZE) {
        return false;
      }

      // Overlap check
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (matrix[r][c] === 1) {
            if (this.grid[startR + r][startC + c] !== null) {
              return false;
            }
          }
        }
      }

      return true;
    }

    placePiece(piece, startR, startC) {
      const matrix = piece.matrix;
      const rows = matrix.length;
      const cols = matrix[0].length;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (matrix[r][c] === 1) {
            const boardR = startR + r;
            const boardC = startC + c;
            this.grid[boardR][boardC] = piece.colorVar;
            const cellEl = this.getCellEl(boardR, boardC);
            cellEl.className = 'cell filled';
            cellEl.style.backgroundColor = piece.colorVar;
          }
        }
      }

      this.sound.playPlacement();

      // Placement points: +1 per cell placed
      let earnedPoints = piece.cellCount;

      // Line clearing detection
      const clearedRows = [];
      const clearedCols = [];

      for (let r = 0; r < GRID_SIZE; r++) {
        let full = true;
        for (let c = 0; c < GRID_SIZE; c++) {
          if (this.grid[r][c] === null) {
            full = false;
            break;
          }
        }
        if (full) clearedRows.push(r);
      }

      for (let c = 0; c < GRID_SIZE; c++) {
        let full = true;
        for (let r = 0; r < GRID_SIZE; r++) {
          if (this.grid[r][c] === null) {
            full = false;
            break;
          }
        }
        if (full) clearedCols.push(c);
      }

      const totalLines = clearedRows.length + clearedCols.length;

      if (totalLines > 0) {
        // Clear points: +10 per completed line
        earnedPoints += totalLines * 10;

        // Perform clearing
        clearedRows.forEach(r => {
          for (let c = 0; c < GRID_SIZE; c++) {
            this.grid[r][c] = null;
          }
        });
        clearedCols.forEach(c => {
          for (let r = 0; r < GRID_SIZE; r++) {
            this.grid[r][c] = null;
          }
        });

        // Update DOM for cleared cells
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (this.grid[r][c] === null) {
              const cellEl = this.getCellEl(r, c);
              cellEl.className = 'cell';
              cellEl.style.backgroundColor = '';
            }
          }
        }

        // Trigger Audio, Confetti, and Pop Animation
        this.sound.playLineClear();
        this.confetti.burst();
        this.triggerScorePop();
      }

      this.addScore(earnedPoints);
    }

    addScore(points) {
      this.currentScore += points;
      this.currentScoreEl.textContent = this.currentScore;
      this.saveBestScore();
    }

    triggerScorePop() {
      this.currentScoreEl.classList.remove('pop');
      void this.currentScoreEl.offsetWidth; // Force reflow
      this.currentScoreEl.classList.add('pop');
    }

    // --- Game Over Evaluation ---
    checkGameOver() {
      const remainingPieces = this.trayPieces.filter(p => p !== null);
      if (remainingPieces.length === 0) return;

      // Check if at least one piece can be placed anywhere
      for (const piece of remainingPieces) {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (this.canPlacePiece(piece.matrix, r, c)) {
              return; // Move available, continue playing
            }
          }
        }
      }

      // No move can be made: Game Over
      this.triggerGameOver();
    }

    triggerGameOver() {
      this.isGameOver = true;
      this.sound.playGameOver();
      this.finalScoreEl.textContent = this.currentScore;
      this.gameOverModal.classList.remove('hidden');
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Game());
  } else {
    new Game();
  }

  // --- PWA Installation Prompt ---
  let deferredInstallPrompt = null;
  const installBtn = document.getElementById('install-pwa-btn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) {
      installBtn.style.display = 'flex';
      installBtn.classList.add('active');
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        installBtn.style.display = 'none';
      }
      deferredInstallPrompt = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
    deferredInstallPrompt = null;
  });

  // --- Automatic Live Reload on Version Update ---
  if (window.location.protocol.startsWith('http')) {
    let initialVersion = null;
    setInterval(async () => {
      try {
        const res = await fetch(`version.json?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (initialVersion === null) {
          initialVersion = data.timestamp;
        } else if (data.timestamp && data.timestamp !== initialVersion) {
          console.log('[LIVE RELOAD] New version detected, reloading page...');
          window.location.reload();
        }
      } catch (e) {
        // Silently ignore network hiccup during reloads
      }
    }, 1500);
  }
})();
