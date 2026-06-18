# GDD.md — Polytopia Clone: Living Game Design Document

> **Status:** Active — source of truth for all game mechanics.
> **Change process:** Tasks in AGENTS.md reference specific GDD sections. When the spec changes, update GDD.md first, then update AGENTS.md tasks.
>
> This document describes **real Polytopia mechanics** as the target spec. Each section notes what is currently **implemented** vs **pending**.

---

## 1. Game Modes

### 1.1 Domination
- Last tribe standing wins.
- A tribe is eliminated when it has **0 cities** AND **0 alive units**.
- Dual-condition logic: a faction losing its final city but retaining units becomes a "landless horde" that can recapture.
- **Implemented:** ✅ Elimination logic in `Tribe.isDefeated()` + `TurnManager.checkWinCondition()`.

### 1.2 Perfection Mode
- 30-turn limit.
- Score calculated at turn 30.
- No difficulty multiplier in clone (leaderboard scoring deferred).

**Score formula:**
| Category | Points | Description |
|---|---|---|
| City Control | 100 | Per city at turn 30 |
| City Level >1 | 50 | Per level above 1 (L3 = 100 pts) |
| Military Units | 10 | Per unit alive |
| Technology | 50 | Per tech researched |
| Buildings | 25 | Per building constructed |

**Total** = cities(×100) + unit(×10) + tech(×50) + building×25 + cityLevelsAbove1(×50)

> **Note:** The reference doc also mentions territorial tiles(×20), exploration(×5), monuments(×400), temples(100-500), parks(×250) — these are **not yet in the GDD** and require further design decisions.
>
> **Implemented:** ✅ Basic scoring in `GameScene.calcScore()` — matches the 5 categories above.

---

## 2. Map

### 2.1 Default Size
- 20×14 hex grid (pointy-top axial coordinates).

### 2.2 Terrain Types

| Terrain | Movement Cost | Defense Bonus | Required Tech | Color |
|---|---|---|---|---|
| GRASS | 1 | none | — | 0x5a8f3c |
| FOREST | 2 | 1.5× | Archery | 0x2d6b1e |
| MOUNTAIN | 2 | 1.5× | Climbing | 0x6b5b4a |
| WATER | *impassable* | 1.5× | Aquatism | 0x3b7dbd |
| SAND | 1 | none | — | 0xd4b86a |
| SNOW | 1 | none | — | 0xffffff |

\*Requires Port building + Sailing tech to traverse (embarkation).

**Important:** The defense bonus is **only applied if the unit has the Fortify skill and the relevant tech is researched**. A unit without Fortify gets no terrain bonus.

**Implemented:** ✅ Biome colors, movement costs, terrain defense bonuses with tech gating in `CombatSystem.calculateDamage()`.

### 2.3 Map Types

| Type | Description |
|---|---|
| **Continents** | Large landmasses separated by water (default algorithm) |
| **Lakes** | Single landmass with scattered water tiles |
| **Dryland** | No water tiles |
| **Archipelago** | Many small islands |
| **Waterworld** | Vast ocean with sparse islands |
| **Pangea** | Massive central landform, all factions on one continent |

**Implemented:** ✅ 4 map types in `SelectScene` enum. ❌ Map type passed to `GameScene` but `MapGenerator` currently only generates one algorithm (radial gradient). Per-type algorithms not implemented. ❌ Waterworld/Pangea missing from enum.

### 2.4 Resources
Placed on ~35% of eligible tiles:

| Resource | Eligible Terrain | Used By |
|---|---|---|
| Animals | FOREST | Lumber Hut |
| Fish | WATER | Port |
| Fruit | GRASS | (food bonus) |
| Metal | MOUNTAIN | Mine |
| Crops | GRASS | Farm |

**Key constraint (real Polytopia):** Resources spawn within a 2-tile radius of a city or neutral village. No resources in the "wilderness" beyond this radius. This enables predictive triangulation of hidden villages.

**Implemented:** ✅ Resource seeding by biome in `MapGenerator`. ❌ No city/village proximity constraint — resources spawn globally.

### 2.5 Neutral Villages
- Spawn at game start, placed sequentially with proximity rules (not within 2 tiles of map edge, other villages, or capitals).
- Captured by moving a unit onto them — unit must **start its next turn** on the village tile.
- Becomes a level-1 city for the capturing tribe.

