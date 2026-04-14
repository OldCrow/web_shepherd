
// extend agent class for shepherds
class Shepherd extends Agent {
  constructor(x, y, shepId) {
    super();
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.maxSpeed = PHYSICS.SHEPHERD_MAX_SPEED;
    this.shepId = shepId;
    this.targetX = x;
    this.targetY = y;
  }

  // update the shepherd dynamics
  // grid: optional SpatialGrid for O(1) neighbor lookup
  update(herdMembers, otherShepherds, targetX, targetY, width, height, grid) {

    // find closest herd member — must search ALL members (not grid)
    // because the shepherd navigates to wherever the closest herd member is,
    // regardless of distance. Grid would miss wrapped-around agents.
    let closestHerd = null;
    let minDistSq = Infinity;
    for (let member of herdMembers) {
      const dx = member.x - this.x;
      const dy = member.y - this.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestHerd = member;
      }
    }

    // if herd exists, compute desired position
    if (closestHerd) {
      // vector from target toward closest herd member (away from target)
      let vx = closestHerd.x - targetX;
      let vy = closestHerd.y - targetY;
      const vDist = VectorMath.magnitude(vx, vy);

      if (vDist > 0.1) {
        // normalize 
        vx /= vDist;
        vy /= vDist;

        // desired position: distance r_S from herd, opposite target 
        const desiredX = closestHerd.x + vx * shepParams.r_S;
        const desiredY = closestHerd.y + vy * shepParams.r_S;

        // navigate toward desired position
        const dx = desiredX - this.x;
        const dy = desiredY - this.y;
        const dist = VectorMath.distance(this.x, this.y, desiredX, desiredY);

        if (dist > PHYSICS.SHEPHERD_UPDATE_THRESHOLD) {
          this.vx += (dx / dist) * PHYSICS.SHEPHERD_MAX_FORCE * shepParams.a_N;
          this.vy += (dy / dist) * PHYSICS.SHEPHERD_MAX_FORCE * shepParams.a_N;
        }
      }
    }

    // repulsion from other shepherds (use grid for nearby query)
    const repelMaxDistSq = PHYSICS.SHEPHERD_REPEL_MAX_DIST * PHYSICS.SHEPHERD_REPEL_MAX_DIST;
    const nearbyShepherds = grid ? grid.query(this.x, this.y, PHYSICS.SHEPHERD_REPEL_MAX_DIST) : otherShepherds;
    for (let other of nearbyShepherds) {
      if (other === this) continue;
      if (!(other instanceof Shepherd)) continue; // grid returns all agent types
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < repelMaxDistSq && distSq > 0) {
        const invDist = 1 / Math.sqrt(distSq);
        this.vx += dx * invDist * PHYSICS.SHEPHERD_MAX_FORCE * shepParams.a_R_s;
        this.vy += dy * invDist * PHYSICS.SHEPHERD_MAX_FORCE * shepParams.a_R_s;
      }
    }

    // laziness/friction: slow down 
    this.vx += shepParams.a_V_s * (-this.vx) * PHYSICS.DT;
    this.vy += shepParams.a_V_s * (-this.vy) * PHYSICS.DT;

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

    // update target (if applicable)
    this.targetX = targetX;
    this.targetY = targetY;
  }

  draw(ctx, color) {
    if (showRadii || this.isCursor) {
      this.drawRadiusCircle(ctx, color, shepParams.r_S);
    }
    const angle = Math.atan2(this.vy, this.vx);
    this.drawTriangle(ctx, color, 6, angle);
  }
}

// functions to initialize and dynamically modify the shepherds
function initializeShepherds(
  count = INIT.SHEPHERD_SIZE,
  centerX = window.innerWidth / 2,
  centerY = window.innerHeight / 2,
  spreadRadius = INIT.HERD_SPREAD_RADIUS
) {
  const shepherds = [];
  for (let s = 0; s < count; s++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * spreadRadius;
    shepherds.push(
      new Shepherd(
        centerX + radius * Math.cos(angle),
        centerY + radius * Math.sin(angle),
        s
      )
    );
  }
  return shepherds;
}

function _addRandomShepherd(shepherds, canvasWidth, canvasHeight) {
  const newId = shepherds.length;
  shepherds.push(
    new Shepherd(
      Math.random() * canvasWidth,
      Math.random() * canvasHeight,
      newId
    )
  );
}

function _removeRandomShepherd(shepherds) {
  if (shepherds.length > 0) {
    const randomIndex = Math.floor(Math.random() * shepherds.length);
    shepherds.splice(randomIndex, 1);
  }
}
