# Blockfall — Software Requirements Specification (SRS)

**Document Version:** 1.0  
**Project Name:** Blockfall  
**Platform:** Web (HTML5, CSS3, Vanilla JavaScript)  
**Location:** `C:\Temp\Julia\Documentation\requirements.md`  
**Related Documents:**
- Design Specification: [`blockfall-design-spec.md`](./blockfall-design-spec.md)
- Gameplay Details: [`blockfall-gameplay-srs.md`](./blockfall-gameplay-srs.md)
- Mockups: `01-start.png`, `02-dragging-preview.png`, `03-mid-game.png`, `04-game-over.png`, `05-mobile.png`

---

## 1. Introduction & Objectives
Blockfall is an 8×8 block placement web game built with vanilla HTML5, CSS3, and JavaScript. Players drag pieces from a 3-piece tray onto the board to complete full horizontal rows and vertical columns. Cleared lines award points, and the game ends when no remaining tray pieces can legally fit onto the board.

---

## 2. Functional Requirements (FR)

### FR-1: Board System
- **FR-1.1:** The board shall consist of exactly an $8 \times 8$ grid ($64$ cells).
- **FR-1.2:** Each cell shall exist in one of two logical states: `EMPTY` or `OCCUPIED(color)`.
- **FR-1.3:** At game start or restart, all 64 cells shall be set to `EMPTY`.

### FR-2: Shape Pool & Spawning
- **FR-2.1:** The shape pool shall consist of exactly 21 fixed discrete pieces:
  1. **Dot 1×1:** 1 cell (`[[1]]`)
  2. **Square 2×2:** 4 cells (`[[1,1],[1,1]]`)
  3. **Square 3×3:** 9 cells (`[[1,1,1],[1,1,1],[1,1,1]]`)
  4. **Horizontal Line 1×2:** 2 cells (`[[1,1]]`)
  5. **Vertical Line 2×1:** 2 cells (`[[1],[1]]`)
  6. **Horizontal Line 1×4:** 4 cells (`[[1,1,1,1]]`)
  7. **Vertical Line 4×1:** 4 cells (`[[1],[1],[1],[1]]`)
  8. **Rectangle 2×3:** 6 cells (`[[1,1,1],[1,1,1]]`)
  9. **Rectangle 3×2:** 6 cells (`[[1,1],[1,1],[1,1]]`)
  10. **T-Shape Down:** 4 cells (`[[1,1,1],[0,1,0]]`)
  11. **T-Shape Up:** 4 cells (`[[0,1,0],[1,1,1]]`)
  12. **T-Shape Left:** 4 cells (`[[0,1],[1,1],[0,1]]`)
  13. **T-Shape Right:** 4 cells (`[[1,0],[1,1],[1,0]]`)
  14. **Horizontal Z-Shape:** 4 cells (`[[1,1,0],[0,1,1]]`)
  15. **Vertical Z-Shape:** 4 cells (`[[0,1],[1,1],[1,0]]`)
  16. **Horizontal Inverted Z / S-Shape:** 4 cells (`[[0,1,1],[1,1,0]]`)
  17. **Vertical Inverted Z / S-Shape:** 4 cells (`[[1,0],[1,1],[0,1]]`)
  18. **L-Shape Top-Left:** 5 cells (`[[1,1,1],[1,0,0],[1,0,0]]`)
  19. **L-Shape Top-Right:** 5 cells (`[[1,1,1],[0,0,1],[0,0,1]]`)
  20. **L-Shape Bottom-Left:** 5 cells (`[[1,0,0],[1,0,0],[1,1,1]]`)
  21. **L-Shape Bottom-Right:** 5 cells (`[[0,0,1],[0,0,1],[1,1,1]]`)
- **FR-2.2:** Rotation by the player is **prohibited**.
- **FR-2.3:** The staging tray shall hold exactly 3 piece slots. At most 2 pieces of the exact same shape are permitted in the dock/tray concurrently.
- **FR-2.4 (Rebalanced Shape Weights):** A new set of 3 pieces shall be generated using balanced probability weighting:
  - Small shapes (1–4 cells: 1×1, 2×2, 1×2, 2×1, 1×4, 4×1): **Weight 1**
  - T-shapes (all 4 orientations): **Weight 1 each** (total weight 4)
  - L-shapes (all 4 orientations): **Weight 1 each** (total weight 4)
  - Z/S-shapes (all 4 orientations): **Weight 1 each** (total weight 4)
  - Large shapes (Rectangle 2×3, 3×2, Square 3×3): **Weight 3**
  - Large shapes (Rectangle 2×3, 3×2, Square 3×3): **Weight 3**
- **FR-2.5:** Each piece shall be assigned a color from the 6 palette options: `coral`, `amber`, `lime`, `sky`, `pink`, `teal` (colors may repeat).

### FR-3: Drag-and-Drop & Placement
- **FR-3.1:** Pieces in the tray shall be draggable via standard Pointer Events (`pointerdown`, `pointermove`, `pointerup`).
- **FR-3.2 (Touch Offset):** When dragging with touch input, the floating proxy piece shall be offset 60px above the touch contact point to avoid finger occlusion.
- **FR-3.3 (Mouse Offset):** When dragging with mouse input, the floating proxy piece shall be centered directly under the mouse cursor.
- **FR-3.4 (Placement Validation):** A placement is valid if and only if all cells of the piece lie strictly within grid bounds ($0 \le x < 8$, $0 \le y < 8$) and all target cells are currently `EMPTY`.
- **FR-3.5 (Placement Preview & Line Completion Highlight):**
  - While hovering over a valid placement position, the target grid cells shall render a 40% opacity preview of the piece's color.
  - When line completion highlighting is enabled, any rows or columns that would become fully completed by placing the piece shall be highlighted with a pulsing white/glow outline.
  - No preview or line highlight shall be displayed when the position is invalid.
