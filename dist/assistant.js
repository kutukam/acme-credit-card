/**
 * The help button.
 *
 * A small control on the page: press it and the Acme voice assistant joins,
 * opens a co-browse session so it can see the structure of this screen, and
 * guides the rest of the application.
 *
 * The Sarvam API key NEVER reaches this bundle. The page asks the worker for a
 * short-lived session token and sends every runtime call through
 * /api/sarvam/*, which injects the key server-side — the same path the Chrome
 * extension and the personal-loan journey use. A key in a public page's
 * JavaScript is a key anyone can spend.
 */
import { BrowserAudioInterface, ConversationAgent, InteractionType } from './vendor/sarvam/sarvam.browser.js';
import { ensureAssistance, endAssistance, onAssistanceEnded } from './cobrowse.js';

const WORKER = 'https://cobrowse-do.harshkhandelwal8553.workers.dev';

/* Values from the agent's app-authoring URLs on indus.sarvam.ai. `version` is
   pinned on purpose: Samvaad serves the older committed default when it is
   unset, which presents as a 404 "App not found for the interaction type" or,
   worse, as a different agent answering. Re-pin after every commit. */
const AGENT = {
  orgId: '019ec301-92a0-7a28-846c-b1afafcdf30d',
  workspaceId: '019ec301-92a7-7f33-81f2-14326ae2265e',
  appId: 'Credit-Card-304ce84f-1917',
  version: 4,
};

/* Committing on the dashboard mints a NEW version, and a pin left behind keeps
   serving the old one — the tools you just fixed sit in v2 while the page still
   calls v1, and it fails exactly as it did before, which reads as "the fix did
   nothing". ?v=2 overrides the pin so a commit can be tested without a
   redeploy; a plain visit still gets the constant above. */
function agentVersion() {
  const v = Number(new URLSearchParams(window.location.search).get('v'));
  return Number.isInteger(v) && v > 0 ? v : AGENT.version;
}

function deadline(promise, milliseconds, message) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

const MIC = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>';
const BARS = '<span class="assist__bars" aria-hidden="true"><i></i><i></i><i></i></span>';
const root = document.createElement('div');
root.className = 'assist';
root.setAttribute('data-cobrowse-ignore', '');
root.innerHTML = `<p class="assist__error" role="status" hidden></p>
  <button type="button" class="assist__btn" aria-label="Talk to an assistant" aria-pressed="false">${MIC}</button>`;
const dock = document.querySelector('.app-footer');
dock.appendChild(root);
const updateDockHeight = () => document.documentElement.style.setProperty('--dock-height', `${dock.getBoundingClientRect().height}px`);
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateDockHeight).observe(dock);
else window.addEventListener('resize', updateDockHeight);
updateDockHeight();

const button = root.querySelector('.assist__btn');
const errorLine = root.querySelector('.assist__error');
let agent = null, audio = null, controller = null, attempt = 0;
let state = 'idle';

function paint(message = '') {
  const live = state === 'live', busy = state === 'connecting';
  button.classList.toggle('is-live', live);
  button.classList.toggle('is-busy', busy);
  button.innerHTML = live ? BARS : MIC;
  button.setAttribute('aria-label', live ? 'End assistance' : busy ? 'Cancel connecting' : 'Talk to an assistant');
  button.setAttribute('aria-pressed', String(live));
  errorLine.textContent = message;
  errorLine.hidden = !message;
  document.documentElement.classList.toggle('is-guided', live);
}

async function stop(message = '') {
  attempt += 1;
  const previous = agent, previousAudio = audio;
  agent = null; audio = null;
  controller?.abort(); controller = null;
  state = 'idle';
  paint(message);
  endAssistance();
  // Clear ownership before stopping; SDK end callbacks cannot stop a new call.
  await Promise.allSettled([
    deadline(Promise.resolve().then(() => previous?.stop()), 4000, 'Call cleanup timed out.'),
    deadline(Promise.resolve().then(() => previousAudio?.stop()), 4000, 'Audio cleanup timed out.'),
  ]);
}

