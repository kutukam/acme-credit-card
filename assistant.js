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
import { ensureAssistance, endAssistance } from './cobrowse.js';

const WORKER = 'https://cobrowse-do.harshkhandelwal8553.workers.dev';

/* Values from the agent's app-authoring URLs on indus.sarvam.ai. `version` is
   pinned on purpose: Samvaad serves the older committed default when it is
   unset, which presents as a 404 "App not found for the interaction type" or,
   worse, as a different agent answering. Re-pin after every commit. */
const AGENT = {
  orgId: '019ec301-92a0-7a28-846c-b1afafcdf30d',
  workspaceId: '019ec301-92a7-7f33-81f2-14326ae2265e',
  appId: 'Credit-Card-304ce84f-1917',
  version: 1,
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

const wait = ms => new Promise(r => setTimeout(r, ms));

const MIC = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/></svg>';
const BARS = '<span class="assist__bars" aria-hidden="true"><i></i><i></i><i></i></span>';

// The button is the lender's offer of help, not a control of the application
// being filled in, so it stays out of the page model — otherwise the flow could
// ring it and the assistant would talk the customer into pressing itself.
const root = document.createElement('div');
root.className = 'assist';
root.setAttribute('data-cobrowse-ignore', '');
root.innerHTML = `<p class="assist__error" hidden></p>
  <button type="button" class="assist__btn" aria-label="Talk to an assistant" title="Talk to an assistant">${MIC}</button>`;
document.body.appendChild(root);

const button = root.querySelector('.assist__btn');
const errorLine = root.querySelector('.assist__error');

let agent = null;
let state = 'idle';   // idle | connecting | live

function paint(message = '') {
  const live = state === 'live';
  const busy = state === 'connecting';
  button.classList.toggle('is-live', live);
  button.classList.toggle('is-busy', busy);
  button.innerHTML = live ? BARS : MIC;
  const label = live ? 'End assistance' : busy ? 'Connecting' : 'Talk to an assistant';
  button.setAttribute('aria-label', label);
  button.title = label;
  errorLine.textContent = message;
  errorLine.hidden = !message;
  document.documentElement.classList.toggle('is-guided', live);
}

async function stop() {
  const current = agent;
  agent = null;
  state = 'idle';
  paint();
  endAssistance();
  // Never let a stalled teardown freeze the button.
  if (current) { try { await Promise.race([current.stop(), wait(4000)]); } catch { /* already gone */ } }
}

async function start() {
  state = 'connecting';
  paint();
  try {
    // The co-browse session first: the agent reads its code as a variable at
    // connect time, and one created afterwards would arrive too late to be seen.
    const cobrowseCode = await ensureAssistance();

    const res = await fetch(`${WORKER}/api/extension/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `scope` picks which Sarvam org's key the worker injects; this agent
      // lives in its own org and the default key would 404 against it.
      body: JSON.stringify({ scope: 'perfios' }),
    });
    if (!res.ok) throw new Error(`assistant ${res.status}`);
    const s = await res.json();

    agent = new ConversationAgent({
      apiKey: '',
      /* Required for a CALL interaction — without it the SDK refuses to start
         with "audioInterface is required for CALL interactions". It owns the
         microphone and the playback path. */
      audioInterface: new BrowserAudioInterface(),
      baseUrl: `${WORKER}/api/sarvam/`,
      platform: 'browser',
      customHeaders: {
        Authorization: `Bearer ${s.token}`,
        'X-User-Id': s.user_id,
        'X-Session-Id': s.session_id,
      },
      config: {
        org_id: AGENT.orgId,
        workspace_id: AGENT.workspaceId,
        app_id: AGENT.appId,
        version: agentVersion(),
        user_identifier: s.session_id,
        user_identifier_type: 'custom',
        interaction_type: InteractionType.CALL,
        input_sample_rate: 16000,
        output_sample_rate: 16000,
        /* Language, voice and pace belong to the published agent version —
           overriding them here made extension calls behave unlike dashboard
           calls, so nothing is forced. */
        agent_variables: {
          // What lets the agent SEE this screen. Without it every screen tool
          // answers session_not_found and it guides blind.
          cobrowse_code: cobrowseCode,
        },
      },
    });

    // A blocked or undecided mic permission would otherwise sit on
    // "Connecting…" forever.
    await Promise.race([
      agent.start(),
      wait(12000).then(() => { throw new Error('__mic_timeout__'); }),
    ]);
    const live = await agent.waitForConnect(8);
    if (!live) throw new Error('The assistant did not answer. Try again.');
    state = 'live';
    paint();
  } catch (e) {
    const raw = String(e?.message ?? e);
    await stop();
    paint(
      raw === '__mic_timeout__' ? 'Allow microphone access, then tap again.'
      : /failed to fetch/i.test(raw) ? 'Could not reach the assistant service.'
      : raw,
    );
  }
}

button.addEventListener('click', () => {
  if (state === 'connecting') return;
  if (state === 'live') void stop(); else void start();
});

// A call that outlives the page is a call nobody can hang up.
window.addEventListener('pagehide', () => { void agent?.stop(); });

paint();
