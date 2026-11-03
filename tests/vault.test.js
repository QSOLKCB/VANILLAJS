import test from 'node:test';
import assert from 'node:assert/strict';
import {PUZZLES,VaultLock,MAX_COMMANDS,PuzzleSearch,solvePuzzle,applyCommand} from '../demos/clockwork-vault/puzzles.js';
import {createVault,stepVault,consoleAccess,openConsole,closeConsole,operateLock,engageSeal,progress,
  mechanismGeometry,exportVault,importVault,solid,STEP,MAX_TICKS} from '../demos/clockwork-vault/world.js';
import {FixedClock} from '../modules/time/index.js';
import {inspectPuzzle} from '../scripts/vault-oracle.js';
const advance=(s,count,input={})=>{for(let i=0;i<count;i++)stepVault(s,input);};
function approach(s){for(let i=0;i<4000&&!consoleAccess(s).available;i++)stepVault(s,{move:[0,-1]});assert.equal(openConsole(s),true);}
function solve(s){const i=progress(s);for(const op of solvePuzzle(i,s.locks[i].snapshot().word).commands){if(op===0){for(let n=0;n<8;n++)operateLock(s,'detent');}else operateLock(s,op);}assert.equal(engageSeal(s).status,'applied');}
function walkRoute(s,callback=()=>{}){
  for(let tick=0;tick<12000&&!s.complete;tick++){
    if(progress(s)<6&&consoleAccess(s).available){assert.equal(openConsole(s),true);solve(s);}
    const z=s.character.position[2],y=s.character.position[1],lift=mechanismGeometry(s).find(p=>p.id==='lift');
    const wait=z< -42.2&&z> -43&&lift.center[1]>-.15&&s.character.supportId!=='lift'||s.character.supportId==='lift'&&z< -44.5&&y<1.99;
    stepVault(s,{move:wait?[0,0]:[0,-1]});callback(s,tick);
    assert.equal(s.truncated,false);
  }
}

