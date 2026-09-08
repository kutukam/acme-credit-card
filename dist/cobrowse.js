/**
 * Guided assistance (co-browse).
 *
 * The assistant sees the STRUCTURE of this page — each visible control's label,
 * role, geometry and whether it is filled — and never its contents. It cannot
 * type, click or navigate; it draws a ring around the control the customer needs
 * next, and the customer does the rest.
 *
 * A session only ever starts from a link the assistant sent: arriving with
 * ?cb=<token> prompts for consent, and nothing is transmitted until it is given.
 * init() never throws and never rejects, so a co-browse outage cannot take the
 * application journey down with it.
 *
 * ?cbEndpoint=http://localhost:8787 points the SDK at a local worker while a
 * journey flow is being recorded and authored. Unset, it uses the managed
 * endpoint. Nothing else about the app changes.
 */
import CoBrowse from './vendor/cobrowse/cobrowse.js';

const params = new URLSearchParams(window.location.search);
const endpoint = params.get('cbEndpoint') || undefined;

CoBrowse.init({
  tenant: 'perfios',
  endpoint,
  linkParam: 'cb',
  debug: params.get('cbDebug') === '1',
});

// Authoring aid: CoBrowse.__scanForTest() prints the labels the assistant would
// see for the screen currently rendered — the labels a journey flow is written
// against. It starts nothing and transmits nothing.
window.CoBrowse = CoBrowse;
