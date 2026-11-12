// SPDX-License-Identifier: Apache-2.0
// Register trusted, local source extensions here. Uploaded text packs never execute code.
import machineHooks from './machine-dawn/hooks.js';
export const campaigns = [
  { id: 'frontier', title: 'The Open Frontier', description: 'Thirty stars, three distinct ship families, ancient archives and an open frontier.', base: new URL('./frontier/', import.meta.url), hooks: {} },
  { id: 'machine-dawn', title: 'Machine Dawn', description: 'A sixteen-system machine civilisation campaign. Six-colony victory, renamed worlds and a working custom turn event.', base: new URL('./machine-dawn/', import.meta.url), hooks: machineHooks },
  ...[
    ['grand-frontier', 'Grand Frontier: The Long Concord', '64 stars. Three playable empires. Build a commonwealth or a dominion across a century of exploration.'],
    ['fallen-gates', 'Fallen Gates: The Quiet Meridian', '36 stars. Recover the archive keys, then restore the old gates or chart an independent future.'],
    ['outer-rim', 'Siege of the Outer Rim', '40 stars. An asymmetric defence with escalating incursions, relief convoys and endurance or reconquest routes.'],
    ['helix-accord', 'Helix Accord: The Threefold Charter', '24 stars. Three new playable cultures on interwoven arms. Negotiate a trading charter or build an industrial federation.'],
    ['emberwake', 'Emberwake Exodus: The Last Convoy', '32 stars. Three refugee cultures, a fractured migration corridor and a choice between permanent havens and a mobile convoy network.'],
    ['glass-meridian', 'Glass Meridian: The Unwritten Sky', '48 stars. Three research cultures on two transit rings. Recover archive memories, then preserve the lattice or chart an independent sky.']
  ].map(([id, title, description]) => ({ id, title, description, base: new URL(`./${id}/`, import.meta.url), hooks: {}, files: ['scenario', 'layout', 'dependencies', 'objectives', 'events', 'starts', 'ai'] }))
];
