// renderer
// Responsible for drawing only; simulation updates live in simulation-core.js
// (run in the simulation worker). frameData carries plain data from the worker,
// so the live agent objects to draw always come from simState.
// Mode-aware: slim mode draws herd connections and a crosshair target,
// full mode draws centroids and the full target marker.

function renderSimulationFrame(ctx, simState, frameData) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const allMembers = frameData.includeCursorHerd
    ? [...simState.herdMembers, simState.cursorHerdMember]
    : simState.herdMembers;

  // draw herd connections (slim mode only) - before members so lines appear behind
  drawHerdConnections(ctx, allMembers, herdParams.r_A, simState.herdColor);

  for (let i = 0; i < allMembers.length; i++) {
    allMembers[i].draw(ctx, simState.herdColor);
  }

  // herd centroid (full mode only)
  if (modeConfig.SHOW_CENTROIDS) {
    ctx.fillStyle = COLORS.CENTROID_HERD;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(frameData.herdCentroidX, frameData.herdCentroidY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // draw shepherds; skip the first when the cursor is controlling it
  for (let i = 0; i < simState.shepherdMembers.length; i++) {
    if (simState.cursorControlsFirstShepherd && i === 0) continue;
    simState.shepherdMembers[i].draw(ctx, simState.shepherdColor);
  }

  // shepherd centroid (full mode only)
  if (modeConfig.SHOW_CENTROIDS && simState.shepherdMembers.length > 0) {
    ctx.fillStyle = COLORS.CENTROID_SHEPHERD;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(frameData.shepherdCentroidX, frameData.shepherdCentroidY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  // draw target at current position (style per mode)
  if (modeConfig.TARGET_STYLE === 'crosshair') {
    drawTargetCrosshair(ctx, simState.targetX, simState.targetY);
  } else {
    drawTargetFull(ctx, simState.targetX, simState.targetY);
  }
}
