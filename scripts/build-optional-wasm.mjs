// SPDX-License-Identifier: Apache-2.0
// Development-only. Supply wabt@1.0.39 using NODE_PATH; never ship tooling.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import bytes from '../modules/render-optional/wasm-bytes.js';
const require=createRequire(import.meta.url);
assert.equal(require('wabt/package.json').version,'1.0.39');
const wabt=await require('wabt')(),source=new URL('../modules/render-optional/project.wat',import.meta.url);
const module=wabt.parseWat('project.wat',await readFile(source,'utf8'));
try{
  const {buffer}=module.toBinary({log:false,write_debug_names:false});
  if(process.argv.includes('--write'))await writeFile(new URL('../modules/render-optional/wasm-bytes.js',import.meta.url),
    '// SPDX-License-Identifier: Apache-2.0\n// Generated from project.wat with wabt 1.0.39.\nexport default new Uint8Array(['+Array.from(buffer).join(',')+']);\n');
  else assert.deepEqual(new Uint8Array(buffer),bytes);
  console.log('WASM source/binary reproducibility PASS ('+buffer.length+' bytes)');
}finally{module.destroy();}
