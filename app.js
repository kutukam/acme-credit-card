import { termsText } from './design-content.js';

// This frontend keeps entered values in memory only. No application, OTP,
// bank login, document, or KYC data is sent to a server.
const main = document.querySelector('#main');
const app = document.querySelector('#application');
const dialog = document.querySelector('#dialog');
const menu = document.querySelector('#app-menu');
const backdrop = document.querySelector('#sheet-backdrop');
const data = {};
let current = 'welcome';
let transitionTimer;
let toastTimer;
let otpNext = 'pan';
let mediaStream = null;
let cameraRequest = 0;
let fileValid = false;
const journey = ['welcome', 'pan', 'aadhaar', 'identity', 'bank', 'qualification', 'professional', 'offer', 'personal', 'additional', 'employment', 'delivery', 'terms', 'kyc', 'video', 'success', 'complete'];

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const plain = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const icon = (name, extra = '') => `<span class="symbol ${extra}" aria-hidden="true">${name}</span>`;
const heading = (title, subtitle = '', large = false) => `<div class="title"><h1${large ? ' class="large"' : ''}>${title}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}</div>`;
const button = (label = 'Next', action = '', options = {}) => `<button class="button ${options.className || ''}" type="${action ? 'button' : 'submit'}" ${action ? `data-action="${action}"` : 'data-submit'} aria-label="${escape(options.aria || plain(label))}" ${options.disabled ? 'disabled' : ''}>${label}${options.arrow === false ? '' : icon('keyboard_arrow_right')}</button>`;
const bottom = (label = 'Next', action = '', options = {}) => `<div class="bottom-action">${button(label, action, options)}</div>`;
const field = (name, label, options = {}) => {
  const value = data[name] ?? '';
  return `<div class="field-wrap ${options.focus ? 'focus-default' : ''}"><label class="field">
    <input name="${name}" aria-label="${escape(options.aria || plain(label))}" aria-describedby="error-${name}" type="${options.type || 'text'}" value="${escape(value)}" placeholder=" " ${options.required ? 'required' : ''} ${options.max ? `maxlength="${options.max}"` : ''} ${options.pattern ? `pattern="${options.pattern}"` : ''} ${options.inputmode ? `inputmode="${options.inputmode}"` : ''} ${options.readonly ? 'readonly' : ''} ${options.autocomplete ? `autocomplete="${options.autocomplete}"` : 'autocomplete="off"'} class="${options.plain ? 'plain' : ''} ${options.uppercase ? 'uppercase' : ''}" ${options.min ? `min="${options.min}"` : ''} ${options.dateMax ? `max="${options.dateMax}"` : ''}>
    <span>${label}</span></label><span id="error-${name}" class="field-error" aria-live="polite"></span></div>`;
};
const select = (name, label, items, required = true) => `<div class="field-wrap"><label class="field select-field"><select name="${name}" aria-label="${label}" ${required ? 'required' : ''}><option value="">Select</option>${items.map(item => `<option value="${escape(item)}" ${data[name] === item ? 'selected' : ''}>${item}</option>`).join('')}</select><span>${label}</span>${icon('expand_more')}</label></div>`;
const check = (name, text, required = false, aria = '') => `<label class="check-label"><input type="checkbox" name="${name}" aria-label="${escape(aria || plain(text))}" ${data[name] ? 'checked' : ''} ${required ? 'required' : ''}><span>${text}</span></label>`;
const toggle = (name, text, aria = '') => `<label class="switch-label"><input type="checkbox" role="switch" name="${name}" aria-label="${escape(aria || plain(text))}" ${data[name] ? 'checked' : ''}><span>${text}</span></label>`;
const choice = (name, value, label = value, showRadio = true) => `<label class="choice ${showRadio ? 'two' : 'names'}"><input type="radio" name="${name}" value="${escape(value)}" aria-label="${escape(plain(label))}" ${data[name] === value ? 'checked' : ''} required>${showRadio ? '<span class="radio-mark" aria-hidden="true"></span>' : ''}<span>${label}</span></label>`;
const cardArt = () => '<figure class="card-art"><img src="./assets/offer-sprite.png" alt="YES Prosperity Rewards Plus RuPay Platinum credit card" width="430" height="996"></figure>';
const appId = () => `<div class="application-id"><span>Application Id:</span><strong>ACME-000002</strong><button class="icon-button" type="button" data-action="copy" aria-label="Copy application ID">${icon('content_copy')}</button></div>`;

