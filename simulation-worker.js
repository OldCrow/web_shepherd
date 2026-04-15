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

function applyParams(params) {
  if (!params) return;
  if (params.herdParams) Object.assign(herdParams, params.herdParams);
  if (params.shepParams) Object.assign(shepParams, params.shepParams);
}

function snapshotToHerdMembers(snapshots) {
  const members = [];
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const member = new HerdMember(snapshot.x, snapshot.y, 0);
    member.vx = snapshot.vx;
    member.vy = snapshot.vy;
    members.push(member);
  }
  return members;
}

function snapshotToShepherds(snapshots) {
  const shepherdsList = [];
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const shepherd = new Shepherd(snapshot.x, snapshot.y, i);
    shepherd.vx = snapshot.vx;
    shepherd.vy = snapshot.vy;
    shepherdsList.push(shepherd);
  }
  return shepherdsList;
}

function createCursorShepherd(snapshot) {
  const cursor = Object.create(Shepherd.prototype);
  cursor.x = snapshot.x;
  cursor.y = snapshot.y;
  cursor.vx = snapshot.vx;
  cursor.vy = snapshot.vy;
  cursor.isCursor = true;
  return cursor;
}

function createCursorHerdMember(snapshot) {
  const cursor = new HerdMember(snapshot.x, snapshot.y, 0);
  cursor.vx = snapshot.vx;
  cursor.vy = snapshot.vy;
  cursor.isCursor = true;
  return cursor;
}

function applySnapshot(snapshot) {
  workerState.canvasWidth = snapshot.canvasWidth;
  workerState.canvasHeight = snapshot.canvasHeight;
  workerState.herdMembers = snapshotToHerdMembers(snapshot.herdMembers);
  workerState.shepherdMembers = snapshotToShepherds(snapshot.shepherdMembers);
  workerState.cursorHerdMember = createCursorHerdMember(snapshot.cursorHerdMember);
  workerState.cursorShepherd = createCursorShepherd(snapshot.cursorShepherd);
  workerState.cursorControlsFirstShepherd = snapshot.cursorControlsFirstShepherd;
  workerState.mouseX = snapshot.mouseX;
  workerState.mouseY = snapshot.mouseY;
  workerState.prevMouseX = snapshot.prevMouseX;
  workerState.prevMouseY = snapshot.prevMouseY;
  workerState.targetX = snapshot.targetX;
  workerState.targetY = snapshot.targetY;
}

function serializeAgent(agent) {
  return {
    x: agent.x,
    y: agent.y,
    vx: agent.vx,
    vy: agent.vy
  };
}

function emitFrame(frameData) {
  postMessage({
    type: 'frame',
    frameData,
    herdMembers: workerState.herdMembers.map(serializeAgent),
    shepherdMembers: workerState.shepherdMembers.map(serializeAgent),
    cursorHerdMember: serializeAgent(workerState.cursorHerdMember),
    cursorShepherd: serializeAgent(workerState.cursorShepherd)
  });
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
