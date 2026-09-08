/**
 * Guided assistance shares control structure only, after the SDK's consent.
 * Voice startup waits for onSessionStart, rather than init() resolving.
 */
import CoBrowse from './vendor/cobrowse/cobrowse.js';

const WORKER = 'https://cobrowse-do.harshkhandelwal8553.workers.dev';
const SITE = 'acme-credit-card';
const params = new URLSearchParams(window.location.search);
const endpoint = params.get('cbEndpoint') || undefined;
const debug = params.get('cbDebug') === '1';
const linkRef = params.get('cb') || '';
const endListeners = new Set();
let connection = null;

const status = document.createElement('div');
status.className = 'assist__status';
status.setAttribute('data-cobrowse-ignore', '');
status.hidden = true;
status.innerHTML = '<span role="status">Screen assistance is active</span><button type="button" class="text-link" aria-label="End screen assistance">End</button>';
document.querySelector('.app-footer').append(status);
status.querySelector('button').addEventListener('click', () => endAssistance());

export function assistanceCode() {
  return connection?.active ? connection.code : '';
}

export function onAssistanceEnded(listener) {
  endListeners.add(listener);
  return () => endListeners.delete(listener);
}

function finish(session, reason, message = '') {
  if (!session || session.finished) return;
  session.finished = true;
  clearTimeout(session.timer);
  session.controller.abort();
  session.reject(new Error(message || 'Screen assistance ended.'));
  if (connection === session) {
    connection = null;
    status.hidden = true;
    for (const listener of endListeners) listener(reason);
  }
  // init() is asynchronous. Ending before it resolves must still clean up.
  Promise.resolve(session.handlePromise).then(handle => handle?.end(reason)).catch(() => {});
}

function createConnection(token = '') {
  const session = { code: token.split('_')[0], active: false, finished: false, controller: new AbortController() };
  session.ready = new Promise((resolve, reject) => { session.resolve = resolve; session.reject = reject; });
  session.ready.catch(() => {}); // Link-started sessions have no voice waiter yet.
  connection = session;
  session.timer = setTimeout(() => finish(session, 'timeout', 'Screen assistance timed out. Please try again.'), 60000);
  void (async () => {
    try {
      let sessionToken = token;
      if (!sessionToken) {
        const response = await fetch(`${WORKER}/api/session`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ site: SITE }), signal: session.controller.signal,
        });
        if (!response.ok) throw new Error(`Screen assistance is unavailable (${response.status}).`);
        const payload = await response.json();
        sessionToken = String(payload.key || payload.sessionId || '');
        if (!sessionToken) throw new Error('The service did not return an assistance session.');
        session.code = sessionToken.split('_')[0];
      }
      if (session.finished) return;
      session.handlePromise = CoBrowse.init({
        tenant: 'perfios', endpoint, debug,
        linkParam: token ? 'cb' : null,
        ...(token ? {} : { sessionToken }),
        // The SDK's floating badge would cover the microphone. Its status and
        // End action live in the reserved footer row instead.
        ui: { indicator: 'custom' },
        onSessionStart(info) {
          if (session.finished) {
            Promise.resolve(session.handlePromise).then(handle => handle?.end('cancelled'));
            return;
          }
          session.active = true;
          session.code = String(info?.id || session.code);
          clearTimeout(session.timer);
          status.querySelector('span').textContent = 'Screen assistance is active';
          status.hidden = false;
          session.resolve(session.code);
        },
        onSessionRecovered() {
          if (!session.finished) status.querySelector('span').textContent = 'Screen assistance is active';
        },
        onSessionDegraded() {
          if (!session.finished) status.querySelector('span').textContent = 'Reconnecting screen assistance…';
        },
        onSessionEnd(info) { finish(session, info?.reason || 'ended'); },
        onError(error) {
          if (error?.fatal || error?.code === 'consent_declined') finish(session, error.code, error.code === 'consent_declined' ? 'Screen assistance was declined. Tap the microphone to try again.' : 'Could not connect screen assistance. Please try again.');
        },
      });
      const handle = await session.handlePromise;
      if (session.finished) handle?.end('cancelled');
    } catch (error) {
      finish(session, 'failed', error?.name === 'AbortError' ? 'Screen assistance ended.' : String(error?.message || 'Could not connect screen assistance.'));
    }
  })();
  return session;
}

export function ensureAssistance() {
  return (connection || createConnection(linkRef)).ready;
}

export function endAssistance() {
  finish(connection, 'ended_by_user');
}

/* Deliberately not connecting here. An assistant's ?cb= link supplies the session
   reference but does not start assistance: ensureAssistance() picks it up when the
   customer presses the microphone, so the page never highlights itself unprompted. */
window.addEventListener('pagehide', endAssistance);
window.CoBrowse = CoBrowse;
