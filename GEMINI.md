# WW2 Frontlines - Project Brain (GEMINI.md)

## Project Overview
A WW2-themed first-person shooter/tank combat game built with Three.js and Cannon-es.

## Current State (May 6, 2026)
The project has recently undergone a major logic and visual fix phase.

### Recent Fixes:
1.  **Enemies:** Fixed spawn logic and increased awareness distance to 250 units.
2.  **Buildings:** Corrected grounding logic with a -0.2 offset and foundation depth to prevent floating.
3.  **Movement:** Increased walk speed (45) and sprint speed (75).
4.  **Vegetation:** 
    *   Fixed inverted Z-coordinate mapping for grass.
    *   Adjusted height thresholds (Trees: 4-80, Grass: 3-85) to populate the plateau.
    *   Verified ~3.6k grass blades and ~500 trees.

### Known Issues / Technical Debt:
- Sketchfab model failed to load in recent live test (Status 403/API failure).
- Pointer Lock requires a user gesture (handled via start overlay, but sometimes fails in automated tests).

## Architecture
- **Main Loop:** `js/main.js` (Game class)
- **Physics:** `cannon-es` (World managed in `Game`)
- **Graphics:** `three.js` (Scene managed in `Game`)
- **Key Modules:**
    - `player.js`: FPS controls and weapon logic.
    - `enemy.js`: Soldier AI and ragdoll physics.
    - `terrain.js`: Perlin noise heightfield.
    - `vegetation.js`: Instanced rendering for grass and trees.
    - `base.js`: Procedural building generation.
    - `modern-tank.js`: Player-controllable tank logic.

## Permanent Operating Rules
1. Read GEMINI.md before every task.
2. Screenshot live game and check console errors.
3. Select minimum agents needed.
4. Visual verification is mandatory.
5. QA Bot is the final gate.
6. Zero console errors for commit.
