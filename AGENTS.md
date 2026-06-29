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
**Status:** ✅ Implemented — commit 5128a59. SaveManager handles serialization, auto-save after each turn, load from SelectScene.
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
**Status:** ✅ Implemented — commit fe24e6e. RESIZE scale mode, layoutHUD(), responsive tribe cards, multi-touch.
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

### Task: add-victory-screen (recovery-generated)
**Priority:** P2
**Status:** ✅ Implemented — commit f9e68f1. Full-screen overlay with victory/defeat title, winner announcement, score breakdown, Play Again + Main Menu buttons.
**Description:** Game currently ends with only a text status message. Add a proper victory/defeat overlay:
1. **Full-screen dimmed overlay** with trophy (victory) or skull (defeat) title
2. **Winner announcement** — shows which tribe won and by what margin
3. **Score breakdown** — reuses existing renderScoreBreakdown for human tribe
4. **Play Again** — restarts with same tribe/map/mode/difficulty settings
5. **Main Menu** — returns to SelectScene
6. **Perfection mode** — highest-scoring tribe shown as winner when turn limit hits

**Success criteria:**
- Overlay appears on elimination victory and Perfection turn limit
- "VICTORY!" in gold when human wins, "DEFEAT" in red when AI wins
- Play Again restarts game with same settings
- Main Menu returns to tribe selection
- No regression in 522 passing tests
**Coach checks:** Start a game, trigger victory (conquer all enemy cities). Verify overlay appears with correct title. Click Play Again — verify fresh game starts. Click Main Menu — verify tribe selection appears.

### Task: fix-sound-volume-slider (recovery-generated)
**Priority:** P3
**Status:** ✅ Coach APPROVED 2026-06-29 — commit c6af629
**Description:** Sound effects and music were added in commit a1b035b with a mute toggle (🔊/🔇) but the task spec included a volume slider. Add a volume slider (0-100%) to control master volume level alongside the existing mute button:
1. **Volume slider UI** — draggable slider bar next to mute button showing current volume level (0-100%)
2. **Master volume control** — scale SoundManager's masterGain gain value by slider percentage (0.0-1.0)
3. **Persist setting** — save volume level to localStorage (polytopia_volume) and restore on load
4. **Visual feedback** — percentage text next to slider updates as dragged

**Verification:** 522/522 tests pass, build clean, Deploy HTTP 200. Code review confirmed: SoundManager volume getter/setter with localStorage persistence, clamped [0,1], decoupled from mute. GameScene slider UI with green fill, white thumb, draggable zone, responsive redraw in layoutHUD(). CFS 0.973 stable.
**Coach checks:** Start a game, verify volume slider renders. Drag to 0% — verify game is silent. Drag to 100% — verify sounds play at full volume. Refresh page — verify slider position restored.

### Task: fix-in-game-settings-panel (recovery-generated)
**Priority:** P3
**Status:** ✅ Coach APPROVED 2026-06-29T23:45:00Z — commit 683587a
**Description:** Added ⚙️ gear button to HUD opening unified settings overlay. Panel has Audio section (mute toggle + volume slider synced with HUD) and Game Speed section (click to cycle Normal→Fast→Slow→Normal, applies immediately to cost multipliers). Backdrop click or X closes. Responsive layout scales with canvas.

**Verification:** 522/522 tests pass, build clean, Deploy HTTP 200, 0 JS console errors. Settings panel opens/closes via gear button. Volume slider draggable, updates percentage live. Speed cycling works (Normal→Fast→Slow). Game state preserved after panel close. P3 finding: speed labels use cost multipliers (Fast=×0.5, Slow=×2) instead of speed multipliers as spec'd.
**Coach checks:** Open game, click ⚙️ gear button, verify settings panel appears. Test volume slider drag. Cycle speed through Normal/Fast/Slow. Click backdrop to close.

## Phase 3 — Keyboard, UX Polish, Stats
### Task: fix-settings-speed-labels-agents-spec (coach-generated)

