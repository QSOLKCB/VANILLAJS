// SPDX-License-Identifier: Apache-2.0
// Shared browser authoring utility; fixed ZIP STORE records, no dependencies.
const encode=text=>new TextEncoder().encode(text);
const safe=path=>typeof path==='string'&&path.length<=240&&/^[a-zA-Z0-9._/-]+$/.test(path)&&!path.startsWith('/')&&!path.split('/').some(p=>['.','..',''].includes(p));
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** Standard ZIP STORE records. No compression library, paths or code from a project. */
export function zipStoredFiles(files){
  if(!(files instanceof Map)||files.size<1||files.size>128)throw Error('Invalid ZIP inventory');
  const chunks=[],directory=[];let offset=0,total=0;
  for(const [path,bytes] of [...files].sort(([a],[b])=>a.localeCompare(b))){
    if(!safe(path)||!(bytes instanceof Uint8Array))throw Error('Invalid ZIP member');
    total+=bytes.length;if(total>5*1024*1024)throw Error('ZIP exceeds 5 MiB');
    const name=encode(path),crc=crc32(bytes),header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint16(12,33,true);
    view.setUint32(14,crc,true);view.setUint32(18,bytes.length,true);view.setUint32(22,bytes.length,true);view.setUint16(26,name.length,true);header.set(name,30);
    chunks.push(header,bytes);
    const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);
    c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=header.length+bytes.length;
  }
  const centralSize=directory.reduce((n,bytes)=>n+bytes.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,files.size,true);v.setUint16(10,files.size,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return new Blob([...chunks,...directory,end],{type:'application/zip'});
}
