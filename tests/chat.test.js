import test from 'node:test';
import assert from 'node:assert/strict';

let serial = 0;
async function invoke(overrides = {}, responseStatus = 200) {
  const { default: handler } = await import('../api/chat.js?case=' + serial++);
  const previousFetch = globalThis.fetch;
  let calls = 0, forwarded;
  globalThis.fetch = async (_url, init) => {
    calls++; forwarded = JSON.parse(init.body);
    return { ok: responseStatus === 200, status: responseStatus, json: async () => ({ content: [] }) };
  };
  process.env.ANTHROPIC_API_KEY = 'unit-test-placeholder';
  const req = {
    method: 'POST', headers: { origin: 'https://shifa.sab.id', 'content-type': 'application/json' },
    socket: { remoteAddress: 'test' },
    body: { model: 'claude-haiku-4-5-20251001', max_tokens: 4000, system: 'test', messages: [{ role: 'user', content: 'test' }] },
    ...overrides,
  };
  const res = {
    headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(v) { this.code = v; return this; },
    json(v) { this.body = v; return this; }, end() { return this; },
  };
  try { await handler(req,res); return { req,res,calls,forwarded,handler }; }
  finally { globalThis.fetch = previousFetch; delete process.env.ANTHROPIC_API_KEY; }
}

test('rejects missing and foreign origins without upstream requests', async () => {
  for (const origin of [undefined, 'https://evil.example']) {
    const x = await invoke({ headers: { origin, 'content-type': 'application/json' } });
    assert.equal(x.res.code,403); assert.equal(x.calls,0);
    assert.equal(x.res.headers['Access-Control-Allow-Origin'],undefined);
  }
});
test('allows preflight and rejects GET and non-JSON requests', async () => {
  assert.equal((await invoke({method:'OPTIONS'})).res.code,204);
  assert.equal((await invoke({method:'GET'})).res.code,405);
  assert.equal((await invoke({headers:{origin:'https://shifa.sab.id','content-type':'text/plain'}})).res.code,415);
});
test('rejects invalid models, token budgets, roles, JSON and oversized payloads', async () => {
  const base = { model:'claude-haiku-4-5-20251001',max_tokens:4000,system:'test',messages:[{role:'user',content:'test'}] };
  for (const body of [{...base,model:'other'}, {...base,max_tokens:4001}, {...base,messages:[{role:'system',content:'x'}]}, '{', {...base,system:'a'.repeat(40_000)}]) {
    const x = await invoke({body}); assert.ok([400,413].includes(x.res.code)); assert.equal(x.calls,0);
  }
});
test('forwards bounded supported fields and hides upstream error details', async () => {
  const x = await invoke();
  assert.equal(x.res.code,200); assert.equal(x.calls,1);
  assert.deepEqual(Object.keys(x.forwarded).sort(),['max_tokens','messages','model','system']);
  const bad = await invoke({},401); assert.equal(bad.res.code,502);
  assert.deepEqual(bad.res.body,{error:'Chat provider unavailable'});
});
test('rate limits repeat requests before calling the provider', async () => {
  const x = await invoke();
  let calls=0; const original=globalThis.fetch;
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({})};};
  process.env.ANTHROPIC_API_KEY='unit-test-placeholder';
  try {
    for(let i=0;i<5;i++) await x.handler(x.req,x.res);
    assert.equal(x.res.code,429); assert.equal(calls,4);
    assert.equal(x.res.headers['Retry-After'],'60');
  } finally { globalThis.fetch=original; delete process.env.ANTHROPIC_API_KEY; }
});