**Priority:** P3
**Status:** ✅ Coach APPROVED 2026-06-30T06:35:00Z — commit 261e4be

**Description:** The speed display labels in the settings panel use cost multipliers (Fast=×0.5, Slow=×2) but the AGENTS.md task spec for the settings panel says speed multipliers (Fast=×2, Slow=×0.5). The implementation is functionally correct — cost-multiplier 0.5 means half-cost moves = twice as fast — but the display convention is inconsistent with the spec. Either update the labels to show speed multipliers (invert: Fast shows ×2, Slow shows ×0.5) or update the spec to document cost multipliers as the convention.

**Verification:** All 3 speed states verified via Phaser console: Normal(×1), Fast(×2), Slow(×0.5). speedDisplayMultiplier() correctly inverts internal cost multipliers. 522/522 tests pass, build clean, 0 JS console errors, RefQA 4/4 pass. CFS 0.989 improving.

**Success criteria:**
- Speed labels match the documented convention consistently ✅
- Labels show speed multipliers: Fast(×2), Slow(×0.5), Normal(×1) ✅
- No regression in 522 passing tests ✅
**Coach checks:** Verified all 3 speed states programmatically and visually. Settings panel shows correct speed multipliers.

### Task: add-keyboard-shortcuts (recovery-generated)
**Priority:** P3
**Status:** 🔜 Next up
**Description:** GameScene already has W=wait and ESC=pause. Add commonly expected keyboard shortcuts to improve accessibility and power-user flow:
1. **End turn** — Enter and E keys end the current player's turn (same as clicking "End Turn" button)
2. **Cycle units** — Tab cycles forward through unactioned units, Shift+Tab cycles backward
3. **Camera pan** — Arrow keys pan the camera (16px per keypress, held keys repeat)
4. **Select unit** — Space bar performs the default action (select/move/attack) on the currently highlighted unit or hex

**Success criteria:**
- Pressing Enter or E ends the turn (skips to AI or next phase)
- Tab cycles through unactioned units, camera centers on each
- Arrow keys pan the camera in all 4 directions
- Holding arrow keys continues panning (key repeat)
- No interference with existing W (wait) and ESC (pause) shortcuts
- No regression in 522 passing tests

**Coach checks:** Start a game, press Tab to cycle units, press Enter to end turn. Verify arrow keys pan the camera. Check console for errors.

### Task: add-end-turn-confirmation (recovery-generated)
**Priority:** P3
**Status:** ✅ Coach APPROVED 2026-06-30 — commit 74508ca
**Description:** Players can accidentally click "End Turn" and waste a turn with unactioned units. Added optional confirmation dialog with settings toggle and smart skip.

**Verification:** 522/522 tests pass, build clean, 0 JS console errors. Confirmation dialog renders correctly (dimmed backdrop, orange-bordered panel, ⏳ title, unactioned unit count, Yes/Cancel buttons). Cancel dismisses without ending turn. Yes advances turn. Settings toggle ON/OFF works with localStorage persistence. Smart skip bypasses dialog when 0 unactioned units. RefQA 4/4 pass.

### Task: add-in-game-stats-panel (recovery-generated)
**Priority:** P3
**Status:** ✅ Implemented — pending Coach review
**Description:** The game shows a score breakdown at victory/defeat but no live stats during gameplay. Added an in-game statistics panel showing per-tribe metrics accessible from the HUD.
1. **Stats button** — 📊 icon in HUD opens a semi-transparent stats overlay
2. **Stats content** — per-tribe rows showing: tribe name + color, cities owned, units alive (count), techs researched, total stars earned, score
3. **Human highlight** — human player's row highlighted (brighter bg)
4. **Close** — click outside overlay or X button to close

**Success criteria:**
- 📊 stats button visible in HUD during gameplay
- Stats overlay shows all active tribes with metrics
- Human player row is visually distinct
- Metrics update in real-time (or on open) reflecting current game state
- No regression in 522 passing tests

**Coach checks:** Start a game, play a few turns, click 📊 button, verify all tribes listed with correct metrics. Verify human row highlighted.
