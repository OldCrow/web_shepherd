// load css colors 
const COLORS = {
  HERD: getComputedStyle(document.documentElement).getPropertyValue('--color-herd').trim(),
  HERD_LIGHT: getComputedStyle(document.documentElement).getPropertyValue('--color-herd-light').trim(),
  SHEPHERD: getComputedStyle(document.documentElement).getPropertyValue('--color-shepherd').trim(),
  SHEPHERD_LIGHT: getComputedStyle(document.documentElement).getPropertyValue('--color-shepherd-light').trim(),
  TARGET: getComputedStyle(document.documentElement).getPropertyValue('--color-target').trim(),
  CENTROID_HERD: getComputedStyle(document.documentElement).getPropertyValue('--color-centroid-herd').trim(),
  CENTROID_SHEPHERD: getComputedStyle(document.documentElement).getPropertyValue('--color-centroid-shepherd').trim()
};


// builds slides from config data 
const SLIDER_CONFIG = SLIDER_CONFIG_DATA.map(config => ({
  ...config,
  setter: (v) => {
    const [obj, key] = config.param.split('.');
    if (obj === 'herdParams') herdParams[key] = v;
    else if (obj === 'shepParams') shepParams[key] = v;
  }
}));

// collapsible toggle 
function initCollapsibles() {
  const headers = document.querySelectorAll('.collapsible-header');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const contentId = header.getAttribute('data-toggle');
      const toggleId = contentId.replace('-content', '-toggle');
      
      const content = document.getElementById(contentId);
      const toggle = document.getElementById(toggleId);
      
      if (content && toggle) {
        content.classList.toggle('open');
        toggle.classList.toggle('open');
      }
    });
  });
}

// slider beinding 
function bindSlider(config) {
  const slider = document.getElementById(config.id);
  const labelId = config.id + '-value';
  const label = document.getElementById(labelId);

  if (!slider || !label) return;

  // apply constraints and initial value from config
  const constraints = SLIDER_CONSTRAINTS[config.id];
  if (constraints) {
    slider.setAttribute('min', constraints.min);
    slider.setAttribute('max', constraints.max);
    slider.setAttribute('step', constraints.step);
  }
  slider.value = config.value;

  // set initial label value
  label.textContent = parseFloat(config.value).toFixed(constraints?.step < 0.1 ? 2 : 1);

  // listen to slider changes
  slider.addEventListener('input', e => {
    const val = parseFloat(e.target.value);
    config.setter(val);
    label.textContent = val.toFixed(constraints?.step < 0.1 ? 2 : 1);
    enforceConstraints();
    updateVisualizations();
  });
}

function initSliders() {
  SLIDER_CONFIG.forEach(config => bindSlider(config));
}
let worldState = null;

function createWorldState(canvas) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  const cursorShepherd = Object.create(Shepherd.prototype);
  cursorShepherd.x = centerX;
  cursorShepherd.y = centerY;
  cursorShepherd.vx = 0;
  cursorShepherd.vy = 0;
  cursorShepherd.isCursor = true;

  const cursorHerdMember = new HerdMember(centerX, centerY, 0);
  cursorHerdMember.isCursor = true;

  return {
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    herdMembers: herd.members,
    shepherdMembers: shepherds.members,
    herdColor: herd.color,
    shepherdColor: shepherds.color,
    mouseX: centerX,
    mouseY: centerY,
    prevMouseX: centerX,
    prevMouseY: centerY,
    cursorHerdMember,
    cursorShepherd,
    cursorControlsFirstShepherd: false,
    targetX: centerX,
    targetY: centerY,
    lastSimulationFrame: null,
    needsWorkerResync: true
  };
}