**Implemented:** ✅ Village spawning with proximity rules, capture by ending turn on tile, becomes level-1 city, AI village targeting. 8 tests.

### 2.6 Ancient Ruins
- Scattered across the map (4 on Tiny to 23 on Massive grids).
- Provide randomized immediate benefits: veteran units, free techs, star injections.
- Cannot spawn adjacent to villages.

**Implemented:** ❌ Not in code.

---

## 3. Units

### 3.1 Common Land Units

| Unit | Cost | HP | Atk | Def | Mov | Rng | Skills | Gated By |
|---|---|---|---|---|---|---|---|---|
| Warrior | 2⭐ | 10 | 2 | 2 | 1 | 1 | Dash, Fortify | — |
| Archer | 3⭐ | 10 | 2 | 1 | 1 | 2 | Dash, Fortify | Archery |
| Defender | 3⭐ | 15 | 1 | 3 | 1 | 1 | Fortify | Strategy |
| Rider | 3⭐ | 10 | 2 | 1 | 2 | 1 | Dash, Escape, Fortify | Riding |
| Swordsman | 5⭐ | 15 | 3 | 3 | 1 | 1 | Dash | Smithery |
| Knight | 8⭐ | 10 | 3.5 | 1 | 3 | 1 | Dash, Persist, Fortify | Chivalry |
| Catapult | 8⭐ | 10 | 4 | 0 | 1 | 3 | Stiff | Mathematics |
| Giant | N/A | 40 | 5 | 4 | 1 | 1 | Static | L5 city |
| Cloak | 8⭐ | 5 | 0 | 0.5 | 2 | 1 | Hide, Creep, Infiltrate, Dash | Diplomacy |
| Mind Bender | 5⭐ | 10 | 0 | 1 | 1 | 1 | Heal, Convert, Stiff | Philosophy |

**Implemented units:** Warrior, Rider, Defender, Archer, Swordsman, Knight, Catapult, Giant, Boat (BOAT in code = naval transport).
**Not implemented:** Cloak, Mind Bender.

### 3.2 Naval Units

| Unit | Cost | Atk | Def | Mov | Rng | Skills | Required Tech |
|---|---|---|---|---|---|---|---|
| Raft | Free | 0 | 1 | 2 | — | Static, Stiff | Port |
| Scout | 5⭐ | 2 | 1 | 3 | 2 | Dash, Scout | Sailing |
| Rammer | 5⭐ | 3 | 3 | 3 | 1 | Dash | Aquaculture |
| Bomber | 15⭐ | 3 | 2 | 2 | 3 | Splash, Stiff | Navigation |

**Naval mechanics:**
- Terrestrial units embark at a friendly Port for free, becoming a Raft.
- Raft HP = carried unit's current HP. Raft has 0 Atk, 1 Def, 2 Mov.
- Upgrading to Scout/Rammer/Bomber costs stars but does NOT heal the unit.
- Disembarking reverts to base terrestrial form (loses naval upgrade permanently).
- Scout gets a final 5×5 vision reveal on disembark.

**Implemented:** ✅ Raft, Scout, Rammer, Bomber unit types in Unit.ts. ✅ Embarkation at Port (free Raft conversion). ✅ Water movement. ✅ Upgrade path: Raft→Scout/Rammer→Bomber. ✅ Naval unit HP inheritance. ✅ 188 tests.

### 3.3 Unit Skills

| Skill | Effect |
|---|---|
| **Dash** | Can attack after moving. |
| **Fortify** | Gains terrain/city defense bonuses (requires relevant tech). |
| **Escape** | Can move after attacking (remaining movement points). Rider has both Dash and Escape but cannot attack twice. |
| **Persist** | If Knight kills a unit, action refreshes — can move and attack again. No chain kill cap. |
| **Stiff** | Cannot move after attacking. Also prevents retaliation damage. Applied to Catapult, Giant, Bomber. |
| **Splash** | Deals half damage (rounded down) to all adjacent enemies. Post-calculation AoE. |
| **Scout** | +1 vision range (5×5 reveal). |
| **Hide** | Unit becomes invisible to enemies. |
| **Creep** | Ignores Zone of Control. |
| **Infiltrate** | Sabotages enemy cities (see §3.5). |
| **Heal** | Restores 4 HP to all adjacent friendly units. |
| **Convert** | Changes faction alignment of adjacent enemy unit. |
| **Static** | Cannot move at all (Giant). |

