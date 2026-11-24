// SPDX-License-Identifier: Apache-2.0
// Scheduling units are whole browser scenarios. Reusable evidence is still per suite.
export const SUITES=Object.freeze(['home','render','play','worlds','research','donor','editor']);
const lanes={
  'horizon-race': [
    ['editor','./browser-horizon-race.js','checkHorizonRace'],
  ],
  'horizon-export': [
    ['editor','./browser-horizon-export.js','checkHorizonExport'],
  ],
  'foundry': [
    ['editor','./foundry-startup-check.mjs','checkHorizonRaceStartup'],
    ['editor','./browser-horizon-drive.js','checkHorizonDrive'],
    ['editor','./foundry-startup-check.mjs','checkHorizonDriveStartup'],
    ['editor','./browser-horizon.js','checkHorizon'],
    ['editor','./foundry-startup-check.mjs','checkHorizonStartup'],
    ['editor','./browser-game-maker-api.js','checkGameMakerAPI'],
    ['editor','./browser-game-maker.js','checkGameMaker'],
    ['editor','./foundry-startup-check.mjs','checkGameMakerStartup'],
    ['editor','./browser-narrative.js','checkNarrativeFoundry'],
    ['editor','./foundry-startup-check.mjs','checkNarrativeStartup'],
    ['editor','./browser-scene-composition.js','checkSceneComposition'],
    ['editor','./browser-tutorial.js','checkTutorial'],
    ['editor','./browser-sprite-foundry.js','checkSpriteFoundry'],
    ['editor','./foundry-startup-check.mjs','checkSpriteStartup'],
    ['editor','./browser-editor.js','verifyEditor'],
    ['editor','./browser-editor-4x.js','verifyEditor4X'],
    ['editor','./browser-creator.js','checkCreator'],
  ],
  'worlds': [
    ['worlds','./browser-rts.js','verifyRts'],
    ['worlds','./browser-flow.js','verifyFlow'],
    ['worlds','./browser-2d.js','verify2DLab'],
    ['worlds','./browser-arcade-combat.js','verifyArcadeCombat'],
    ['worlds','./browser-block-arena.js','verifyBlockArena'],
    ['worlds','./browser-demoscene.js','verifyDemoscene'],
    ['worlds','./browser-4x.js','verify4XLab'],
    ['worlds','./browser-voidward.js','verifyVoidwardLab'],
  ],
  'render': [
    ['render','./browser-render-lit.js','checkRenderLit'],
    ['render','./browser-integer.js','verifyIntegerFoundry'],
    ['render','./browser-opt-render.js','verifyRenderReuse'],
    ['render','./browser-webgl-api.js','verifyWebGLAPI'],
    ['render','./browser-frame-gate.js','verifyFrameGate'],
    ['research','./browser-omi.js','verifyOmi'],
    ['research','./browser-machine.js','verifyMachine'],
    ['research','./browser-graph.js','verifyGraphLab'],
    ['research','./browser-qgame.js','verifyQuantumGameLab'],
    ['render','./browser-vault.js','verifyVault'],
  ],
  'vehicles': [
    ['donor','./browser-skyguard.js','checkSkyguard'],
    ['donor','./browser-pursuit.js','checkPursuit'],
    ['donor','./browser-football.js','checkFootball'],
    ['donor','./browser-subhunt.js','checkSubHunt'],
  ],
  'play': [
    ['play','./browser-weapon-feel.js','verifyWeaponFeel'],
    ['play','./foundry-startup-check.mjs','checkWeaponFeelStartup'],
    ['home','./browser-home.js','checkHome'],
    ['play','./browser-interactions.js','verifyInteractions'],
    ['play','./browser-mouse.js','verifyMouseLook'],
    ['play','./browser-fps.js','verifyFps'],
    ['play','./browser-fps-motion.js','verifyFpsMotion'],
    ['play','./browser-platforms.js','verifyPlatforms'],
    ['donor','./browser-optional-labs.js','verifyOptionalLabs'],
    ['donor','./browser-donor-labs.js','verifyDonorLabs'],
    ['donor','./browser-soundtrack.js','checkSoundtrack'],
  ],
};
export const SHARDS=Object.freeze(Object.keys(lanes));
export const CHECKS=Object.freeze(Object.entries(lanes).flatMap(([shard,rows])=>
  rows.map(([suite,file,name])=>Object.freeze({shard,suite,file,name,id:suite+'/'+name}))));

export function selectedChecks(suites,shard){
  if(!Array.isArray(suites)||new Set(suites).size!==suites.length||suites.some(s=>!SUITES.includes(s)))
    throw Error('invalid browser suite selection');
  if(shard!==undefined&&!SHARDS.includes(shard))throw Error('invalid browser shard');
  return CHECKS.filter(check=>suites.includes(check.suite)&&(shard===undefined||shard===check.shard));
}
export function activeShards(suites){
  return SHARDS.filter(shard=>selectedChecks(suites,shard).length>0);
}
