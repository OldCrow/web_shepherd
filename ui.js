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

  // get constraints 
  const constraints = SLIDER_CONSTRAINTS[config.id];
  if (constraints) {
    slider.setAttribute('min', constraints.min);
    slider.setAttribute('max', constraints.max);
    slider.setAttribute('step', constraints.step);
  }

  // set initial label value
  label.textContent = parseFloat(slider.value).toFixed(1);

  // listen to slider changes
  slider.addEventListener('input', e => {
    const val = parseFloat(e.target.value);
    config.setter(val);
    label.textContent = val.toFixed(1);
    enforceConstraints();
    updateVisualizations();
  });
}

function initSliders() {
  SLIDER_CONFIG.forEach(config => bindSlider(config));
}

// control population sizes 
function initPopulationControls() {
  const herdSizeInput = document.getElementById('herd-size-input');
  const shepherdsCountInput = document.getElementById('shepherds-count-input');

  if (herdSizeInput) {
    herdSizeInput.addEventListener('change', () => {
      const value = parseInt(herdSizeInput.value);
      if (value < 3) {
        herdSizeInput.value = 3;
        return;
      }
      const diff = value - herdSize;
      if (diff > 0) {
        for (let i = 0; i < diff; i++) addRandomHerdMember();
      } else if (diff < 0) {
        for (let i = 0; i < -diff; i++) removeRandomHerdMember();
      }
      herdSize = value;
    });
  }

  if (shepherdsCountInput) {
    shepherdsCountInput.addEventListener('change', () => {
      const value = parseInt(shepherdsCountInput.value);
      if (value < 1) {
        shepherdsCountInput.value = 1;
        return;
      }
      const diff = value - shepherdSize;
      if (diff > 0) {
        for (let i = 0; i < diff; i++) addRandomShepherd();
      } else if (diff < 0) {
        for (let i = 0; i < -diff; i++) removeRandomShepherd();
      }
      shepherdSize = value;
    });
  }
}

// mouse play 
let mouseX = 0;
let mouseY = 0;
let prevMouseX = 0;
let prevMouseY = 0;

function initMouseTracking(canvas) {
  prevMouseX = canvas.width / 2;
  prevMouseY = canvas.height / 2;
  
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    prevMouseX = mouseX;
    prevMouseY = mouseY;
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });
}

// cursor objects (used for cursor control mode)
let cursorShepherd;
let cursorHerdMember;
let cursorControlsFirstShepherd = false;
let targetX = 0;
let targetY = 0;

function initCursorObjects(canvas) {
  cursorShepherd = Object.create(Shepherd.prototype);
  cursorShepherd.x = canvas.width / 2;
  cursorShepherd.y = canvas.height / 2;
  cursorShepherd.vx = 0;
  cursorShepherd.vy = 0;

  cursorHerdMember = new HerdMember(canvas.width / 2, canvas.height / 2, 0);
  
  targetX = canvas.width / 2;
  targetY = canvas.height / 2;
}

// cursor mode toggle
function initCursorModeToggle() {
  const toggle = document.getElementById('cursor-mode-toggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      cursorControlsFirstShepherd = e.target.checked;
    });
  }
}

