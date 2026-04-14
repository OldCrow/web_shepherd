
const VectorMath = {
  distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  // Squared distance — use for range comparisons to avoid sqrt.
  // Compare distSq < radius*radius instead of dist < radius.
  distanceSquared(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  },

  magnitude(vx, vy) {
    return Math.sqrt(vx * vx + vy * vy);
  },

  magnitudeSquared(vx, vy) {
    return vx * vx + vy * vy;
  },

  normalize(vx, vy) {
    const mag = this.magnitude(vx, vy);
    return mag > 0 ? { vx: vx / mag, vy: vy / mag } : { vx: 0, vy: 0 };
  },

  scale(vx, vy, scalar) {
    return { vx: vx * scalar, vy: vy * scalar };
  },

  limitMagnitude(vx, vy, maxMag) {
    const mag = this.magnitude(vx, vy);
    if (mag > maxMag) {
      return { vx: (vx / mag) * maxMag, vy: (vy / mag) * maxMag };
    }
    return { vx, vy };
  },

  // GC-free version: writes result into pre-allocated _out object.
  // Call as: VectorMath.limitMagnitudeInto(vx, vy, max, out)
  // Then read out.vx, out.vy
  _limitOut: { vx: 0, vy: 0 },
  limitMagnitudeInto(vx, vy, maxMag, out) {
    const magSq = vx * vx + vy * vy;
    if (magSq > maxMag * maxMag) {
      const scale = maxMag / Math.sqrt(magSq);
      out.vx = vx * scale;
      out.vy = vy * scale;
    } else {
      out.vx = vx;
      out.vy = vy;
    }
  }
};
