# Performance Optimization

This document summarizes optimization work in two phases:

1. **Phase 1: O(n) performance pass** (core runtime speedup).
2. **Phase 2: refactor/threading pass** (architecture, worker offload, and data-path improvements).

The goal is to keep a single narrative that shows what changed, why it changed, and where diminishing returns start.

## Optimization Timeline

### Phase 1: O(n) Performance Pass

#### Problem Statement

The original simulation spent most time in O(n²) neighbor scans: every agent checked every other agent every frame. At higher counts this exceeded frame budgets and caused visible stutter.

Additional overhead came from:
- per-frame temporary object allocation
- unnecessary `Math.sqrt()` calls in range checks
- avoidable array copies in hot paths

#### Methodology

Optimizations were applied incrementally:

1. Baseline FPS measurement at multiple agent counts.
2. One optimization at a time.
3. Visual validation to confirm behavior stayed consistent.
4. Re-measurement after each change.

#### Key Changes (Phase 1)

**New file**
- `spatial-grid.js`
  - Added a 2D spatial hash grid for local neighbor queries.
  - Replaced broad full-list interaction checks with local cell lookups in hot paths.

**Modified files**
- `vector-math.js`
  - Added squared-distance and GC-free vector limit helpers.
- `agent_herd.js`
  - Switched radius checks to squared-distance comparisons.
  - Used spatial-grid neighbor queries for herd interactions.
- `agent_shepherd.js`
  - Kept closest-herd search global for behavior correctness.
  - Used spatial-grid filtering for nearby shepherd repulsion.
- `ui.js`
  - Removed avoidable per-frame allocations.
  - Added FPS overlay.
- `index.html`
  - Included `spatial-grid.js`.

#### Design Notes (Phase 1)

- **Spatial hash grid vs KD-tree**: chosen for low implementation complexity and efficient rebuild/query behavior in browser JS.
- **GC avoidance**: reduced short-lived allocations in frame-critical paths.

#### Measured Results (Phase 1)

Tested on a 144Hz monitor (vsync-capped by `requestAnimationFrame`):

| Agents | FPS | Notes |
|--------|-----|-------|
| 25     | 144 | Default config, vsync-capped |
| 80     | 144 | UI-range counts still capped |
| 1100   | 144 | Still capped |
| 2100   | ~100 | First measurable drop |

At scale, this extended practical counts from low hundreds into the low thousands.

### Phase 2: Refactor, Threading, and Data-Path Improvements

Phase 1 focused on raw algorithmic speed. Phase 2 focused on architecture and sustained behavior under load.

#### 1) Simulation/Render Separation

- Added `simulation-core.js` for simulation update logic.
- Added `renderer.js` for drawing logic.
- Split previously monolithic frame logic in `ui.js`.

#### 2) Fixed-Step Simulation Loop

- Introduced fixed-step accumulator scheduling in `ui.js`.
- Added timing controls in `config.js`:
  - `FIXED_TIMESTEP_MS`
  - `MAX_CATCHUP_STEPS`
  - `MAX_FRAME_DELTA_MS`
- Tuned simulation step rate to **120Hz** to better match pre-refactor traversal feel on high-refresh systems.

#### 3) Worker Offload

- Added `simulation-worker.js`.
- Moved simulation stepping off the main thread.
- Main thread now focuses on UI/input/render and worker orchestration.

#### 4) Hot-State Transport Moved to SoA

- Worker ↔ main thread snapshots now use packed `Float32Array` data (`[x, y, vx, vy]` stride) instead of per-agent object arrays.
- Added transfer-list usage for init/resync and per-frame worker messages.
- Result: less allocation churn and lower message serialization overhead.

#### 5) Correctness and UX Fixes

- **Spatial-grid key correctness**
  - Cantor pairing is bijective for non-negative pairs only.
  - Query bounds were clamped to non-negative cells to prevent key collisions near top/left edges.
- **Toroidal centroid fix**
  - Replaced arithmetic mean with circular mean for wrapped canvas coordinates.
  - Prevents centroid marker jumps across wrap boundaries.
- **Population input initialization**
  - UI counters now initialize from actual simulation sizes.

#### Observed Behavior (Phase 2)

Manual observations on the current branch:

- FPS stayed near monitor cap up to roughly **~2500 agents**.
- After that, FPS declined roughly linearly.
- Around **~4000 agents**, FPS dropped below **~100**.

Exact numbers depend on hardware/browser/refresh rate, but trend direction is consistent.

## Current Architecture (Post-Refactor)

- **Main thread**
  - DOM/UI
  - input capture
  - rendering
  - fixed-step scheduling and worker coordination
- **Worker thread**
  - simulation stepping
  - neighbor-grid rebuild/query
  - centroid computation
  - packed-state emission

## Diminishing Returns and Remaining Work

The branch is in a good reviewable state for upstream PR work. Additional work is possible, but likely higher effort per gain.

Remaining bottlenecks:
- Shepherd nearest-herd logic still performs global scan (`O(H * S)`).
- Canvas rendering remains linear in agent count.
- Simulation internals are still object-based; SoA currently optimizes transport, not full compute storage.

If more scale is required, high-value next steps are:

1. Move simulation internals to full SoA storage/update loops.
2. Revisit shepherd target selection to reduce full-scan cost.
3. Move rendering to WebGL if draw cost becomes dominant.

## Dependencies

None. All optimizations use vanilla JavaScript and browser-native APIs.
