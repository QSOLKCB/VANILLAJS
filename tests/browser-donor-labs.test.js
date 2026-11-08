// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyDonorLabs} from '../scripts/browser-donor-labs.js';

function fixture(failure){
  const events=[],error=new Error(failure);
  function page(name){
    let status='READY';
    return {
      async goto(url){
        events.push([name,'goto',url]);
        if(name==='offline'&&failure==='offline-navigation')throw error;
      },
      async waitForFunction(){},
      locator(selector){return {
        async click(){if(selector==='#pause')status='PAUSED';},
        async uncheck(){},
        async textContent(){
          return selector==='#status'?status:selector==='#mode'?'BANK':'1';
        }
      };},
      keyboard:{async down(){},async up(){}},
      async screenshot(){},
      async setViewportSize(){},
      async evaluate(){return true;},
      async reload(){events.push([name,'reload']);},
      async close(){events.push([name,'close']);}
    };
  }
  let pageCount=0;
  const context={
    async newPage(){
      const name=pageCount++===0?'arcade':'offline';
      events.push([name,'newPage']);
      if(failure===name+'-page')throw error;
      return page(name);
    },
    async setOffline(value){events.push(['context','offline',value]);},
    async close(){events.push(['context','close']);}
  };
  const browser={
    async newPage(){
      events.push(['browser','newPage']);
      assert.equal(events.filter(e=>e[0]==='browser').length,1,
        'only the single-page bullet check may use browser.newPage()');
      return page('bullet');
    },
    async newContext(options){
      assert.deepEqual(options,{viewport:{width:1280,height:860}});
      events.push(['context','created']);
      return context;
    }
  };
  return {browser,events,error};
}

test('donor offline witness uses an explicit shared context and closes it',async()=>{
  const {browser,events}=fixture();
  await verifyDonorLabs(browser,'http://localhost/VANILLAJS/');
  assert.deepEqual(events.slice(-7),[
    ['arcade','reload'],['context','offline',true],['offline','newPage'],
    ['offline','goto','http://localhost/VANILLAJS/demos/bullet-time-lab/index.html'],
    ['offline','close'],['context','offline',false],['context','close']
  ]);
  assert.ok(events.findIndex(e=>e[0]==='bullet'&&e[1]==='close')<
    events.findIndex(e=>e[1]==='created'));
});

for(const failure of ['arcade-page','offline-page','offline-navigation']){
  test('donor context is cleaned up after '+failure,async()=>{
    const {browser,events,error}=fixture(failure);
    await assert.rejects(verifyDonorLabs(browser,'http://localhost/VANILLAJS/'),
      e=>e===error);
    assert.deepEqual(events.at(-1),['context','close']);
    if(failure.startsWith('offline')){
      assert.deepEqual(events.at(-2),['context','offline',false]);
      assert.equal(events.some(e=>e[0]==='offline'&&e[1]==='close'),
        failure==='offline-navigation');
    }
  });
}
