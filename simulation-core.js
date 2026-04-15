// simulation core
// Responsible for simulation updates only (no canvas/DOM rendering).
// This split keeps update logic reusable when running in a worker.

const simulationGrid = new SpatialGrid(Math.max(50, herdParams.r_A));

function updateCursorState(simState) {
  const rawVx = simState.mouseX - simState.prevMouseX;
  const rawVy = simState.mouseY - simState.prevMouseY;
  const alpha = PHYSICS.CURSOR_VELOCITY_SMOOTH;

  if (simState.cursorControlsFirstShepherd) {
    if (simState.shepherdMembers.length > 0) {
      const leadShepherd = simState.shepherdMembers[0];
      leadShepherd.x = simState.mouseX;
      leadShepherd.y = simState.mouseY;
      leadShepherd.vx = leadShepherd.vx * (1 - alpha) + rawVx * alpha;
      leadShepherd.vy = leadShepherd.vy * (1 - alpha) + rawVy * alpha;

      simState.cursorShepherd.vx = leadShepherd.vx;
      simState.cursorShepherd.vy = leadShepherd.vy;
    }

    simState.cursorShepherd.x = simState.mouseX;
    simState.cursorShepherd.y = simState.mouseY;
  } else {
    simState.cursorHerdMember.x = simState.mouseX;
    simState.cursorHerdMember.y = simState.mouseY;
    simState.cursorHerdMember.vx = simState.cursorHerdMember.vx * (1 - alpha) + rawVx * alpha;
    simState.cursorHerdMember.vy = simState.cursorHerdMember.vy * (1 - alpha) + rawVy * alpha;
  }
}

function rebuildSimulationGrid(simState, includeCursorHerd) {
  simulationGrid.cellSize = Math.max(50, herdParams.r_A, PHYSICS.SHEPHERD_REPEL_MAX_DIST);
  simulationGrid.invCellSize = 1 / simulationGrid.cellSize;
  simulationGrid.clear();

  for (let member of simState.herdMembers) simulationGrid.insert(member);
  if (includeCursorHerd) simulationGrid.insert(simState.cursorHerdMember);
  for (let shep of simState.shepherdMembers) simulationGrid.insert(shep);
}

function _computeCircularCoordinate(values, period) {
  if (values.length === 0 || period <= 0) return 0;

  // Circular mean on [0, period): map to angle, average unit vectors, map back.
  // This keeps means stable when values straddle wrap boundaries.
  let sumSin = 0;
  let sumCos = 0;
  const factor = (2 * Math.PI) / period;

  for (let i = 0; i < values.length; i++) {
    const angle = values[i] * factor;
    sumSin += Math.sin(angle);
    sumCos += Math.cos(angle);
  }

  const magnitudeSq = sumSin * sumSin + sumCos * sumCos;
  if (magnitudeSq < 1e-12) {
    // Ambiguous circular mean (uniform/opposed spread): fall back to arithmetic.
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[i];
    return sum / values.length;
  }

  let angle = Math.atan2(sumSin, sumCos);
  if (angle < 0) angle += 2 * Math.PI;
  return (angle / (2 * Math.PI)) * period;
}

function computeToroidalCentroid(members, width, height, extraMember = null) {
  const xs = [];
  const ys = [];

  for (let i = 0; i < members.length; i++) {
    xs.push(members[i].x);
    ys.push(members[i].y);
  }

  if (extraMember) {
    xs.push(extraMember.x);
    ys.push(extraMember.y);
  }

  if (xs.length === 0) {
    return { x: 0, y: 0, count: 0 };
  }

  return {
    x: _computeCircularCoordinate(xs, width),
    y: _computeCircularCoordinate(ys, height),
    count: xs.length
  };
}


function stepSimulation(simState) {
  updateCursorState(simState);

  const allMembers = simState.herdMembers;
  const shepsObjects = simState.shepherdMembers;
  const includeCursorHerd = !simState.cursorControlsFirstShepherd;

  rebuildSimulationGrid(simState, includeCursorHerd);

  for (let member of allMembers) {
    member.update(allMembers, shepsObjects, simState.canvasWidth, simState.canvasHeight, simulationGrid);
  }
  if (includeCursorHerd) {
    simState.cursorHerdMember.update(allMembers, shepsObjects, simState.canvasWidth, simState.canvasHeight, simulationGrid);
  }

  for (let i = 0; i < shepsObjects.length; i++) {
    shepsObjects[i].update(
      allMembers,
      shepsObjects,
      simState.targetX,
      simState.targetY,
      simState.canvasWidth,
      simState.canvasHeight,
      simulationGrid
    );
  }

  const herdCentroid = computeToroidalCentroid(
    allMembers,
    simState.canvasWidth,
    simState.canvasHeight,
    includeCursorHerd ? simState.cursorHerdMember : null
  );
  const shepherdCentroid = computeToroidalCentroid(
    shepsObjects,
    simState.canvasWidth,
    simState.canvasHeight
  );

  return {
    includeCursorHerd,
    herdCentroidX: herdCentroid.x,
    herdCentroidY: herdCentroid.y,
    shepherdCentroidX: shepherdCentroid.x,
    shepherdCentroidY: shepherdCentroid.y
  };
}