// control population sizes 
function initPopulationControls() {
  const herdSizeInput = document.getElementById('herd-size-input');
  const shepherdsCountInput = document.getElementById('shepherds-count-input');

  if (herdSizeInput) {
    herdSizeInput.value = herdSize;
  }
  if (shepherdsCountInput) {
    shepherdsCountInput.value = shepherdSize;
  }

  if (herdSizeInput) {
    herdSizeInput.addEventListener('change', () => {
      let value = parseInt(herdSizeInput.value);
      if (value < 3) {
        value = 3;
        herdSizeInput.value = 3;
      }
      const diff = value - herdSize;
      if (diff > 0) {
        for (let i = 0; i < diff; i++) addRandomHerdMember();
      } else if (diff < 0) {
        for (let i = 0; i < -diff; i++) removeRandomHerdMember();
      }
      herdSize = value;
      if (worldState) worldState.needsWorkerResync = true;
    });
  }

  if (shepherdsCountInput) {
    shepherdsCountInput.addEventListener('change', () => {
      let value = parseInt(shepherdsCountInput.value);
      if (value < 1) {
        value = 1;
        shepherdsCountInput.value = 1;
      }
      const diff = value - shepherdSize;
      if (diff > 0) {
        for (let i = 0; i < diff; i++) addRandomShepherd();
      } else if (diff < 0) {
        for (let i = 0; i < -diff; i++) removeRandomShepherd();
      }
      shepherdSize = value;
      if (worldState) worldState.needsWorkerResync = true;
    });
  }
}


function initMouseTracking(canvas) {
  worldState.prevMouseX = canvas.width / 2;
  worldState.prevMouseY = canvas.height / 2;
  worldState.mouseX = canvas.width / 2;
  worldState.mouseY = canvas.height / 2;
  
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    worldState.prevMouseX = worldState.mouseX;
    worldState.prevMouseY = worldState.mouseY;
    worldState.mouseX = e.clientX - rect.left;
    worldState.mouseY = e.clientY - rect.top;
  });
  
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    worldState.targetX = e.clientX - rect.left;
    worldState.targetY = e.clientY - rect.top;
  });
}

function initCursorObjects(canvas) {
  worldState = createWorldState(canvas);
}

// cursor mode toggle
function initCursorModeToggle() {
  const toggle = document.getElementById('cursor-mode-toggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      worldState.cursorControlsFirstShepherd = e.target.checked;
    });
  }
}

// show radii toggle
function initShowRadiiToggle() {
  const toggle = document.getElementById('show-radii-toggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      showRadii = e.target.checked;
    });
  }
}

// constrain enforcement 
function enforceConstraints() {
  
  // r_R < r_O < r_A constraints hold at fixed defaults (radii are no longer user-adjustable)
  
  // derive interaction radius from attraction radius
  herdParams.r_I = herdParams.r_A - 0.5;
  
  // derive shepherding radius from interaction radius
  shepParams.r_S = herdParams.r_I - 1;
  
  // update display value for shepherding radius
  const shepRadiusLabel = document.getElementById('shep-r-s-value');
  if (shepRadiusLabel) {
    shepRadiusLabel.textContent = shepParams.r_S.toFixed(1);
  }

  // a_R_s_v = 2 * sqrt(a_R_s) 
  shepParams.a_R_s_v = 2 * Math.sqrt(shepParams.a_R_s);
}

// update visuals 
function updateVisualizations() {
  updateMultiSlider();
}

function updateMultiSlider() {
  const btnOrientation = document.getElementById('multi-btn-orientation');
  const btnRepulsion = document.getElementById('multi-btn-repulsion');
  const btnAttraction = document.getElementById('multi-btn-attraction');
  
  const lblOrientation = document.getElementById('multi-label-orientation');
  const lblRepulsion = document.getElementById('multi-label-repulsion');
  const lblAttraction = document.getElementById('multi-label-attraction');
  
  const valOrientation = document.getElementById('herd-r-o-value');
  const valRepulsion = document.getElementById('herd-r-r-value');
  const valAttraction = document.getElementById('herd-r-a-value');
  
  if (!btnOrientation || !btnRepulsion || !btnAttraction) return;

  const minVal = 0.5;
  const maxVal = 15;
  
  const r_O = herdParams.r_O;
  const r_R = herdParams.r_R;
  const r_A = herdParams.r_A;
  
  const percentO = ((r_O - minVal) / (maxVal - minVal)) * 100;
  const percentR = ((r_R - minVal) / (maxVal - minVal)) * 100;
  const percentA = ((r_A - minVal) / (maxVal - minVal)) * 100;
  
  btnOrientation.style.left = percentO + '%';
  btnRepulsion.style.left = percentR + '%';
  btnAttraction.style.left = percentA + '%';
  
  // update label positions to follow buttons
  if (lblOrientation) lblOrientation.style.left = percentO + '%';
  if (lblRepulsion) lblRepulsion.style.left = percentR + '%';
  if (lblAttraction) lblAttraction.style.left = percentA + '%';
  
  // update value positions to follow buttons
  if (valOrientation) {
    valOrientation.style.left = percentO + '%';
    valOrientation.textContent = r_O.toFixed(1);
  }
  if (valRepulsion) {
    valRepulsion.style.left = percentR + '%';
    valRepulsion.textContent = r_R.toFixed(1);
  }
  if (valAttraction) {
    valAttraction.style.left = percentA + '%';
    valAttraction.textContent = r_A.toFixed(1);
  }
}

