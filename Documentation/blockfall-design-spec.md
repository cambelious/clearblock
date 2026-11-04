# Blockfall — Visual Design Spec

Companion to the gameplay SRS. Mockups: `blockfall-mockups/` (01-start, 02-dragging-preview, 03-mid-game, 04-game-over, 05-mobile).

## 1. Direction
Dark, calm "night arcade". Deep navy backdrop, a recessed board, and glossy candy-coloured blocks that feel tactile (light top edge, dark bottom edge). One warm accent (amber) for score and the primary button. No other chrome.

## 2. Colour tokens (CSS custom properties, oklch)
| Token | Value | Use |
|---|---|---|
| --background | oklch(0.18 0.03 260) | Page base |
| --foreground | oklch(0.97 0.01 90) | Title, headings |
| --muted-foreground | oklch(0.70 0.03 260) | Labels ("SCORE", "Final score") |
| --primary | oklch(0.85 0.16 85) | Score number, Play Again button (amber) |
| --primary-foreground | oklch(0.18 0.03 260) | Text on amber |
| --board-bg | oklch(0.13 0.03 260) | Board frame / gutters |
| --cell-empty | oklch(0.22 0.03 260) | Empty cell |
| --tray-bg | oklch(0.22 0.03 260 / 60%) | Tray panel, 1px border oklch(1 0 0 / 8%) |
| --overlay | oklch(0.16 0.03 260 / 80%) | Game Over dim + 4px backdrop blur |
| --button-shadow | oklch(0.60 0.14 70) | 3D base under Play Again |

Block palette (random per piece, may repeat):
| --block-1 coral oklch(0.72 0.19 25) | --block-2 amber oklch(0.82 0.17 75) | --block-3 lime oklch(0.78 0.20 145) |
| --block-4 sky oklch(0.72 0.15 230) | --block-5 pink oklch(0.70 0.20 340) | --block-6 teal oklch(0.80 0.14 190) |

Page background: `radial-gradient(ellipse at top, oklch(0.26 0.05 260), var(--background) 70%)`.

## 3. Typography
- Display: **Bricolage Grotesque** 600/700 (Google Fonts) — title, score, best score, "Game Over", button.
- Body: **DM Sans** 400/500 — labels.
- Sizes: title 30px bold, tight tracking; labels 12px uppercase, letter-spacing 0.2em; score and best score 36px bold; "Game Over" 48px; final score 60px; button 20px.

## 4. Layout
- Single centred column, max width 448px, max height 100dvh, horizontal padding 16px, vertical gap 12px. Vertically centred in viewport.
- Order: Header (title + Sound button left, SCORE and BEST grouped right) → Settings Bar ("Highlight Clears" label + iOS toggle slider) → Board → Tray.
- Settings Bar: compact `padding: 6px 12px`, `border-radius: 10px`, background `--tray-bg`. Contains label and a smooth 44×24px iOS-style sliding pill toggle switch.
- Board: square (aspect 1:1), responsive width `min(100%, calc(100dvh - 250px))`, max 416px, 8×8 CSS grid, 3px gap + 3px padding, radius 16px.
  Shadow: `inset 0 2px 8px rgb(0 0 0/50%), 0 20px 50px -20px rgb(0 0 0/70%)`.
- Tray: 3 equal columns, 8px gap, 8px padding, each slot 98px tall (88px on short viewports), piece centred. Radius 16px.
- Same layout on mobile and tablet (board scales with viewport height and width so nothing is pushed offscreen); see 05-mobile.

## 5. Cells & blocks
- All cells radius 6px.
- Filled block: piece colour + `inset 0 -4px 0 rgb(0 0 0/25%), inset 0 3px 0 rgb(255 255 255/30%)` (glossy bevel).
- Tray pieces drawn at 22px per cell (scaled-down), 3px gaps.
- Placement preview: target cells filled with the dragged piece's colour at 40% opacity. Only shown when placement is valid; nothing shown when invalid.
- Line completion highlight: rows and columns that would complete render with a pulsing 2px glowing outline (`oklch(0.97 0.01 90 / 95%)`) and inner/outer box shadow glow.

## 6. Interaction states
- Tray piece hover: scale 1.05, cursor grab.
- Dragging: tray slot empties; floating proxy follows pointer at full board cell size, 90% opacity, large drop shadow.
  - On touch devices: offset 60px **above** the pointer so the finger doesn't hide it.
  - On mouse/desktop: centered directly on the cursor.
  - Snap target = proxy's top-left rounded to nearest cell.
- Invalid release: piece reappears in its slot (no animation required; optional 150ms ease back).
- Placed slot stays empty until all 3 are used, then 3 new pieces appear.
- Page uses `user-select:none; touch-action:none`.

## 7. Feedback & motion
- Score change on line clear: "pop" — scale 1.4 → 1 over 350ms ease-out.
- Confetti on ≥1 line clear: canvas over the board (extends 40px beyond it), ~140 small rectangles in block palette colours, burst from board centre (random vx ±7, vy −2…−16), gravity 0.4/frame, spinning, ~90 frames (~1.5s), then cleared.
- Game Over overlay fades in.

## 8. Game Over modal
Covers the board only (radius matches board), --overlay + blur. Centred stack: "Game Over" (foreground) → "Final score" (muted) → score (amber, 60px) → 32px gap → **Play Again** pill button: amber fill, navy text, padding 14px 40px, `box-shadow: 0 6px 0 --button-shadow`; on press translateY(4px) and shadow shrinks to 2px (physical press).

## 9. Audio & Persistence
- Procedural Web Audio API sound effects (no external audio assets):
  - Pick up: short ascending soft tone (300Hz → 600Hz).
  - Placement: low tactile pop/thud (240Hz → 120Hz).
  - Line clear: bright chord chime / sweep (587Hz, 740Hz, 880Hz, 1175Hz).
  - Game over: gentle descending minor cadence (520Hz, 466Hz, 415Hz, 349Hz).
  - Mobile audio session unlock via inline silent WAV element (bypasses iOS hardware silent switch).
- Persistence & Settings:
  - Best / High Score stored in browser `localStorage` under key `blockfall_best_score`.
  - Sound toggle state stored in `localStorage` under key `blockfall_sound_enabled`.
  - Line completion highlight setting stored in `localStorage` under key `blockfall_highlight_clears`.

## 10. Implementation notes
- Plain HTML/CSS/JS is fine: board = CSS grid of divs; drag via Pointer Events (pointerdown on tray piece, pointermove/pointerup on window) to cover mouse and touch.
- Keep all colours as CSS variables; no hard-coded colours in markup.
