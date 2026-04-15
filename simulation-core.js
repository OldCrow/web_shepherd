// simulation core
// Responsible for simulation updates only (no canvas/DOM rendering).
// This split keeps update logic reusable when running in a worker.

const simulationGrid = new SpatialGrid(Math.max(50, herdParams.r_A));

function updateCursorState(simState) {
  const rawVx = simState.mouseX - simState.prevMouseX;
  const rawVy = simState.mouseY - simState.prevMouseY;
  const alpha = PHYSICS.CURSOR_VELOCITY_SMOOTH;
  const beta = PHYSICS.TARGET_POSITION_SMOOTH || 0.03;

  if (simState.cursorControlsFirstShepherd) {
    if (simState.shepherdMembers.length > 0) {
      const leadShepherd = simState.shepherdMembers[0];
      // smooth position toward mouse target
      leadShepherd.x = leadShepherd.x * (1 - beta) + simState.mouseX * beta;
      leadShepherd.y = leadShepherd.y * (1 - beta) + simState.mouseY * beta;
      // smooth velocity to reduce jitter
      leadShepherd.vx = leadShepherd.vx * (1 - alpha) + rawVx * alpha;
      leadShepherd.vy = leadShepherd.vy * (1 - alpha) + rawVy * alpha;

      simState.cursorShepherd.vx = leadShepherd.vx;
      simState.cursorShepherd.vy = leadShepherd.vy;
    }

    // also update cursor shepherd object for radius visualization
    simState.cursorShepherd.x = simState.cursorShepherd.x * (1 - beta) + simState.mouseX * beta;
    simState.cursorShepherd.y = simState.cursorShepherd.y * (1 - beta) + simState.mouseY * beta;
  } else {
    // smooth velocity to reduce jitter
    simState.cursorHerdMember.vx = simState.cursorHerdMember.vx * (1 - alpha) + rawVx * alpha;
    simState.cursorHerdMember.vy = simState.cursorHerdMember.vy * (1 - alpha) + rawVy * alpha;

    // smooth position toward mouse target to allow forces (like shepherd repulsion) to act
    simState.cursorHerdMember.x = simState.cursorHerdMember.x * (1 - beta) + simState.mouseX * beta;
    simState.cursorHerdMember.y = simState.cursorHerdMember.y * (1 - beta) + simState.mouseY * beta;
  }
}

function rebuildSimulationGrid(allMembers, shepherdMembers) {
  simulationGrid.cellSize = Math.max(50, herdParams.r_A, PHYSICS.SHEPHERD_REPEL_MAX_DIST);
  simulationGrid.invCellSize = 1 / simulationGrid.cellSize;
  simulationGrid.clear();

  for (let member of allMembers) simulationGrid.insert(member);
  for (let shep of shepherdMembers) simulationGrid.insert(shep);
}

function computeCentroid(members) {
  let sumX = 0;
  let sumY = 0;
  const count = members.length;

  for (let i = 0; i < count; i++) {
    sumX += members[i].x;
    sumY += members[i].y;
  }

  if (count === 0) {
    return { x: 0, y: 0, count: 0 };
  }

  return {
    x: sumX / count,
    y: sumY / count,
    count
  };
}

function stepSimulation(simState) {
  updateCursorState(simState);

  // include cursor herd member in the herd when in herd-cursor mode
  const includeCursorHerd = !simState.cursorControlsFirstShepherd;
  const allMembers = includeCursorHerd
    ? [...simState.herdMembers, simState.cursorHerdMember]
    : simState.herdMembers;
  const shepsObjects = simState.shepherdMembers;

  rebuildSimulationGrid(allMembers, shepsObjects);

  for (let member of allMembers) {
    member.update(allMembers, shepsObjects, simState.canvasWidth, simState.canvasHeight, simulationGrid);
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

  const herdCentroid = computeCentroid(allMembers);
  const shepherdCentroid = computeCentroid(shepsObjects);

  // Note: only plain data here — this object crosses the worker
  // postMessage boundary, so live agent objects must not be included.
  return {
    includeCursorHerd,
    herdCentroidX: herdCentroid.x,
    herdCentroidY: herdCentroid.y,
    shepherdCentroidX: shepherdCentroid.x,
    shepherdCentroidY: shepherdCentroid.y
  };
}
