# GDD.md — Polytopia Clone: Living Game Design Document

> **Status:** Active — source of truth for all game mechanics.  
> **Change process:** Tasks in AGENTS.md reference specific GDD sections. When the spec changes, update GDD.md first, then update AGENTS.md tasks.

---

## 1. Game Modes

### 1.1 Domination
- Last tribe standing wins.
- A tribe is eliminated when it has **0 cities** AND **0 alive units**.

### 1.2 Perfection
- 30-turn limit.
- Score calculated at turn 30.
- Score formula: cities(×100) + units(×10) + techs(×50) + building levels(×25) + city levels(×20).

---

## 2. Map

### 2.1 Default Size
- 20×14 hex grid (pointy-top axial coordinates).

### 2.2 Terrain Types
| Terrain   | Movement Cost | Defense Bonus (with tech) | Color      |
|-----------|---------------|--------------------------|------------|
| GRASS     | 1             | none                     | 0x5a8f3c  |
| FOREST    | 2             | 1.5× (Archery)           | 0x2d6b1e  |
| MOUNTAIN  | 2             | 1.5× (Climbing)          | 0x6b5b4a  |
| WATER     | impassable*   | 1.5× (Aquatism)          | 0x3b7dbd  |
| SAND      | 1             | none                     | 0xd4b86a  |
| SNOW      | 1             | none                     | 0xffffff  |

\* Requires Port building + Sailing tech to traverse.

### 2.3 Map Types
- **Continents**: Large landmasses separated by water (current algorithm).
- **Lakes**: Single landmass with scattered water tiles.
- **Dryland**: No water tiles.
- **Archipelago**: Many small islands separated by water.

### 2.4 Resources
Placed on ~35% of eligible tiles:
| Resource | Eligible Terrain | Used By         |
|----------|-----------------|-----------------|
| Animals  | FOREST          | Lumber Hut      |
| Fish     | WATER           | Port            |
| Fruit    | GRASS           | (food bonus)    |
| Metal    | MOUNTAIN        | Mine            |
| Crops    | GRASS           | Farm            |

### 2.5 Villages
- Neutral villages spawn at game start.
- Captured by moving a unit onto them (unit must start turn on village).
- Become a level-1 city for the capturing tribe.
- No more than 1 village per 3×3 area.

---

## 3. Units

### 3.1 Common Land Units
| Unit       | Cost | HP  | Atk | Def | Mov | Rng | Skills                        | Gated By    |
|------------|------|-----|-----|-----|-----|-----|-------------------------------|-------------|
| Warrior    | 2⭐   | 10  | 2   | 2   | 1   | 1   | Dash, Fortify                 | —           |
| Archer     | 3⭐   | 10  | 2   | 1   | 1   | 2   | Dash, Fortify                 | Archery     |
| Defender   | 3⭐   | 15  | 1   | 3   | 1   | 1   | Fortify                       | —           |
| Rider      | 3⭐   | 10  | 2   | 1   | 2   | 1   | Dash, Escape, Fortify         | Riding      |
| Swordsman  | 5⭐   | 15  | 3   | 3   | 1   | 1   | Dash                          | Chivalry    |
| Knight     | 8⭐   | 10  | 3.5 | 1   | 3   | 1   | Dash, Persist, Fortify        | Chivalry    |
| Catapult   | 8⭐   | 10  | 4   | 0   | 1   | 3   | Stiff                         | Mathematics |
| Giant      | N/A   | 40  | 5   | 4   | 1   | 1   | Static (city L5 super unit)   | L5 city     |
| Cloak      | 8⭐   | 5   | 0   | 0.5 | 2   | 1   | Hide, Creep, Infiltrate, Dash | Diplomacy   |
| Mind Bender| 5⭐   | 10  | 0   | 1   | 1   | 1   | Heal, Convert, Stiff          | Philosophy  |

