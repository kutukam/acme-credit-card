# Acme credit card application

Responsive, interactive frontend based on the supplied Figma section:
https://www.figma.com/design/56kjTPayHR1LvNxvlGFoDU/Internal---Universal-PCG-Journeys?node-id=6031-31534

## Run

Serve the `dist` directory with any static HTTP server. No package install or build is required.

```bash
python3 -m http.server 8080 --directory dist
```

Open http://localhost:8080 in a browser. Use an HTTP server rather than opening `index.html` directly, because the application uses JavaScript modules.

## Interaction

Tap an empty text field, date field, or dropdown to fill its prepared value. Existing entered values are preserved and remain editable. The OTP also fills when tapped. Checkboxes and radio choices work normally; tapping the bank-statement area selects the prepared statement. For keyboard use, focus a field and press Enter or Space to fill it.

The prepared values are defined in `prefillValues` in `dist/app.js`. The fixed OTP remains `123456` internally; there is no visible test-code notice, sample-fill menu, or demo banner.

The screens include mobile verification, PAN, Aadhaar, identity/address, three bank-statement choices, occupation and nominee information, employment, card offer, additional details, delivery, terms, scheduling, optional camera preview, and completion. Browser Back/Forward and the previous-step menu preserve values during the current page session.

This is intentionally a frontend demonstration with no real APIs. Entered information remains in JavaScript memory and is cleared on reload. No documents, SMS messages, bank account requests, video, audio, or application submissions are sent to a backend. Camera preview is optional, local, and stopped when the user leaves it. Bank account sharing, OTP verification, scheduling, microphone controls, and KYC completion are simulated. Tapping the statement area selects a prepared file entry without opening or uploading a real file.

## Design fidelity and assets

The 430px content width, 24px margins, 56px header/fields/buttons, 8px input/button corners, Inter typography, Acme branding, and `#0050aa` buttons follow the Figma design. The simulated phone status bar, browser address bar, and home indicator are omitted.

`dist/assets/welcome-sprite.png` and `offer-sprite.png` contain exact exported Figma screen pixels. CSS clips only the original logo, welcome illustration, footer logo, and card artwork. All text, forms, navigation, and controls are real HTML, not screenshot overlays. Using local exported pixels avoids expiring Figma asset links; standalone original-asset downloads were unavailable.

Figma's View-seat extraction quota was reached after five detailed screens and the complete section metadata were retrieved. The remaining forms follow that metadata and the shared extracted components. Bank-provider and later KYC/completion screens use frontend approximations. A valid PAN example replaces a typo in the Figma placeholder.

Google Fonts supplies Inter and the Material Symbols Rounded glyphs named in the design. There are no application dependencies or third-party analytics. The code archive contains the frontend and its assets, with no deployment workflow, credentials, repository history, or hosting account configuration.

## Guided assistance (co-browse)

`@creditnirvana/cobrowse` 0.5.0 is embedded, vendored at `dist/vendor/cobrowse/cobrowse.js`
and started from `dist/cobrowse.js`. A session only begins from a link the assistant sent
— arriving with `?cb=<token>` prompts for consent, and nothing is transmitted until it is
given. `init()` never throws, so the application journey runs identically with assistance
switched off or unreachable.

The assistant receives each visible control's label, role, geometry and whether it is
filled. It never receives values, keystrokes, pixels or a DOM mirror, and it cannot type,
click or navigate — it draws a ring around the control the customer needs next.

`?cbEndpoint=http://localhost:8787` points the SDK at a local worker while a journey flow
is being recorded; unset, it uses the managed endpoint.

Three things in this frontend exist so the assistant can address the journey at all:

- every button, checkbox, switch, radio and bank-statement option carries an explicit
  `aria-label`, because a button's own text includes its Material Symbols glyph
  (`Get OTPkeyboard_arrow_right`);
- `.choice input` covers its pill transparently rather than being a 1×1 `opacity: 0` box,
  which is invisible to the page model — the delivery-address screen had no controls at
  all in it before;
- the header actions, the step menu and the footer carry `data-cobrowse-ignore`, so the
  assistant never points at app chrome.

The PAN caption keeps its example PAN on screen, but the field's `aria-label` is
`PAN Number *`: the SDK redacts PAN-shaped text out of every label before it leaves the
browser, so the printed caption reaches the assistant as asterisks.

The two pre-offer forms submit with **Save and Continue** and the two post-offer forms
with **Save and Next**. The journey shows the same nominee and employment forms twice —
identical field names, identical labels — and one word of button copy is what tells the
two passes apart on the wire.
