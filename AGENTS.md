# AGENTS.md — Polytopia Clone

## About
Turn-based strategy game inspired by The Battle of Polytopia. Hex grid, 4 tribes, tech tree, city management, combat.
Status: **active** (Phase 1 complete — core combat + city building working)

## Architecture
- **Stack**: TypeScript + Phaser 3.90.0 (WebGL), Vite build, Vitest for unit tests
- **Key dirs**:
  - `src/scenes/` — Phaser scenes (BootScene, GameScene)
  - `src/entities/` — Game logic (Unit, City, Tribe, CombatSystem, GameState, TurnManager)
  - `src/hex/` — Hex grid (HexCoord, MapGenerator, Tile, constants)
  - `src/ai/` — AI opponent (BasicAI)
  - `tests/` — Vitest unit tests
  - `dist/` — Production build (served by `serve`)
- **Game flow**: BootScene → GameScene. Turn-based: human plays → AI plays → repeat. Win when one tribe eliminates all others.
- **Serving**: `npx serve dist -p 3001 --cors`, tunneled via Cloudflare to `hex.codeovertcp.com`

## Conventions
- All tests must pass before commit: `npx vitest run`
- Build must pass: `npm run build`
- Commit message format: `"Phase N: description of change"`
- No linting config currently — ignore pre-existing TS errors from `"lib"` target in tsconfig
- New unit types go in `src/entities/Unit.ts` with stats, cost, and max health
- New game mechanics go in `src/entities/` as pure functions/classes (testable)
- UI/rendering goes in `src/scenes/GameScene.ts`

## Skills
| Skill | When | Why |
|-------|------|-----|
| `subagent-driven-development` | Complex multi-file changes | Parallel implementation with isolation |

## Tasks

### Phase 2 — Tech Tree

#### Task: p2-tech-tree-ui
- **Description**: Build a tech tree panel that opens when clicking a "Tech" button. Shows 3 starting series (Hunting, Fishing, Riding) with tier 1→2→3 progression. Click a tech to research it. Tech cost = `(tier × citiesOwned) + 4`. Philosophy tech reduces remaining costs by 33%.
- **Success criteria**: Tech button visible on HUD. Panel opens showing tech tree. Clicking a tech with enough stars researches it. Tech cost formula implemented correctly. Researched techs are visibly marked.
- **Coach checks**: Cost formula matches `(tier × cities) + 4`. Stars deducted correctly. Philosophy discount applies. Panel closes on click-away.

#### Task: p2-tech-gated-units
- **Description**: Gate Archer behind Archery tech, Swordsman/knight behind Chivalry, Catapult behind Mathematics, Rider behind Riding. City menu only shows units whose tech is researched. Each tribe starts with one free starting tech (Xin-xi: Riding, Imperius: Organization, Bardur: Hunting, Oumaji: Riding).
- **Success criteria**: City menu filters to available units. Starting tech gives turn-0 unit access. AI researches techs and uses unlocked units.
- **Coach checks**: Unlocked units appear in city menu. Locked units are hidden or greyed. AI can research and use new units.

#### Task: p2-ai-tech
- **Description**: AI prioritizes tech research. Simple heuristic: if no units can be trained (all gated), research cheapest available tech. Otherwise, prefer Hunting → Archery (ranged) or Riding → Chivalry (knights).
- **Success criteria**: AI researches techs over multiple turns. AI eventually uses gated units. AI doesn't get stuck with no trainable units.
- **Coach checks**: AI tech choices follow heuristic. Stars deducted correctly. AI trains newly unlocked units in subsequent BUILD phases.

### Phase 3 — Map Economy

#### Task: p3-resource-tiles
- **Description**: Add resource types to map generation: Animals (on forest), Fish (on water), Fruit (on grass), Metal (on mountain), Crops (on grass). Each tile has a 40% chance of having a resource. Resources are rendered as colored dots on the tile. Add `Resource` enum and `TileData.resource` field.
- **Success criteria**: Map generates with resource dots visible on appropriate terrain types. Resources persist across turns. Each tile has at most one resource.
- **Coach checks**: Resource placement respects terrain constraints. Rendering uses distinct colors per resource type. No resource on SAND or SNOW.