async function start() {
  const run = ++attempt;
  const abort = controller = new AbortController();
  state = 'connecting';
  paint();
  try {
    const cobrowseCode = await ensureAssistance();
    if (run !== attempt) return;
    const response = await deadline(fetch(`${WORKER}/api/extension/session`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'perfios' }), signal: abort.signal,
    }), 12000, 'The assistant service did not respond. Please try again.');
    if (!response.ok) throw new Error(`The assistant service is unavailable (${response.status}).`);
    const session = await response.json();
    if (run !== attempt) return;
    if (!session.token || !session.user_id || !session.session_id) throw new Error('The assistant service returned an incomplete session.');

    const acknowledged = deferred(), microphoneReady = deferred();
    // A permission response may arrive after cancellation or timeout. Release
    // that late stream before it can be used by an abandoned call.
    class SessionAudio extends BrowserAudioInterface {
      async start(...args) {
        try {
          await super.start(...args);
          if (run !== attempt) { await super.stop(); return; }
          microphoneReady.resolve();
        } catch (error) { microphoneReady.reject(error); throw error; }
      }
    }
    const currentAudio = audio = new SessionAudio();
    const candidate = new ConversationAgent({
      apiKey: '', audioInterface: currentAudio,
      baseUrl: `${WORKER}/api/sarvam/`, platform: 'browser',
      customHeaders: {
        Authorization: `Bearer ${session.token}`,
        'X-User-Id': session.user_id, 'X-Session-Id': session.session_id,
      },
      config: {
        org_id: AGENT.orgId, workspace_id: AGENT.workspaceId,
        app_id: AGENT.appId, version: agentVersion(),
        user_identifier: session.session_id, user_identifier_type: 'custom',
        interaction_type: InteractionType.CALL,
        input_sample_rate: 16000, output_sample_rate: 16000,
        agent_variables: { cobrowse_code: cobrowseCode },
      },
      stateCallback(next) {
        if (run !== attempt) return;
        if (['connected', 'listening', 'speaking'].includes(next)) acknowledged.resolve();
        if (next === 'error') {
          acknowledged.reject(new Error('Could not connect to the assistant. Please try again.'));
          if (state === 'live') void stop('The assistant disconnected. Tap the microphone to reconnect.');
        }
      },
      telemetryCallback(event) {
        if (run !== attempt || event.name !== 'ws_disconnected') return;
        acknowledged.reject(new Error('The assistant disconnected. Please try again.'));
        if (state === 'live') void stop('The assistant disconnected. Tap the microphone to reconnect.');
      },
      endCallback() {
        if (run !== attempt) return;
        acknowledged.reject(new Error('The assistant ended the connection.'));
        void stop();
      },
    });
    agent = candidate;
    const started = candidate.start();
    started.then(() => {
      if (run !== attempt) void candidate.stop().catch(() => {});
    }, () => {});
    // waitForConnect() in the vendored SDK can resolve for a socket that is
    // still connecting. Require the server acknowledgement AND ready audio.
    await deadline(Promise.all([started, acknowledged.promise, microphoneReady.promise]), 20000, 'Connection timed out. Allow microphone access, then try again.');
    if (run !== attempt) return;
    state = 'live';
    paint();
  } catch (error) {
    if (run !== attempt) return;
    const message = error?.name === 'NotAllowedError' ? 'Allow microphone access, then tap again.'
      : /failed to fetch/i.test(String(error?.message)) ? 'Could not reach the assistant service.'
      : String(error?.message || 'Could not start assistance. Please try again.');
    await stop(message);
  }
}

button.addEventListener('click', () => {
  if (state === 'idle') void start(); else void stop();
});
onAssistanceEnded(reason => {
  if (state !== 'idle') void stop(reason === 'ended_by_user' || reason === 'completed' ? '' : 'Screen assistance ended. Tap the microphone to reconnect.');
});
window.addEventListener('pagehide', () => { void stop(); });
paint();
