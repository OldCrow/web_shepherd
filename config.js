
// ====== STATIC ========

// physics 
const PHYSICS = {
  SHEPHERD_MAX_FORCE: 0.2,   // max shepherd force per frame 
  SHEPHERD_MAX_SPEED: 2.0,
  SHEPHERD_REPEL_MAX_DIST: 50,
  SHEPHERD_UPDATE_THRESHOLD: 0.5,
  HERD_MAX_FORCE: 0.1,         // max herd force per frame 
  HERD_MAX_SPEED: 1.0,
  DT: 0.02,
  // Run simulation at 120Hz to better match the pre-refactor traversal speed
  // seen on high-refresh displays (previously tied to requestAnimationFrame).
  FIXED_TIMESTEP_MS: 1000 / 120,
  // Keep catch-up horizon close to the prior ~83ms (5 steps @ 60Hz).
  MAX_CATCHUP_STEPS: 10,
  MAX_FRAME_DELTA_MS: 100,
  VISUALIZATION_SCALE: 1,
  CURSOR_VELOCITY_SMOOTH: 0.2  // lower = smoother but more lag, higher = more responsive
};

// initialization of agents 
const INIT = {
  HERD_SIZE: 20,
  SHEPHERD_SIZE: 5,
  HERD_SPREAD_RADIUS: 300
};

// ====== DYNAMIC ========

// visualization toggles
let showRadii = false;  // show/hide circle radii

// herd behavior parameters 
let herdParams = {
  r_R: 20.0, // 20.0,       // repulsion radius (within the herd)
  r_O: 30.0, // 30.0,       // orientation radius
  r_A: 50.0, //50.0,       // attraction radius 
  a_R: 0.9,                 // repulsion gain      [0,1]
  a_O: 0.3,                 // orientation gain    [0,1]
  a_A: 0.6,                 // attraction gain     [0,1]
  a_I: 1.0,               // interaction gain (shepherd avoidance) [0,1]
  a_V: 1.0                 // drag gain
};
herdParams.r_I = herdParams.r_A - 0.5;  // interaction radius (derived: r_A - 0.5)

// shepherd behavior parameters 
let shepParams = {
  r_S: (herdParams.r_A - 0.5) - 1,  // desired shepherding radius (derived: (r_A - 0.5) - 1)
  a_N: 0.9,                          // navigation gain             [0,1]
  a_R_s: 0.9,                        // shepherd repulsion gain     [0,1]
  a_R_s_v: 2 * Math.sqrt(0.9),       // shepherd velocity repulsion (derived: 2*sqrt(a_R_s))
  a_V_s: 0.6                         // shepherd drag gain
};

// min/max values for UI sliders (fixed)
const SLIDER_CONSTRAINTS = {
  'herd-a-r': { min: 0, max: 1, step: 0.01 },
  'herd-a-o': { min: 0, max: 1, step: 0.01 },
  'herd-a-a': { min: 0, max: 1, step: 0.01 },
  'herd-a-i': { min: 0, max: 1, step: 0.01 },
  'herd-a-v': { min: 0, max: 1, step: 0.01 },
  'shep-a-n': { min: 0, max: 1, step: 0.01 },
  'shep-a-r-s': { min: 0, max: 1, step: 0.01 },
  'shep-a-v-s': { min: 0, max: 1, step: 0.01 }
};

// slider configuration
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
