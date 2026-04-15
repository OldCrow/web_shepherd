
// ====== MODE CONFIGURATION ========
const MODE_CONFIG = {
  full: {
    SHEPHERD_MAX_FORCE: 0.2,
    SHEPHERD_MAX_SPEED: 2.0,
    SHEPHERD_REPEL_MAX_DIST: 50,
    SHEPHERD_UPDATE_THRESHOLD: 0.5,
    HERD_MAX_FORCE: 0.1,
    HERD_MAX_SPEED: 1.0,
    DT: 0.02,
    VISUALIZATION_SCALE: 1,
    CURSOR_VELOCITY_SMOOTH: 0.2,
    TARGET_POSITION_SMOOTH: 0.03,
    HERD_SIZE: 20,
    SHEPHERD_SIZE: 5,
    HERD_SPREAD_RADIUS: 80,
    SHOW_CENTROIDS: true,
    SHOW_FPS: true,
    TARGET_STYLE: 'full',
    EMBEDDED_MESSAGING: false,
    TRIANGLE_SIZE: 6,
    COLORS: {
      HERD: 'rgba(224, 156, 156, 0.8)',
      SHEPHERD: 'rgba(70, 70, 70, 0.9)',
      TARGET: 'rgba(0, 0, 0, 0.8)',
      CENTROID_HERD: 'rgba(222, 156, 156, 0.7)',
      CENTROID_SHEPHERD: 'rgba(70, 70, 70, 0.6)'
    }
  },
  slim: {
    SHEPHERD_MAX_FORCE: 0.2,
    SHEPHERD_MAX_SPEED: 2.0,
    SHEPHERD_REPEL_MAX_DIST: 50,
    SHEPHERD_UPDATE_THRESHOLD: 0.5,
    HERD_MAX_FORCE: 0.1,
    HERD_MAX_SPEED: 1.0,
    DT: 0.02,
    VISUALIZATION_SCALE: 1,
    CURSOR_VELOCITY_SMOOTH: 0.2,
    TARGET_POSITION_SMOOTH: 0.03,
    HERD_SIZE: 20,
    SHEPHERD_SIZE: 5,
    HERD_SPREAD_RADIUS: 300,
    SHOW_CENTROIDS: false,
    SHOW_FPS: false,
    TARGET_STYLE: 'crosshair',
    EMBEDDED_MESSAGING: true,
    TRIANGLE_SIZE: 4,
    COLORS: {
      HERD: 'rgba(224, 156, 156, 0.8)',
      SHEPHERD: 'rgba(70, 70, 70, 0.9)',
      TARGET: 'rgba(0, 0, 0, 0.8)',
      CENTROID_HERD: 'rgba(222, 156, 156, 0.7)',
      CENTROID_SHEPHERD: 'rgba(70, 70, 70, 0.6)'
    }
  }
};

const modeConfig = MODE_CONFIG[typeof APP_MODE !== 'undefined' ? APP_MODE : 'full'];

// ====== STATIC ========

// physics 
const PHYSICS = {
  SHEPHERD_MAX_FORCE: modeConfig.SHEPHERD_MAX_FORCE,
  SHEPHERD_MAX_SPEED: modeConfig.SHEPHERD_MAX_SPEED,
  SHEPHERD_REPEL_MAX_DIST: modeConfig.SHEPHERD_REPEL_MAX_DIST,
  SHEPHERD_UPDATE_THRESHOLD: modeConfig.SHEPHERD_UPDATE_THRESHOLD,
  HERD_MAX_FORCE: modeConfig.HERD_MAX_FORCE,
  HERD_MAX_SPEED: modeConfig.HERD_MAX_SPEED,
  DT: modeConfig.DT,
  // Run simulation at 120Hz to better match the pre-refactor traversal speed
  // seen on high-refresh displays (previously tied to requestAnimationFrame).
  FIXED_TIMESTEP_MS: 1000 / 120,
  // Keep catch-up horizon close to the prior ~83ms (5 steps @ 60Hz).
  MAX_CATCHUP_STEPS: 10,
  MAX_FRAME_DELTA_MS: 100,
  VISUALIZATION_SCALE: modeConfig.VISUALIZATION_SCALE,
  CURSOR_VELOCITY_SMOOTH: modeConfig.CURSOR_VELOCITY_SMOOTH,
  TARGET_POSITION_SMOOTH: modeConfig.TARGET_POSITION_SMOOTH,
  TRIANGLE_SIZE: modeConfig.TRIANGLE_SIZE
};

