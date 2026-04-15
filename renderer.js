// renderer
// Responsible for drawing only; simulation updates live in simulation-core.js.

function drawTargetMarker(ctx, x, y) {
  // outer circle
  ctx.strokeStyle = COLORS.TARGET;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.stroke();

  // inner circle
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.stroke();

  // crosshair
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + 6, y);
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y + 6);
  ctx.stroke();

  // center dot
  ctx.fillStyle = COLORS.TARGET;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

function renderSimulationFrame(ctx, simState, frameData) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < simState.herdMembers.length; i++) {
    simState.herdMembers[i].draw(ctx, simState.herdColor);
  }
  if (frameData.includeCursorHerd) {
    simState.cursorHerdMember.draw(ctx, simState.herdColor);
  }

  ctx.fillStyle = COLORS.CENTROID_HERD;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(frameData.herdCentroidX, frameData.herdCentroidY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  for (let i = 0; i < simState.shepherdMembers.length; i++) {
    simState.shepherdMembers[i].draw(ctx, simState.shepherdColor);
  }
  if (simState.cursorControlsFirstShepherd) {
    simState.cursorShepherd.draw(ctx, simState.shepherdColor);
  }

  if (simState.shepherdMembers.length > 0) {
    ctx.fillStyle = COLORS.CENTROID_SHEPHERD;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(frameData.shepherdCentroidX, frameData.shepherdCentroidY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  drawTargetMarker(ctx, simState.targetX, simState.targetY);
}