let multiSliderDragState = {
  isDragging: false,
  behavior: null,
  startX: 0,
  container: null
};

function initMultiSlider() {
  const container = document.querySelector('.multi-slider-track');
  if (!container) return;
  
  multiSliderDragState.container = container;
  
  const buttons = {
    orientation: { element: document.getElementById('multi-btn-orientation'), minValue: 0.5, maxValue: 10 },
    repulsion: { element: document.getElementById('multi-btn-repulsion'), minValue: 0.5, maxValue: 6 },
    attraction: { element: document.getElementById('multi-btn-attraction'), minValue: 2, maxValue: 15 }
  };
  
  // mouse down on button
  Object.entries(buttons).forEach(([behavior, btn]) => {
    if (!btn.element) return;
    
    btn.element.addEventListener('mousedown', (e) => {
      e.preventDefault();
      multiSliderDragState.isDragging = true;
      multiSliderDragState.behavior = behavior;
      multiSliderDragState.startX = e.clientX;
      btn.element.classList.add('dragging');
    });
  });
  
  // mouse move
  document.addEventListener('mousemove', (e) => {
    if (!multiSliderDragState.isDragging) return;
    
    const behavior = multiSliderDragState.behavior;
    const containerRect = multiSliderDragState.container.getBoundingClientRect();
    const delta = e.clientX - multiSliderDragState.startX;
    
    let currentValue = 0;
    if (behavior === 'orientation') currentValue = herdParams.r_O;
    else if (behavior === 'repulsion') currentValue = herdParams.r_R;
    else if (behavior === 'attraction') currentValue = herdParams.r_A;
    
    // calculate new value based on drag delta
    const containerWidth = containerRect.width;
    const valueRange = 14.5; 
    const newValue = Math.max(
      buttons[behavior].minValue,
      Math.min(buttons[behavior].maxValue, currentValue + (delta * (valueRange / containerWidth)))
    );
    
    if (behavior === 'orientation') herdParams.r_O = newValue;
    else if (behavior === 'repulsion') herdParams.r_R = newValue;
    else if (behavior === 'attraction') herdParams.r_A = newValue;
    
    enforceConstraints();
    updateMultiSlider();
    
    // update drag start for next move
    multiSliderDragState.startX = e.clientX;
  });
  
  // mouse up
  document.addEventListener('mouseup', (e) => {
    if (multiSliderDragState.isDragging) {
      const behavior = multiSliderDragState.behavior;
      const btn = buttons[behavior];
      if (btn.element) {
        btn.element.classList.remove('dragging');
      }
      multiSliderDragState.isDragging = false;
      multiSliderDragState.behavior = null;
    }
  });
}


// precomputeOtherShepherds removed — shepherds now filter with === this
// check inline, avoiding per-frame array allocation.


// FPS counter
let fpsFrameCount = 0;
let fpsLastTime = performance.now();
let fpsDisplay = 0;

function updateFPS() {
  fpsFrameCount++;
  const now = performance.now();
  if (now - fpsLastTime >= 1000) {
    fpsDisplay = fpsFrameCount;
    fpsFrameCount = 0;
    fpsLastTime = now;
  }
}

function drawFPS(ctx) {
  const n = herd.members.length + shepherds.members.length;
  const text = `${fpsDisplay} fps | ${n} agents`;
  ctx.font = '12px monospace';
  // dark background for readability on any canvas color
  const metrics = ctx.measureText(text);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(6, 6, metrics.width + 8, 18);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 10, 20);
}
const fixedStepLoop = {
  stepMs: PHYSICS.FIXED_TIMESTEP_MS,
  maxCatchupSteps: PHYSICS.MAX_CATCHUP_STEPS,
  maxFrameDeltaMs: PHYSICS.MAX_FRAME_DELTA_MS,
  accumulatorMs: 0,
  lastFrameTime: null,
  lastSimulationFrame: null
};

// animation 
let animationContext = null;
let simulationWorker = null;
let workerStepInFlight = false;
let pendingWorkerSteps = 0;

