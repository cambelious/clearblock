# Blockfall — Gameplay Software Requirements Specification (SRS)

Companion to `blockfall-design-spec.md`.

## 1. System Overview
- **Technology Stack:** HTML5, CSS3, vanilla JavaScript.
- **Display Target:** Responsive single-page application (desktop and mobile web).
- **Core Loop:** Place shapes onto an 8×8 grid from a 3-piece tray to clear horizontal rows and vertical columns, scoring points until no available pieces can fit.

---

## 2. Board System
- **Grid Dimensions:** Exactly 8 rows by 8 columns (64 cells total).
- **Coordinate System:** Origin (0,0) at top-left, (7,7) at bottom-right.
- **Cell States:** Each cell is either `EMPTY` or `OCCUPIED(color)`.
- **Initialization:** All 64 cells initialize to `EMPTY`.

---

## 3. Piece Definitions
Pieces cannot be rotated by the player. The pool consists of 13 discrete shapes across a 6-color palette (`coral`, `amber`, `lime`, `sky`, `pink`, `teal`):

| ID | Shape Name | Bounding Box | Cell Count | Matrix Representation (1 = filled) | Variants |
|---|---|:---:|:---:|---|:---:|
| 1 | **Dot 1×1** | 1×1 | 1 | `[[1]]` | 1 |
| 2 | **Square 2×2** | 2×2 | 4 | `[[1,1],[1,1]]` | 1 |
| 3 | **Square 3×3** | 3×3 | 9 | `[[1,1,1],[1,1,1],[1,1,1]]` | 1 |
| 4 | **Line 1×4** | 1×4 | 4 | `[[1,1,1,1]]` | 1 |
| 5 | **Line 4×1** | 4×1 | 4 | `[[1],[1],[1],[1]]` | 1 |
| 6 | **Rect 2×3** | 2×3 | 6 | `[[1,1,1],[1,1,1]]` | 1 |
| 7 | **Rect 3×2** | 3×2 | 6 | `[[1,1],[1,1],[1,1]]` | 1 |
| 8 | **T-Shape** | 3×2 | 4 | `[[1,1,1],[0,1,0]]` | 1 |
| 9 | **Z-Shape** | 3×2 | 4 | `[[1,1,0],[0,1,1]]` | 1 |
| 10 | **L-Shape TL** | 3×3 | 5 | `[[1,1,1],[1,0,0],[1,0,0]]` | 1 |
| 11 | **L-Shape TR** | 3×3 | 5 | `[[1,1,1],[0,0,1],[0,0,1]]` | 1 |
| 12 | **L-Shape BL** | 3×3 | 5 | `[[1,0,0],[1,0,0],[1,1,1]]` | 1 |
| 13 | **L-Shape BR** | 3×3 | 5 | `[[0,0,1],[0,0,1],[1,1,1]]` | 1 |

---

## 4. Staging Tray & Spawning
- **Capacity:** Exactly 3 piece slots.
- **Replenishment Rule:** A new set of 3 randomly chosen shapes is generated only after all 3 slots have been emptied by successful placements.
- **Rebalanced Spawning Weights:**
  - Small shapes (1–4 cells: Dot 1×1, Square 2×2, Line 1×4, Line 4×1): **Weight 1**
  - Medium shapes (Horizontal T-Shape, Horizontal Z-Shape): **Weight 2**
  - Large shapes (Rectangle 2×3, Rectangle 3×2, Square 3×3): **Weight 3**
  - L-shapes (each of the 4 orientations): **Weight 1** (lowered to curb repetition)
- **Color Assignment:** Each piece is assigned a random color from the 6 palette options upon generation (colors may repeat).
- **Color Assignment:** Each piece is assigned a random color from the 6 palette options upon generation (colors may repeat).

---

## 5. Controls & Placement Rules
- **Pointer Events:** Supported via unified Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`).
- **Drag Proxy Offset:**
  - Touch input: Floating proxy offset 60px **above** the touch contact point so the finger does not obscure target cells.
  - Mouse input: Floating proxy centered directly on the cursor.
- **Placement Validation:**
  - Every constituent unit cell must lie strictly within grid bounds ($0 \le x < 8$, $0 \le y < 8$).
  - Target grid cells must currently be `EMPTY` (no overlap allowed).
- **Placement Preview & Line Completion Highlight:**
  - When dragging over a valid placement position, the underlying grid cells display a 40% opacity preview of the piece's color.
  - If placing the piece would complete one or more rows or columns, those entire rows/columns display a pulsing white/glow outline (when enabled).
  - A toggle button in the header enables/disables line completion highlights (enabled by default; saved in `localStorage`).
  - If placement is invalid or out of bounds, no preview or line highlight is shown.
- **Release Action:**
  - Valid drop: Piece is committed to the board, removed from tray, score updated, line check triggered.
  - Invalid drop: Piece snaps back to its tray slot.

---

## 6. Line Clearing & Scoring System
- **Line Detection:**
  - Executed immediately following every piece placement.
  - Any row with all 8 cells `OCCUPIED` is cleared.
  - Any column with all 8 cells `OCCUPIED` is cleared.
  - Intersecting rows and columns clear simultaneously in a single resolution.
- **Scoring Formula:**
  - **Placement Points:** $+1$ point per cell placed (e.g. 1×1 = +1, 2×2 = +4, 3×3 = +9).
  - **Clear Points:** $+10$ points per completed line (e.g. 2 lines cleared = $+20$ points).
- **High Score Tracking:**
  - Highest score persisted to `localStorage` under `blockfall_best_score`.
  - Displayed in header under `"BEST"`.

---

## 7. Audio & Visual Effects
- **Visual Effects:**
  - Line clear triggers ~140 confetti particles on an overlaid canvas extending 40px beyond the board.
  - Score counter animates with a 1.4× scale pop over 350ms on clear.
- **Procedural Audio (Web Audio API):**
  - **Pick up:** Short ascending tone (300Hz → 600Hz).
  - **Drop / Place:** Low tactile pop (240Hz → 120Hz).
  - **Line Clear:** Upbeat multi-tone harmonic chime (587Hz, 740Hz, 880Hz, 1175Hz).
  - **Game Over:** Soft descending minor chord (520Hz, 466Hz, 415Hz, 349Hz).
  - **Mobile Audio Session:** Unlocked via inline silent WAV `<audio playsinline>` on user interaction, allowing playback through the iOS `Playback` session category and preventing suspension on Android. A Sound toggle button in the header enables muting/unmuting.

---

## 8. Game Over & Restart Flow
- **Game Over Trigger:**
  - Checked after every piece placement or tray replenishment.
  - Evaluates whether ANY remaining piece in the tray can fit in AT LEAST ONE valid position on the 8×8 board.
  - If no remaining piece can fit, Game Over is triggered.
- **Game Over UI:**
  - Modal overlay covers the board with 4px backdrop blur.
  - Displays `"Game Over"`, `"Final score"`, the final score value, and a 3D tactile `"Play Again"` button.
- **Restart Action:**
  - Board resets to empty.
  - Current score resets to 0.
  - Tray refills with 3 new pieces.
  - Modal overlay is dismissed.
