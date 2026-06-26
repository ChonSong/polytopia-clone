# AGENTS.md — Polytopia Clone

## About
Browser-based The Battle of Polytopia clone built with Phaser 3 (WebGL + Web Audio). Live at `hex.codeovertcp.com`.

**Status:** Phase 1 complete ✅ — core game loop, 16 tribes (3 special), terrain generation, unit system (infantry, naval, air, ranged, special), city mechanics, tech tree, scoring (temples, monuments, breakdown). 515 tests pass, 0 JS errors. Moving to Phase 2 (AI, Animations, UX).

## Architecture

### Stack
- **Game Engine**: Phaser v3.90.0 (WebGL + Web Audio)
- **Frontend**: Next.js
- **Backend**: (Phase 2 — multiplayer)
- **Testing**: 515 unit/integration tests

### Phase 1 Completed Features
- Terrain generation (water, mountains, forests, fruits, animals, ruins)
- City radius sharing (conflict resolution)
- Resource distribution (5-8 per tribe, no double-count)
- Unit system: infantry, naval (ships/ports/battleship), air (bird riders, Mooni, Ryy), ranged (archers/catapults multi-tile)
- 3 Special tribes: Elyrion (Polytaur), Cymanti (poison/centipede), Polaris (freeze)
- Turn timing & unit limits (10/city + 10/capital)
- Scoring: temples (+20), monuments (+30), breakdown display
- Spawn system (16 tribes balanced)
- Tribe selection screen with settings (map, mode, speed, difficulty)

## Phase 2 — AI, Animations, UX

### Task: fix-tribe-index-mapping
**Priority:** P1
**Status:** ✅ Coach APPROVED 2026-06-26 — commit 08151c0
**Description:** Tribe selection was broken: SelectScene sorted tribes alphabetically by name and passed sorted index to GameScene, which used unsorted TRIBE_CONFIGS. Fixed by passing humanTribeId (string) and resolving via findIndex() in GameScene.init().

**Verification:** 515/515 tests pass. Live verification on hex.codeovertcp.com confirmed: Imperius loads with Fishing, Elyrion loads with Ecology + Polytaur, Cymanti resolves to correct index. 0 console errors. RefQA passes.
**Coach checks:** Open hex.codeovertcp.com, click each tribe card, verify HUD shows correct tribe name and starting tech. Verified via Phaser game API: humanTribeId passed correctly, findIndex works for all 3 tested tribes.

### Task: fix-ai-opponent-intelligence
**Priority:** P1
**Status:** ✅ Coach APPROVED 2026-06-26 — items 1, 2, 4 partially addressed (balanced army composition, strategic upgrades, threat-aware retreat). See spec_gaps for remaining work.
**Description:** AI opponents make basic decisions but lack strategic depth. Current AI behavior needs improvement across multiple dimensions:
1. **City management** — ✅ Partially addressed in 7b510c9. `chooseUpgrade()` picks A/B based on threat level (defensive when enemies near, economic when safe). Still uses basic scoring — no full economic vs military strategic mode.
2. **Unit production** — ✅ Addressed in 7b510c9. `pickBalancedUnit()` ensures ranged/melee/tank mix instead of always picking highest attack. Avoids over-training one type.
3. **Territory expansion** — ❌ Not addressed. AI still uses basic wander-to-unseen behavior. Does not prioritize high-value resource tiles or strategic chokepoints.
4. **Combat targeting** — ✅ Partially addressed in 7b510c9. Threat-aware retreat prevents <25% HP units from suicide attacks. Still targets lowest-HP enemy first (existing behavior).
5. **Difficulty levels** — ✅ Addressed in 98eba7b. Easy AI picks economic upgrades (B), avoids combat unless one-shot or 2:1 HP advantage. Hard AI picks military upgrades (A), hunts enemies within 8 hexes. Medium uses balanced tactical logic. 5 new tests verify observable differences.

Reference: Original Polytopia AI adapts to player skill. Implement at minimum a competent scripted AI (Medium) and a simple random/weak AI (Easy).
**Success criteria:**
- AI plays a full game to completion without crashing — ✅ (existing)
- AI expands territory, builds units, attacks enemy cities — ✅ partial (no strategic territory expansion)
- Hard AI is observably more effective than Easy AI (wins more, higher score) — ✅ Addressed in 98eba7b: Hard hunts enemies & picks military, Easy avoids combat & picks economic
- No regression in existing 515 passing tests — ✅ (all 515 pass)
**Coach checks:** Start a game vs AI, observe AI behavior over 20+ turns. Verify AI captures cities, builds improvements, uses combat effectively. Compare Easy vs Hard behavior difference.

### Task: fix-unit-combat-animations
**Priority:** P2
**Status:** ✅ Coach APPROVED 2026-06-26T11:51:47Z — commit 86410dc
**Description:** Units currently teleport to target hex and HP changes instantly. Add basic combat animations:
1. **Attack animation** — attacker unit moves toward target, attack visual (slash/projectile), defender HP flash, attacker returns
2. **Death animation** — destroyed unit fades/scales out
3. **Damage numbers** — floating damage text (-X HP) above defender
4. **Ranged attack** — arrow/projectile sprite from attacker to target

Keep animations fast (< 500ms per action) to maintain game pace.
**Success criteria:**
- Attack animation plays when unit attacks (move → hit → return)
- Ranged units show projectile animation
- Damage numbers appear on hit
- Death animation plays on unit destruction
- Animations don't block game logic (can be toggled/skipped)
**Coach checks:** Start a game, attack with a warrior and an archer. Verify animations play. Check console for errors.