function welcome() {
  return `<section class="screen welcome" data-design-node="6031:32555">
    ${heading('Get the best credit cards!', 'Apply for Credit card here')}
    <figure class="welcome-art"><img src="./assets/welcome-sprite.png" alt="An illustrated person carrying colourful credit cards" width="430" height="932"></figure>
    <form class="welcome-form" data-form="welcome" novalidate>
      ${field('mobile', 'Mobile Number', { type: 'tel', inputmode: 'numeric', max: 10, required: true, pattern: '[0-9]{10}', plain: true, focus: true })}
      ${check('mitc', 'I have read and accepted <button type="button" class="text-link" data-action="mitc" aria-label="Read the Most Important Terms and Conditions">Most Important Terms and Conditions (MITC)</button>', true, 'I accept the Most Important Terms and Conditions')}
      ${button('Get OTP', '', { disabled: true })}
    </form>
  </section>`;
}

function pan() {
  return `<section class="screen" data-design-node="6031:32657">${heading('Enter Your PAN', 'Please share your PAN number to continue')}
    <form class="screen-form" data-form="pan" novalidate>${field('pan', 'PAN Number *', { required: true, max: 10, pattern: '.{10}', focus: true, plain: true })}${bottom('Next', '', { disabled: true })}</form></section>`;
}

function aadhaar() {
  return `<section class="screen" data-design-node="6031:32675">${heading('Enter Your Aadhaar', 'Please share your Aadhaar number to continue')}
    <form class="screen-form" data-form="aadhaar" novalidate>${field('aadhaar', 'Aadhaar Number *', { required: true, type: 'tel', inputmode: 'numeric', max: 12, pattern: '[0-9]{12}', focus: true, plain: true })}${bottom('Next', '', { disabled: true })}</form></section>`;
}

function identity() {
  return `<section class="screen" data-design-node="6031:32751"><form class="screen-form" data-form="identity" novalidate>
    <div class="identity-panel"><h2>Your details</h2>
      <div class="row">${field('name', 'Full Name *', { required: true })}${field('identityDob', 'Date of Birth *', { required: true })}</div>
      <label class="field"><textarea name="identityAddress" aria-label="Address *" required autocomplete="off" placeholder=" ">${escape(data.identityAddress || '')}</textarea><span>Address *</span></label>
    </div>
    ${toggle('differentAddress', 'My Current Address is different from Aadhaar')}
    <div class="address-extra" id="address-extra" ${data.differentAddress ? '' : 'hidden'}>
      ${field('address1', 'Address Line 1 *', { required: Boolean(data.differentAddress) })}${field('address2', 'Address Line 2')}${field('pincode', 'Pincode *', { required: Boolean(data.differentAddress), inputmode: 'numeric', max: 6, pattern: '[0-9]{6}' })}
      <div class="row">${field('city', 'City *', { required: Boolean(data.differentAddress) })}${field('state', 'State *', { required: Boolean(data.differentAddress) })}</div>
    </div>${bottom('Next')}</form></section>`;
}

