# AGENTS.md — Polytopia Clone

## About
Turn-based strategy game inspired by The Battle of Polytopia. Hex grid, tech tree, city management, combat.
Status: **active** — see GDD.md for the full spec.

## Architecture
- **Stack**: TypeScript + Phaser 3.90.0 (WebGL), Vite build, Vitest unit tests, Playwright E2E
- **Key dirs**:
  - `src/scenes/` — Phaser scenes (BootScene, SelectScene, GameScene)
  - `src/entities/` — Game logic (Unit, City, Tribe, CombatSystem, TechTree, etc.)
  - `src/hex/` — Hex grid (HexCoord, MapGenerator, Tile)
  - `src/ai/` — AI opponent (BasicAI)
  - `tests/` — Unit tests (Vitest) + E2E gameplay tests (Playwright)
  - `GDD.md` — **Living Game Design Document** (source of truth for all mechanics)
- **Serving**: `npx serve dist -p 3001 --cors`, tunneled via Cloudflare to `hex.codeovertcp.com`

## Conventions
- All **unit tests** must pass before commit: `npx vitest run`
- **Build** must pass: `npm run build`
- **E2E tests** run but don't block: `npx playwright test`
- Commit message format: `"GDD §N: description of change"`
- When implementing a feature, reference its GDD section (e.g. "GDD §4.1: fix damage formula")
- When GDD.md changes, update AGENTS.md task descriptions to match
- Pre-existing TS errors from tsconfig "lib" target are ignored

### 🔴 Permanent Runtime-Play Directive
**The coach MUST play the game in a browser, like a human.** All gameplay
verification — tribe selection, map generation, city interaction, combat, tech
research, AI behaviour — MUST be validated by actually running the Phaser
canvas at `http://localhost:3001` (or `hex.codeovertcp.com`) and clicking
through the UI at real canvas pixel positions.

- **ALL** test interactions go through `page.locator('canvas').click()`
  at properly converted game → canvas coordinates.
- **NEVER** call game state functions (`handleClick`, `endTurn`, `scene.start`)
  from Playwright `page.evaluate` — that bypasses the UI and does not count
  as "playing."
- **Only READ** operations use `page.evaluate`: verify tribe name after
  selection, verify city menu opened, verify turn number advanced.
