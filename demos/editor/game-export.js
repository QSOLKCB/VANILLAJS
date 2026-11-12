// SPDX-License-Identifier: Apache-2.0
import {serializeProject} from './asset-foundry.js';
export function exportGame(scene,library,{optionalGPU=false,packaged=false}={}){
  const data=serializeProject(scene,library,{optionalGPU}).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VANILLAJS game preview</title>
<style>body{margin:0;background:#050a14;color:white;font:16px system-ui}.viewport{position:relative;width:100%;height:80vh}canvas{width:100%;height:100%;display:block}button{padding:12px;margin:8px}</style>
<div id="controls"><button id="pause">Pause</button><button id="restart">Restart</button></div><div class="viewport"><canvas id="view" width="960" height="540" tabindex="0" aria-label="Game preview. WASD move, Space jump."></canvas></div><p>WASD move · Space jump. Focus loss pauses. ${packaged?'Serve this whole folder over HTTP(S).':'Place this HTML beside the packaged modules/ and demos/ folders. For a complete game folder, export the project and use scripts/export-game.js.'}</p><p id="game-status" role="status" aria-live="polite"></p>
<script id="project" type="application/json">${data}</script><script type="module">
import {mountGame} from './demos/editor/game-player.js';
try { mountGame(JSON.parse(document.getElementById('project').textContent)); }
catch(error) { document.getElementById('game-status').textContent='Preview unavailable: '+error.message; }
</script>${packaged?'<script type="module" src="./offline/register.js"></script>':''}</html>`;
}
