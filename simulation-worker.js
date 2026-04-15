importScripts(
  'config.js',
  'vector-math.js',
  'spatial-grid.js',
  'agent.js',
  'agent_herd.js',
  'agent_shepherd.js',
  'simulation-core.js'
);

const workerState = {
  canvasWidth: 0,
  canvasHeight: 0,
  herdMembers: [],
  shepherdMembers: [],
  cursorHerdMember: null,
  cursorShepherd: null,
  cursorControlsFirstShepherd: false,
  mouseX: 0,
  mouseY: 0,
  prevMouseX: 0,
  prevMouseY: 0,
  targetX: 0,
  targetY: 0
};

const PACKED_AGENT_STRIDE = 4; // x, y, vx, vy

function applyParams(params) {
  if (!params) return;
  if (params.herdParams) Object.assign(herdParams, params.herdParams);
  if (params.shepParams) Object.assign(shepParams, params.shepParams);
}

function unpackHerdMembers(packedState, count) {
  const members = [];
  for (let i = 0; i < count; i++) {
    const base = i * PACKED_AGENT_STRIDE;
    const member = new HerdMember(packedState[base], packedState[base + 1], 0);
    member.vx = packedState[base + 2];
    member.vy = packedState[base + 3];
    members.push(member);
  }
  return members;
}

function unpackShepherds(packedState, count) {
  const shepherdsList = [];
  for (let i = 0; i < count; i++) {
    const base = i * PACKED_AGENT_STRIDE;
    const shepherd = new Shepherd(packedState[base], packedState[base + 1], i);
    shepherd.vx = packedState[base + 2];
    shepherd.vy = packedState[base + 3];
    shepherdsList.push(shepherd);
  }
  return shepherdsList;
}

function unpackCursorShepherd(packedState) {
  const cursor = Object.create(Shepherd.prototype);
  cursor.x = packedState[0];
  cursor.y = packedState[1];
  cursor.vx = packedState[2];
  cursor.vy = packedState[3];
  cursor.isCursor = true;
  return cursor;
}

function unpackCursorHerdMember(packedState) {
  const cursor = new HerdMember(packedState[0], packedState[1], 0);
  cursor.vx = packedState[2];
  cursor.vy = packedState[3];
  cursor.isCursor = true;
  return cursor;
}

function applySnapshot(snapshot) {
  workerState.canvasWidth = snapshot.canvasWidth;
  workerState.canvasHeight = snapshot.canvasHeight;
  workerState.herdMembers = unpackHerdMembers(snapshot.herdState, snapshot.herdCount);
  workerState.shepherdMembers = unpackShepherds(snapshot.shepherdState, snapshot.shepherdCount);
  workerState.cursorHerdMember = unpackCursorHerdMember(snapshot.cursorHerdState);
  workerState.cursorShepherd = unpackCursorShepherd(snapshot.cursorShepherdState);
  workerState.cursorControlsFirstShepherd = snapshot.cursorControlsFirstShepherd;
  workerState.mouseX = snapshot.mouseX;
  workerState.mouseY = snapshot.mouseY;
  workerState.prevMouseX = snapshot.prevMouseX;
  workerState.prevMouseY = snapshot.prevMouseY;
  workerState.targetX = snapshot.targetX;
  workerState.targetY = snapshot.targetY;
}

function packAgentsSoA(agents) {
  const packed = new Float32Array(agents.length * PACKED_AGENT_STRIDE);
  for (let i = 0; i < agents.length; i++) {
    const base = i * PACKED_AGENT_STRIDE;
    packed[base] = agents[i].x;
    packed[base + 1] = agents[i].y;
    packed[base + 2] = agents[i].vx;
    packed[base + 3] = agents[i].vy;
  }
  return packed;
}

function packSingleAgentSoA(agent) {
  return new Float32Array([agent.x, agent.y, agent.vx, agent.vy]);
}

function emitFrame(frameData) {
  const herdState = packAgentsSoA(workerState.herdMembers);
  const shepherdState = packAgentsSoA(workerState.shepherdMembers);
  const cursorHerdState = packSingleAgentSoA(workerState.cursorHerdMember);
  const cursorShepherdState = packSingleAgentSoA(workerState.cursorShepherd);

  postMessage({
    type: 'frame',
    frameData,
    herdCount: workerState.herdMembers.length,
    herdState,
    shepherdCount: workerState.shepherdMembers.length,
    shepherdState,
    cursorHerdState,
    cursorShepherdState
  }, [
    herdState.buffer,
    shepherdState.buffer,
    cursorHerdState.buffer,
    cursorShepherdState.buffer
  ]);
}

function applyInput(input) {
  workerState.canvasWidth = input.canvasWidth;
  workerState.canvasHeight = input.canvasHeight;
  workerState.mouseX = input.mouseX;
  workerState.mouseY = input.mouseY;
  workerState.prevMouseX = input.prevMouseX;
  workerState.prevMouseY = input.prevMouseY;
  workerState.targetX = input.targetX;
  workerState.targetY = input.targetY;
  workerState.cursorControlsFirstShepherd = input.cursorControlsFirstShepherd;
}

onmessage = (event) => {
  try {
    const message = event.data;

    if (message.type === 'init' || message.type === 'resync') {
      applyParams(message.params);
      applySnapshot(message.snapshot);
      return;
    }

    if (message.type === 'step') {
      applyParams(message.params);
      applyInput(message.input);

      let frameData = null;
      const stepCount = Math.max(1, message.steps || 1);
      for (let i = 0; i < stepCount; i++) {
        frameData = stepSimulation(workerState);
      }
      emitFrame(frameData);
    }
  } catch (error) {
    postMessage({
      type: 'error',
      error: error && error.message ? error.message : String(error)
    });
  }
};
