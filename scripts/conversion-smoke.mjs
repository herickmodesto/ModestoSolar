import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pages = await fetch('http://127.0.0.1:9223/json/list').then(r=>r.json());
const page = pages.find(p=>p.type==='page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let sequence=0;
const errors=[];
const outbound=[];
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text+': '+message.params.exceptionDetails.exception?.description);
  if(message.method==='Fetch.requestPaused') {
    outbound.push(message.params.request.url);
    send('Fetch.failRequest',{requestId:message.params.requestId,errorReason:'Aborted'});
  }
  if(!pending.has(message.id))return;
  const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
  message.error?reject(new Error(message.error.message)):resolve(message.result);
});
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));})}
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await wait(150)}throw Error('Timeout: '+expression)}
const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const scroll=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({behavior:'instant',block:'start'})`);
function assert(value,message){if(!value)throw Error(message);console.log('PASS '+message)}
async function shot(name){const data=await send('Page.captureScreenshot',{format:'png'});const path=join(tmpdir(),`modesto-${name}.png`);await writeFile(path,Buffer.from(data.data,'base64'));console.log(path);}
await send('Page.enable');await send('Runtime.enable');
await send('Fetch.enable',{patterns:[{urlPattern:'*wa.me/*',requestStage:'Request'}]});
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await send('Page.navigate',{url:'http://127.0.0.1:5174/'});
await until(`!!document.querySelector('.hero-analysis-button')`);
await evaluate(`document.documentElement.style.scrollBehavior='auto';window.qaEvents=[];window.addEventListener('modesto:conversion',e=>window.qaEvents.push(e.detail))`);
await wait(600);
assert(await evaluate(`document.querySelectorAll('h1').length===1`),'one primary heading');
assert(await evaluate(`!document.querySelector('.chat-modal')`),'no unsolicited contact popup');
assert(await evaluate(`!document.querySelector('model-viewer')&&!document.querySelector('script[data-google-maps]')`),'hero 3D and Maps wait for interaction');
assert(await evaluate(`document.querySelector('.hero-analysis-button').getBoundingClientRect().bottom<innerHeight`),'mobile primary action above fold');
assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),'mobile homepage no horizontal overflow');
await shot('mobile-hero');
await click('.menu-button');assert(await evaluate(`document.querySelector('.nav-links').classList.contains('open')`),'mobile menu opens');await click('.nav-links a[href="#simulador"]');
await until(`!!document.querySelector('#solar-average-bill')`);
await until(`!!document.querySelector('.roof-stage.is-ready')||!!document.querySelector('.roof-stage.is-error')`);
await scroll('.config-panel');await wait(250);await shot('mobile-simulator');
await evaluate(`document.querySelector('#property-sobrado').click()`);
await until(`document.querySelector('#property-sobrado').checked`);
await evaluate(`{const input=document.querySelector('#solar-average-bill');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1000');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}`);
await until(`document.querySelector('.config-bill').textContent.includes('1.000')`);
await click('.config-cta');await until(`!!document.querySelector('.generation-analysis-modal')`);
assert(await evaluate(`document.querySelector('.analysis-details').textContent.includes('Sobrado')&&document.querySelector('.analysis-details').textContent.includes('1.000')`),'analysis uses selected home and bill');
await shot('mobile-analysis');
await click('.analysis-modal-close');assert(await evaluate(`!document.querySelector('.generation-analysis-modal')&&document.querySelector('#property-sobrado').checked`),'closing result preserves selection');
await scroll('#mobilidade');await until(`!!document.querySelector('#ev-profile-driver')`);
await click('#ev-profile-driver');await until(`document.querySelector('.ev-range-label').textContent.includes('200')`);
await click('.ev-primary-action');await until(`!!document.querySelector('.included-vehicle')`);
assert(await evaluate(`document.querySelector('.included-vehicle').textContent.includes('200 km/dia')`),'driver consumption transfers to residential planning');
await click('.config-cta');await until(`!!document.querySelector('.generation-analysis-modal')`);
assert(await evaluate(`document.querySelector('.analysis-details').textContent.includes('924 kWh/mês')`),'analysis contains driver monthly demand');
await click('.performance-footer button');await until(`!!document.querySelector('.chat-input input')`);
async function answerText(text){await evaluate(`{const input=document.querySelector('.chat-input input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(text)});input.dispatchEvent(new Event('input',{bubbles:true}));}`);await wait(100);await click('.chat-input button');await wait(1050);}
await answerText('Teste local');await answerText('Natal');
// Bill, property and EV answers must be reused, not asked again.
assert(await evaluate(`document.querySelector('.quick-replies').textContent.includes('Próprio')`),'contact skips answers already provided in simulators');
for(let i=0;i<5;i++){await click('.quick-replies button');await wait(1050);}
await until(`!!document.querySelector('.contact-review')`);
assert(await evaluate(`location.hostname==='127.0.0.1'`),'contact waits for explicit send');
assert(await evaluate(`document.querySelector('.contact-review').textContent.includes('Sua montagem está incluída')`),'review includes simulation');
await shot('mobile-contact-review');
await evaluate(`document.querySelector('.contact-review').requestSubmit()`);await wait(500);
assert(outbound.length===1,'WhatsApp send intercepted locally');
const message=new URL(outbound[0]).searchParams.get('text');
assert(message.includes('Sobrado')&&message.includes('1000')&&message.includes('200 km/dia'),'WhatsApp draft contains home, bill and vehicle');
assert(errors.length===0,'no uncaught browser errors');
await send('Page.navigate',{url:'http://127.0.0.1:5174/'});await until(`!!document.querySelector('.hero-analysis-button')`);
for(const [width,height] of [[320,740],[768,1024],[1366,900]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await evaluate(`window.scrollTo({top:0,behavior:'instant'})`);await wait(400);
  assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),`${width}px no horizontal overflow`);await shot(`${width}-hero`);
}
if(process.argv.includes('--models')){
  await scroll('#simulador');await until(`!!document.querySelector('#property-terrea')`);
  for(const profile of ['terrea','sobrado','comercial']){
    await click(`#property-${profile}`);
    await until(`!!document.querySelector('.roof-stage.is-ready')||!!document.querySelector('.roof-stage.is-error')`);
    assert(await evaluate(`!!document.querySelector('.roof-stage.is-ready')`),`${profile} 3D model loaded`);
  }
  await scroll('.roof-viewer-card');await wait(500);await shot('desktop-roof');
  await click('.config-panel .simulation-repeat-button');
  assert(await evaluate(`document.querySelector('#property-terrea').checked&&document.querySelector('#solar-average-bill').value==='600'`),'residential repeat resets property and consumption');
  await scroll('#mobilidade');await until(`!!document.querySelector('.ev-model-cover button')`);
  await click('.ev-model-cover button');
  await until(`!!document.querySelector('.ev-three-canvas')&&!document.querySelector('.ev-model-loader')`);
  assert(await evaluate(`!!document.querySelector('.ev-three-canvas')`),'car and wallbox load on request');
  await scroll('.ev-model-card');await wait(500);await shot('desktop-vehicle');
  await click('#ev-profile-driver');await click('.ev-primary-action');await until(`!!document.querySelector('.included-vehicle')`);
  await click('.ev-calculator-card .simulation-repeat-button');await until(`!document.querySelector('.included-vehicle')`);
  assert(await evaluate(`document.querySelector('#ev-profile-personal').checked&&document.querySelector('#ev-daily-distance').value==='40'`),'EV repeat resets controls and removes included demand');
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:740,deviceScaleFactor:1,mobile:true});
  await scroll('.config-panel');await wait(250);await shot('320-simulator');
  assert(await evaluate(`document.querySelector('.property-tabs').getBoundingClientRect().right<=innerWidth`),'property tabs fit at 320px');
  await scroll('.ev-calculator-card');await wait(250);await shot('320-vehicle-controls');
  assert(await evaluate(`document.querySelector('.ev-profile-tabs').getBoundingClientRect().right<=innerWidth`),'vehicle controls fit at 320px');
}
socket.close();
