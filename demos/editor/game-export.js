// SPDX-License-Identifier: Apache-2.0
import {serializeProject} from './asset-foundry.js';
export function exportGame(scene,library,{optionalGPU=false}={}){
  const data=serializeProject(scene,library,{optionalGPU}).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VANILLAJS game preview</title>
<style>body{margin:0;background:#050a14;color:white;font:16px system-ui}.viewport{position:relative;width:100%;height:80vh}canvas{width:100%;height:100%;display:block}button{padding:12px;margin:8px}</style>
<div id="controls"><button id="pause">Pause</button></div><div class="viewport"><canvas id="view" width="960" height="540" tabindex="0"></canvas></div><p>WASD move · Space jump. Focus loss pauses. Place this HTML beside the packaged modules/ and demos/ folders.</p>
<script id="project" type="application/json">${data}</script><script type="module">
import {mountGame} from './demos/editor/game-player.js';
mountGame(JSON.parse(document.getElementById('project').textContent));
</script></html>`;
}