function bank() {
  return `<section class="screen" data-design-node="6031:31711">${heading('Bank Statements', 'Please share your bank statements using any of the following options')}
    <div class="bank-options">
    ${[['account_tree', 'bank-aa', 'Use Account Aggregator', 'Share your banking details by approving consent for your AA ID'], ['account_balance', 'bank-net', 'Use Net-Banking', 'Share your bank statements using your net-banking details'], ['upload_file', 'bank-upload', 'Upload Statements', 'Upload your original bank statements in PDF format']].map(([symbol, action, title, subtitle]) => `<button type="button" class="bank-option" data-action="${action}" aria-label="${escape(title)}">${icon(symbol)}<span><strong>${title}</strong><small>${subtitle}</small></span>${icon('arrow_forward', 'arrow')}</button>`).join('')}
    </div></section>`;
}

function bankAA() {
  return `<section class="screen">${heading('Share your bank statements', 'Securely share your account details with your consent.')}
    <div class="step-dots"><span>Verify</span><span class="active">Select accounts</span><span>Consent</span></div>
    <form class="screen-form" data-form="bank-aa" novalidate><div class="fields">
      ${field('aaId', 'Account Aggregator ID *', { required: true })}
      <div class="bank-account">${check('shareAccount', 'Share my selected bank account', true)}</div>
      ${check('aaConsent', 'I consent to share my bank statements for this credit card application.', true, 'I consent to share my bank statements')}
    </div>${bottom('Approve and Continue', '', { disabled: true })}</form></section>`;
}

function bankNet() {
  return `<section class="screen">${heading('Share Bank Statements', 'Select your bank to continue')}
    <form class="screen-form" data-form="bank-net" novalidate><div class="fields">
      ${select('bankName', 'Bank Name *', ['Acme Bank', 'YES BANK', 'HDFC Bank', 'ICICI Bank', 'State Bank of India'])}
      ${check('netConsent', 'I agree to share my bank statements for this credit card application.', true, 'I agree to share my bank statements')}
    </div>${bottom('Continue', '', { disabled: true })}</form></section>`;
}

function bankUpload() {
  return `<section class="screen">${heading('Upload Bank Statements', 'Please upload your bank statements in PDF format')}
    <form class="screen-form" data-form="bank-upload" novalidate><div class="fields">
      <button type="button" class="upload-area" id="upload-area" data-action="choose-statement" aria-label="Select a PDF statement">${icon('cloud_upload')}<span>Select a PDF statement</span><span class="hint">PDF files up to 10 MB</span></button>
      <input type="file" name="statement" id="statement" accept=".pdf,application/pdf" aria-label="Bank statement PDF" hidden>
      <p id="file-status" class="hint" role="status"></p>
    </div>${bottom('Continue', '', { disabled: true })}</form></section>`;
}

function additional(beforeOffer = false) {
  return `<section class="screen" data-design-node="${beforeOffer ? '6031:31535' : '6031:33527'}">${heading('Enter Additional Details', beforeOffer ? 'Please fill out the form with required details' : 'Please fill out the form with your details', !beforeOffer)}
    <form class="screen-form details-form" data-form="${beforeOffer ? 'qualification' : 'additional'}" novalidate>
      <div class="section-block"><h2>Select your occupation type</h2><div class="choice-grid">${choice('occupation', 'Salaried')}${choice('occupation', 'Self Employed')}</div></div>
      <div class="section-block"><h2>Nominee details</h2>
        ${field('nominee', 'Nominee Name *', { required: true })}${field('nomineeDob', 'Date of Birth *', { required: true })}${select('relation', 'Relationship with Nominee *', ['Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'])}
        ${check('insurance', 'I am giving my consent to avail an insurance coverage and to update above nominee details in bank records', false, 'I consent to the insurance cover and nominee details')}
      </div>
      <div class="section-block"><h2>Self Declarations</h2>${toggle('political', 'I am a political exposed person')}${toggle('politicalRelative', 'I am closely related to a political exposed person')}${toggle('bankRelative', 'I am related to any director / designated employee of the bank')}</div>
      ${bottom(beforeOffer ? 'Save and Continue' : 'Save and Next', '', { disabled: true })}
    </form></section>`;
}