### 3.2 Naval Units
| Unit    | Cost | HP* | Atk | Def | Mov | Rng | Skills          | Gated By  |
|---------|------|-----|-----|-----|-----|-----|-----------------|-----------|
| Raft    | free | var | 0   | 1   | 2   | —   | Static, Stiff   | Port      |
| Scout   | 5⭐   | var | 2   | 1   | 3   | 2   | Dash, Scout     | Sailing   |
| Rammer  | 5⭐   | var | 3   | 3   | 3   | 1   | Dash            | Ramming   |
| Bomber  | 15⭐  | var | 3   | 2   | 2   | 3   | Splash, Stiff   | Navigation|

*HP varies by carried unit.

### 3.3 Unit Skills
| Skill      | Effect |
|------------|--------|
| **Dash**   | Unit can attack after moving. |
| **Fortify**| Gains defense bonus in cities/terrain. |
| **Escape** | Unit can retreat when attacked (move 1 tile away). |
| **Persist**| If Knight kills a unit, it can attack again (chain kills). |
| **Stiff**  | Cannot move after attacking (Catapult, Giant). |
| **Splash** | Deals half damage to adjacent tiles (Bomber). |
| **Scout**  | +1 vision range. |

---

## 4. Combat

### 4.1 Damage Formula (REAL — verified from game code)

```
attackForce  = attacker.attack × (attacker.health / attacker.maxHealth)
defenseForce = defender.defense × (defender.health / defender.maxHealth) × defenseBonus
totalDamage  = attackForce + defenseForce

attackResult  = round((attackForce  / totalDamage) × attacker.attack  × 4.5)
defenseResult = round((defenseForce / totalDamage) × defender.defense × 4.5)
```

### 4.2 Defense Bonus Values
- No bonus: ×1.0
- Terrain/city (no wall): ×1.5
- City Wall: ×4.0
- Poisoned unit: ×0.7

### 4.3 Terrain Defense Bonuses
| Terrain   | Bonus Multiplier | Required Tech |
|-----------|-----------------|---------------|
| Forest    | 1.5×            | Archery       |
| Mountain  | 1.5×            | Climbing      |
| Water     | 1.5×            | Aquatism      |
| City      | 1.5×            | —             |
| City+Wall | 4.0×            | City Wall     |

### 4.4 Retaliation
- Defender counter-attacks IF:
  - Defender survives the attack (health > 0)
  - Attacker is in melee range (distance = 1) OR defender is also ranged
- No retaliation if attacker kills defender.
- No retaliation if defender cannot see attacker (fog of war).

### 4.5 Melee Advance
- If attacker kills defender in melee, attacker moves into defender's tile.

### 4.6 Healing
- Friendly territory: +4 HP/turn (unit does nothing).
- Neutral/enemy territory: +2 HP/turn.
- Cannot exceed max HP.
- Mind Bender: heals all adjacent friendly units by 4 HP.

---

## 5. Cities

### 5.1 Base Production
- **1 star/turn per city level**.
- Workshop adds +1 star.
- Park adds +1 star.
- Human capital: base 2 stars (not 1).
- Cities under siege produce no income.

### 5.2 Population & Leveling
- Unit capacity = level + 1.
- Level N requires N population to upgrade from N-1.
- Each upgrade gives +1 star/turn base income.

### 5.3 Level-Up Choices (REAL Polytopia)
| New Lv | Option A           | Option B            |
|--------|--------------------|---------------------|
| 2      | **Workshop** (+1⭐/t) | **Explorer** (2 scouts) |
| 3      | **City Wall** (×4 def) | **Resources** (+5⭐ instant) |
| 4      | **Population Growth** (+3 pop) | **Border Growth** (expand territory) |
| 5+     | **Park** (+1⭐/t, +250 score) | **Super Unit** (Giant) |

### 5.4 Buildings
| Building    | Cost | Requires     | Effect                            |
|-------------|------|--------------|-----------------------------------|
| Lumber Hut  | 3⭐   | Animals (forest) | +1 population                  |
| Mine        | 5⭐   | Metal (mountain)| +2 population, +1⭐/t           |
| Farm        | 5⭐   | Crops (grass)   | +2 population                  |
| Port        | 7⭐   | Fish (water)    | +1 population, +2⭐/t, enables embark |
| Workshop    | free | Level 2 upgrade | +1⭐/t                          |
| City Wall   | free | Level 3 upgrade | ×4 defense for Fortify units    |