**Implemented:** Dash (as `canAttackAfterMove`), Fortify (as defense bonus gating). ✅ Escape (Rider retreat 1 tile when hit) and Persist (Knight refreshes action on kill) — 12 tests. ❌ Stiff, Splash, Hide, Creep, Infiltrate, Convert not implemented.

### 3.4 Mind Benders
- Non-lethal paradigm: 0 attack stat.
- **Convert:** Instantly changes adjacent enemy unit's faction. Converted unit assigned to capital's population limit; if no capital, assigned southernmost→northernmost.
- **Heal Others:** AoE — restores 4 HP to all adjacent friendly units.
- Fragile (10 HP, 1 Def) — must be screened by Defenders.

**Implemented:** ❌ Not in code.

### 3.5 Cloak Infiltration (Diplomacy Tech)
When a Cloak executes Infiltrate on an enemy city:
1. Cloak is permanently consumed.
2. Garrison unit takes damage equal to Cloak's base attack (2) at max health.
3. Infiltrator receives lump sum = target city's current per-turn star income.
4. Target city's star production set to 0 for victim's next turn.
5. Dagger units spawn = target city level (cap 5).

**Dagger spawn priority:** (1) central city tile if garrison killed, (2) vacant land tiles with terrain defense bonuses, (3) vacant water tiles (becomes Pirate with Surprise skill).

**Implemented:** ❌ Not in code.

---

## 4. Combat

### 4.1 Damage Formula

```
healthFactor(unit) = unit.health / unit.maxHP

attackForce  = attacker.attack × healthFactor(attacker)
defenseForce = defender.defense × healthFactor(defender) × defenseBonus
totalForce   = attackForce + defenseForce

attackResult  = round((attackForce  / totalForce) × attacker.attack  × 4.5)
defenseResult = round((defenseForce / totalForce) × defender.defense × 4.5)
```

- Ranged attacks (distance ≥ 2): ×0.75 damage.
- Minimum 1 damage.
- The 4.5 multiplier is critical — ensures standard engagements yield expected high-variance outputs.

**Implemented:** ✅ In `CombatSystem.calculateDamage()` and `calculateCityDamage()`.

### 4.2 Defense Bonus Values

| Condition | Multiplier | Notes |
|---|---|---|
| No bonus | ×1.0 | |
| Terrain/city (no wall) | ×1.5 | Requires Fortify skill + relevant tech |
| City Wall | ×4.0 | Requires Fortify skill + City Wall upgrade |
| Poisoned | ×0.7 | Overrides all positive terrain modifiers |

**Visual indicator:** Single shield halo = 1.5×, double shield halo = 4.0×.

**Implemented:** ✅ Basic terrain/city bonuses in code. ✅ City Wall ×4.0 (requires Fortify). ❌ Poison status not implemented. ✅ Visual halos for fortified units.

### 4.3 Retaliation
- Defender counter-attacks IF: defender survives AND (attacker is melee range OR defender is ranged).
- No retaliation if: attacker kills defender, defender can't see attacker (fog of war), or defender has Stiff/Surprise.
- Attacker striking from fog of war suffers no retaliation.

**Implemented:** ✅ Basic retaliation in `CombatSystem.executeAttack()`. ❌ Fog-of-war retaliation check not implemented.

### 4.4 Melee Advance
- If melee attacker kills defender, attacker moves into defender's tile.
- Blocked by terrain restrictions.

**Implemented:** ✅ In `GameScene.handleClick()` — melee units advance into defender's tile on kill.

### 4.5 Healing
- Friendly territory: +4 HP/turn (unit does nothing).
- Neutral/enemy territory: +2 HP/turn.
- Cannot exceed max HP.
- Consumes entire action phase.

**Implemented:** ✅ Units that skip their turn heal +4 HP in friendly territory, +2 in neutral/enemy. Cannot exceed max HP. Consumes entire action phase.

### 4.6 Veteran System
- Unit promoted after 3 confirmed kills (direct attacks or retaliations).
- Grants +5 max HP and full heal.
- Promotion can be deferred — "banked" for tactical timing.
- Naval units, super units, summoned entities (Daggers/Pirates), and enchanted fauna are excluded.

**Implemented:** ✅ Kill tracking on combat, +5 max HP, full heal, naval/Giant exclusion. 10 tests.

