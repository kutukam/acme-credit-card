import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../dist/', import.meta.url);
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
function node() {
  const children = new Map(), attributes = new Map(), classes = new Set(), events = {};
  return {
    children, hidden: true, innerHTML: '', textContent: '',
    style: { setProperty() {} },
    classList: { toggle(key, value) { value ? classes.add(key) : classes.delete(key); }, contains: key => classes.has(key) },
    setAttribute: (key, value) => attributes.set(key, value), getAttribute: key => attributes.get(key),
    querySelector(selector) { if (!children.has(selector)) children.set(selector, node()); return children.get(selector); },
    append(child) { this.child = child; }, appendChild(child) { this.child = child; },
    addEventListener(type, fn) { events[type] = fn; }, fire: type => events[type]?.(),
    getBoundingClientRect: () => ({height: 90}),
  };
}
function environment() {
  const dock = node(), documentElement = node(), events = {}, timers = new Map(); let timerId = 0;
  return {
    dock, events, timers,
    document: { createElement: node, documentElement, querySelector: () => dock },
    window: { location: {search: ''}, addEventListener(type, fn) { events[type] = fn; } },
    URLSearchParams, AbortController,
    setTimeout(fn, delay) { timers.set(++timerId, {fn, delay}); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
}
function assistantFixture({ consent = Promise.resolve('123456'), audioWait = Promise.resolve(), responseOK = true } = {}) {
  const env = environment(), agents = [], audios = [], requests = [];
  let ended = 0, endedListener;
  class BrowserAudioInterface {
    constructor() { this.stops = 0; audios.push(this); }
    async start() { await audioWait; }
    async stop() { this.stops++; }
  }
  class ConversationAgent {
    constructor(options) { this.options = options; this.stops = 0; agents.push(this); }
    async start() { void this.options.audioInterface.start().catch(() => {}); }
    async stop() { this.stops++; this.options.endCallback(); }
  }
  const context = vm.createContext({...env, BrowserAudioInterface, ConversationAgent, InteractionType: {CALL: 'call'},
    ensureAssistance: () => consent, endAssistance: () => { ended++; }, onAssistanceEnded: fn => { endedListener = fn; },
    fetch: async (url, options) => { requests.push({url, options}); return {ok: responseOK, status: 403, json: async () => ({token: 'test-token', user_id: 'test-user', session_id: 'test-session'})}; },
  });
  vm.runInContext(readFileSync(new URL('assistant.js', root), 'utf8').replace(/^import .*;\n/gm, ''), context);
  const mic = env.dock.child.querySelector('.assist__btn');
  return {...env, agents, audios, requests, mic, ended: () => ended, endScreen: () => endedListener('ended_by_user')};
}

test('assistant is inert until clicked and waits for screen consent', async () => {
  const consent = deferred(), f = assistantFixture({consent: consent.promise});
  assert.equal(f.requests.length, 0); f.mic.fire('click'); await flush();
  assert.equal(f.requests.length, 0);
  consent.resolve('654321'); await flush();
  assert.equal(f.requests.length, 1);
  assert.equal(f.agents[0].options.config.agent_variables.cobrowse_code, '654321');
});

test('live state needs server acknowledgement and ready microphone', async () => {
  const audio = deferred(), f = assistantFixture({audioWait: audio.promise});
  f.mic.fire('click'); await flush();
  assert.equal(f.mic.classList.contains('is-live'), false);
  f.agents[0].options.stateCallback('connected'); await flush();
  assert.equal(f.mic.classList.contains('is-live'), false);
  audio.resolve(); await flush();
  assert.equal(f.mic.classList.contains('is-live'), true);
});

test('ending either voice or screen assistance releases both sessions', async () => {
  for (const endFromScreen of [false, true]) {
    const f = assistantFixture(); f.mic.fire('click'); await flush();
    f.agents[0].options.stateCallback('connected'); await flush();
    endFromScreen ? f.endScreen() : f.mic.fire('click'); await flush();
    assert.equal(f.mic.getAttribute('aria-label'), 'Talk to an assistant');
    assert.ok(f.ended() > 0); assert.ok(f.agents[0].stops > 0); assert.ok(f.audios[0].stops > 0);
  }
});

test('a failed connection resets the control for retry', async () => {
  const f = assistantFixture({responseOK: false}); f.mic.fire('click'); await flush();
  assert.equal(f.mic.classList.contains('is-busy'), false); assert.equal(f.agents.length, 0);
  f.mic.fire('click'); await flush(); assert.equal(f.requests.length, 2);
});

test('late microphone permission cannot revive a cancelled call', async () => {
  const audio = deferred(), f = assistantFixture({audioWait: audio.promise});
  f.mic.fire('click'); await flush(); f.mic.fire('click'); await flush();
  const stopsBefore = f.audios[0].stops; audio.resolve(); await flush();
  assert.ok(f.audios[0].stops > stopsBefore);
  f.agents[0].options.stateCallback('connected'); await flush();
  assert.equal(f.mic.classList.contains('is-live'), false);
});

test('remote disconnect and page exit clean up the call', async () => {
  for (const pageExit of [false, true]) {
    const f = assistantFixture(); f.mic.fire('click'); await flush();
    f.agents[0].options.stateCallback('connected'); await flush();
    pageExit ? f.events.pagehide() : f.agents[0].options.telemetryCallback({name: 'ws_disconnected'});
    await flush(); assert.ok(f.agents[0].stops > 0); assert.ok(f.ended() > 0);
  }
});

function cobrowseFixture() {
  const env = environment(), sessions = []; let count = 0;
  const context = vm.createContext({...env,
    fetch: async () => ({ok: true, json: async () => ({key: String(++count).padStart(6, '0')})}),
    CoBrowse: {init: async options => { const handle = {ends: 0, end() {this.ends++;}}; sessions.push({options, handle}); return handle; }},
  });
  const source = readFileSync(new URL('cobrowse.js', root), 'utf8').replace(/^import .*;\n/gm, '').replace(/export function /g, 'function ');
  vm.runInContext(source + '\nglobalThis.api = {ensureAssistance, endAssistance, assistanceCode};', context);
  return {...env, ...context.api, sessions};
}

test('co-browse waits for active socket and keeps its indicator in the dock', async () => {
  const f = cobrowseFixture(); let ready = false;
  const pending = f.ensureAssistance().then(() => {ready = true;}); await flush();
  assert.equal(ready, false); assert.equal(f.assistanceCode(), '');
  assert.equal(f.sessions[0].options.ui.indicator, 'custom');
  f.sessions[0].options.onSessionStart({id:'000001'}); await pending;
  assert.equal(f.assistanceCode(), '000001'); assert.equal(f.dock.child.hidden, false);
});

test('end and retry use a fresh handle and code; declining consent rejects startup', async () => {
  const f = cobrowseFixture(); const pending = f.ensureAssistance(); await flush();
  f.sessions[0].options.onSessionStart({id:'000001'}); await pending;
  f.endAssistance(); await flush();
  assert.ok(f.sessions[0].handle.ends > 0); assert.equal(f.assistanceCode(), '');
  const retry = f.ensureAssistance(); const rejection = assert.rejects(retry, /declined/); await flush();
  assert.equal(f.sessions.length, 2);
  f.sessions[1].options.onError({code:'consent_declined', fatal:false}); await rejection;
  assert.equal(f.assistanceCode(), '');
});