function cloneBehaviorParams() {
  return {
    herdParams: { ...herdParams },
    shepParams: { ...shepParams }
  };
}

function serializeAgent(agent) {
  return {
    x: agent.x,
    y: agent.y,
    vx: agent.vx,
    vy: agent.vy
  };
}

function serializeWorldForWorker() {
  return {
    canvasWidth: worldState.canvasWidth,
    canvasHeight: worldState.canvasHeight,
    herdMembers: worldState.herdMembers.map(serializeAgent),
    shepherdMembers: worldState.shepherdMembers.map(serializeAgent),
    cursorHerdMember: serializeAgent(worldState.cursorHerdMember),
    cursorShepherd: serializeAgent(worldState.cursorShepherd),
    cursorControlsFirstShepherd: worldState.cursorControlsFirstShepherd,
    mouseX: worldState.mouseX,
    mouseY: worldState.mouseY,
    prevMouseX: worldState.prevMouseX,
    prevMouseY: worldState.prevMouseY,
    targetX: worldState.targetX,
    targetY: worldState.targetY
  };
}

function applyAgentSnapshot(targetAgents, snapshots, createAgent) {
  while (targetAgents.length < snapshots.length) {
    targetAgents.push(createAgent(targetAgents.length, snapshots[targetAgents.length]));
  }
  while (targetAgents.length > snapshots.length) {
    targetAgents.pop();
  }

  for (let i = 0; i < snapshots.length; i++) {
    targetAgents[i].x = snapshots[i].x;
    targetAgents[i].y = snapshots[i].y;
    targetAgents[i].vx = snapshots[i].vx;
    targetAgents[i].vy = snapshots[i].vy;
  }
}

function applyWorkerFrame(message) {
  applyAgentSnapshot(
    worldState.herdMembers,
    message.herdMembers,
    (_, data) => {
      const member = new HerdMember(data.x, data.y, 0);
      member.vx = data.vx;
      member.vy = data.vy;
      return member;
    }
  );

  applyAgentSnapshot(
    worldState.shepherdMembers,
    message.shepherdMembers,
    (index, data) => {
      const shepherd = new Shepherd(data.x, data.y, index);
      shepherd.vx = data.vx;
      shepherd.vy = data.vy;
      return shepherd;
    }
  );

  worldState.cursorHerdMember.x = message.cursorHerdMember.x;
  worldState.cursorHerdMember.y = message.cursorHerdMember.y;
  worldState.cursorHerdMember.vx = message.cursorHerdMember.vx;
  worldState.cursorHerdMember.vy = message.cursorHerdMember.vy;

  worldState.cursorShepherd.x = message.cursorShepherd.x;
  worldState.cursorShepherd.y = message.cursorShepherd.y;
  worldState.cursorShepherd.vx = message.cursorShepherd.vx;
  worldState.cursorShepherd.vy = message.cursorShepherd.vy;

  herdSize = worldState.herdMembers.length;
  shepherdSize = worldState.shepherdMembers.length;

  fixedStepLoop.lastSimulationFrame = message.frameData;
  worldState.lastSimulationFrame = message.frameData;
}

function computeFallbackFrame(simState) {
  let herdX = 0;
  let herdY = 0;
  let herdCount = 0;
  for (let i = 0; i < simState.herdMembers.length; i++) {
    herdX += simState.herdMembers[i].x;
    herdY += simState.herdMembers[i].y;
    herdCount++;
  }
  if (!simState.cursorControlsFirstShepherd) {
    herdX += simState.cursorHerdMember.x;
    herdY += simState.cursorHerdMember.y;
    herdCount++;
  }

  let shepX = 0;
  let shepY = 0;
  let shepCount = 0;
  for (let i = 0; i < simState.shepherdMembers.length; i++) {
    shepX += simState.shepherdMembers[i].x;
    shepY += simState.shepherdMembers[i].y;
    shepCount++;
  }

  return {
    includeCursorHerd: !simState.cursorControlsFirstShepherd,
    herdCentroidX: herdCount > 0 ? herdX / herdCount : 0,
    herdCentroidY: herdCount > 0 ? herdY / herdCount : 0,
    shepherdCentroidX: shepCount > 0 ? shepX / shepCount : 0,
    shepherdCentroidY: shepCount > 0 ? shepY / shepCount : 0
  };
}

