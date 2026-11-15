// SPDX-License-Identifier: Apache-2.0
import {createIntro} from './intro.js';
let intro;const $=id=>document.getElementById(id);
const complete=()=>{$('intro-stage').hidden=true;$('menu').hidden=false;$('skip').disabled=true;$('launch').disabled=true;};
$('launch').onclick=async()=>{if(intro)return;intro=createIntro($('screen'),{enabled:$('enabled').checked,onComplete:complete});try{await intro.start();}catch(error){$('status').textContent=error.message;intro.dispose();intro=null;}};
$('skip').onclick=()=>{if(intro)intro.skip();else complete();};
window.addEventListener('pagehide',()=>intro?.dispose());