#### Task: p3-buildings
- **Description**: Add buildable improvements: Lumber Hut (3⭐, +1 pop, on forest), Mine (5⭐, +2 pop, on metal), Farm (5⭐, +2 pop, on crops), Port (7⭐, +1 pop, on water/coast). Buildings appear as clickable options in the city menu (section below unit training). Each building consumes its tile — no other building can be built there.
- **Success criteria**: City menu shows building options when clicked on a city tile with valid adjacent resource. Building appears rendered on the map. Population increases. Stars deducted.
- **Coach checks**: Building placement respects terrain. Multiple cities don't conflict on same tile. Population increments correctly.

#### Task: p3-city-population-growth
- **Description**: Each turn, a city gains food equal to its biomes' food yield. When accumulated food >= population × 10, population increases by 1. Population determines canGrow() threshold. Display food progress in city menu. Star production scales with population (each pop gives +1⭐/turn baseline).
- **Success criteria**: Food accumulates each turn. Population grows when threshold met. City levels up when population >= level. HUD shows food progress.
- **Coach checks**: Food calculation uses adjacent biome yields. Population cap (5) works. City's `canGrow()` correctly checks current population.

### Phase 4 — Naval & Giants

#### Task: p4-port-embarkation
- **Description**: Port building enables embarking units onto adjacent water tiles. Embarked units become a Raft (1 move, cannot attack). Raft can be upgraded to Scout (5⭐, range 2, 3 move) at any port city. Movement over water requires the Sailing tech.
- **Success criteria**: Units adjacent to a port city can move onto water. Embarked unit shows as Raft with correct stats. Upgrading at port costs 5⭐. Movement over water respects movement range.
- **Coach checks**: Unit can embark/disembark. Raft has correct stats (0 atk, 1 def). Upgrade to Scout works.

#### Task: p4-super-unit-giant
- **Description**: When a city reaches level 5, the city menu gains a "SUMMON GIANT" option (cost: 0⭐, one-time). Giant has 40 HP, 5 atk, 4 def, 1 move, range 1. Spawning a Giant pushes existing units on the city tile to an adjacent hex (or destroys them if blocked).
- **Success criteria**: City at level 5 shows SUMMON GIANT. Clicking spawns a Giant at the city. Giant appears with correct stats. Existing unit on city tile is pushed.
- **Coach checks**: Giant HP (40), atk (5), def (4) match real Polytopia. Push mechanic works. Only one Giant per city.

### Phase 5 — Full Game

#### Task: p5-tribe-select
- **Description**: Before the game starts, show a tribe selection screen with 4 tribes displayed (Xin-xi, Imperius, Bardur, Oumaji). Each shows tribe name, color, and starting bonus. Human picks one, the rest are AI. Click "START" to begin.
- **Success criteria**: Tribe selection screen renders before GameScene. Player can click a tribe to select it. Starting bonuses differ per tribe. Game starts with player's chosen tribe.
- **Coach checks**: Each tribe selectable. Human is the chosen tribe. AI gets the remaining tribes.

#### Task: p5-map-types
- **Description**: Add map type selection: Continents (land masses separated by water), Lakes (single landmass with water lakes), Dryland (no water), Archipelago (many small islands). Default is Continents. Map generator produces terrain that matches the selected type.
- **Success criteria**: Map type selector on tribe select screen. Each type produces recognizably different terrain. No water on Dryland. Islands on Archipelago.
- **Coach checks**: Map gen produces coherent landmasses. Continents has navigable water. Dryland has zero water tiles.

#### Task: p5-perfection-mode
- **Description**: Add 30-turn limit mode. After 30 turns, highest score wins. Score = (cities × 100) + (units × 10) + (techs × 50) + (buildings × 25) + (city levels × 20). Display scoreboard at game end. Domination mode (eliminate all) is the default.
- **Success criteria**: Game ends at turn 30 in Perfection mode. Scoreboard shows with breakdown. Domination mode ends when one tribe remains.
- **Coach checks**: Turn counter stops at 30. Score calculation matches formula. Both modes selectable.

## .checkpoint.json
```json
{
  "project": "polytopia-clone",
  "repo": "/home/sc/repos/polytopia-clone",
  "current_task": "p2-tech-tree-ui",
  "completed": [
    {"task": "p1-unit-stats", "sha": "feea065", "date": "2026-06-15", "summary": "Real Polytopia unit stats, costs, per-type HP, Swordsman/Knight, city level bonuses"}
  ],
  "health": "tests_pass",
  "last_sha": "feea065",
  "blocker": null
}
```
