
// ====== STATIC ========

// physics 
const PHYSICS = {
  HERD_FRICTION_SCALE: 0.08,
  HERD_DAMPING_FACTOR: 0.001,
  HERD_MAX_SPEED: 1.5,
  HERD_MAX_FORCE: 0.08,
  SHEPHERD_REPEL_MAX_DIST: 50, // max distance at which shepherds repel eachother 
  SHEPHERD_NAV_SCALE: 0.02,
  SHEPHERD_REPEL_SCALE: 0.05,
  SHEPHERD_MAX_SPEED: 3.0,
  SHEPHERD_MAX_FORCE: 0.12,
  SHEPHERD_LAZINESS_SCALE: 0.01,
  SHEPHERD_UPDATE_THRESHOLD: 0.5,
  VISUALIZATION_SCALE: 4
};

// initialization of agents 
const INIT = {
  HERD_SIZE: 40,
  SHEPHERD_SIZE: 40,
  HERD_SPREAD_RADIUS: 60
};

// ====== DYNAMIC ========

// herd behavior parameters (updated dynamically by UI sliders)
let herdParams = {
  r_R: 4.0,      // repulsion radius (within the herd)
  r_O: 5.5,      // orientation radius
  r_A: 10.0,     // attraction radius 
  a_R: 6.0,      // repulsion gain
  a_O: 2.0,      // orientation gain
  a_A: 3.0,      // attraction gain 
  a_I: 4.0,      // interaction gain (shepherd avoidance)
  a_V: 3.0       // laziness/stop gain
};
herdParams.r_I = herdParams.r_A - 0.5;  // interaction radius (derived: r_A - 0.5)

// shepherd behavior parameters (updated dynamically by UI sliders)
let shepParams = {
  r_S: (herdParams.r_A - 0.5) - 1,  // desired shepherding radius (derived: (r_A - 0.5) - 1)
  a_N: 8.0,                         // navigation gain
  a_R_s: 2.0,                       // shepherd repulsion gain
  a_R_s_v: 2 * Math.sqrt(2.0),      // shepherd velocity repulsion (derived: 2*sqrt(a_R_s))
  a_V_s: 3.0                        // shepherd laziness gain
};

// Min/max values for UI sliders (fixed)
const SLIDER_CONSTRAINTS = {
  'herd-r-o': { min: 0.5, max: 10, step: 0.1 },
  'herd-r-r': { min: 0.5, max: 6, step: 0.1 },
  'herd-r-a': { min: 2, max: 15, step: 0.1 },
  'herd-a-v': { min: 0, max: 5, step: 0.1 },
  'shep-a-n': { min: 0, max: 15, step: 0.1 },
  'shep-a-r-s': { min: 0, max: 5, step: 0.1 },
  'shep-a-v-s': { min: 0, max: 5, step: 0.1 }
};

// Slider configuration metadata (setters added dynamically in ui.js)
const SLIDER_CONFIG_DATA = [
  // Herd Behavior - Laziness
  { id: 'herd-a-v', label: 'laziness', group: null, section: 'herd', value: 3, param: 'herdParams.a_V', singleRow: true },
  
  // Shepherd Control - Navigation
  { id: 'shep-a-n', label: 'force', group: 'navigation', section: 'shepherd', value: 8, param: 'shepParams.a_N' },
  
  // Shepherd Control - Repulsion
  { id: 'shep-a-r-s', label: 'force', group: 'repulsion', section: 'shepherd', value: 2, param: 'shepParams.a_R_s' },
  
  // Shepherd Control - Laziness
  { id: 'shep-a-v-s', label: 'laziness', group: null, section: 'shepherd', value: 3, param: 'shepParams.a_V_s', singleRow: true }
];
