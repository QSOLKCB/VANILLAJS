// SPDX-License-Identifier: Apache-2.0
// Bounded conservative dependency recognizer, NOT a general ECMAScript parser.
import {createHash} from 'node:crypto';
import {posix} from 'node:path';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const gitBlob=bytes=>createHash('sha1').update('blob '+Buffer.byteLength(bytes)+'\0').update(bytes).digest('hex');
export const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const identity=x=>hash(canonical(x));
const safe=p=>typeof p==='string'&&/^[a-zA-Z0-9._/-]+$/.test(p)&&!p.startsWith('/')&&!p.split('/').includes('..');
export function validateInventory(files){
  if(!Array.isArray(files)||files.some(f=>!safe(f.path)||!/^[a-f0-9]{64}$/.test(f.sha256))||new Set(files.map(f=>f.path)).size!==files.length)throw Error('invalid package inventory');
}
export function resolveLocal(from,spec){
  if(typeof spec!=='string'||!spec.startsWith('.')||/[\\?#%]/.test(spec))throw Error('unsupported dependency '+spec);
  const p=posix.normalize(posix.join(posix.dirname(from),spec));if(!safe(p))throw Error('escaping dependency '+spec);return p;
}
// Comments and string/template bodies are skipped. Any escape in an import
// specifier, interpolated template containing import/eval, or escaped identifier
// is unsupported and cannot qualify for reuse. Regex ambiguity over-invalidates.
export function jsDependencies(source){
  const tokens=[],issues=[];let i=0;
  if(source.length>2**20)return {imports:[],issues:['source exceeds analyzer budget']};
  while(i<source.length){
    const c=source[i];if(/\s/.test(c)){i++;continue;}
    if(source.startsWith('//',i)){i=source.indexOf('\n',i);if(i<0)break;continue;}
    if(source.startsWith('/*',i)){const end=source.indexOf('*/',i+2);if(end<0){issues.push('unterminated comment');break;}i=end+2;continue;}
    if(c==='/'&&(!tokens.length||['=','(',':','[',',','!','?','&','|','{',';','}','return','=>'].includes(tokens.at(-1).value))){
      const start=i++;let bracket=false;
      while(i<source.length){if(source[i]==='\\'){i+=2;continue;}if(source[i]==='[')bracket=true;if(source[i]===']')bracket=false;if(source[i]==='/'&&!bracket)break;i++;}
      if(i===source.length){issues.push('unrecognized regex/division');break;}
      const body=source.slice(start,i++);
      if(/\b(import|eval|Function|fetch|Worker)\b/.test(body)||(tokens.at(-1)?.value==='}'&&body.includes('\\u')))issues.push('ambiguous executable token in regex');
      while(/[a-z]/i.test(source[i]??'')&&i<source.length)i++;
      tokens.push({type:'regex',value:body});continue;
    }
    if(c==='"'||c==="'"||c==='`'){
      const quote=c,start=++i;let escaped=false;
      while(i<source.length&&source[i]!==quote){if(source[i]==='\\'){escaped=true;i+=2;}else i++;}
      const value=source.slice(start,i);if(i===source.length)issues.push('unterminated literal');i++;
      if(quote==='`'&&value.includes('${')&&/\b(import|eval|Function|fetch|Worker)\b/.test(value))issues.push('dynamic code in template');
      tokens.push({type:quote==='`'?'template':'string',value,escaped});continue;
    }
    if(c==='\\'){issues.push('escaped executable identifier');i++;continue;}
    const word=/^[A-Za-z_$][\w$]*/.exec(source.slice(i));
    if(word){tokens.push({type:'word',value:word[0]});i+=word[0].length;}else if(source.startsWith('=>',i)){tokens.push({type:'punct',value:'=>'});i+=2;}else{tokens.push({type:'punct',value:c});i++;}
  }
  const imports=[];
  for(let n=0;n<tokens.length;n++){
    const t=tokens[n],next=tokens[n+1];if(t.type!=='word')continue;
    if(['eval','Function','Worker','SharedWorker','fetch','importScripts','require'].includes(t.value)&&tokens[n-1]?.value!=='#')issues.push('unmodeled execution/resource '+t.value);
    if(t.value==='createElement'&&tokens[n+1]?.value==='('&&(tokens[n+2]?.type!=='string'||['script','iframe'].includes(tokens[n+2].value)))issues.push('dynamic DOM execution dependency');
    if(t.value==='URL'&&tokens[n-1]?.value==='new')issues.push('unmodeled URL resource');
    if(t.value!=='import'&&t.value!=='export')continue;
    if(t.value==='import'&&next?.value==='.')continue; // import.meta: resource use separately rejected
    let spec;
    if(t.value==='import'&&next?.type==='string')spec=next;
    else if(t.value==='import'&&next?.value==='('){
      spec=tokens[n+2];if(tokens[n+3]?.value!==')'||spec?.type!=='string'){issues.push('computed dynamic import');continue;}
    }else{
      let k=n+1;for(;k<tokens.length;k++){
        if(tokens[k].value==='from'&&tokens[k].type==='word'){spec=tokens[k+1];break;}
        if([';','='].includes(tokens[k].value)||['function','class','const','let','var','default'].includes(tokens[k].value))break;
      }
      if(!spec&&t.value==='import')issues.push('unrecognized import');
    }
    if(spec){if(spec.type!=='string'||spec.escaped)issues.push('unsupported import specifier');else imports.push(spec.value);}
  }
  return {imports:[...new Set(imports)].sort(),issues:[...new Set(issues)].sort()};
}
export function assetDependencies(path,source){
  if(/\.[cm]?js$/.test(path))return jsDependencies(source);
  const imports=[],issues=[];
  if(path.endsWith('.html')){
    if(/<base\b|<(?:object|embed|audio|video)\b|\b(?:importmap|srcdoc|srcset)\b|\son\w+\s*=/i.test(source))issues.push('unsupported HTML execution/base');
    for(const tag of source.matchAll(/<(script|link|img|iframe|source)\b([^>]*)>([\s\S]*?)(?:<\/script\s*>|(?=<)|$)/gi)){
      const attrs=tag[2],url=/\b(?:src|href)\s*=\s*(["'])(.*?)\1/i.exec(attrs);
      if(url)imports.push(url[2].startsWith('.')?url[2]:'./'+url[2]);
      else if(tag[1].toLowerCase()==='script'&&tag[3].trim())issues.push('inline script requires explicit root');
    }
    if(/\b(?:src|href)\s*=\s*[^\s"'>]/i.test(source))issues.push('unquoted HTML resource');
  }
  if(path.endsWith('.css')){
    if(source.includes('\\'))issues.push('unsupported CSS escape');
    for(const m of source.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/g)){
      const s=m[1]??m[2];if(!s.startsWith('data:')&&!s.startsWith('#'))imports.push(s.startsWith('.')?s:'./'+s);
    }
  }
  return {imports,issues};
}
export function closures({files,sources,policy,extra={},environment}){
  validateInventory(files);const inventory=new Map(files.map(f=>[f.path,f]));
  const groups=Object.keys(policy.suites),allRoots=groups.flatMap(g=>policy.suites[g].roots);
  const unknown=files.filter(f=>!allRoots.some(p=>f.path.startsWith(p))&&!/^(modules\/|api\/|experiments\/|offline\/|index\.html$|service-worker\.js$|MODULES\.json$|LICENSE$|NOTICE$|\.nojekyll$)/.test(f.path)).map(f=>f.path);
  const output={};
  for(const group of groups){
    const config=policy.suites[group],roots= config.consumes.flatMap(g=>policy.suites[g].roots);
    const queue=[...(extra.roots?.[group]??[]),...files.filter(f=>roots.some(p=>f.path.startsWith(p))).map(f=>f.path)],seen=new Set(),edges=[],issues=unknown.map(p=>'unclassified package member: '+p);
    if(!queue.length)issues.push('missing suite roots');
    if(config.serviceWorker)queue.push('index.html','offline/register.js','service-worker.js');
    while(queue.length){
      const path=queue.shift();if(seen.has(path))continue;seen.add(path);
      if(!inventory.has(path)){issues.push('missing runtime: '+path);continue;}
      if(!/\.(?:js|mjs|html|css)$/.test(path))continue;
      const source=sources[path];
      if(/\.[cm]?js$/.test(path)&&path!=='service-worker.js'&&policy.auditedRuntime&&policy.auditedRuntime[path]!==hash(source??''))issues.push('unreviewed executable closure: '+path);
      if(typeof source!=='string'||hash(source)!==inventory.get(path).sha256){issues.push('missing/mismatched source: '+path);continue;}
      // Full package identity is included for these audited generated/offline
      // execution paths, so no inferred exclusion applies to their resources.
      if(path==='service-worker.js'&&config.serviceWorker){
        if(hash(extra['scripts/service-worker.template.js']??'')!==policy.workerTemplateSHA256)issues.push('unreviewed worker template');
        continue;
      }
      const opaque=policy.opaqueRuntime?.[path];
      if(opaque&&opaque.sha256===hash(source)){
        if(path==='offline/register.js'&&!config.serviceWorker)issues.push('undeclared worker consumer');
        queue.push(...opaque.roots);for(const target of opaque.roots)edges.push([path,target]);continue;
      }
      const deps=assetDependencies(path,source);issues.push(...deps.issues.map(x=>path+': '+x));
      for(const spec of deps.imports)try{const target=resolveLocal(path,spec);edges.push([path,target]);queue.push(target);}catch(e){issues.push(path+': '+e.message);}
    }
    const runtime=(config.serviceWorker?files:files.filter(f=>seen.has(f.path))).map(f=>({path:f.path,sha256:f.sha256,...(extra.gitBlobs?.[f.path]?{gitBlob:extra.gitBlobs[f.path]}:{})})).sort((a,b)=>a.path.localeCompare(b.path));
    const requirements=[];
    for(const [prefix,paths] of Object.entries(policy.contracts))if(runtime.some(f=>f.path.startsWith(prefix)))for(const path of paths){
      if(typeof extra[path]!=='string')issues.push('missing verification requirement: '+path);
      else requirements.push({path,sha256:hash(extra[path]),gitBlob:gitBlob(extra[path])});
    }
    const catalogue=extra.catalogue?{schemaVersion:extra.catalogue.schemaVersion,release:extra.catalogue.release,modules:Object.fromEntries(Object.entries(extra.catalogue.modules).filter(([,m])=>runtime.some(f=>f.path===m.entry)))}:null;
    issues.push(...(extra.issues??[]),...(extra.suiteIssues?.[group]??[]));
    const executable={runtime,requirements,catalogue,manifestVersion:extra.manifestVersion,environment,policy:identity(policy),shared:extra.shared??[],tests:extra.tests?.[group]??[],schema:'CI-INVARIANT-001/1'};
    output[group]={fingerprint:identity(executable),inputs:executable,edges:edges.sort(),issues:[...new Set(issues)].sort()};
  }
  return output;
}