### 4.7 Battle Preview
- Hovering over valid target runs combat formula predictively.
- **Sweating animation:** Predicted attackResult ≥ defender's current HP (guaranteed kill).
- **Black/red ring:** Predicted defenseResult will be lethal to attacker.

**Implemented:** ❌ Not in code.

---

## 5. Cities

### 5.1 Star Income
- City star income = adjacent biome yields + level bonus + building bonuses.
- Biome yields: GRASS +1⭐, MOUNTAIN +2⭐, SAND +1⭐, FOREST +0⭐, WATER +0⭐.
- Level bonus: city level − 1 stars/turn (L1=0, L2=1, L3=2, L4=3, L5=4).
- Building bonuses: Workshop +1⭐, Mine +1⭐, Port +2⭐, Park +1⭐.
- Cities under siege produce no income.

**Note (real Polytopia):** Human capital starts at 2⭐/turn base, AI capitals at 1⭐. Not replicated in clone — all tribes use +5⭐/turn base `starsPerTurn`.

**Implemented:** ✅ Biome yields + level bonus + building bonuses in `City.getStarsPerTurn()`. ❌ Siege income blockade not implemented.

### 5.2 Population & Leveling
- Unit capacity = level + 1.
- Level N requires N population to upgrade from N−1.
- Each upgrade gives +1 star/turn base income.

**Implemented:** ✅ In `City.canGrow()` / `City.grow()`.

### 5.3 Level-Up Choices (Binary Upgrades)

| New Lv | Option A | Option B | Strategic Tradeoff |
|---|---|---|---|
| 2 | **Workshop** (+1⭐/t) | **Explorer** (2 scouts) | Economy vs. map awareness |
| 3 | **City Wall** (×4 def) | **Resources** (+5⭐ instant) | Fortification vs. rapid deployment |
| 4 | **Population Growth** (+3 pop) | **Border Growth** (5×5 grid) | Super unit rush vs. resource control |
| 5+ | **Park** (+250 score) | **Super Unit** (Giant) | Score vs. military |

**Implemented:** ✅ Binary upgrade choice system in `City.applyLevelUp(choice)`. Workshop(+1⭐/t), Explorer(2 scouts), City Wall(×4 def), Resources(+5⭐), Population Growth(+3 pop), Border Growth(5×5 grid), Park(+250 score), Super Unit(Giant).

### 5.4 Border Expansion
- Default city territory: 3×3 grid (8 tiles).
- Border Growth (L4 Option B): expands to 5×5 grid (24 tiles).
- Used to secure distant resources, whales, Customs House radii, restrict enemy naval movement.
- Overlapping borders: existing borders take precedence.

**Implemented:** ❌ No border/territory system in code.

### 5.5 Buildings

| Building | Cost | Requires | Effect |
|---|---|---|---|
| Lumber Hut | 3⭐ | Animals (forest) | +1 population |
| Mine | 5⭐ | Metal (mountain) | +2 population, +1⭐/t |
| Farm | 5⭐ | Crops (grass) | +2 population |
| Port | 7⭐ | Fish (water) | +1 population, +2⭐/t, enables embark |
| Workshop | Free | L2 upgrade choice | +1⭐/t |
| City Wall | Free | L3 upgrade choice | ×4 defense for Fortify units |
| Park | Free | L5 upgrade choice | +250 Perfection score |

**Implemented:** ✅ Lumber Hut, Mine, Farm, Port in `BUILDING_DEFS`. ✅ Workshop, City Wall, Park are upgrade choices via `City.applyLevelUp()`.

### 5.6 Explorer Pathfinding Algorithm
- Selecting Explorer at L2 grants 15 autonomous movement steps.
- Uses BFS capped at 3 iterations per step.
- Scoring: clearing 4-5 fog tiles = 110 (optimal), 1 tile = 173 (suboptimal).
- Distance penalty: +100 per BFS step — biases toward immediate exploration.
- Anti-backtracking: heavily penalizes recently traversed tiles.

**Implemented:** ❌ Not in code.

### 5.7 Trade Routes & City Connections
- Roads (terrestrial) and Bridges (aquatic) halve movement cost (1.0 → 0.5).
- Rounding exploit: unit with 0.5 movement remaining can enter tiles costing 1-3.
- City Connection: continuous Roads/Bridges/Ports linking outer city to capital.
- Grants +1 population to both connected cities.
- Ports act as network nodes; water gap ≤ 5 tiles.
- **Grand Bazaar:** Completing 5 city connections → +3 population, +400 Perfection score.

