// Herd-member dynamics for WebShep.
// Depends on the existing globals: Agent, VectorMath, PHYSICS, herdParams,
// INIT, showRadii, and isSlim.
//
// Zone radii are ABSOLUTE distances:
//   [0, r_R)       : repulsion
//   [r_R, r_O)     : orientation
//   [r_O, r_A)     : attraction
// The radii should therefore satisfy 0 <= r_R <= r_O <= r_A.
//
// Assumed physics units:
//   position: pixels; velocity / maxSpeed: pixels per second;
//   HERD_MAX_FORCE: pixels per second squared; DT: seconds per update.

class HerdMember extends Agent {
  constructor(x, y, herdId) {
    super();
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 1;
    this.vy = (Math.random() - 0.5) * 1;
    this.maxSpeed = PHYSICS.HERD_MAX_SPEED;
    this.herdId = herdId;
  }

  // Update the herd dynamics.
  // `grid` is an optional SpatialGrid used for faster neighbour searches.
  update(allMembers, shepherds, width, height, grid) {
    // This parameter is derived, so keep it synchronized with an r_A slider.
    herdParams.r_I = Math.max(0, herdParams.r_A - 0.5);

    const dt = PHYSICS.DT;
    const maxForce = PHYSICS.HERD_MAX_FORCE;

    const rR = herdParams.r_R;
    const rO = herdParams.r_O;
    const rA = herdParams.r_A;
    const rI = herdParams.r_I;

    const r_R_sq = rR * rR;
    const r_O_sq = rO * rO;
    const r_A_sq = rA * rA;
    const r_I_sq = rI * rI;

    let repX = 0, repY = 0;
    let oriX = 0, oriY = 0;
    let attX = 0, attY = 0;
    let repCount = 0, oriCount = 0, attCount = 0;

    // A normal spatial-grid query may not include neighbours on the opposite
    // canvas edge. Use the full list near an edge to preserve wraparound.
    // (If your SpatialGrid supports periodic queries, this fallback can go.)
    const nearEdge = width > 0 && height > 0 && (
      this.x < rA || this.x >= width - rA ||
      this.y < rA || this.y >= height - rA
    );
    const nearby = grid && !nearEdge
      ? grid.query(this.x, this.y, rA)
      : allMembers;

    for (const other of nearby) {
      if (other === this) continue;

      // Minimum-image displacement, from other to this agent.
      // Works with the periodic (wrapping) canvas boundaries below.
      let dx = this.x - other.x;
      let dy = this.y - other.y;
      if (width > 0) {
        if (dx > width / 2) dx -= width;
        else if (dx < -width / 2) dx += width;
      }
      if (height > 0) {
        if (dy > height / 2) dy -= height;
        else if (dy < -height / 2) dy += height;
      }

      const distSq = dx * dx + dy * dy;
      if (distSq === 0) continue;

      // Mutually exclusive zones: each neighbour contributes to ONE zone.
      if (distSq < r_R_sq) {
        // Inverse-square-weighted average of outward unit vectors.
        const invDistSq = 1 / distSq;
        const invDist = Math.sqrt(invDistSq);
        repX += dx * invDist * invDistSq;
        repY += dy * invDist * invDistSq;
        repCount += invDistSq;

      } else if (distSq < r_O_sq) {
        // Mean neighbour velocity for alignment.
        oriX += other.vx;
        oriY += other.vy;
        oriCount++;

      } else if (distSq < r_A_sq) {
        // Average direction toward attraction-zone neighbours.
        // Accumulate RELATIVE offsets to handle wrapped boundaries correctly.
        attX -= dx;
        attY -= dy;
        attCount++;
      }
    }

    // Shepherd repulsion has priority over all herd interactions.
    let shepRepX = 0, shepRepY = 0, shepCount = 0;
    for (const shep of shepherds) {
      let dx = this.x - shep.x;
      let dy = this.y - shep.y;
      if (width > 0) {
        if (dx > width / 2) dx -= width;
        else if (dx < -width / 2) dx += width;
      }
      if (height > 0) {
        if (dy > height / 2) dy -= height;
        else if (dy < -height / 2) dy += height;
      }

      const distSq = dx * dx + dy * dy;
      if (distSq > 0 && distSq < r_I_sq) {
        const invDistSq = 1 / distSq;
        const invDist = Math.sqrt(invDistSq);
        shepRepX += dx * invDist * invDistSq;
        shepRepY += dy * invDist * invDistSq;
        shepCount += invDistSq;
      }
    }

    let ax = 0;
    let ay = 0;

    if (shepCount > 0) {
      // Highest priority: move away from shepherds.
      ax = (shepRepX / shepCount) * maxForce * herdParams.a_I;
      ay = (shepRepY / shepCount) * maxForce * herdParams.a_I;
    } else {
      // Repulsion and attraction can act together on DIFFERENT neighbours.
      if (repCount > 0) {
        ax += (repX / repCount) * maxForce * herdParams.a_R;
        ay += (repY / repCount) * maxForce * herdParams.a_R;
      }

      // close-range repulsion suspends alignment.
      if (repCount === 0 && oriCount > 0) {
        const avgOriX = oriX / oriCount;
        const avgOriY = oriY / oriCount;

        VectorMath.limitMagnitudeInto(
          avgOriX - this.vx,
          avgOriY - this.vy,
          maxForce * herdParams.a_O,
          VectorMath._limitOut
        );
        ax += VectorMath._limitOut.vx;
        ay += VectorMath._limitOut.vy;
      }

      if (attCount > 0) {
        const dx = attX / attCount;
        const dy = attY / attCount;
        const distSq = dx * dx + dy * dy;
        if (distSq > 0) {
          const invDist = 1 / Math.sqrt(distSq);
          ax += dx * invDist * maxForce * herdParams.a_A;
          ay += dy * invDist * maxForce * herdParams.a_A;
        }
      }
    }

    // Integrate acceleration into velocity (frame-based)
    this.vx += ax;
    this.vy += ay;

    // Friction
    const damping = Math.max(
      0,
      1 - herdParams.a_V * PHYSICS.DT
    );

    this.vx *= damping;
    this.vy *= damping;

    // Limit speed
    VectorMath.limitMagnitudeInto(
      this.vx,
      this.vy,
      this.maxSpeed,
      VectorMath._limitOut
    );

    this.vx = VectorMath._limitOut.vx;
    this.vy = VectorMath._limitOut.vy;

    // Update position (frame-based)
    this.x += this.vx;
    this.y += this.vy;

    // Periodic boundary conditions; modulo also handles large jumps.
    if (width > 0 && (this.x < 0 || this.x >= width)) {
      this.x = ((this.x % width) + width) % width;
    }
    if (height > 0 && (this.y < 0 || this.y >= height)) {
      this.y = ((this.y % height) + height) % height;
    }
  }