### Task: add-sound-effects-and-music
**Priority:** P2
**Status:** ✅ Coach APPROVED 2026-06-26T11:51:47Z — commit a1b035b. Note: task spec mentions volume slider but only mute toggle (🔊) implemented. Minor gap.
**Description:** The game is silent. Add basic sound effects and background music:
1. **UI sounds** — button click, tribe select, settings toggle
2. **Combat sounds** — attack hit, unit death, city capture
3. **Ambient music** — simple looping background track per game phase (exploration, combat, victory/defeat)
4. **Volume controls** — master volume slider in settings

Use Web Audio API (Phaser's built-in audio). For music, use simple synthesized/looped tracks to avoid licensing issues.
**Success criteria:**
- UI interactions have click/hover sounds
- Combat plays attack/death sounds
- Background music plays and loops
- Volume slider works and persists
- 0 audio-related console errors
**Coach checks:** Start a game, verify UI sounds, start combat, verify attack sounds. Check audio context is active (user gesture initiated).

### Task: fix-tech-tree-visualization
**Priority:** P2
**Status:** ✅ Coach APPROVED 2026-06-26T11:51:47Z — commit 914395d (tech tree implementation) + 08151c0 (P1 tribe blocker fix)
**Description:** Technology research is functional but has no visual tech tree. Add a tech tree panel accessible from the city view that shows:
1. **Tech tree graph** — nodes connected by edges showing tech dependencies
2. **Research progress** — per-tech star cost and current progress bar
3. **Unlocked technologies** — green highlight for researched techs
4. **Available research** — white/yellow highlight for techs meeting prerequisites
5. **Filter by category** — filtering by military/economic/naval

Reference: Original Polytopia has a simple horizontal tech tree. Keep it compact and scannable.
**Success criteria:**
- Tech tree panel opens from city view
- Tech tree shows all technologies with dependency connections
- Researched techs are visually distinct from available and locked techs
- Clicking an available tech starts research
- No console errors
**Coach checks:** Open city view, open tech tree, verify visual layout. Research a tech, verify progress shows.

### Task: fix-city-building-visual-improvements
**Priority:** P3
**Status:** ✅ Coach APPROVED 2026-06-26T23:35:00Z — commit df00a19
**Description:** Cities show level but lack visual feedback for buildings placed:
1. **Building sprites** — show visible improvements on city tile (walls for level 2+, temples, monuments)
2. **Population growth** — visual indicator when city is about to level up
3. **City border expansion** — animate border growth when city expands
4. **Customize city name** — allow player to rename cities (like original game)

**Verification:** 520/520 tests pass. Live page verified: Imperius loads correctly (no tribe regression). City circle with level pips, population progress bar renders. Entity graphics and update loop working. 0 console errors. RefQA passes.
**Coach checks:** Build city wall → verify crenellation dots. Build temple/monument → verify gold triangle / blue diamond icons. Level up city → verify border pulse animation (1.25s fade ring). Use RENAME CITY menu option → verify name cycles through tribe pool.

### Task: fix-ai-territory-expansion
**Priority:** P2
**Status:** ❌ Not started — 11 cycles stagnant
**Description:** AI opponents still use basic wander-to-unseen behavior instead of prioritizing high-value tiles or strategic expansion. Remaining gap from fix-ai-opponent-intelligence (item 3: Territory expansion).
1. **Tile valuation** — rate tiles by resource value (fruits > animals > forests for chopping) and strategic position
2. **Enemy proximity** — prioritize tiles that push toward nearest enemy city when difficulty is Hard/Medium
3. **Chokepoint awareness** — avoid expanding into dead-end peninsula tiles; prefer branching positions
4. **Settler logic** — if AI has a settler unit, guide it toward high-value unclaimed tiles within 5-8 hexes of capital

**Reference:** Original Polytopia AI expands strategically — captures resource-rich tiles first, creates front toward enemies.

**Success criteria:**
- AI claims fruit/animal tiles before empty tiles when both are available
- Hard AI expands in direction of nearest enemy
- AI captures multiple cities in a full game (not just capital)
- Territory-controlled hex count grows faster than current wander behavior
- No regression in existing 520 passing tests

**Coach checks:** Start a game vs Hard AI, observe AI city expansion over 20+ turns. Verify AI claims resource tiles and expands toward player. Compare tile ownership growth rate vs current behavior.

### Task: fix-save-load-game-state
**Priority:** P3
**Description:** Games cannot be saved and resumed. Add localStorage-based save/load:
1. **Auto-save** — save game state after each turn
2. **Save slots** — 3 save slots accessible from main menu
3. **Load game** — resume from saved state
4. **Serialize/deserialize** — GameState must serialize cleanly (handle Map/Set/class instances)

**Success criteria:**
- Game saves to localStorage after each turn
- Load game restores complete state (tribe, units, cities, tech, scores, turn)
- 3 save slots work independently
- No serialization errors in console
**Coach checks:** Start game, play 3 turns, save. Refresh page, load save, verify exact state restoration.

### Task: fix-mobile-responsive-canvas
**Priority:** P3
**Description:** The Phaser canvas is fixed-size and doesn't scale on mobile/small viewports. Add responsive canvas scaling:
1. **Aspect-ratio aware** — maintain game aspect ratio while fitting viewport
2. **Touch controls** — map pan (touch drag), unit select (tap), unit move (tap destination)
3. **UI scaling** — HUD elements scale with canvas
4. **Orientation handling** — detect and respond to orientation changes

**Success criteria:**
- Canvas fills viewport on mobile widths (320px+)
- Touch pan works for map navigation
- Unit selection and movement works via tap
- HUD elements are readable on small screens
**Coach checks:** Resize browser to 375×667 (iPhone SE). Verify canvas scales, HUD is usable. Test touch interactions.