// initialization of agents 
const INIT = {
  HERD_SIZE: modeConfig.HERD_SIZE,
  SHEPHERD_SIZE: modeConfig.SHEPHERD_SIZE,
  HERD_SPREAD_RADIUS: modeConfig.HERD_SPREAD_RADIUS
};

// ====== DYNAMIC ========

// visualization toggles
let showRadii = false;  // show/hide circle radii

// herd behavior parameters 
let herdParams = {
  r_R: 30.0, // 20.0, // 20.0,       // repulsion radius (within the herd)
  r_O: 45.0, // 30.0, // 30.0,       // orientation radius
  r_A: 90.0, // 50.0, //50.0,       // attraction radius 
  a_R: 1.0, // 0.9,                 // repulsion gain      [0,1]
  a_O: 0.4, // 0.3,                 // orientation gain    [0,1]
  a_A: 0.3, //0.6,                 // attraction gain     [0,1]
  a_I: 1.0,               // interaction gain (shepherd avoidance) [0,1]
  a_V: 0.5                 // drag gain
};
herdParams.r_I = herdParams.r_A - 0.5;  // interaction radius (derived: r_A - 0.5)

// shepherd behavior parameters 
let shepParams = {
  r_S: (herdParams.r_A - 0.5) - 1,  // desired shepherding radius (derived: (r_A - 0.5) - 1)
  a_N: 0.9,                          // navigation gain             [0,1]
  a_R_s: 0.9, //0.9,                        // shepherd repulsion gain     [0,1]
  a_R_s_v: 2 * Math.sqrt(0.9),       // shepherd velocity repulsion (derived: 2*sqrt(a_R_s))
  a_V_s: 0.6                         // shepherd drag gain
};

// Slim mode: increase herd spacing radii and make shepherds more aggressive
if (typeof APP_MODE !== 'undefined' && APP_MODE === 'slim') {
  herdParams.r_R *= 1.0;
  herdParams.r_O *= 1.0;
  herdParams.r_A *= 1.0;
  herdParams.r_I = herdParams.r_A - 0.5;
  shepParams.r_S = (herdParams.r_A - 0.5) - 1;
  
  // increase shepherd aggression
  shepParams.a_N *= 1.0;     // navigation gain (was 0.9)
  shepParams.a_R_s *= 1.0;   // repulsion gain (was 0.9)
  shepParams.a_R_s_v = 1 * Math.sqrt(shepParams.a_R_s);

  // increase drag
  herdParams.a_V *= 1.0;   // drag gain (was 1.0)
  shepParams.a_V_s *= 1.0;   // drag gain 
}

// min/max values for UI sliders (fixed)
const SLIDER_CONSTRAINTS = {
  'herd-a-r': { min: 0, max: 1, step: 0.1 },
  'herd-a-o': { min: 0, max: 1, step: 0.1 },
  'herd-a-a': { min: 0, max: 1, step: 0.1 },
  'herd-a-i': { min: 0, max: 1, step: 0.1 },
  'herd-a-v': { min: 0, max: 1, step: 0.1 },
  'shep-a-n': { min: 0, max: 1, step: 0.1 },
  'shep-a-r-s': { min: 0, max: 1, step: 0.1 },
  'shep-a-v-s': { min: 0, max: 1, step: 0.1 }
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
