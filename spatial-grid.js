/**
 * 2D Spatial Hash Grid for O(1) neighbor queries.
 * 
 * Divides the canvas into cells of fixed size. Agents are inserted into
 * cells based on their position. Neighbor queries check only the 9
 * surrounding cells (3x3 neighborhood), giving O(k) cost where k is the
 * local agent density, instead of O(n) for a full scan.
 * 
 * Usage:
 *   const grid = new SpatialGrid(cellSize);
 *   // each frame:
 *   grid.clear();
 *   for (agent of agents) grid.insert(agent);
 *   const neighbors = grid.query(x, y, radius);
 */
class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
    this.cells = new Map();
  }

  // Hash a cell coordinate to a single key
  _key(cx, cy) {
    // Cantor pairing — fast, unique for all integer pairs
    return ((cx + cy) * (cx + cy + 1)) / 2 + cy;
  }

  // Clear all cells (called once per frame)
  clear() {
    this.cells.clear();
  }

  // Insert an agent into its cell — O(1)
  insert(agent) {
    const cx = Math.floor(agent.x * this.invCellSize);
    const cy = Math.floor(agent.y * this.invCellSize);
    const key = this._key(cx, cy);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(agent);
  }

  // Query all agents within radius of (x, y) — O(k) where k = local density
  // Returns agents in the 3x3 cell neighborhood. Caller must do final
  // distance check (grid returns superset within ±cellSize).
  query(x, y, radius) {
    const results = [];
    const r = Math.max(radius, this.cellSize);
    const minCx = Math.floor((x - r) * this.invCellSize);
    const maxCx = Math.floor((x + r) * this.invCellSize);
    const minCy = Math.floor((y - r) * this.invCellSize);
    const maxCy = Math.floor((y + r) * this.invCellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }
}