**Implemented:** ❌ Not in code.

### 5.8 Siege Mechanics
- Enemy unit ending turn on city's central tile triggers Siege.
- Siege effects: star generation → 0, city interface locked (no unit queue/building).
- Siege persists until: defender destroys occupying unit, or attacker initiates capture.

**Implemented:** ❌ Not in code.

---

## 6. Technology

### 6.1 Cost Formula
```
techCost = (tier × citiesOwned) + 4
```
Each city owned increases all research costs. Creates strategic tension: expand now (more income, higher tech cost) or research first (cheaper but slower expansion).

**Implemented:** ✅ In `techCost()` function.

### 6.2 Tech Tree (9 techs, 3 series — base game)

| Series | Tier 1 (5⭐) | Tier 2 (6⭐) | Tier 3 (7⭐) |
|---|---|---|---|
| Hunting | Hunting (Animals) | Archery (Archer, Forest Def) | Mathematics (Catapult, Sawmill) |
| Riding | Riding (Rider) | Free Spirit (Temple) | Chivalry (Swordsman, Knight) |
| Fishing | Fishing (Port, Fish) | Sailing (Scout, Embark) | Navigation (Bomber, Starfish) |

**Full Polytopia has additional series** (Climbing, Organization, Farming) — not yet in clone.

**Implemented:** ✅ 9 techs in `TechTree.ts`. ❌ Climbing, Organization, Farming series not implemented.

### 6.3 Tech Unlocks

| Tech | Cost (1 city) | Unlocks |
|---|---|---|
| Hunting | 5⭐ | Animal resources |
| Archery | 6⭐ | Archer, +150% forest def |
| Mathematics | 7⭐ | Catapult, Sawmill |
| Riding | 5⭐ | Rider |
| Free Spirit | 6⭐ | Temple |
| Chivalry | 7⭐ | Swordsman, Knight |
| Fishing | 5⭐ | Port, Fish resources |
| Sailing | 6⭐ | Scout ship, embark |
| Navigation | 7⭐ | Bomber, Starfish |

**Implemented:** ✅ All 9 techs with descriptions in `TECH_DEFS`.

### 6.4 Tribe Starting Techs

| Tribe | Starting Tech | Starting Unit(s) |
|---|---|---|
| Xin-xi | Riding | Warrior + Rider |
| Imperius | Fishing | Warrior |
| Bardur | Hunting | Warrior |
| Oumaji | Riding | Rider (no warrior) |

**Implemented:** ✅ In `TRIBE_STARTING_TECHS`.

---

## 7. Special Tribes (Post-Base Game)

### 7.1 Polaris — Cryogenic Expansion
- Replaces maritime navigation with cryogenic terraforming (water → ice, terrain → tundra).
- **Tech replacements:** Frostwork (Mooni, Outposts), Sledding (Battle Sleds), Polar Warfare (Ice Fortresses), Polarism (Ice Temples).
- **Freeze mechanic:** Auto Freeze + Freeze Area — strips enemy action economy and negates retaliation.
- **Units:** Mooni (pacifist, auto-freezes adjacent), Battle Sled (ice mobility, crippled on land), Gaami (super unit, 30 HP, mass freeze).
- **Economy:** Ice Bank (replaces Customs House) — income scales with total frozen tiles on map.

**Implemented:** ❌ Not in code.

### 7.2 Cymanti — Organic Engineering
- **Organic economy:** Fungi (replaces crops), Mycelium networks (roads that heal), Algae (bridges water without Ports).
- **Venom:** Poison strips terrain/structure defense bonuses (×0.7 multiplier).
- **Units:** Centipede (replaces Giant — Eat/Grow skill, head death → segment becomes new head), Hexapods (Creep/Sneak, ignore ZOC), Doomux (Explode AoE suicide).
- **No Ports** — Hydrology tech cultivates Algae on water tiles.

**Implemented:** ❌ Not in code.