- This applies to the Coach (during review cycles) and to E2E tests (which
  are the Coach's automated play verification).
- A review that did not play the game in a browser is not a valid review.

## Non-Blocking Review Process

### How this works
1. **Tasks reference GDD.md sections.** Each task says what GDD section it implements.
2. **I work through tasks in order.** Each task is a single commit + deploy.
3. **You review asynchronously.** Visit `hex.codeovertcp.com` at any time, play the game, inspect what's changed.
4. **You feed back by modifying AGENTS.md or GDD.md.**
   - Change the spec in `GDD.md` → I'll see it on the next task.
   - Reorder/add/remove tasks in this file → I'll pick up the new backlog.
   - Add a `[BLOCKER]` note to a task → I'll stop and address it.
5. **No blocking.** The pipeline continues between your reviews. Every commit is self-contained and deployed.

### What to check when reviewing
- Does the implemented feature match the GDD spec?
- Play the game at `hex.codeovertcp.com` — does it feel right?
- Check `git log` for what changed since your last review.
- Run `npx vitest run` to verify tests still pass.

---

## Skills
| Skill | When | Why |
|-------|------|-----|
| `spec-driven-project-audit` | Project status reports, verifying claims | Runtime-first Playwright protocol — only what the browser shows counts |
| `subagent-driven-development` | Complex multi-file changes | Parallel implementation with isolation |

---

## Tasks (Referenced to GDD.md)

> **NOTE:** `GDD.md §X` means the task implements section X of GDD.md.

---

### Backlog: Damage Formula + Combat Fixes

#### Task: gdd-4.1-damage-formula
- **Status**: ✅ Complete (commit pending)
- **GDD**: §4.1, §4.2, §4.3
- **Description**: Replace approximated damage formula with the real Polytopia formula: `round((attackForce / totalForce) × atk × 4.5)`. Add proper defense bonus values (1.0/1.5/4.0). Remove old getTileDefenseBonus helper.
- **Success criteria**: CombatSystem uses the real formula. Unit tests validate known combat outcomes.

#### Task: gdd-4.6-healing
- **Status**: 🔲 Pending
- **GDD**: §4.6
- **Description**: Implement healing system. Units that skip their turn heal +4 HP in friendly territory, +2 in neutral/enemy. Cannot exceed max HP.
- **Success criteria**: Unit next to own city can heal by not moving. Health bar updates. Heal amount is correct per territory type.

#### Task: gdd-4.5-melee-advance
- **Status**: 🔲 Pending
- **GDD**: §4.5
- **Description**: When a melee unit kills an enemy, it advances into the defender's tile. Currently Warriors don't move after killing.
- **Success criteria**: Unit moves into enemy tile after kill. Ranged units don't advance.

---

### Backlog: City Upgrades (Real Choices)

#### Task: gdd-5.3-city-upgrade-choices
- **Status**: 🔲 Pending
- **GDD**: §5.3
- **Description**: Replace linear city upgrade with real choice system. L2: Workshop(+1⭐/t) or Explorer(2 scouts). L3: City Wall(×4 def) or Resources(+5⭐). L4: Population(+3 pop) or Border Growth. L5: Park(+1⭐/t, +250 score) or Super Unit(Giant).
- **Success criteria**: City upgrade menu shows two choices. Choosing Workshop gives +1⭐/t. Explorer spawns 2 scouts on nearby tiles. City Wall gives ×4 defense. Etc.

#### Task: gdd-5.4-buildings-real-costs
- **Status**: 🔲 Pending
- **GDD**: §5.4
- **Description**: Adjust building costs/effects to match GDD. Lumber Hut costs 3⭐ (currently hardcoded). Port costs 7⭐. Verify all building effects match spec.
- **Success criteria**: Costs match GDD. Building bonuses match GDD.

---

### Backlog: Naval System

#### Task: gdd-3.2-naval-chain
- **Status**: 🔲 Pending
- **GDD**: §3.2, §2.2
- **Description**: Implement full naval chain. Port building enables Raft (free embark). Raft can upgrade to Scout(5⭐) or Rammer(5⭐) at any port city. Rammer upgrades to Bomber(15⭐). Water movement costs 1. Units without Port cannot enter water.
- **Success criteria**: Unit on coast adjacent to port city can embark as Raft. Raft can move on water. Upgrade path works. Movement costs correct.

---

### Backlog: Neutral Villages

#### Task: gdd-2.5-villages
- **Status**: 🔲 Pending
- **GDD**: §2.5
- **Description**: Spawn neutral villages on the map at game start (not on tribe start positions, not on map edges, min 3 tiles apart). Unit that ends turn on a village captures it. Village becomes a level-1 city. AI captures villages.
- **Success criteria**: Villages visible on map at game start. Unit can capture by moving onto village. Captured village becomes player city. AI captures villages too.

---

### Backlog: AI Improvements

#### Task: gdd-7-ai-heal
- **Status**: 🔲 Pending
- **GDD**: §7
- **Description**: AI should heal damaged units in friendly territory instead of always moving toward enemies. Units below 50% HP and within 2 tiles of a friendly city should skip their turn to heal.
- **Success criteria**: AI units with low HP near cities don't move. They heal and show increased HP next turn.

#### Task: gdd-7-ai-tech-priority
- **Status**: 🔲 Pending
- **GDD**: §6, §7.1
- **Description**: AI should prioritize techs that unlock units it can afford. If it has >10 stars and no unit to train, research a unit-unlocking tech first. If it has units but no upgrades, upgrade cities.
- **Success criteria**: AI tech choices are smarter. AI unlocks Archery then trains Archers.

---

### Backlog: Polish & Balance

#### Task: gdd-9.1-starting-stars
- **Status**: 🔲 Pending
- **GDD**: §9.1
- **Description**: Set correct starting stars per GDD: human 15⭐, AI 10⭐. AI gets 5⭐/turn base + city production.
- **Success criteria**: Starting stars match spec. AI income matches spec.

#### Task: gdd-3.4-unit-skills-escape-persist
- **Status**: 🔲 Pending
- **GDD**: §3.3
- **Description**: Implement Escape (Rider retreats 1 tile when attacked) and Persist (Knight attacks again after kill) skills.
- **Success criteria**: Rider hit in melee moves 1 tile away. Knight killing an adjacent unit can attack another enemy in range.

#### Task: gdd-4.2-city-wall-defense
- **Status**: ✅ Complete (commit pending)
- **GDD**: §4.2, §5.3
- **Description**: When a city has City Wall upgrade, Fortify units inside get ×4 defense bonus. Show double-shield indicator on the unit. Units without Fortify get no bonus.
- **Success criteria**: Defender in walled city takes significantly less damage. Warrior in walled city takes standard damage (no Fortify). Visual indicator present.

---

---

## Active Tasks (Tracked via Checkpoint)

Ordered by priority. Each task is one unit of work for one player tick.

### Task: gdd-4.6-healing
- **Description**: Units that skip their turn heal +4 HP in friendly territory, +2 in neutral/enemy. Cannot exceed max HP. Add a "skip turn" action button and heal logic.
- **Success criteria**:
  - Unit in friendly territory that skips turn heals +4 HP
  - Unit in neutral/enemy territory that skips turn heals +2 HP
  - Unit at max HP cannot exceed max HP
  - Health bar visually updates after heal
- **Coach checks**:
  - Check combat after healing: a wounded unit should have more HP after skipping a turn
  - Verify the skip-turn action is available from the unit action menu
  - Check edge case: unit at 1 HP skips turn in friendly territory → 5 HP (not 0 or over max)

### Task: gdd-4.5-melee-advance
- **Description**: When a melee unit kills an enemy, it advances into the defender's tile. Currently Warriors don't move after killing. Ranged units (Archers) should NOT advance.
- **Success criteria**:
  - Melee unit (Warrior, Swordsman, Knight, Rider, Defender) moves into defender's tile on kill
  - Ranged unit (Archer) does NOT advance on kill
  - Advance happens immediately after the kill animation/resolution
- **Coach checks**:
  - Verify warrior advances into city tile after killing defender inside city
  - Verify archer stays in place after killing enemy
  - Check multi-attack case: Knight with Persist skill kills first enemy, advances, then second attack should be from new position

### Task: gdd-5.4-buildings-real-costs
- **Description**: Adjust building costs/effects to match GDD §5.5. Lumber Hut costs 3⭐ (currently hardcoded). Port costs 7⭐. Verify all building effects match spec.
- **Success criteria**:
  - Lumber Hut cost is 3⭐
  - Port cost is 7⭐
  - Mine cost is 5⭐
  - Farm cost is 5⭐
  - All building bonuses match GDD §5.5
- **Coach checks**:
  - Load game, found city, verify costs in city building menu
  - Run unit tests — all 228+ tests still pass
  - Check edge case: city with 0 stars shows buildings greyed out

### Task: gdd-9.1-starting-stars
- **Description**: Set correct starting stars per GDD: human player starts with 15⭐, AI players with 10⭐. AI gets 5⭐/turn base + city production. Verify through gameplay and tests.
- **Success criteria**:
  - New game: human player has 15⭐ on turn 1
  - New game: AI players have 10⭐ on turn 1
  - AI income per turn: 5⭐ base + city production
- **Coach checks**:
  - Start a new game and verify the star count in the HUD
  - Check AI star count by inspecting AI state
  - Star income should increase after capturing a city

### Task: gdd-3.4-unit-skills-escape-persist
- **Description**: Implement Escape (Rider retreats 1 tile when attacked) and Persist (Knight attacks again after kill) skills per GDD §3.3.
- **Success criteria**:
  - Rider hit in melee moves 1 tile away from attacker (Escape)
  - Knight killing an adjacent unit can attack another enemy in range (Persist)
  - Escape only triggers on successful hit (not on miss)
- **Coach checks**:
  - Move Rider next to enemy Warrior, attack Rider, verify it retreats 1 tile
  - Move Knight next to two adjacent enemies, attack and kill first, verify second attack is possible
  - Check edge case: Rider cannot retreat (obstacle/edge) — unit takes normal damage instead

## Task Key
- ✅ Complete
- 🔲 Pending
- ⚠️ Blocked (reason in task)
- 🔄 In progress

---

### Task: gdd-2.2-per-type-map-gen
- **Description**: Implement per-type map generation algorithms. Currently `MapGenerator` uses a single radial gradient for all 4 map types (Continents, Waterworld, Pangea, Islands). Each type should produce distinctly different terrain layouts: Continents = large landmasses with oceans, Waterworld = mostly water with small islands, Pangea = one huge continent, Islands = many small scattered islands. Also add Waterworld and Pangea to the `MapType` enum if missing.
- **Success criteria**:
  - `MapGenerator.generate(mapType)` produces visually distinct terrain for each of the 4 map types
  - Waterworld and Pangea exist in the `MapType` enum and are selectable in `SelectScene`
  - Each map type has its own generation algorithm (not just parameter tweaks of the same algorithm)
  - All 228+ existing tests still pass
- **Coach checks**:
  - Start 4 new games with each map type, verify terrain layout is visually distinct
  - Check that Waterworld has mostly water tiles, Pangea has one dominant landmass
  - Verify tribe starting positions are on land for all map types
  - Run `npx vitest run` — no regressions

### Task: gdd-5.2-border-expansion
- **Description**: Implement city border expansion. Currently cities have a fixed 3×3 territory. Per GDD §5.2, cities should expand their territory as they grow: L1=3×3, L2=5×5, L3=7×7, L4=9×9, L5=11×11. Territory determines which tiles generate stars for the city. Show territory boundary visually on the map (subtle colored border tiles).
- **Success criteria**:
  - City territory radius increases with city level (L1=1 tile radius, L2=2, L3=3, L4=4, L5=5)
  - Territory boundary is visually indicated on the map (colored tiles or subtle grid)
  - Star income calculation uses expanded territory tiles
  - All 228+ existing tests still pass
- **Coach checks**:
  - Found a city, upgrade it through levels, verify territory grows visually
  - Check that star income increases as territory expands
  - Verify two cities' territories can overlap (no crash)
  - Run `npx vitest run` — no regressions

### Task: gdd-4.4-veteran-system
- **Description**: Implement the veteran system per GDD §4.4. When a unit accumulates 3 kills, it gains +5 max HP and full heal. Promotion can be deferred ("banked") for tactical timing. Naval units, super units, and summoned entities are excluded. Show a veteran badge (star icon) on veteran units.
- **Success criteria**:
  - Unit kill count tracked per unit (separate from unit type)
  - After 3 kills, unit gains +5 max HP and current HP set to new max
  - Veteran status is "banked" — player can trigger promotion from unit action menu
  - Veteran units show a visual badge (star icon or border glow)
  - Naval units, Giants, and summoned units are excluded from veteran system
  - 3+ new tests for veteran mechanics
- **Coach checks**:
  - Kill 3 enemies with a Warrior, verify veteran promotion option appears
  - Promote veteran, verify HP increased by 5 and unit is fully healed
  - Check that naval units and Giants don't get veteran after 3 kills
  - Run `npx vitest run` — all tests pass

### Task: gdd-2.4-ancient-ruins
- **Description**: Implement ancient ruins on the map per GDD §2.4. Ruins spawn at game start (4 on Tiny to 23 on Massive), scattered across the map, not adjacent to villages. When a unit ends turn on a ruin, it reveals a randomized reward: veteran unit, free tech, or star injection. Ruins are visible on the map as distinct tiles (e.g., stone icon) through fog-of-war.
- **Success criteria**:
  - Ancient ruins spawn at game start with count based on map size
  - Ruins are visible on map (distinct tile appearance) and persist until discovered
  - Unit ending turn on a ruin triggers a reward popup (random: veteran unit, free tech, or star bonus)
  - Ruins cannot spawn adjacent to villages (min 2-tile distance)
  - 3+ new tests for ruin spawning and reward mechanics
- **Coach checks**:
  - Start a new game, verify ruins are visible on the map before discovery
  - Move a unit onto a ruin, verify reward popup appears
  - Check that ruins don't spawn next to villages
  - Run `npx vitest run` — all tests pass

### Task: gdd-5.8-siege-mechanics
- **Description**: Implement siege mechanics per GDD §5.8. When an enemy unit ends turn on a city's central tile, the city enters Siege state: star income drops to 0, city interface is locked (no unit queue or building). Siege persists until the defender destroys the occupying unit or the attacker initiates capture. Show siege visual indicator (red border/flashing) on besieged cities.
- **Success criteria**:
  - Enemy unit ending turn on city central tile triggers siege
  - Besieged city produces 0 stars/turn
  - Besieged city cannot build units or buildings (UI locked)
  - Siege ends when occupying unit is killed or city is captured
  - Visual siege indicator on the city tile (red border or similar)
  - 3+ new tests for siege trigger, income lock, and siege break
- **Coach checks**:
  - Move enemy unit onto city tile, end turn, verify siege activates
  - Verify city produces 0 income while besieged
  - Kill the besieging unit, verify siege lifts and city functions normally
  - Run `npx vitest run` — all tests pass

### Task: gdd-4.2-poison-status
- **Description**: Implement poison status effect per GDD §4.2. When a unit is attacked by a unit with poison (e.g., Archer with poison skill), the poisoned unit takes 1 damage at the start of each turn for 3 turns. Show poison indicator (green skull icon) on affected units. Poison does not stack — re-applying resets the duration.
- **Success criteria**:
  - Unit hit by poison takes 1 damage at start of next 3 turns
  - Poison indicator visible on affected unit
  - Poison does not stack (re-apply resets duration)
  - 3+ new tests for poison damage, duration, and indicator
- **Coach checks**:
  - Attack unit with poison-enabled attacker, verify poison indicator appears
  - End turn 3 times, verify 1 damage per turn
  - Re-apply poison, verify duration resets (not stacks)
  - Run `npx vitest run` — all tests pass

### Task: gdd-8-fog-of-war
- **Description**: Implement fog-of-war per GDD §8. Units reveal tiles within their vision range (2 tiles for most, 3 for Scout/Giant). Unrevealed tiles show as black fog. Enemy units in fog are not visible. Revealed but out-of-range tiles show as dimmed/explored. Each tribe only sees their own fog state.
- **Success criteria**:
  - Unrendered tiles show as black fog at game start
  - Units reveal tiles within 2-tile radius
  - Enemy units not in vision range are hidden
  - Previously revealed but out-of-range tiles show as dimmed
  - Fog state is per-tribe (each player sees their own fog)
  - 3+ new tests for vision range, fog reveal, and unit visibility
- **Coach checks**:
  - Start game, verify fog covers unexplored areas
  - Move a unit, verify tiles around it are revealed
  - Move Scout (3-tile vision), verify greater range
  - Run `npx vitest run` — all tests pass

### Task: gdd-3.1-cloak-unit
- **Description**: Implement Cloak unit per GDD §3.1. Cloak is a naval unit that can submerge (hide from all enemy units except adjacent ones). While submerged, Cloak cannot be targeted by attacks but also cannot attack. Cloak can emerge to attack. Costs 8⭐ at Port. Requires Sailing tech.
- **Success criteria**:
  - Cloak unit type exists with submerge/emerge action
  - Submerged Cloak is invisible to non-adjacent enemies
  - Submerged Cloak cannot attack or be attacked
  - Cloak can emerge and attack on same turn (if has action remaining)
  - Cloak costs 8⭐ and requires Sailing + Port
  - 3+ new tests for submerge, emerge, and targeting rules
- **Coach checks**:
  - Build Cloak at Port (8⭐), verify it exists
  - Submerge Cloak, verify enemy can't see/target it
  - Emerge and attack, verify attack works
  - Run `npx vitest run` — all tests pass

### Task: gdd-6.3-mind-bender-unit
- **Description**: Implement Mind Bender unit per GDD §3.4. Mind Bender is a special unit with Convert skill: can convert an adjacent enemy unit to your tribe. Costs 12⭐. Requires Philosophy tech. Has low combat stats (2 atk, 2 def, 3 hp). One conversion per turn.
- **Success criteria**:
  - Mind Bender unit type exists (2 atk, 2 def, 3 hp)
  - Convert action available when adjacent to enemy unit
  - Converted unit changes tribe ownership
  - Cannot convert naval units or Giants
  - Costs 12⭐ and requires Philosophy
  - 3+ new tests for convert, exclusion rules, and tribe transfer
- **Coach checks**:
  - Build Mind Bender (12⭐), verify stats
  - Move adjacent to enemy unit, verify Convert action appears
  - Convert enemy unit, verify it changes tribe
  - Try to convert naval unit, verify blocked
  - Run `npx vitest run` — all tests pass

### Task: gdd-3.3-stiff-splash-skills
- **Description**: Implement Stiff and Splash unit skills per GDD §3.3. Stiff: unit cannot move after attacking AND attacker takes no retaliation damage (applied to Catapult, Giant, Bomber, Raft). Splash: Bomber deals half damage (rounded down) to all adjacent enemies after the primary attack.
- **Success criteria**:
  - Catapult, Giant, Bomber, Raft have Stiff skill flag
  - Units with Stiff cannot move after attacking
  - Attacks against Stiff units deal no retaliation damage
  - Bomber's Splash deals floor(damage/2) to all enemies adjacent to the primary target
  - 3+ new tests for Stiff and Splash mechanics
- **Coach checks**:
  - Attack with Catapult, verify it cannot move afterward
  - Attack a Catapult, verify no retaliation damage is dealt
  - Use Bomber to attack a unit adjacent to 2 enemies, verify splash damage
  - Run `npx vitest run` — all tests pass

### Task: gdd-4.7-battle-preview
- **Description**: Implement battle preview UI per GDD §4.7. When hovering over a valid attack target, show predicted damage for both attacker and defender. Show sweating animation on target if predicted damage ≥ target's current HP (guaranteed kill). Show black/red ring on attacker if predicted counter-attack would be lethal.
- **Success criteria**:
  - Hovering over an enemy unit shows predicted attack damage and counter-attack damage
  - Guaranteed kill shows sweating animation on the target
  - Lethal counter-attack shows warning ring on the attacker
  - Preview updates dynamically based on attacker's current health
  - 3+ new tests for preview calculation accuracy
- **Coach checks**:
  - Hover over weak enemy, verify sweating animation appears
  - Hover over strong enemy that would kill attacker, verify warning ring
  - Verify preview numbers match actual combat results
  - Run `npx vitest run` — all tests pass

### Task: gdd-8.4-ai-low-hp-targeting
- **Description**: Improve AI attack priority per GDD §8.4. Currently the AI attacks the first adjacent enemy found. It should prioritize low-HP targets to secure guaranteed kills, build veteran progress, and eliminate retaliation threats. Sort attack targets by ascending current HP, then by descending attack value for ties.
- **Success criteria**:
  - AI evaluates all adjacent enemies before choosing attack target
  - AI attacks the lowest-HP adjacent enemy first
  - For equal HP, AI attacks the unit with highest attack value (biggest threat)
  - 2+ new tests verifying target selection order
- **Coach checks**:
  - Place AI unit adjacent to two enemies (one low HP, one high HP), verify AI targets low HP
  - Place AI unit adjacent to two equal-HP enemies, verify AI targets higher-attack one
  - Run `npx vitest run` — all tests pass

### Task: gdd-5.6-explorer-pathfinding
- **Description**: Implement autonomous Explorer pathfinding per GDD §5.6. When a city chooses Explorer at L2, the explorer unit gets 15 autonomous movement steps using BFS. Scoring: clearing 4-5 fog tiles = 110 (optimal), 1 tile = 173 (suboptimal). Distance penalty: +100 per BFS step. Anti-backtracking: heavily penalize recently traversed tiles.
- **Success criteria**:
  - Selecting Explorer at L2 spawns an explorer unit that moves autonomously
  - Explorer uses BFS capped at 3 iterations per step
  - Explorer prioritizes tiles that reveal the most fog (4-5 new tiles optimal)
  - Explorer avoids recently traversed tiles
  - Explorer stops after 15 steps or when no beneficial moves remain
  - 3+ new tests for pathfinding scoring and movement
- **Coach checks**:
  - Upgrade city to L2, choose Explorer, verify explorer spawns and moves
  - Verify explorer moves toward unexplored areas
  - Verify explorer doesn't revisit recent tiles
  - Run `npx vitest run` — all tests pass

---

## Active Tasks (Generated by Coach — 2026-06-19)

> These tasks were auto-generated by the Coach after detecting that all previously listed tasks were completed.

### Task: gdd-5.7-trade-routes
- **Description**: Implement trade routes and city connections per GDD §5.7. Roads (terrestrial) and Bridges (aquatic) halve movement cost. City Connections grant +1 population to both connected cities. Grand Bazaar: completing 5 city connections → +3 population +400 Perfection score. Ports act as network nodes; water gap ≤ 5 tiles.
- **Success criteria**:
  - Roads can be built on land tiles, Bridges on water tiles
  - Units on road/bridge tiles have halved movement cost
  - City Connection detected when continuous road/bridge/port path links two cities
  - Connected cities get +1 population each
  - Grand Bazaar bonus triggers at 5 connections (+3 pop, +400 score)
  - 3+ new tests for road building, connection detection, and Grand Bazaar
- **Coach checks**:
  - Build a road between two cities, verify connection forms
  - Check population bonus applied to both cities
  - Verify Grand Bazaar score bonus at 5 connections
  - Run `npx vitest run` — all tests pass

### Task: gdd-2.4-resource-proximity
- **Description**: Implement resource proximity constraint per GDD §2.4. Resources (Animals, Fish, Fruit, Metal, Crops) should only spawn within a 2-tile radius of a city or neutral village. Currently resources spawn globally. This enables predictive triangulation of hidden villages.
- **Success criteria**:
  - Resources only spawn within 2 tiles of a city or village
  - No resources spawn in "wilderness" beyond 2-tile radius of any city/village
  - Existing map generation still produces valid maps
  - 3+ new tests for resource proximity validation
- **Coach checks**:
  - Start a new game, verify resources are only near cities/villages
  - Check that wilderness tiles have no resources
  - Verify map still generates without errors
  - Run `npx vitest run` — all tests pass

### Task: gdd-3.2-scout-disembark-vision
- **Description**: Implement Scout 5×5 vision reveal on disembark per GDD §3.2. When a Scout naval unit disembarks back to land, it should reveal all tiles in a 5×5 area around the disembark tile. This rewards naval exploration with map knowledge.
- **Success criteria**:
  - Scout unit disembarking reveals 5×5 tile area around disembark point
  - Vision reveal works even in fog-of-war
  - Only triggers on Scout (not Raft/Rammer/Bomber)
  - 2+ new tests for disembark vision reveal
- **Coach checks**:
  - Embark a unit as Scout, sail to distant coast, disembark
  - Verify 5×5 area around disembark tile is revealed
  - Check that Raft disembark does NOT trigger vision reveal
  - Run `npx vitest run` — all tests pass

### Task: gdd-4.3-fog-retaliation-suppress
- **Description**: Implement fog-of-war retaliation suppression per GDD §4.3. When a unit attacks from a fogged tile (attacker not visible to defender), the defender should not retaliate. Currently retaliation always happens if defender survives.
- **Success criteria**:
  - Attacking from fog (attacker not visible to defender) suppresses retaliation
  - Defender still takes damage from the attack
  - Retaliation works normally when attacker is visible
  - 2+ new tests for fog retaliation suppression
- **Coach checks**:
  - Move unit into fog near enemy, attack from fog — verify no retaliation
  - Attack from visible tile — verify retaliation works normally
  - Run `npx vitest run` — all tests pass

### Task: gdd-6.2-extended-tech-tree
- **Description**: Add missing tech series to the tech tree per GDD §6.2. Add: Climbing (tier 1, unlocks Mountain movement), Organization (tier 1, +1 population per city), Farming (tier 1, +1 food), Smithery (tier 2, unlocks Swordsman — currently gated by Chivalry incorrectly), Aquaculture (tier 2, unlocks Rammer — currently gated by Sailing incorrectly), Strategy (tier 2, unlocks Defender). Fix Swordsman gate from Chivalry → Smithery. Fix Rammer gate from Sailing → Aquaculture.
- **Success criteria**:
  - 6 new techs added: Climbing, Organization, Farming, Smithery, Aquaculture, Strategy
  - Swordsman requires Smithery (not Chivalry)
  - Rammer requires Aquaculture (not Sailing)
  - Tech tree UI shows all techs with correct dependencies
  - 3+ new tests for new tech unlocks
- **Coach checks**:
  - Research Smithery, verify Swordsman unlocks
  - Research Aquaculture, verify Rammer unlocks
  - Check tech tree UI renders all 17 techs correctly
  - Run `npx vitest run` — all tests pass

---

## Active Tasks (Generated by Coach — 2026-06-19 Phase 2)

> These tasks were auto-generated by the Coach after approving gdd-6.2-extended-tech-tree and detecting that all previously listed tasks were completed. Next frontier: special tribes (GDD §7).

### Task: gdd-10.1-polaris-tribe
- **Description**: Implement the Polaris special tribe per GDD §7.1. Polaris replaces maritime navigation with cryogenic terraforming. Key mechanics: Freeze (convert water→ice, terrain→tundra), Mooni (pacifist unit that auto-freezes adjacent tiles), Battle Sled (ice mobility, crippled on land), Gaami (super unit, 30 HP, mass freeze), Ice Bank (replaces Customs House, income scales with frozen tiles). Tech replacements: Frostwork, Sledding, Polar Warfare, Polarism.
- **Success criteria**:
  - Polaris tribe selectable in tribe selection screen
  - Mooni unit exists with auto-freeze adjacent tiles ability
  - Battle Sled unit exists with ice/land movement differentiation
  - Gaami super unit exists (30 HP, mass freeze ability)
  - Ice Bank building exists with income scaling by frozen tile count
  - Freeze mechanic converts water→ice and terrain→tundra
  - 5+ new tests for Polaris-specific mechanics
- **Coach checks**:
  - Select Polaris, start game, verify Mooni spawns and freezes adjacent tiles
  - Build Battle Sled, verify it moves on ice but is crippled on land
  - Verify Gaami mass freeze ability works
  - Check Ice Bank income scales with frozen tiles
  - Run `npx vitest run` — all tests pass

### Task: gdd-10.2-cymanti-tribe
- **Description**: Implement the Cymanti special tribe per GDD §7.2. Cymanti features organic economy: Fungi (replaces crops), Mycelium networks (roads that heal), Algae (bridges water without Ports). Venom mechanic: poison strips terrain/structure defense bonuses (×0.7 multiplier). Units: Centipede (Eat/Grow skill, head death → segment becomes new head), Hexapods (Creep/Sneak, ignore ZOC), Doomux (Explode AoE suicide). No Ports — Hydrology tech cultivates Algae on water tiles.
- **Success criteria**:
  - Cymanti tribe selectable in tribe selection screen
  - Fungi resource replaces crops in Cymanti economy
  - Mycelium network acts as road with healing effect
  - Algae allows water crossing without Port
  - Venom applies ×0.7 defense penalty to enemies
  - Centipede, Hexapods, Doomux units exist with unique skills
  - 5+ new tests for Cymanti-specific mechanics
- **Coach checks**:
  - Select Cymanti, start game, verify organic economy works
  - Build Centipede, verify Eat/Grow skill
  - Use Hexapod to ignore ZOC
  - Verify Doomux Explode AoE
  - Run `npx vitest run` — all tests pass

### Task: gdd-10.3-elyrion-tribe
- **Description**: Implement the Elyrion special tribe per GDD §7.3. Elyrion restrictions: Cannot Clear/Burn Forest, cannot harvest wild animals. Sanctuary: +1⭐/turn per adjacent wild animal; spawns new animal every 3 turns. Enchantment: Spend 3⭐ to transform wild animal into Polytaur (3 Atk, 1 Def, independent — doesn't count toward population cap). Dragon maturation: Egg (0 Atk, 2 Def) → Baby Dragon (flight, ranged) → Fire Dragon (flight, Splash AoE). Prophetic Vision: Can see unrevealed ancient ruins through fog (rainbow flames).
- **Success criteria**:
  - Elyrion tribe selectable in tribe selection screen
  - Cannot clear/burn forest or harvest wild animals
  - Sanctuary building gives +1⭐/turn per adjacent animal
  - New animal spawns every 3 turns near Sanctuary
  - Enchantment converts wild animal to Polytaur for 3⭐
  - Dragon maturation chain: Egg → Baby Dragon → Fire Dragon
  - Prophetic Vision shows ancient ruins through fog
  - 5+ new tests for Elyrion-specific mechanics
- **Coach checks**:
  - Select Elyrion, start game, verify forest/animal restrictions
  - Build Sanctuary, verify star income from adjacent animals
  - Enchant animal, verify Polytaur creation
  - Verify Dragon maturation chain
  - Run `npx vitest run` — all tests pass

### Backlog: Documentation Accuracy

#### Task: update-gdd-gaps-section
- **Status**: 🔲 Pending
- **GDD**: §9
- **Description**: The GDD §9 "Gaps vs Real Polytopia" section is massively outdated — it claims dozens of features are "not implemented" when they actually are fully implemented in code. Audit the entire §9 section against the actual codebase and update all incorrect `[ ]` markers to `[x]`. Features confirmed implemented: Stiff, Splash, Cloak/submerge, Mind Bender (Convert+Heal), Battle preview, Fog retaliation suppression, Scout 5×5 disembark vision, Aquaculture tech, Border expansion, Explorer pathfinding, Trade routes + Grand Bazaar, Per-type map generation (6 algorithms), Waterworld/Pangea map types, Ancient ruins, Resource proximity constraint, Extended tech tree (Climbing/Organization/Farming/Smithery/Aquaculture/Strategy), Polaris/Cymanti/Elyrion tribes, Park scoring. Features genuinely not implemented: scoring extensions (territorial, exploration, monuments, temples) — GDD main text defers these as "require further design decisions". Leave those as `[ ]`.
- **Success criteria**: GDD §9 checklist matches actual implementation status. Running `grep -c "\- \[ \]" GDD.md` in the gaps section shows only the genuinely unimplemented items (scoring extensions). No features marked `[ ]` that exist in code.
- **Coach checks**: Pick 5 random `[ ]` items from the old gaps section and verify in code that they are actually implemented. Verify scoring extensions are left as `[ ]` with a note about design decisions needed.
