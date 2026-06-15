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
- **Status**: 🔲 Pending
- **GDD**: §4.2, §5.3
- **Description**: When a city has City Wall upgrade, Fortify units inside get ×4 defense bonus. Show double-shield indicator on the unit. Units without Fortify get no bonus.
- **Success criteria**: Defender in walled city takes significantly less damage. Warrior in walled city takes standard damage (no Fortify). Visual indicator present.

---

## Task Key
- ✅ Complete
- 🔲 Pending
- ⚠️ Blocked (reason in task)
- 🔄 In progress
