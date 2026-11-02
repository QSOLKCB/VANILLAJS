// Independent development-only graph oracle: arithmetic OMI parity and XOR,
// its own FIFO traversal, distances and parent table. Does not import the solver.
import {referenceDelta,referenceXor} from './omi-oracle.js';
export function inspectPuzzle({seed,target,masks}) {
  const distances=new Int32Array(65536).fill(-1),parents=new Int32Array(65536),commands=new Uint8Array(65536),queue=[seed];
  distances[seed]=0;let edges=0;
  for(let head=0;head<queue.length;head++){
    const word=queue[head],next=[referenceDelta(word),...masks.map(mask=>referenceXor(word,mask))];
    for(let op=0;op<next.length;op++){
      edges++;const destination=next[op];if(distances[destination]!==-1)continue;
      distances[destination]=distances[word]+1;parents[destination]=word;commands[destination]=op;queue.push(destination);
    }
  }
  let solution=null;
  if(distances[target]>=0){solution=[];for(let word=target;word!==seed;word=parents[word])solution.push(commands[word]);solution.reverse();}
  return {reachable:queue.length,edges,distance:distances[target],solution,distances};
}
