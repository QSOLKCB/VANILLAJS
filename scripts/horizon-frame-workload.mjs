// SPDX-License-Identifier: Apache-2.0
// Passed to page.evaluate. Imports resolve inside the selected package's runtime.
export async function captureRaceFrames({runtime, profile, frames}) {
  const load = file => import(new URL(file, runtime).href);
  const {starterRaceProject} = await load('race-project.js');
  const {RaceView} = await load('race-view.js');
  const {createRaceSession, raceDriverInput, raceWorldSafety} = await load('race-model.js');
  const {directionalDriveControls} = await load('drive-input.js');
  const project = structuredClone(starterRaceProject());
  project.scenery.profile = profile;
  const session = createRaceSession(project);
  const canvas = document.querySelector('canvas');
  const view = new RaceView(canvas, project, session.world, session.checkpoints);
  const gl = canvas.getContext('webgl');
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
  const pixel = new Uint8Array(4);
  const scenes = {};
  function advance() {
    for (let i = 0; i < 2; i++) {
      const input = raceDriverInput(session.road, session.player, session.project.vehicle,
        {speed: 10, lateral: -2, rows: session.rows});
      session.step(input, 1/120);
    }
  }
  function driveUntil(condition) {
    for (let i = 0; i < 4500; i++) {
      if (condition()) return;
      advance();
    }
    throw Error('Course fixture was not reached');
  }
  const structure = () => session.road.sample(session.progress.distance).structure;
  async function sample(name, driving) {
    const start = session.snapshot();
    const workMs = [], intervalMs = [];
    let previous;
    for (let i = -12; i < frames; i++) {
      const frame = await new Promise(requestAnimationFrame);
      const begin = performance.now();
      if (driving) advance();
      view.draw(session);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      if (i >= 0) {
        workMs.push(performance.now() - begin);
        intervalMs.push(frame - previous);
      }
      previous = frame;
    }
    if (driving && (session.progress.offRoad || session.player.needsRecovery)) throw Error(name+' left the road');
    if (['bridge','tunnel'].includes(name) && structure() !== name) throw Error(name+' fixture exited structure');
    // Count actual submissions outside the timed region, including the sky.
    const original = gl.drawArrays;
    let draws = 0, submittedVertices = 0;
    gl.drawArrays = function(mode, first, count) {
      draws++;
      submittedVertices += count;
      return original.call(this, mode, first, count);
    };
    try { view.draw(session); } finally { gl.drawArrays = original; }
    const image = canvas.toDataURL('image/png');
    if (!draws || gl.isContextLost() || gl.getError() !== gl.NO_ERROR) throw Error(name+' WebGL failure');
    const state = view.snapshot();
    scenes[name] = {start, end: session.snapshot(), camera: state.camera, resolution: [canvas.width,canvas.height],
      draws, submittedVertices, visibility: state.visibility, workMs, intervalMs, image, glError: 0};
  }
  try {
    await sample('parked', false);
    session.start();
    driveUntil(() => session.progress.distance >= 45);
    await sample('driving', true);
    for (const name of ['bridge','tunnel']) {
      driveUntil(() => structure() === name);
      await sample(name, true);
    }
    session.reset();
    session.start();
    for (let i = 0; session.phase === 'countdown' && i < 720; i++) session.step({});
    if (session.phase !== 'running') throw Error('Recovery countdown did not finish');
    let reason;
    for (let i = 0; i < 1100 && !reason; i++) {
      session.step(directionalDriveControls(session.player, {reverse: 1}));
      reason = raceWorldSafety(session);
    }
    if (reason !== 'BEHIND_START' || !session.recover() || session.progress.recoveries !== 1)
      throw Error('Reverse recovery fixture failed');
    await sample('recovery', false);
    return {renderer, project, scenes};
  } finally {
    view.dispose();
  }
}