function dispatchWorkerSteps() {
  if (!simulationWorker || workerStepInFlight || pendingWorkerSteps <= 0) {
    return;
  }

  if (worldState.needsWorkerResync) {
    simulationWorker.postMessage({
      type: 'resync',
      snapshot: serializeWorldForWorker(),
      params: cloneBehaviorParams()
    });
    worldState.needsWorkerResync = false;
  }

  const steps = pendingWorkerSteps;
  pendingWorkerSteps = 0;
  workerStepInFlight = true;

  simulationWorker.postMessage({
    type: 'step',
    steps,
    input: {
      canvasWidth: worldState.canvasWidth,
      canvasHeight: worldState.canvasHeight,
      mouseX: worldState.mouseX,
      mouseY: worldState.mouseY,
      prevMouseX: worldState.prevMouseX,
      prevMouseY: worldState.prevMouseY,
      targetX: worldState.targetX,
      targetY: worldState.targetY,
      cursorControlsFirstShepherd: worldState.cursorControlsFirstShepherd
    },
    params: cloneBehaviorParams()
  });
}

function ensureSimulationWorker() {
  if (simulationWorker) {
    return;
  }

  simulationWorker = new Worker('simulation-worker.js');
  simulationWorker.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'frame') {
      applyWorkerFrame(message);
      workerStepInFlight = false;
      dispatchWorkerSteps();
      return;
    }
    if (message.type === 'error') {
      workerStepInFlight = false;
      console.error('Simulation worker error:', message.error);
    }
  });

  simulationWorker.postMessage({
    type: 'init',
    snapshot: serializeWorldForWorker(),
    params: cloneBehaviorParams()
  });
}

function setAnimationContext(ctx) {
  animationContext = ctx;
  fixedStepLoop.accumulatorMs = 0;
  fixedStepLoop.lastFrameTime = null;
  fixedStepLoop.lastSimulationFrame = null;
  pendingWorkerSteps = 0;
  workerStepInFlight = false;
}

function buildSimulationState(canvas) {
  worldState.canvasWidth = canvas.width;
  worldState.canvasHeight = canvas.height;
  worldState.herdMembers = herd.members;
  worldState.shepherdMembers = shepherds.members;
  worldState.herdColor = herd.color;
  worldState.shepherdColor = shepherds.color;
  return worldState;
}

function animate(timestamp) {
  const ctx = animationContext;
  const canvas = ctx.canvas;
  const simState = buildSimulationState(canvas);
  ensureSimulationWorker();

  if (fixedStepLoop.lastFrameTime === null) {
    fixedStepLoop.lastFrameTime = timestamp;
  }

  const frameDelta = Math.min(
    fixedStepLoop.maxFrameDeltaMs,
    timestamp - fixedStepLoop.lastFrameTime
  );
  fixedStepLoop.lastFrameTime = timestamp;
  fixedStepLoop.accumulatorMs += frameDelta;
  let stepsToRun = 0;
  while (
    fixedStepLoop.accumulatorMs >= fixedStepLoop.stepMs &&
    stepsToRun < fixedStepLoop.maxCatchupSteps
  ) {
    fixedStepLoop.accumulatorMs -= fixedStepLoop.stepMs;
    stepsToRun++;
  }

  if (stepsToRun > 0) {
    pendingWorkerSteps = Math.min(
      pendingWorkerSteps + stepsToRun,
      fixedStepLoop.maxCatchupSteps * 2
    );
    dispatchWorkerSteps();
  }

  const frameData = fixedStepLoop.lastSimulationFrame || computeFallbackFrame(simState);
  renderSimulationFrame(ctx, simState, frameData);

  updateFPS();
  drawFPS(ctx);

  requestAnimationFrame(animate);
}

// load
async function loadControlPanel() {
  try {
    const response = await fetch('control-panel.html');
    const html = await response.text();
    document.body.insertAdjacentHTML('afterbegin', html);
  } catch (error) {
    console.error('Failed to load control panel:', error);
  }
}

// initialize everything
function initUI(canvas, ctx) {
  // load and initialize control panel
  loadControlPanel().then(() => {
    initCollapsibles();
    initSliders();
    initPopulationControls();
    initCursorModeToggle();
    initShowRadiiToggle();
    initMultiSlider();
    updateVisualizations();
  });
  
  // initialize interaction systems
  initCursorObjects(canvas);
  initMouseTracking(canvas);
  
  // set up animation context and start loop
  setAnimationContext(ctx);
  enforceConstraints();
  requestAnimationFrame(animate);
}
