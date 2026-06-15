# Polytopia Clone

## Tech Stack
- Phaser 3 (2D game framework)
- TypeScript
- Vite (bundler)
- vitest (unit tests)
- Playwright (E2E tests)
- Colyseus (multiplayer, Phase 3+)

## Project Structure
```
src/
  hex/          # Hex grid math + rendering
  scenes/       # Phaser scenes (GameScene, MenuScene, etc.)
  entities/     # Game objects (City, Unit, Tribe, Tile)
  ai/           # AI opponent logic
  multiplayer/  # Colyseus client (Phase 3)
tests/
  hex.test.ts   # Hex math tests
public/
  assets/sprites/  # Generated sprite sheets
```

## Conventions
- Hex coordinates: Axial (q, r) system
- Grid: Pointy-top hexagons, offset layout
- State machine: pure functions, no side effects
- Tests before implementation for all math/logic
- Sprites generated via ComfyUI MCP (Phase 2+)

## Development Loop
1. Run `npm test` before any commit
2. Run `npm run dev` for local preview
3. E2E tests via Playwright on Chromium