function employment(beforeOffer = false) {
  return `<section class="screen" data-design-node="6031:33181">${heading(beforeOffer ? 'Professional Details' : 'Enter Employment Details', beforeOffer ? 'Please fill out the form with required details' : 'Please fill out the form with your details', !beforeOffer)}
    <form class="screen-form details-form" data-form="${beforeOffer ? 'professional' : 'employment'}" novalidate>
      <div class="section-block">${field('company', 'Company Name *', { required: true })}${field('designation', 'Designation *', { required: true, focus: true })}${field('profession', 'Nature of Profession *', { required: true })}</div>
      <div class="section-block">${field('office1', 'Office Address Line 1 *', { required: true })}${field('office2', 'Office Address Line 2')}${field('officePin', 'Office Pincode *', { required: true, inputmode: 'numeric', max: 6, pattern: '[0-9]{6}' })}
        <div class="row">${field('officeCity', 'City *', { required: true })}${field('officeState', 'State *', { required: true })}</div>
      </div>${bottom(beforeOffer ? 'Save and Continue' : 'Save and Next', '', { disabled: true })}
    </form></section>`;
}

function offer() {
  return `<section class="screen offer" data-design-node="6031:32869">${heading('Card Offer', '', true)}${cardArt()}
    <div><h2 class="card-name">Yes Bank - RuPay Credit</h2><div class="tags"><span class="tag">${icon('stars')}Rewards</span><span class="tag">${icon('local_bar')}Dining</span><span class="tag">${icon('flight_takeoff')}Travel</span></div></div>
    <p class="body-copy">Extra savings, with the Yes Bank RuPay Credit Access tonns of exciting features. <button class="text-link" type="button" data-action="card-details" aria-label="More details about this card">More details</button></p>
    <div class="features"><div class="feature">${icon('stars')}<div><strong>Rewards Points per ₹200</strong><small>On travel and dining</small></div><b>8 Points</b></div><div class="feature">${icon('login')}<div><strong>Joining Fee</strong><small>Waived after spend of 5k in first 30 days</small></div><b><small>₹</small>399</b></div><div class="feature">${icon('refresh')}<div><strong>Renewal Fee</strong><small>Waived after spend of 50k in anniversary year</small></div><b><small>₹</small>399</b></div></div>
    <form class="fields" data-form="offer"><div class="offer-consent">${check('overLimit', 'I am giving my consent to avail an over limit service if I exceed my credit limit for any reason and shall be liable to the fee / charges on Over limit.', false, 'I consent to the over limit service')}</div>${button('Select This Card', '', { arrow: false })}</form>
    </section>`;
}

function personal() {
  return `<section class="screen" data-design-node="6031:32920">${heading('Enter Additional Details', 'Please fill out the form with your details', true)}
    <form class="screen-form details-form" data-form="personal" novalidate>
      <div class="section-block">${field('email', 'Email ID *', { required: true, inputmode: 'email' })}${field('alternate', 'Alternate Mobile Number', { type: 'tel', inputmode: 'numeric', max: 10, pattern: '[0-9]{10}' })}</div>
      <div class="section-block">${field('maidenName', "Mother's Maiden Name *", { required: true })}${select('maritalStatus', 'Marital Status *', ['Single', 'Married', 'Divorced', 'Widowed'])}</div>
      <div class="section-block"><h2>How would you like your name to appear on your credit card?</h2>${field('cardName', 'Name on credit card *', { required: true })}</div>
      ${bottom('Save and Next', '', { disabled: true })}</form></section>`;
}