---

## 6. Technology

### 6.1 Cost Formula
```
techCost = (tier × citiesOwned) + 4
```
Each city you own increases research costs.

### 6.2 Tech Tree (11 techs, 4 series + 1 capstone)
| Series     | Tier 1      | Tier 2       | Tier 3          |
|------------|-------------|--------------|-----------------|
| Hunting    | Hunting     | Archery      | Mathematics     |
| Riding     | Riding      | Free Spirit  | Chivalry        |
| Fishing    | Fishing     | Sailing      | Navigation      |
| Climbing   | Climbing    | Meditation   | Philosophy      |
| Organization| Organization | Strategy     | Diplomacy       |
| Farming    | Farming     | Construction | —               |

### 6.3 Tech Unlocks
| Tech        | Cost (1 city) | Unlocks |
|-------------|--------------|---------|
| Hunting     | 5⭐           | Animal resources |
| Archery     | 6⭐           | Archer, +150% forest def |
| Mathematics | 7⭐           | Catapult, Sawmill |
| Riding      | 5⭐           | Rider |
| Free Spirit | 6⭐           | Temple |
| Chivalry    | 7⭐           | Swordsman, Knight |
| Fishing     | 5⭐           | Port, Fish resources |
| Sailing     | 6⭐           | Scout ship, embark |
| Navigation  | 7⭐           | Bomber, Starfish |

### 6.4 Tribe Starting Techs
| Tribe   | Starting Tech | Starting Unit      |
|---------|--------------|--------------------|
| Xin-xi  | Riding       | Warrior + Rider    |
| Imperius| Fishing      | Warrior            |
| Bardur  | Hunting      | Warrior            |
| Oumaji  | Riding       | Rider (no warrior) |

---

## 7. AI Behavior

### 7.1 BUILD Phase Priority
1. Train unit if fewer than 3 units exist (pick best affordable).
2. Upgrade cheapest city if enough stars.
3. Research cheapest affordable unresearched tech.

### 7.2 MOVE Phase Priority (per unit)
1. Defend threatened cities (move toward nearby enemy units).
2. Move toward nearest enemy city.
3. Explore unseen tiles.

### 7.3 ATTACK Phase
- Attack adjacent enemy units first.
- Attack adjacent enemy cities.
- Prioritize low-HP targets.

---

## 8. Scoring (Perfection Mode)

| Category          | Points |
|-------------------|--------|
| Per city          | 100    |
| Per city level >1 | 50/level |
| Per unit          | 10     |
| Per tech          | 50     |
| Per building      | 25     |
| Per city level    | 20     |

---

## 9. Game Balance Reference

### 9.1 Starting Stars
- Human player: 15⭐
- AI player: 10⭐
- AI per-turn income: 5⭐ + city production

### 9.2 Unit Upgrade Paths
- Warrior → Swordsman (requires Chivalry)
- Rider → Knight (requires Chivalry)
- Raft → Scout → Rammer → Bomber (requires Sailing→Ramming→Navigation)

---

## 10. Gaps vs Real Polytopia (known)

- [ ] Damage formula uses our approximation, not the real `×4.5` formula
- [ ] No fortress/city wall defense bonus for Fortify units
- [ ] No Escape skill implementation (retreat on attacked)
- [ ] No Persist skill (Knight chain kills)
- [ ] No Splash damage for Bomber
- [ ] No Explorer scouts on L2 city upgrade
- [ ] No Border Growth on L4 city upgrade
- [ ] No Cloak/stealth mechanics
- [ ] No Mind Bender/convert mechanics
- [ ] No road/city connection mechanic
- [ ] No village spawning (capture neutral villages)
- [ ] No siege mechanic (blocked cities produce no income)
- [ ] Naval system incomplete (Raft→Scout→Rammer→Bomber chain)
- [ ] City Wall visual indicator missing
- [ ] Battle preview (hover to see predicted damage)
- [ ] Veteran system (units gain +5 max HP after killing)
- [ ] No Cymanti/Elyrion/Polaris special tribes