test('All six authored targets have independent shortest solutions of two through seven commands',()=>{
  for(let i=0;i<6;i++){
    const p=PUZZLES[i],oracle=inspectPuzzle(p),actual=solvePuzzle(i);
    assert.equal(oracle.distance,p.minimum);assert.equal(actual.status,'found');assert.equal(actual.commands.length,oracle.distance);
    let word=p.seed;for(const op of actual.commands)word=applyCommand(i,word,op);assert.equal(word,p.target);
    assert.ok(oracle.reachable<=65536);assert.ok(actual.visited<=oracle.reachable);
    assert.ok(Object.isFrozen(p));assert.ok(Object.isFrozen(p.masks));
  }
});
test('Sliced hints respect budgets, retain owned results, and distinguish already matched from unreachable',()=>{
  const search=new PuzzleSearch(5,PUZZLES[5].seed);let previous=0,result=search.snapshot();
  while(result.status==='building'){result=search.step(7);assert.ok(result.expanded-previous<=7);previous=result.expanded;}
  assert.equal(result.commands.length,7);result.commands.push(123);assert.equal(search.snapshot().commands.length,7);
  assert.deepEqual(new PuzzleSearch(0,PUZZLES[0].target).snapshot().commands,[]);
  const oracle=inspectPuzzle(PUZZLES[0]),outside=oracle.distances.findIndex(n=>n<0);assert.equal(solvePuzzle(0,outside).status,'unreachable');
  for(const budget of [0,-1,4097,.5,NaN,'1'])assert.throws(()=>search.step(budget));
});
test('Lock uses the Brass Engine preparation lanes and records a delta only when the eighth detent latches',()=>{
  const lock=new VaultLock(0);
  for(let i=0;i<7;i++){lock.detent();assert.equal(lock.snapshot().word,0x1234);assert.deepEqual(lock.snapshot().commands,[]);assert.equal(lock.lever(1),false);}
  assert.equal(lock.snapshot().registers.output,0xeb79);lock.detent();assert.equal(lock.snapshot().word,0xeb79);assert.deepEqual(lock.snapshot().commands,[0]);
  lock.lever(1);assert.equal(lock.snapshot().word,PUZZLES[0].target);assert.deepEqual(lock.snapshot().commands,[0,1]);
});
test('Undo first cancels partial crank motion, then reverses a completed command; reset restores seed',()=>{
  const lock=new VaultLock(2);lock.lever(1);const lever=lock.exportReplay();lock.turn();for(let n=0;n<22;n++)lock.tick();
  assert.equal(lock.snapshot().detents,1);assert.equal(lock.snapshot().subTick,7);lock.undo();assert.deepEqual(lock.exportReplay(),lever);
  lock.undo();assert.equal(lock.snapshot().word,PUZZLES[2].seed);assert.equal(lock.undo(),false);
  lock.lever(1);lock.turn();lock.tick();lock.reset();assert.deepEqual(lock.exportReplay(),new VaultLock(2).exportReplay());
});
test('One motor run completes only the pending revolution and closed-console motor cancellation preserves its fraction',()=>{
  const lock=new VaultLock(0);lock.detent();lock.turn();for(let i=0;i<16;i++)lock.tick();lock.stopMotor();const stopped=lock.exportReplay();
  for(let i=0;i<500;i++)lock.tick();assert.deepEqual(lock.exportReplay(),stopped);assert.equal(lock.snapshot().subTick,1);
  lock.turn();for(let i=0;i<200;i++)lock.tick();assert.deepEqual(lock.snapshot().commands,[0]);assert.equal(lock.snapshot().word,0xeb79);assert.equal(lock.snapshot().motor,false);
});
test('Command tape is bounded and invalid operations fail without mutation',()=>{
  const lock=new VaultLock(0);for(let i=0;i<MAX_COMMANDS;i++)assert.equal(lock.lever(1),true);
  const before=lock.exportReplay();assert.equal(lock.lever(1),false);assert.equal(lock.turn(),false);assert.equal(lock.detent(),false);
  for(const op of [0,2,-1,.5,'1',NaN]){assert.throws(()=>lock.lever(op));assert.deepEqual(lock.exportReplay(),before);}
  lock.undo();assert.equal(lock.turn(),true);for(let i=0;i<120;i++)lock.tick();assert.equal(lock.snapshot().commands.length,MAX_COMMANDS);
});
test('Every lock phase and fractional motor tick round-trips and continues identically',()=>{
  for(let index=0;index<6;index++)for(let phase=0;phase<8;phase++)for(const subTick of [0,7,14]){
    const original=new VaultLock(index);original.lever(1);original.turn();for(let n=0;n<phase*15+subTick;n++)original.tick();
    const restored=VaultLock.fromReplay(index,JSON.parse(JSON.stringify(original.exportReplay())));
    assert.deepEqual(restored.snapshot(),original.snapshot());for(let n=0;n<130;n++){original.tick();restored.tick();}assert.deepEqual(restored.snapshot(),original.snapshot());
  }
});
test('Lock replay rejects sparse histories, invalid stages, extra fields and inconsistent words',()=>{
  const valid=new VaultLock(0).exportReplay();
  for(const data of [null,[],{...valid,extra:1},{...valid,word:0},{...valid,commands:[2]},
    {...valid,commands:new Array(2)},{...valid,commands:Array(129).fill(1)},{...valid,detents:8},{...valid,subTick:15},{...valid,motor:1}])assert.throws(()=>VaultLock.fromReplay(0,data));
});
test('Console interaction requires grounded proximity, sequence, a complete calculation and a matching word',()=>{
  const s=createVault();assert.equal(openConsole(s),false);assert.equal(engageSeal(s,0).status,'blocked');
  approach(s);assert.equal(engageSeal(s).status,'blocked');assert.equal(engageSeal(s,1).status,'blocked');
  operateLock(s,'turn');advance(s,120);operateLock(s,1);operateLock(s,'detent');assert.equal(engageSeal(s).status,'blocked');
  operateLock(s,'undo');assert.equal(engageSeal(s).status,'applied');assert.equal(progress(s),1);assert.equal(s.console,null);
  s.console=0;assert.equal(operateLock(s,'reset'),false);s.console=null;assert.equal(progress(s),1);
});
test('Closed first gate stops an unsolved player; no approach from beyond a partition can engage it',()=>{
  const s=createVault();advance(s,360,{move:[0,-1],sprint:true});assert.ok(s.character.position[2]>-2.5);assert.equal(progress(s),0);
  s.character.position=[0,0,-5];assert.equal(consoleAccess(s,0).available,false);assert.equal(engageSeal(s,0).status,'blocked');
});
test('Full expedition completes through every physical gate, the causeway and lift with no rescue',()=>{
  const s=createVault();let onLift=false,onBridge=false;
  walkRoute(s,state=>{onLift ||= state.character.supportId==='lift';onBridge ||= state.character.supportId==='causeway';});
  assert.equal(s.complete,true);assert.equal(progress(s),6);assert.equal(s.rescues,0);assert.ok(onLift&&onBridge);
  const done=exportVault(s);advance(s,20,{move:[0,1]});assert.deepEqual(exportVault(s),done);assert.deepEqual(exportVault(importVault(done)),done);
});
test('Falling restores the last visited checkpoint without resetting released seals',()=>{
  const s=createVault();approach(s);solve(s);approach(s);assert.equal(s.checkpoint,1);closeConsole(s);
  s.character.position=[6,-3.01,-36];s.character.velocity=[0,-1,0];stepVault(s);
  assert.equal(s.rescues,1);assert.equal(progress(s),1);assert.deepEqual(s.character.position,[0,0,-9]);assert.equal(s.console,null);
});
test('Saving on a moving lift preserves support, routes and future character state',()=>{
  const s=createVault();let saved;
  walkRoute(s,state=>{if(!saved&&state.character.supportId==='lift'&&state.character.position[1]>.5&&state.character.position[1]<1.5)saved=exportVault(state);});
  assert.ok(saved);const a=importVault(saved),b=importVault(JSON.parse(JSON.stringify(saved)));
  for(let i=0;i<300;i++){const input={move:i>120?[0,-1]:[0,0]};stepVault(a,input);stepVault(b,input);assert.deepEqual(exportVault(a),exportVault(b));}
});
test('Kinematic interlock holds mechanism time while a rider can crouch to clear a temporary obstruction',()=>{
  const source=createVault();let saved;
  walkRoute(source,state=>{if(!saved&&state.character.supportId==='lift'&&state.character.position[1]>.5&&state.character.position[1]<.55)saved=exportVault(state);});
  const s=importVault(saved);s.solids.push(solid('test-clearance',[0,2.6,-45],[5,.4,4]));
  for(let n=0;n<120&&!s.blocked;n++)stepVault(s);
  assert.equal(s.blocked,true);const tick=s.mechanismTick;advance(s,20);assert.equal(s.mechanismTick,tick);assert.equal(s.truncated,false);
  advance(s,30,{crouch:true});assert.ok(s.mechanismTick>tick);assert.equal(s.character.crouched,true);assert.equal(s.truncated,false);
});
test('Vault replay restores pending console state; bad data leaves an existing expedition unchanged',()=>{
  const s=createVault();approach(s);operateLock(s,'turn');advance(s,22);const valid=exportVault(s);
  assert.deepEqual(exportVault(importVault(valid)),valid);const changed=structuredClone(valid);changed.locks[0].word=0;
  const invalid=[changed,{...valid,game:'other'},{...valid,levelSet:'future'},{...valid,ticks:-1},{...valid,mechanismTick:valid.ticks+1},
    {...valid,extra:1},{...valid,checkpoint:5},{...valid,complete:true},{...valid,player:{...valid.player,position:[0,0,-3]}},
    {...valid,player:{...valid.player,velocity:[NaN,0,0]}},{...valid,player:{...valid.player,supportVelocity:[0,2,0]}},
    {...valid,player:{...valid.player,grounded:false}},{...valid,console:1},{...valid,sealedAt:[0,null,null,null,null,null]}];
  for(const data of invalid){assert.throws(()=>importVault(data));assert.deepEqual(exportVault(s),valid);}
});
test('Future operated locks, out-of-order releases and motors without their console are rejected',()=>{
  const s=createVault(),save=exportVault(s);save.locks[1]=new VaultLock(1).exportReplay();save.locks[1].commands=[1];
  save.locks[1].word=applyCommand(1,PUZZLES[1].seed,1);assert.throws(()=>importVault(save));
  const a=exportVault(createVault());a.locks[0].motor=true;assert.throws(()=>importVault(a));
  const b=exportVault(createVault());b.sealedAt[1]=0;assert.throws(()=>importVault(b));
});
test('Fixed pause freezes player, mechanism and cam together; update boundaries reject invalid dt/input',()=>{
  const s=createVault();approach(s);operateLock(s,'turn');advance(s,19);const before=exportVault(s),clock=new FixedClock();clock.setPaused(true);
  clock.advance(100,dt=>stepVault(s,{},dt));stepVault(s,{},0);assert.deepEqual(exportVault(s),before);
  for(const dt of [-1,.02,NaN,Infinity]){assert.throws(()=>stepVault(s,{},dt));assert.deepEqual(exportVault(s),before);}
  assert.throws(()=>stepVault(s,{move:[NaN,0]}));assert.deepEqual(exportVault(s),before);
  assert.throws(()=>stepVault(s,{look:{yaw:Infinity}}));assert.deepEqual(exportVault(s),before);
  clock.setPaused(false);clock.advance(STEP,dt=>stepVault(s,{},dt));assert.equal(s.locks[0].snapshot().subTick,5);
});
test('30/60/144 Hz schedules preserve world, puzzle and full save state in the same runtime',()=>{
  const results=[30,60,144].map(hz=>{
    const s=createVault(),clock=new FixedClock();
    for(let frame=0;frame<hz*4;frame++)clock.advance(1/hz,dt=>{
      if(clock.ticks===90){openConsole(s);operateLock(s,'turn');}
      if(clock.ticks===250)operateLock(s,1);if(clock.ticks===260)engageSeal(s);
      stepVault(s,{move:[0,-1]},dt);
    });return exportVault(s);
  });assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});
test('The four-hour simulation boundary stops atomically and survives replay',()=>{
  const data=exportVault(createVault());data.ticks=MAX_TICKS-1;data.mechanismTick=MAX_TICKS-1;const s=importVault(data);
  stepVault(s);assert.equal(s.limit,true);const end=exportVault(s);stepVault(s);assert.deepEqual(exportVault(s),end);assert.equal(importVault(end).limit,true);
});