function delivery() {
  const office = data.delivery === 'Office Address';
  const address = !data.delivery ? '' : office ? [data.office1, data.office2, data.officeCity, data.officeState, data.officePin].filter(Boolean).join(', ') : data.differentAddress ? [data.address1, data.address2, data.city, data.state, data.pincode].filter(Boolean).join(', ') : data.identityAddress;
  return `<section class="screen" data-design-node="6031:33129">${heading('Select Delivery Address', 'Please select address where you want us to deliver your card', true)}
    <form class="screen-form" data-form="delivery"><div class="choice-grid">${choice('delivery', 'Residence Address', 'Residence<br>Address')}${choice('delivery', 'Office Address', 'Office<br>Address')}</div>
      <div class="fields"><p class="body-copy">Your card will be delivered at</p><p class="body-copy" id="delivery-address">${escape(address || (data.delivery ? 'Please enter this address in the previous steps.' : 'Select a delivery address above.'))}</p></div>
      ${bottom('Save and Next')}</form></section>`;
}

function terms() {
  return `<section class="screen terms-screen" data-design-node="6031:33031">${heading('Terms and Conditions', '', true)}<div class="terms-copy"><p>${escape(termsText)}</p></div>
    <form class="fields" data-form="terms">${check('promotions', 'I would like to receive promotional messages and updates via whatsapp, email and sms', false, 'I would like to receive promotional messages')}${button('I Agree and Continue')}</form></section>`;
}

function kyc() {
  return `<section class="screen" data-design-node="6280:26534">${heading('Complete KYC', 'Congratulations! You are just one step away', true)}${appId()}
    <div class="kyc-box"><p>Complete your Video KYC to finish your application. Please keep the following ready:</p><ul class="checklist">
      ${[['badge', 'PAN Card'], ['fingerprint', 'Aadhaar Card'], ['home', 'Be present in India'], ['drive_file_rename_outline', 'A blank paper and pen'], ['videocam', 'A camera and microphone'], ['vpn_lock', 'Turn off your VPN'], ['wifi', 'A stable internet connection']].map(([symbol, text]) => `<li>${icon(symbol)}<span>${text}</span></li>`).join('')}
    </ul></div><div class="fields">${button('Start Video KYC', 'video')}${button('Schedule for Later', 'schedule', { className: 'secondary', arrow: false })}</div></section>`;
}

function video() {
  return `<section class="camera-screen"><video id="camera-video" autoplay playsinline muted aria-label="Your camera preview"></video>
    <div class="camera-empty" id="camera-empty">${icon('videocam')}<h1>Video KYC</h1><p>Keep your face clearly visible and your documents ready.</p>${button('Enable Camera Preview', 'enable-camera', { arrow: false })}<p class="hint" id="camera-status">Allow camera access to see your preview.</p></div>
    <div class="camera-overlay"><span>Video KYC</span></div>
    <div class="camera-controls"><button class="round-button" data-action="toggle-camera" aria-label="Toggle camera" aria-pressed="false">${icon('videocam')}</button><button class="button" data-action="finish-kyc" aria-label="Continue">Continue</button></div></section>`;
}

function success() {
  return `<section class="screen success-screen" data-design-node="6280:26526">${icon('task_alt', 'success-symbol')}<h1>Success!</h1><p class="success-note">You have successfully completed<br>your Video KYC</p>${button('Continue', 'complete')}</section>`;
}

function complete() {
  return `<section class="screen success-screen" data-design-node="6280:26336">${heading('Thank You!', 'Your credit card application is complete!', true)}${cardArt()}${icon('task_alt', 'success-symbol')}<div><p class="body-copy">Credit Card Application Id</p>${appId()}</div>${button('Back to Home', 'restart', { className: 'secondary', arrow: false })}</section>`;
}

const screens = { welcome, pan, aadhaar, identity, bank, 'bank-aa': bankAA, 'bank-net': bankNet, 'bank-upload': bankUpload, qualification: () => additional(true), professional: () => employment(true), offer, personal, additional, employment, delivery, terms, kyc, video, success, complete };