### 7.3 Elyrion — Ecological Mysticism
- **Restrictions:** Cannot Clear/Burn Forest, cannot harvest wild animals.
- **Sanctuary:** +1⭐/turn per adjacent wild animal; spawns new animal every 3 turns.
- **Enchantment:** Spend 3⭐ to transform wild animal into Polytaur (3 Atk, 1 Def, independent — doesn't count toward population cap).
- **Dragon maturation:** Egg (0 Atk, 2 Def) → Baby Dragon (flight, ranged) → Fire Dragon (flight, Splash AoE).
- **Prophetic Vision:** Can see unrevealed ancient ruins through fog (rainbow flames).

**Implemented:** ❌ Not in code.

---

## 8. AI Behavior

### 8.1 Turn Phase Structure
`EXPLORE → BUILD → MOVE → ATTACK → END`

**Implemented:** ✅ In `TurnManager` enum.

### 8.2 BUILD Phase Priority
1. Train unit if fewer than `minUnitsForUpgrade` (default 2) — pick highest attack affordable.
2. Upgrade cheapest city if enough stars.
3. Research cheapest affordable unresearched tech.

**Implemented:** ✅ In `BasicAI.decideBuild()`.

### 8.3 MOVE Phase Priority (per unit)
1. Defend threatened cities (enemy within 3 tiles).
2. Move toward nearest enemy city.
3. Explore nearest unseen walkable tile.

**Implemented:** ✅ In `BasicAI.decideMove()`.

### 8.4 ATTACK Phase Priority
1. Attack adjacent enemy units first.
2. Attack adjacent enemy cities.
3. Prioritize low-HP targets (guaranteed kills, veteran progress, eliminate retaliation).

**Implemented:** ⚠️ Adjacent attack logic present but no low-HP prioritization — attacks first found target.

---

## 9. Gaps vs Real Polytopia (Summary)

### Combat & Units
- [x] Fortify skill implemented (terrain bonuses require Fortify)
- [x] City Wall ×4 defense bonus implemented
- [x] Escape skill (Rider retreat) implemented
- [x] Persist skill (Knight chain kills) implemented
- [ ] Stiff skill (no retaliation) not implemented
- [ ] Splash damage (Bomber AoE) not implemented
- [ ] Cloak / stealth / Infiltration / Dagger spawning not implemented
- [ ] Mind Bender (Convert, Heal Others) not implemented
- [x] Healing system (skip turn to heal +4/+2 HP) implemented
- [x] Veteran system (+5 max HP after 3 kills) implemented
- [ ] Battle preview UI not implemented
- [ ] Fog-of-war retaliation suppression not implemented

### Naval
- [x] Full naval system (Raft → Scout → Rammer → Bomber) implemented
- [x] Embarkation/disembarkation implemented
- [x] Naval unit HP inheritance implemented
- [ ] Scout 5×5 vision on disembark not implemented
- [ ] Aquaculture tech (Rammer gate) not yet added to tech tree

### Cities & Economy
- [x] Binary city upgrade choices implemented
- [ ] Border expansion (3×3 → 5×5) not implemented
- [ ] Siege mechanic (economic blockade) not implemented
- [ ] Explorer autonomous pathfinding not implemented
- [ ] Trade routes / Roads / City Connections not implemented
- [ ] Grand Bazaar (+400 score) not implemented
- [x] Park building (L5 upgrade choice) implemented

### Map & World
- [ ] Per-type map generation algorithms not implemented (only one algorithm)
- [ ] Waterworld / Pangea map types missing from enum
- [x] Neutral villages implemented
- [ ] Ancient ruins not implemented
- [ ] Resource proximity constraint (2-tile radius from city/village) not implemented

### Technology
- [ ] Climbing / Meditation / Philosophy tech series not implemented
- [ ] Organization / Strategy / Diplomacy tech series not implemented
- [ ] Farming / Construction tech series not implemented
- [ ] Smithery tech (Swordsman gate) not implemented — currently gated by Chivalry
- [ ] Aquaculture tech (Rammer gate) not added
- [ ] Free Spirit → Temple connection not implemented

### Special Tribes
- [ ] Polaris (freeze mechanics, Ice Bank, Mooni, Battle Sled, Gaami) not implemented
- [ ] Cymanti (organic economy, poison, Centipede, Hexapod, Doomux) not implemented
- [ ] Elyrion (Sanctuary, Enchantment, Dragon maturation, Prophetic Vision) not implemented

### Scoring Extensions
- [ ] Territorial tile scoring not implemented
- [ ] Exploration (fog dispersal) scoring not implemented
- [ ] Monument / Grand Bazaar scoring not implemented
- [ ] Temple scoring not implemented
- [ ] Park scoring not implemented
