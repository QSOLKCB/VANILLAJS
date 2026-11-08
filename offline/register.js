// SPDX-License-Identifier: Apache-2.0
// Optional, same-origin offline registration for the packaged static build.
// File-open and source-only development work without a service worker.
const secure=location.protocol==='https:'||
  (location.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(location.hostname));
if(secure&&'serviceWorker' in navigator){
  const root=new URL('../',import.meta.url);
  const manifestUrl=new URL('manifest.json',root);
  // Source checkout has no generated manifest: do not install a broken worker.
  fetch(manifestUrl,{cache:'no-store'}).then(async response=>{
    if(!response.ok)return;
    const manifest=await response.json();
    if(!Array.isArray(manifest.files)||!manifest.files.some(f=>f.path==='service-worker.js'))return;
    await navigator.serviceWorker.register(new URL('service-worker.js',root),{scope:root.pathname});
    document.documentElement.dataset.offlineWorker='registered';
  }).catch(()=>{document.documentElement.dataset.offlineWorker='unavailable';});
}
