import test from 'node:test';
import assert from 'node:assert/strict';
import {createLab2D,stepLab2D,snapshotLab2D,rtsRoute2D,
  LAB2D_MODES,RTS2D_GRID} from '../demos/2d-lab/world.js';
test('all four genres have independent, repeatable fixed tick simulations',()=>{
  for(const kind of LAB2D_MODES){
    const input={x:1,y:1,steer:1,throttle:1,jump:true,fire:true};
    const one=stepLab2D(createLab2D(kind),input),
      two=stepLab2D(createLab2D(kind),input);
    assert.deepEqual(one,two);assert.equal(one.tick,1);
    assert.equal(createLab2D(kind).tick,0);
  }
});
test('RTS pathfinding is complete, blocked-tile-aware and geometrically bounded',()=>{
  const path=rtsRoute2D();
  assert.deepEqual(path[0],[1,2]);assert.deepEqual(path.at(-1),[24,14]);
  assert.ok(path.some(([x,y])=>x===12&&y===7));
  for(const cell of path)assert.ok(RTS2D_GRID.walkable(cell));
  const snapshot=rtsRoute2D();snapshot[0][0]=100;
  assert.deepEqual(rtsRoute2D()[0],[1,2]);
  let s=createLab2D('rts');
  for(let i=0;i<800;i++)s=stepLab2D(s);
  assert.equal(s.kind,'rts');
  assert.ok(s.body.x>=0&&s.body.y>=0);
  assert.ok(s.waypoint>1);
});
test('SHMUP fire cadence bounded; car steering wraps; platform gravity lands',()=>{
  let shooter=createLab2D('shmup');
  for(let i=0;i<48;i++)shooter=stepLab2D(shooter,{x:1,fire:true});
  assert.ok(shooter.shots.length>0&&shooter.shots.length<=32);
  assert.ok(shooter.shots.every(p=>p.id>0));
  let car=createLab2D('car');
  for(let i=0;i<16;i++)car=stepLab2D(car,{steer:1,throttle:1});
  assert.equal(car.body.heading,0);
  let platform=createLab2D('platform');
  platform=stepLab2D(platform,{jump:true});
  assert.ok(platform.body.y>0);
  for(let i=0;i<40;i++)platform=stepLab2D(platform);
  assert.equal(platform.body.y,0);
});
test('model refuses invalid modes, bad controls and freezes at bounded tick cap',()=>{
  assert.throws(()=>createLab2D('multiplayer'));
  assert.throws(()=>stepLab2D(createLab2D('shmup'),{fire:0}));
  let s=createLab2D('platform');
  for(let i=0;i<905;i++)s=stepLab2D(s);
  assert.equal(s.tick,900);
  assert.equal(s.status,'limit');assert.deepEqual(stepLab2D(s),s);
});
test('full 120-tick per-mode replay snapshots are source-backed and stable',()=>{
  for(const kind of LAB2D_MODES){
    const run=()=>{let s=createLab2D(kind);
      for(let tick=0;tick<120;tick++)
        s=stepLab2D(s,{x:tick%3-1,y:tick%5===0?1:0,
          steer:tick%13===0?1:0,throttle:1,fire:tick%2===0,
          jump:tick%40===0});
      return snapshotLab2D(s);};
    assert.deepEqual(run(),run());
  }
});
