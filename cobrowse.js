/**
 * Guided assistance (co-browse).
 *
 * The assistant sees the STRUCTURE of this page — each visible control's label,
 * role, geometry and whether it is filled — and never its contents. It cannot
 * type, click or navigate; it draws a ring around the control the customer needs
 * next, and the customer does the rest.
 *
 * There are two ways a session starts, and the difference matters:
 *
 *   ?cb=<token> in the URL — the assistant sent the customer this link, so the
 *   session already exists and belongs to the tenant that created it. Assistance
 *   offers itself the moment the page loads.
 *
 *   The help button on this page — nobody sent a link, so the page asks the
 *   service for a session of its own. Nothing happens until the customer presses
 *   the button, and consent is still asked for before anything is transmitted.
 *
 * init() never throws and never rejects, so a co-browse outage cannot take the
 * application journey down with it.
 *
 * ?cbEndpoint=http://localhost:8787 points the SDK at a local worker while a
 * journey flow is being recorded. Unset, it uses the managed endpoint.
 */
import CoBrowse from './vendor/cobrowse/cobrowse.js';

const WORKER = 'https://cobrowse-do.harshkhandelwal8553.workers.dev';
const SITE = 'acme-credit-card';

const params = new URLSearchParams(window.location.search);
const endpoint = params.get('cbEndpoint') || undefined;
const debug = params.get('cbDebug') === '1';
const linkRef = params.get('cb') || '';

let handle = null;
let code = linkRef.split('_')[0] || '';

// Arriving on an assistant-sent link: start straight away, exactly as before.
if (linkRef) {
  handle = CoBrowse.init({ tenant: 'perfios', endpoint, linkParam: 'cb', debug });
}

/** The six-digit code that names this session, or "" if there isn't one yet. */
export function assistanceCode() {
  return code;
}

/**
 * Make sure a co-browse session exists, and return its code.
 *
 * Called by the help button, so a customer who was never sent a link can still
 * be guided. `POST /api/session` needs no API key — it only creates an empty
 * session bound to a published site, and the visitor still has to consent before
 * one byte of page structure is sent. The API key stays on the server, which is
 * the whole reason this endpoint is separate from the one that mints links.
 */
export async function ensureAssistance() {
  if (code) return code;
  const res = await fetch(`${WORKER}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ site: SITE }),
  });
  if (!res.ok) throw new Error(`session ${res.status}`);
  const s = await res.json();
  code = String(s.key || s.sessionId || '');
  if (!code) throw new Error('no session code');
  // A token (rather than a link) is the other thing init() will start on, so
  // this both creates the session and offers assistance for it.
  handle = CoBrowse.init({ tenant: 'perfios', endpoint, linkParam: null, sessionToken: code, debug });
  return code;
}

/** End assistance along with the call, so the ring does not outlive the agent. */
export function endAssistance() {
  try { handle?.end('agent_ended'); } catch { /* already gone */ }
}

// Authoring aid: CoBrowse.__scanForTest() prints the labels the assistant would
// see for the screen currently rendered. It starts nothing and transmits nothing.
window.CoBrowse = CoBrowse;
