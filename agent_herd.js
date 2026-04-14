
// extend agent class for herd members 
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

  // update the herd dynamics 
  // grid: optional SpatialGrid for O(1) neighbor lookup
  update(allMembers, shepherds, width, height, grid) {
    
    // compute r_I from r_A if not already set
    if (herdParams.r_I === null) {
      herdParams.r_I = herdParams.r_A - 0.5;
    }

    // initialize repulsion, orientation, and attraction forces
    let repX = 0, repY = 0;
    let oriX = 0, oriY = 0;
    let attX = 0, attY = 0;
    let repCount = 0, oriCount = 0, attCount = 0;

    // pre-compute squared radii to avoid sqrt in range comparisons
    const r_R_sq = herdParams.r_R * herdParams.r_R;
    const r_O_sq = herdParams.r_O * herdParams.r_O;
    const r_A_sq = herdParams.r_A * herdParams.r_A;

    // interact with nearby herd members (use spatial grid if available)
    const nearby = grid ? grid.query(this.x, this.y, Math.max(herdParams.r_R, herdParams.r_O, herdParams.r_A)) : allMembers;
    for (let other of nearby) {
      if (other === this) continue;

      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const distSq = dx * dx + dy * dy;

      if (distSq === 0) continue;

      // repulsion (r_R) — inverse-square weighted
      if (distSq < r_R_sq) {
        // w = 1/distSq, and (dx/dist)*w = dx/dist^3 = dx/(distSq * sqrt(distSq))
        // but since we accumulate weighted, we can use: dx / (distSq) as the contribution
        // which is (dx/dist) * (1/dist) = equivalent to original (dx/dist) * (1/distSq) * dist
        // Actually: original is (dx/dist) * (1/distSq) = dx / (dist^3)
        // = dx / (distSq * sqrt(distSq))
        const invDistSq = 1 / distSq;
        const invDist = Math.sqrt(invDistSq); // = 1/dist, only sqrt when actually needed
        repX += dx * invDist * invDistSq;
        repY += dy * invDist * invDistSq;
        repCount += invDistSq;
      }

      // orientation (r_O) — no distance value needed, just range check
      if (distSq < r_O_sq) {
        oriX += other.vx;
        oriY += other.vy;
        oriCount++;
      }

      // attraction (r_A) — no distance value needed, just range check
      if (distSq < r_A_sq) {
        attX += other.x;
        attY += other.y;
        attCount++;
      }
    }

    // check shepherd interaction (highest priority — overrides herd mentality)
    const r_I_sq = herdParams.r_I * herdParams.r_I;
    let shepRepX = 0, shepRepY = 0, shepCount = 0;
    for (let shep of shepherds) {
      const dx = this.x - shep.x;
      const dy = this.y - shep.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < r_I_sq && distSq > 0) {
        const invDistSq = 1 / distSq;
        const invDist = Math.sqrt(invDistSq);
        shepRepX += dx * invDist * invDistSq;
        shepRepY += dy * invDist * invDistSq;
        shepCount += invDistSq;
      }
    }

    // apply aggregated forces 
    // zoning: shepherd overrides all; herd repulsion overrides orientation and attraction
    if (shepCount > 0) {
      this.vx += (shepRepX / shepCount) * PHYSICS.HERD_MAX_FORCE * herdParams.a_I;
      this.vy += (shepRepY / shepCount) * PHYSICS.HERD_MAX_FORCE * herdParams.a_I;
    } else if (repCount > 0) {
      this.vx += (repX / repCount) * PHYSICS.HERD_MAX_FORCE * herdParams.a_R;
      this.vy += (repY / repCount) * PHYSICS.HERD_MAX_FORCE * herdParams.a_R;
    } else {
      if (oriCount > 0) {
        oriX /= oriCount;
        oriY /= oriCount;
        VectorMath.limitMagnitudeInto(oriX - this.vx, oriY - this.vy, PHYSICS.HERD_MAX_FORCE * herdParams.a_O, VectorMath._limitOut);
        this.vx += VectorMath._limitOut.vx;
        this.vy += VectorMath._limitOut.vy;
      }

      if (attCount > 0) {
        attX /= attCount;
        attY /= attCount;
        const dx = attX - this.x;
        const dy = attY - this.y;
        const distSqAtt = dx * dx + dy * dy;
        if (distSqAtt > 0) {
          const invDist = 1 / Math.sqrt(distSqAtt);
          this.vx += dx * invDist * PHYSICS.HERD_MAX_FORCE * herdParams.a_A;
          this.vy += dy * invDist * PHYSICS.HERD_MAX_FORCE * herdParams.a_A;
        }
      }
    }

    // laziness/friction
    this.vx *= (1 - herdParams.a_V * PHYSICS.DT);
    this.vy *= (1 - herdParams.a_V * PHYSICS.DT);

    // limit speed (GC-free)
    VectorMath.limitMagnitudeInto(this.vx, this.vy, this.maxSpeed, VectorMath._limitOut);
    this.vx = VectorMath._limitOut.vx;
    this.vy = VectorMath._limitOut.vy;

    // update position (should have a time component, but scaling does this)
    this.x += this.vx;
    this.y += this.vy;

    // wrap around edges of canvas
    if (this.x < 0) this.x = width;
    if (this.x > width) this.x = 0;
    if (this.y < 0) this.y = height;
    if (this.y > height) this.y = 0;
  }

  draw(ctx, color) {
    if (showRadii || this.isCursor) {
      const maxRadiusViz = Math.max(herdParams.r_R, herdParams.r_O, herdParams.r_A);
      this.drawRadiusCircle(ctx, color, maxRadiusViz);
    }
    
    const angle = Math.atan2(this.vy, this.vx);
    this.drawTriangle(ctx, color, 6, angle);
  }
}

// functions to initial and dynamically modify the herd
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