function render(route = current) {
  clearTimeout(transitionTimer);
  if (current === 'video' && route !== 'video') stopCamera();
  current = Object.hasOwn(screens, route) ? route : 'welcome';
  app.classList.toggle('is-welcome', current === 'welcome');
  app.dataset.screen = current;
  main.innerHTML = screens[current]();
  closeMenu();
  document.title = `${main.querySelector('h1')?.textContent || 'Credit Card Application'} | Acme`;
  main.querySelectorAll('form').forEach(validate);
  if (current === 'identity') updateAddressFields();
  if (current === 'bank-upload') { fileValid = false; validate(main.querySelector('form')); }
  main.focus({ preventScroll: true });
  main.scrollTo({ top: 0, behavior: 'instant' });
}

function go(route) {
  if (!Object.hasOwn(screens, route)) return;
  if (!dialog.hidden) closeSheet();
  if (window.location.hash === `#${route}`) render(route);
  else window.location.hash = route;
}

function transition(message, route) {
  clearTimeout(transitionTimer);
  main.innerHTML = `<section class="screen loading-screen" role="status" aria-live="polite"><div class="spinner" aria-hidden="true"></div><p>${escape(message)}</p></section>`;
  transitionTimer = setTimeout(() => go(route), 850);
}

function capture(form) {
  for (const element of form.elements) {
    if (!element.name || element.type === 'file') continue;
    if (element.type === 'checkbox') data[element.name] = element.checked;
    else if (element.type === 'radio') { if (element.checked) data[element.name] = element.value; }
    else data[element.name] = element.value;
  }
}

function validate(form) {
  if (!form) return;
  const submit = form.querySelector('[data-submit]');
  if (!submit) return;
  submit.disabled = !form.checkValidity() || (form.dataset.form === 'bank-upload' && !fileValid);
}

function updateAddressFields() {
  const extra = document.querySelector('#address-extra');
  if (!extra) return;
  extra.hidden = !data.differentAddress;
  extra.querySelectorAll('input').forEach(input => {
    input.disabled = !data.differentAddress;
    input.required = Boolean(data.differentAddress) && input.name !== 'address2';
  });
  validate(extra.closest('form'));
}

function toast(text) {
  clearTimeout(toastTimer);
  const element = document.querySelector('#toast');
  element.textContent = text;
  element.classList.add('visible');
  toastTimer = setTimeout(() => element.classList.remove('visible'), 3500);
}

function openSheet() { backdrop.hidden = false; dialog.hidden = false; }
function closeSheet() { backdrop.hidden = true; dialog.hidden = true; }

function sheet(title, html) {
  dialog.innerHTML = `<div class="sheet-panel"><div class="sheet-top"><button type="button" class="icon-button" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div><h2 id="dialog-title">${title}</h2>${html}</div>`;
  openSheet();
  dialog.querySelectorAll('form').forEach(validate);
}

function showOTP(next) {
  otpNext = next;
  delete data.otp;
  sheet('Enter OTP', `<p class="subtitle">${next === 'identity' ? 'Verify the mobile number linked to your Aadhaar' : `Verify +91 ${escape(data.mobile)}`}</p><form data-form="otp" novalidate>${field('otp', 'Enter 6 digit OTP', { required: true, inputmode: 'numeric', max: 6, pattern: '[0-9]{6}', plain: true, focus: true })}<p class="field-error" id="otp-error" role="alert"></p>${button('Verify OTP', '', { disabled: true })}${button('Resend OTP', 'resend', { className: 'ghost', arrow: false })}</form>`);
  dialog.querySelector('input[name=otp]')?.focus();
}

function closeMenu() {
  menu.hidden = true;
  document.querySelector('[data-action=menu]').setAttribute('aria-expanded', 'false');
}