  draw(ctx, color) {
    if ((showRadii || this.isCursor) && !isSlim) {
      const maxRadiusViz = Math.max(
        herdParams.r_R, herdParams.r_O, herdParams.r_A
      );
      this.drawRadiusCircle(ctx, color, maxRadiusViz);
    }

    const angle = Math.atan2(this.vy, this.vx);
    this.drawTriangle(ctx, color, angle);
  }
}

// Initialize a herd with random positions around a given centre.
function initializeHerd(
  count = INIT.HERD_SIZE,
  centerX = window.innerWidth / 2,
  centerY = window.innerHeight / 2,
  spreadRadius = INIT.HERD_SPREAD_RADIUS
) {
  const members = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * spreadRadius;
    const member = new HerdMember(
      centerX + radius * Math.cos(angle),
      centerY + radius * Math.sin(angle),
      0
    );
    members.push(member);
  }
  return members;
}

function _addRandomHerdMember(herd, canvasWidth, canvasHeight) {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * INIT.HERD_SPREAD_RADIUS;
  const member = new HerdMember(
    centerX + radius * Math.cos(angle),
    centerY + radius * Math.sin(angle),
    0
  );
  herd.push(member);
}

function _removeRandomHerdMember(herd) {
  if (herd.length > 0) {
    const randomIndex = Math.floor(Math.random() * herd.length);
    herd.splice(randomIndex, 1);
  }
}