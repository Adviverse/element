import { test } from 'node:test';
import assert from 'node:assert/strict';

// minimal DOM + SDK stub
const scripts: any[] = [];
const rendered: any[] = [];
const destroyed: any[] = [];
let autoLoad = false;
(globalThis as any).window = globalThis as any;
class El { children:any[]=[]; attrs:Record<string,string>={}; tag=''; isConnected=true; removed=false; listeners:Record<string,any[]>={};
  setAttribute(k:string,v:string){this.attrs[k]=v;} getAttribute(k:string){return this.attrs[k]??null;}
  addEventListener(t:string,f:any){(this.listeners[t] ||= []).push(f);}
  fire(t:string){(this.listeners[t]||[]).forEach(f=>f());}
  remove(){this.removed=true;}
  appendChild(c:any){this.children.push(c);return c;} removeChild(c:any){this.children=this.children.filter(x=>x!==c);} }
(globalThis as any).HTMLElement = El;
const registry:Record<string,any>={};
(globalThis as any).customElements = { define:(n:string,c:any)=>{registry[n]=c;}, get:(n:string)=>registry[n] };
const live = () => scripts.filter(s=>!s.removed);
(globalThis as any).document = {
  createElement:(t:string)=>{const e:any=new El(); e.tag=t; if(t==='script'){scripts.push(e); if(autoLoad) queueMicrotask(()=>loadScript(e));} return e;},
  head:{appendChild:(s:any)=>{}},
  querySelector:(sel:string)=> sel.includes('data-adviverse-sdk') ? (live().find(s=>s.attrs['data-adviverse-sdk'])||null) : null,
};
const installSdk = () => { (globalThis as any).window.adviverse = {
  render: async (el:any,opts:any)=>{rendered.push(opts); return {};},
  destroy: (el:any)=>{destroyed.push(el);},
  ready: (cb:()=>void)=>cb(),
}; };
const loadScript = (s:any) => { installSdk(); s.fire('load'); };
const reset = () => { scripts.length=0; rendered.length=0; destroyed.length=0; delete (globalThis as any).window.adviverse; _resetSdkLoader(); };
const tick = () => new Promise(r=>setTimeout(r,0));

const { AdviverseAdElement, loadSdk, _resetSdkLoader } = await import('./index.ts');

test('loadSdk injects the sdk script once', async () => {
  reset(); autoLoad = true;
  await loadSdk(); await loadSdk();
  assert.equal(scripts.filter(s=>String(s.attrs.src||'').includes('/sdk/')).length, 1, 'one sdk script');
});
test('concurrent loadSdk before load → one script, all resolve after load', async () => {
  reset(); autoLoad = false;
  const all = Promise.all([loadSdk(), loadSdk()]);
  assert.equal(scripts.length, 1, 'exactly one script injected');
  loadScript(scripts[0]);
  await all;
  assert.ok((globalThis as any).window.adviverse.render);
});
test('error removes the dead script so a retry re-injects', async () => {
  reset(); autoLoad = false;
  const p = loadSdk(); scripts[0].fire('error');
  await assert.rejects(p);
  assert.equal(scripts[0].removed, true);
  const p2 = loadSdk(); assert.equal(scripts.length, 2, 're-injected');
  loadScript(scripts[1]); await p2;
});
test('element renders with its tag on connect and destroys on disconnect', async () => {
  reset(); autoLoad = true;
  const e:any = new (AdviverseAdElement as any)();
  e.setAttribute('tag','tk_demo'); e.setAttribute('sizes','300x250');
  e.connectedCallback(); await tick();
  assert.ok(rendered.some(r=>r.tag==='tk_demo'), 'render called with tag');
  e.disconnectedCallback();
  assert.equal(destroyed.length, 1, 'destroy called');
});
test('no tag → does not render', async () => {
  reset(); autoLoad = true;
  const e:any = new (AdviverseAdElement as any)();
  e.connectedCallback(); await tick();
  assert.equal(rendered.length, 0, 'render not called without a tag');
});
test('disconnect before script load → no render (generation guard)', async () => {
  reset(); autoLoad = false;
  const e:any = new (AdviverseAdElement as any)();
  e.setAttribute('tag','tk_demo');
  e.connectedCallback();
  e.isConnected = false; e.disconnectedCallback();
  loadScript(scripts[0]); await tick();
  assert.equal(rendered.length, 0, 'render not called after disconnect');
});
test('reconnect before load → single render', async () => {
  reset(); autoLoad = false;
  const e:any = new (AdviverseAdElement as any)();
  e.setAttribute('tag','tk_demo');
  e.connectedCallback(); e.disconnectedCallback(); e.connectedCallback();
  loadScript(scripts[0]); await tick();
  assert.equal(rendered.length, 1, 'rendered once');
});
test('attribute change re-renders: destroy old, render new tag', async () => {
  reset(); autoLoad = true;
  const e:any = new (AdviverseAdElement as any)();
  e.setAttribute('tag','tk_old');
  e.connectedCallback(); await tick();
  e.setAttribute('tag','tk_new'); e.attributeChangedCallback('tag','tk_old','tk_new'); await tick();
  assert.equal(destroyed.length, 1, 'old slot destroyed');
  assert.deepEqual(rendered.map(r=>r.tag), ['tk_old','tk_new']);
});
test('tag set after connect renders; observedAttributes declared', async () => {
  reset(); autoLoad = true;
  assert.deepEqual((AdviverseAdElement as any).observedAttributes, ['tag','sizes']);
  const e:any = new (AdviverseAdElement as any)();
  e.connectedCallback(); await tick();
  e.setAttribute('tag','tk_late'); e.attributeChangedCallback('tag',null,'tk_late'); await tick();
  assert.deepEqual(rendered.map(r=>r.tag), ['tk_late']);
});