async function enableCamera() {
  if (mediaStream) return;
  const request = ++cameraRequest;
  const status = document.querySelector('#camera-status');
  if (!navigator.mediaDevices?.getUserMedia) { if (status) status.textContent = 'Camera preview is unavailable. You can continue.'; return; }
  if (status) status.textContent = 'Waiting for camera permission…';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    if (current !== 'video' || request !== cameraRequest) { stream.getTracks().forEach(track => track.stop()); return; }
    mediaStream = stream;
    document.querySelector('#camera-video').srcObject = stream;
    document.querySelector('#camera-empty').hidden = true;
  } catch { if (status) status.textContent = 'Camera access was not enabled. You can continue.'; }
}

function stopCamera() {
  cameraRequest += 1;
  mediaStream?.getTracks().forEach(track => track.stop());
  mediaStream = null;
}

document.addEventListener('input', event => {
  const input = event.target;
  if (['mobile', 'aadhaar', 'alternate', 'pincode', 'officePin', 'otp'].includes(input.name)) input.value = input.value.replace(/[^0-9]/g, '');
  const form = input.closest('form');
  if (!form) return;
  capture(form);
  validate(form);
  const error = form.querySelector(`#error-${input.name}`);
  if (error && input.validity?.valid) { error.textContent = ''; input.closest('.field-wrap')?.classList.remove('is-invalid'); input.removeAttribute('aria-invalid'); }
  if (input.name === 'otp') document.querySelector('#otp-error').textContent = '';
});

