
// ====== STATIC ========

// physics 
const PHYSICS = {
  HERD_MAX_SPEED: 0.75,
  SHEPHERD_REPEL_MAX_DIST: 50,
  SHEPHERD_MAX_SPEED: 1.5,
  SHEPHERD_UPDATE_THRESHOLD: 0.5,
  DT: 0.02,
  VISUALIZATION_SCALE: 1,
  CURSOR_VELOCITY_SMOOTH: 0.2  // lower = smoother but more lag, higher = more responsive
};

// initialization of agents 
const INIT = {
  HERD_SIZE: 40,
  SHEPHERD_SIZE: 40,
  HERD_SPREAD_RADIUS: 120
};

// ====== DYNAMIC ========

// visualization toggles
let showRadii = false;  // show/hide circle radii

// herd behavior parameters (updated dynamically by UI sliders)
let herdParams = {
  r_R: 10.0, // 20.0,       // repulsion radius (within the herd)
  r_O: 20.0, // 30.0,       // orientation radius
  r_A: 30.0, //50.0,       // attraction radius 
  a_R: 16.0, //8.0,        // repulsion gain
  a_O: 8.0, //2.0,        // orientation gain
  a_A: 4.0, //5.0,        // attraction gain
  a_I: 10.0, //5.0,        // interaction gain (shepherd avoidance)
  a_V: 0.3         // drag gain
};
herdParams.r_I = herdParams.r_A - 0.5;  // interaction radius (derived: r_A - 0.5)

// shepherd behavior parameters (updated dynamically by UI sliders)
let shepParams = {
  r_S: (herdParams.r_A - 0.5) - 1,  // desired shepherding radius (derived: (r_A - 0.5) - 1)
  a_N: 10.0, //10.0,                         // navigation gain
  a_R_s: 10.0, //10.0,                       // shepherd repulsion gain
  a_R_s_v: 2 * Math.sqrt(10.0),      // shepherd velocity repulsion (derived: 2*sqrt(a_R_s))
  a_V_s: 0.3                        // shepherd drag gain
};

// Min/max values for UI sliders (fixed)
const SLIDER_CONSTRAINTS = {
  'herd-a-r': { min: 0, max: 20, step: 0.1 },
  'herd-a-o': { min: 0, max: 20, step: 0.1 },
  'herd-a-a': { min: 0, max: 20, step: 0.1 },
  'herd-a-i': { min: 0, max: 20, step: 0.1 },
  'herd-a-v': { min: 0, max: 5.0, step: 0.1 },
  'shep-a-n': { min: 0, max: 20, step: 0.1 },
  'shep-a-r-s': { min: 0, max: 20, step: 0.1 },
  'shep-a-v-s': { min: 0, max: 5.0, step: 0.1 }
};

// Slider configuration metadata (setters added dynamically in ui.js)
const SLIDER_CONFIG_DATA = [
  // Herd Behavior - Forces
  { id: 'herd-a-r', label: 'repulsion', group: null, section: 'herd', value: herdParams.a_R, param: 'herdParams.a_R' },
  { id: 'herd-a-o', label: 'orientation', group: null, section: 'herd', value: herdParams.a_O, param: 'herdParams.a_O' },
  { id: 'herd-a-a', label: 'attraction', group: null, section: 'herd', value: herdParams.a_A, param: 'herdParams.a_A' },
  { id: 'herd-a-i', label: 'interaction', group: null, section: 'herd', value: herdParams.a_I, param: 'herdParams.a_I' },

  // Herd Behavior - Drag
  { id: 'herd-a-v', label: 'drag', group: null, section: 'herd', value: herdParams.a_V, param: 'herdParams.a_V', singleRow: true },
  
  // Shepherd Control - Navigation
  { id: 'shep-a-n', label: 'force', group: 'navigation', section: 'shepherd', value: shepParams.a_N, param: 'shepParams.a_N' },
  
  // Shepherd Control - Repulsion
  { id: 'shep-a-r-s', label: 'force', group: 'repulsion', section: 'shepherd', value: shepParams.a_R_s, param: 'shepParams.a_R_s' },
  
  // Shepherd Control - Drag
  { id: 'shep-a-v-s', label: 'drag', group: null, section: 'shepherd', value: shepParams.a_V_s, param: 'shepParams.a_V_s', singleRow: true }
];
