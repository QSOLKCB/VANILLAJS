// SPDX-License-Identifier: Apache-2.0
// Original case files. All names, palettes, routes and tunes are demo-owned.
export const CASES=Object.freeze([
  {name:'PHANTOM RUNNER',route:'Sunset causeway',car:'Violet coupe',color:'#d278ce',speed:55,gap:460,hits:5,traffic:145,bends:[0,.0015,0,-.0018,0,.0024,0,-.001],sky:'#153d60',haze:'#e6a171',land:'#5d7170',verge:'#ad916f',accent:'#ffce7c',kind:'coast'},
  {name:'GHOST FREIGHT',route:'Red Mesa highway',car:'Cobalt hauler',color:'#629cdb',speed:58,gap:520,hits:6,traffic:135,bends:[.0005,-.002,.0015,0,.0026,-.001,0,.002],sky:'#50445e',haze:'#e3a575',land:'#824e49',verge:'#b38a62',accent:'#ffd18a',kind:'desert'},
  {name:'NIGHT COURIER',route:'Pine Ridge pass',car:'Jade interceptor',color:'#7ec7a5',speed:61,gap:560,hits:6,traffic:125,bends:[-.0018,0,.0028,-.0016,0,.003,-.002,.001],sky:'#293958',haze:'#a4a8a0',land:'#304b4d',verge:'#48675c',accent:'#bde0ca',kind:'forest'},
  {name:'REDLINE',route:'Neon harbour',car:'Scarlet roadster',color:'#f27972',speed:64,gap:600,hits:7,traffic:115,bends:[0,.002,-.0024,0,.003,-.002,.0016,0],sky:'#151e3f',haze:'#775d84',land:'#283c55',verge:'#354d65',accent:'#f8b888',kind:'city'},
  {name:'LAST TRANSMISSION',route:'Stormfront expressway',car:'Armoured sedan',color:'#c5b394',speed:67,gap:640,hits:8,traffic:105,bends:[.002,-.0018,.003,0,-.0025,.0018,0,-.003],sky:'#101f31',haze:'#637c89',land:'#263f4b',verge:'#3e5661',accent:'#a4dae6',kind:'rain'}
].map(c=>Object.freeze({...c,bends:Object.freeze(c.bends)})));
