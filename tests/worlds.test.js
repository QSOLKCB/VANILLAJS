import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,createWorld,updateSession} from '../demos/flight-lab/worlds.js';
import {stepFlight,flightConfig,createBody} from '../modules/flight/index.js';
test('worlds are repeatable and use distinct flight configurations',()=>{
  assert.deepEqual(createWorld('arena'),createWorld('arena'));
  assert.equal(createSession('tunnel').config.assisted,true);assert.equal(createSession('arena').config.assisted,false);
  assert.throws(()=>createWorld('missing'));
});
for(const kind of ['tunnel','arena'])test(`${kind}: all six gates are reachable with shared flight physics`,()=>{
  const s=createSession(kind),dt=1/120;
  // Guidance controls translation only, so this exercises the actual world and collider.
  // Tunnel assist follows a target velocity; arena applies bang-limited proportional/derivative thrust.
  for(let i=0;i<120*180&&!s.complete;i++){
    const target=s.world.gates[s.nextGate].position;
    const desired=target.map((x,k)=>(x-s.body.position[k])*.8);
    const thrust=desired.map((v,k)=>s.config.assisted?v/s.config.maxSpeed:(v-s.body.velocity[k])*2/s.config.acceleration);
    updateSession(s,{thrust},dt);
  }
  assert.equal(s.complete,true,`${kind}: stopped at ${s.nextGate}, ${s.body.position}`);
  assert.equal(s.nextGate,6);
  const end=structuredClone(s.body);updateSession(s,{thrust:[1,1,1]},dt);assert.deepEqual(s.body,end);
});
test('both spawn locations are outside solids and remain stable without input',()=>{
  for(const kind of ['tunnel','arena']){
    const s=createSession(kind);for(let i=0;i<120;i++)updateSession(s,{},1/120);
    assert.deepEqual(s.body.position,s.world.spawn);assert.equal(s.collisions,0);
  }
});
test('thin-world collision works through the public flight API',()=>{
  const b=createBody({velocity:[0,0,-20000]}),s=createSession('tunnel');
  stepFlight(b,{},.05,flightConfig(),s.world.solids);assert.ok(b.position[2]>-244.1);
});