- **FR-3.6 (Highlight Setting Slider):** A labeled settings bar located directly between the header and the board shall feature an iOS-style toggle slider switch with the label `"Highlight Clears"`. Sliding the thumb toggles line completion highlights on or off (enabled by default, persisted in `localStorage` under `blockfall_highlight_clears`).
- **FR-3.7 (Drop Action):**
  - On valid drop: the piece is locked onto the board, removed from the tray, and placement points are awarded.
  - On invalid drop: the piece smoothly snaps back to its tray slot.

### FR-4: Line Clearing & Scoring
- **FR-4.1:** Immediately following a successful placement, all rows and columns are evaluated:
  - Any full row of 8 cells is marked for clearing.
  - Any full column of 8 cells is marked for clearing.
- **FR-4.2:** Both horizontal and vertical lines can clear simultaneously.
- **FR-4.3:** Cleared cells revert to `EMPTY`.
- **FR-4.4 (Scoring Formula):**
  - $+1$ point per cell placed (e.g. 1×1 = 1 pt, 2×2 = 4 pts, 3×3 = 9 pts).
  - $+10$ points per cleared line (e.g., 2 simultaneous lines = $+20$ points).
- **FR-4.5 (High Score):** The highest score achieved shall be saved to browser `localStorage` (`blockfall_best_score`) and displayed in the header under `"BEST"`.

### FR-5: Game Over & Reset
- **FR-5.1:** Game Over check executes after every piece placement or tray replenishment:
  - If **no** remaining piece in the tray can fit anywhere on the current board, Game Over is triggered.
- **FR-5.2:** Game Over displays a modal covering the board with a backdrop blur, showing `"Game Over"`, `"Final score"`, the final score value, and a `"Play Again"` button.
- **FR-5.3:** Clicking `"Play Again"` resets the board to empty, resets the current score to 0, refills the tray with 3 new pieces, and dismisses the modal.

---

## 3. Non-Functional Requirements (NFR)

### NFR-1: Visual Styling & Theming
- **NFR-1.1:** Palette shall use CSS Custom Properties with OKLCH color definitions as specified in `blockfall-design-spec.md`.
- **NFR-1.2:** Block cells shall feature tactile bevel highlights (`inset 0 -4px 0 rgb(0 0 0/25%), inset 0 3px 0 rgb(255 255 255/30%)`) and 6px border radii.
- **NFR-1.3:** Single centered column layout with max width 448px and max height 100dvh, dynamically scaling board and dock dimensions relative to viewport height (`min(100%, calc(100dvh - 250px))`) to guarantee the entire game (header, settings, board, and piece dock) fits on screen without vertical overflow.
- **NFR-1.4:** Typography: **Bricolage Grotesque** (display/score) and **DM Sans** (labels) loaded from Google Fonts.

### NFR-2: Animations & Audio
- **NFR-2.1 (Confetti):** Whenever $\ge 1$ line clears, a canvas confetti burst with ~140 particles in block palette colors shall animate over ~1.5 seconds.
- **NFR-2.2 (Score Pop):** Score counter shall scale from 1.4× to 1.0× over 350ms on clear.
- **NFR-2.3 (Audio & Mobile Hardware Compatibility):** Procedural Web Audio API sound effects for piece pickup, placement, line clear chime, and game over cadence without external media files.
  - **iOS/iPadOS Session Unlock:** Plays a 48-byte inline WAV audio element on user touch to switch the browser audio session from `Ambient` to `Playback`, allowing sounds to be heard even if the device's hardware Mute/Silent switch or Control Center Silent Mode is active.
  - **Android/Chrome Autoplay Fix:** Lazy context instantiation and asynchronous `resume()` verification prior to note scheduling to prevent suspended playback states.
  - **Speaker Frequency Optimization:** Frequencies shifted above 120Hz (pickup: 300–600Hz; placement: 240–120Hz; clear: 587–1175Hz) to ensure rich audibility on compact mobile and tablet speakers.
  - **Mute/Sound Control:** A dedicated Sound toggle button in the header enables or mutes audio (persisted in `localStorage` under `blockfall_sound_enabled`).

### NFR-3: Performance & Compatibility
- **NFR-3.1:** 60fps rendering for drag, placement preview, and confetti animations.
- **NFR-3.2:** Fully functional in modern evergreen browsers (Chrome, Edge, Safari, Firefox) with touch and mouse support. Prevents accidental double-tap/double-click and multi-touch gesture zoom locks via viewport meta tags, global `touch-action: none`, and event listener interception (`dblclick`, `touchend`, `gesturestart`).
- **NFR-3.3:** Zero runtime framework dependencies (vanilla JavaScript, HTML5, CSS3).
- **NFR-3.4 (Automatic Live Reload):** Development environments running over HTTP monitor `version.json` timestamp updates. When changes to `index.html`, `style.css`, or `game.js` are saved, all connected clients (iPad, phone, PC) automatically reload without manual cache clearing.
- **NFR-3.5 (Progressive Web App & Offline Execution):** Compliant with W3C PWA standards (`manifest.json`, `sw.js` Service Worker). Supports installability as a full-screen, standalone application on Android and iOS/iPadOS with complete offline asset caching (100% playable in Airplane Mode without a server).