// constrain enforcement 
function enforceConstraints() {
  
  // r_R < r_O < r_A (herd repulsion, orientation, attraction)
  if (herdParams.r_R >= herdParams.r_O) {
    herdParams.r_O = Math.max(herdParams.r_R + 0.1, herdParams.r_O);
    document.getElementById('herd-r-o').value = herdParams.r_O;
    document.getElementById('herd-r-o-value').textContent = herdParams.r_O.toFixed(1);
  }
  if (herdParams.r_O >= herdParams.r_A) {
    herdParams.r_A = Math.max(herdParams.r_O + 0.1, herdParams.r_A);
    document.getElementById('herd-r-a').value = herdParams.r_A;
    document.getElementById('herd-r-a-value').textContent = herdParams.r_A.toFixed(1);
  }
  
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


let precomputedOtherShepherds = [];

function precomputeOtherShepherds() {
  const shepsObjects = shepherds.members;
  precomputedOtherShepherds = [];
  for (let s = 0; s < shepherds.members.length; s++) {
    const otherSheps = [];
    for (let i = 0; i < shepsObjects.length; i++) {
      if (i !== s) otherSheps.push(shepsObjects[i]);
    }
    precomputedOtherShepherds[s] = otherSheps;
  }
}

// animation 
let animationContext = null;

function setAnimationContext(ctx) {
  animationContext = ctx;
}

function animate() {
  const canvas = animationContext.canvas;
  const ctx = animationContext;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // update cursor position based on mode
  if (cursorControlsFirstShepherd) {
    shepherds.members[0].x = mouseX;
    shepherds.members[0].y = mouseY;
    // set velocity based on mouse movement so triangle orientation matches cursor direction
    shepherds.members[0].vx = mouseX - prevMouseX;
    shepherds.members[0].vy = mouseY - prevMouseY;
  } else {
    cursorHerdMember.x = mouseX;
    cursorHerdMember.y = mouseY;
    // set velocity based on mouse movement so triangle orientation matches cursor direction
    cursorHerdMember.vx = mouseX - prevMouseX;
    cursorHerdMember.vy = mouseY - prevMouseY;
  }

  // all shepherds navigate to the center target
  const shepsTargetX = targetX;
  const shepsTargetY = targetY;

  // update and draw herd (include cursor herd member if in herd mode)
  const allMembers = cursorControlsFirstShepherd ? herd.members : [...herd.members, cursorHerdMember];
  const cursorShepherdList = cursorControlsFirstShepherd ? [] : [cursorShepherd];
  const shepsObjects = shepherds.members;

  // compute herd centroid (cached for this frame)
  let centX = 0, centY = 0;
  for (let member of allMembers) {
    centX += member.x;
    centY += member.y;
  }
  centX /= allMembers.length;
  centY /= allMembers.length;

  // update each herd member
  for (let member of allMembers) {
    member.update(allMembers, shepsObjects, canvas.width, canvas.height);
    member.draw(ctx, herd.color);
  }

  // draw herd centroid
  ctx.fillStyle = COLORS.CENTROID_HERD;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(centX, centY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // update and draw shepherds (pre-compute other shepherds lists)
  precomputeOtherShepherds();
  for (let s = 0; s < shepherds.members.length; s++) {
    const shep = shepherds.members[s];
    const otherSheps = precomputedOtherShepherds[s].concat(cursorShepherdList);

    shep.update(allMembers, otherSheps, shepsTargetX, shepsTargetY, canvas.width, canvas.height);
    shep.draw(ctx, shepherds.color);
  }

  // compute shepherds centroid (cached for this frame)
  let shepCentX = 0, shepCentY = 0;
  for (let s of shepherds.members) {
    shepCentX += s.x;
    shepCentY += s.y;
  }
  shepCentX /= shepherds.members.length;
  shepCentY /= shepherds.length;

  ctx.fillStyle = COLORS.CENTROID_SHEPHERD;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(shepCentX, shepCentY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // draw target at center of screen (maybe move later)
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  // outer circle
  ctx.strokeStyle = COLORS.TARGET;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
  ctx.stroke();
  
  // inner circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
  ctx.stroke();
  
  // crosshair
  ctx.beginPath();
  ctx.moveTo(centerX - 6, centerY);
  ctx.lineTo(centerX + 6, centerY);
  ctx.moveTo(centerX, centerY - 6);
  ctx.lineTo(centerX, centerY + 6);
  ctx.stroke();
  
  // center dot
  ctx.fillStyle = COLORS.TARGET;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
  ctx.fill();

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
    initMultiSlider();
    updateVisualizations();
  });
  
  // initialize interaction systems
  initMouseTracking(canvas);
  initCursorObjects(canvas);
  
  // set up animation context and start loop
  setAnimationContext(ctx);
  enforceConstraints();
  animate();
}
