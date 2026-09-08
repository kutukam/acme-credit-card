# Acme credit card application

Responsive frontend for the Acme credit-card journey.

## Run

Serve `dist` with any static HTTP server. No package installation or build is needed.

```bash
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. JavaScript modules require HTTP serving rather than opening the file directly.

## Layout and inputs

- The application fills the viewport. Phones use one column; iPads and laptops use wider forms and multiple columns where the content supports them.
- The journey scrolls independently of the header and assistance footer. The microphone owns the bottom-right footer cell. Connection errors take a separate row; dialogs stay above the entire footer, including safe-area padding.
- Every new application starts with empty fields and unselected choices. Focusing, tapping, or pressing a key never inserts sample data. Returning to a previous step preserves only what the visitor entered during this session; reload or Start Again clears it.
- Any six-digit OTP works, including `123456`, `000000`, and `987654`. Mobile numbers accept any 10 digits, Aadhaar any 12 digits, and pincodes any 6 digits. PAN accepts any 10 characters. Other required text fields accept any nonempty text, including email and dates; no server verification or strict format checks apply.
- Identity, nominee, employment, and card-name fields are editable. Address summaries use the visitor's own entries. Bank statements are selected with the device's file picker; no prepared filename is inserted. PDF files up to 10 MB are accepted locally.

The application includes mobile verification, PAN, Aadhaar, identity/address, three bank-statement options, nominee and employment details, the card offer, delivery, terms, scheduling, optional camera preview, and completion. Browser Back/Forward and the previous-step menu work within the journey.

Application submission, OTP verification, bank sharing, scheduling, and KYC completion are frontend simulations. Form data remains in JavaScript memory and is cleared on reload. Camera preview is optional and stops when the visitor leaves the screen. Existing voice and co-browse assistance use the configured services when explicitly started; they are separate from the simulated application flow.

## Assets

Inter typography, Acme branding, the original 56px form controls, and blue buttons retain the visual language of the Figma reference. Phone status bars and browser chrome are omitted. `dist/responsive.css` adapts the original styles to larger screens.

Local Figma sprite exports supply the original logo, welcome illustration, footer branding, and card artwork. Text, fields, navigation, and controls are real HTML. Google Fonts provides Inter and Material Symbols Rounded.

## Guided assistance

The existing integration is preserved in `dist/assistant.js`, `dist/cobrowse.js`, and `dist/vendor/`. Pressing the microphone starts the configured voice assistant and offers a co-browse session. An assistant link with `?cb=<token>` can also offer assistance. The co-browse SDK asks for consent before sharing the page's control structure. Application navigation remains usable when assistance is unavailable.

The worker endpoint, agent identity/version, and vendored SDKs are unchanged. `?v=<number>` overrides the agent version, while `?cbEndpoint=http://localhost:8787` selects a local co-browse worker. No service credentials are added to the frontend.

Voice waits for co-browse consent and an active screen session, then for the bot's connection acknowledgement and microphone readiness. The screen-assistance indicator and End action occupy their own footer row. Cancelling, remote hangup, ending screen assistance, and leaving the page clean up both sessions; retry creates a fresh screen session. Late permission responses cannot revive a cancelled call.

Explicit control labels and `data-cobrowse-ignore` markers are retained. Pre-offer forms use **Save and Continue** and post-offer forms use **Save and Next**, preserving the assistant's navigation cues.

## Checks

```bash
node --test tests/*.test.mjs
node --check dist/app.js
node --check dist/assistant.js
```

The dependency-free tests exercise rendered field constraints and journey handlers using a lightweight document fixture. They do not replace browser layout or live voice-service testing.