document.addEventListener('change', event => {
  const input = event.target;
  const form = input.closest('form');
  if (!form) return;
  capture(form);
  if (input.name === 'differentAddress') updateAddressFields();
  if (input.name === 'delivery') render('delivery');
  if (input.name === 'statement') {
    const file = input.files?.[0];
    fileValid = Boolean(file && /\.pdf$/i.test(file.name) && (!file.type || file.type === 'application/pdf') && file.size <= 10 * 1024 * 1024);
    document.querySelector('#file-status').textContent = fileValid ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB · ready` : 'Please select a PDF file no larger than 10 MB.';
  }
  validate(form);
});

document.addEventListener('focusout', event => {
  const input = event.target;
  if (!input.name || !input.value || !input.validity || input.validity.valid) return;
  const error = document.querySelector(`#error-${input.name}`);
  if (!error) return;
  const messages = { mobile: 'Enter 10 digits.', alternate: 'Enter 10 digits.', pan: 'Enter 10 characters.', aadhaar: 'Enter 12 digits.', pincode: 'Enter 6 digits.', officePin: 'Enter 6 digits.', otp: 'Enter 6 digits.' };
  error.textContent = messages[input.name] || 'Please enter a valid value.';
  input.closest('.field-wrap')?.classList.add('is-invalid');
  input.setAttribute('aria-invalid', 'true');
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  if (!form.reportValidity()) return;
  capture(form);
  switch (form.dataset.form) {
    case 'welcome': showOTP('pan'); break;
    case 'otp':
      closeSheet(); go(otpNext); break;
    case 'pan': go('aadhaar'); break;
    case 'aadhaar': showOTP('identity'); break;
    case 'identity': transition('Fetching your details', 'bank'); break;
    case 'bank-aa': case 'bank-net': transition('Bank statements shared successfully', 'qualification'); break;
    case 'bank-upload': if (fileValid) transition('Bank statements shared successfully', 'qualification'); break;
    case 'qualification': go('professional'); break;
    case 'professional': transition('Getting the best offer for you', 'offer'); break;
    case 'offer': go('personal'); break;
    case 'personal': go('additional'); break;
    case 'additional': go('employment'); break;
    case 'employment': go('delivery'); break;
    case 'delivery': go('terms'); break;
    case 'terms': transition('Processing', 'kyc'); break;
    case 'schedule': closeSheet(); toast(`Video KYC scheduled for ${data.scheduleDate} at ${data.scheduleTime}.`); break;
  }
});

document.addEventListener('click', async event => {
  const element = event.target.closest('[data-action]');
  if (!element) { if (!event.target.closest('#app-menu')) closeMenu(); return; }
  const action = element.dataset.action;
  if (action !== 'menu') closeMenu();
  switch (action) {
    case 'menu': menu.hidden = !menu.hidden; element.setAttribute('aria-expanded', String(!menu.hidden)); if (!menu.hidden) menu.querySelector('button').focus(); break;
    case 'help':
      sheet('How can we help?', `<div class="sheet-copy"><p>Apply for a credit card by verifying your mobile number, confirming your details, and completing KYC.</p><p>You can revisit the previous step using the menu in the top-right corner.</p></div>${button('Continue Application', 'close-dialog', { arrow: false })}`); break;
    case 'mitc': sheet('Most Important Terms and Conditions', `<div class="sheet-copy"><p>Joining fee: ₹399. Renewal fee: ₹399. Rewards: 8 points per ₹200 on travel and dining.</p><p>${escape(termsText)}</p></div>${button('I Understand', 'accept-mitc', { arrow: false })}`); break;
    case 'accept-mitc': data.mitc = true; closeSheet(); render(current); break;
    case 'card-details': sheet('Yes Bank - RuPay Credit', `<div class="sheet-copy"><p>8 reward points per ₹200 on travel and dining.</p><p>Joining fee: ₹399, waived after a spend of ₹5,000 in the first 30 days.</p><p>Renewal fee: ₹399, waived after a spend of ₹50,000 in the anniversary year.</p></div>${button('Continue', 'close-dialog', { arrow: false })}`); break;
    case 'close-dialog': closeSheet(); break;
    case 'back': go(current.startsWith('bank-') ? 'bank' : journey[Math.max(0, journey.indexOf(current) - 1)]); break;
    case 'restart':
      sheet('Start a new application?', `<p class="subtitle">This will clear the details entered in this application.</p>${button('Start Again', 'confirm-restart', { arrow: false })}${button('Keep My Progress', 'close-dialog', { className: 'ghost', arrow: false })}`); break;
    case 'confirm-restart': for (const key of Object.keys(data)) delete data[key]; stopCamera(); fileValid = false; closeSheet(); go('welcome'); break;
    case 'resend': data.otp = ''; dialog.querySelector('input[name=otp]').value = ''; dialog.querySelector('#otp-error').textContent = ''; validate(dialog.querySelector('form')); toast('OTP resent.'); break;
    case 'bank-aa': case 'bank-net': case 'bank-upload': case 'video': case 'complete': go(action); break;
    case 'choose-statement': document.querySelector('#statement').click(); break;
    case 'copy': try { await navigator.clipboard.writeText('ACME-000002'); toast('Application ID copied.'); } catch { toast('Application ID: ACME-000002'); } break;
    case 'schedule': sheet('Schedule Video KYC', `<p class="subtitle">Choose a convenient date and time.</p><form data-form="schedule" novalidate><div class="fields">${field('scheduleDate', 'Date *', { required: true })}${select('scheduleTime', 'Time *', ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'])}</div>${button('Confirm Schedule', '', { disabled: true })}</form>`); break;
    case 'enable-camera': await enableCamera(); break;
    case 'toggle-camera':
      if (!mediaStream) { await enableCamera(); break; }
      { const track = mediaStream.getVideoTracks()[0]; track.enabled = !track.enabled; element.setAttribute('aria-pressed', String(!track.enabled)); element.innerHTML = icon(track.enabled ? 'videocam' : 'videocam_off'); } break;
    case 'finish-kyc': stopCamera(); go('success'); break;
  }
});

backdrop.addEventListener('click', closeSheet);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeMenu(); if (!dialog.hidden) closeSheet(); }
  if (!menu.hidden && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    const items = [...menu.querySelectorAll('button')];
    const index = items.indexOf(document.activeElement);
    items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
  }
});
window.addEventListener('hashchange', () => render(window.location.hash.slice(1)));
window.addEventListener('pagehide', stopCamera);
render(window.location.hash.slice(1) || 'welcome');
