import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('dist/app.js', root), 'utf8');
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m => [m[1], m[2] ?? '']));
const fields = html => [...html.matchAll(/<input\b([^>]+)>/g)].map(m => attrs(m[1]));
const allows = (field, value) => (!('required' in field) || value.length > 0) && (!value || ((!field.maxlength || value.length <= Number(field.maxlength)) && (!field.pattern || new RegExp(`^(?:${field.pattern})$`, 'u').test(value))));

// Source and handler fixture only; this does not simulate browser layout.
function fixture() {
  const listeners = {};
  const node = () => ({
    hidden: true, innerHTML: '', dataset: {}, style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, removeAttribute() {}, focus() {}, scrollTo() {},
    querySelectorAll: () => [], querySelector: () => null, addEventListener() {},
  });
  const main = node(), app = node(), dialog = node(), menu = node(), backdrop = node(), menuButton = node();
  const nodes = { '#main': main, '#application': app, '#dialog': dialog, '#app-menu': menu, '#sheet-backdrop': backdrop, '[data-action=menu]': menuButton };
  const location = { hash: '' };
  const context = vm.createContext({
    document: { querySelector: selector => nodes[selector] || null, addEventListener: (type, fn) => (listeners[type] ||= []).push(fn) },
    window: { location, addEventListener() {} }, navigator: {}, clearTimeout() {}, setTimeout() {}, console,
  });
  const runnable = source.replace(/^import .*;\n/m, 'const termsText = "Terms";\n').replace("render(window.location.hash.slice(1) || 'welcome');", '');
  vm.runInContext(runnable + '\nglobalThis.api = {screens, data, showOTP, render, capture};', context);
  return { ...context.api, main, dialog, location,
    emit: async (type, target, extra = {}) => { for (const fn of listeners[type] || []) await fn({ target, preventDefault() {}, ...extra }); }
  };
}

test('new text fields, textareas, and selections are empty', () => {
  const f = fixture();
  for (const [name, screen] of Object.entries(f.screens)) {
    const html = screen();
    for (const field of fields(html).filter(x => !['radio', 'checkbox', 'file'].includes(x.type))) assert.equal(field.value, '', `${name}: ${field.name}`);
    assert.doesNotMatch(html, /<input[^>]+\bchecked\b|<option[^>]+\bselected\b/, name);
    for (const textarea of html.matchAll(/<textarea[^>]*>(.*?)<\/textarea>/gs)) assert.equal(textarea[1], '', name);
  }
});

test('length checks accept leading zeroes and arbitrary PAN characters', () => {
  const f = fixture();
  for (const [screen, name, a, b, length] of [
    ['welcome', 'mobile', '0000000000', '9876543210', 10],
    ['aadhaar', 'aadhaar', '000000000000', '111111111111', 12],
    ['pan', 'pan', '1234567890', 'ab!@#$%^&*', 10],
    ['employment', 'officePin', '000000', '111111', 6],
    ['personal', 'alternate', '0000000000', '1234567890', 10],
  ]) {
    const field = fields(f.screens[screen]()).find(x => x.name === name);
    assert.ok(allows(field, a), name); assert.ok(allows(field, b), name);
    assert.equal(allows(field, '1'.repeat(length - 1)), false, name);
    assert.equal(allows(field, '1'.repeat(length + 1)), false, name);
  }
});

test('email, names and dates accept arbitrary text', () => {
  const f = fixture();
  for (const screen of ['identity', 'personal', 'additional', 'employment', 'bank-aa']) {
    for (const field of fields(f.screens[screen]()).filter(x => !['radio', 'checkbox'].includes(x.type) && !x.pattern)) {
      assert.equal(field.type, 'text', field.name);
      assert.ok(!('readonly' in field), field.name);
      assert.ok(allows(field, 'anything'), field.name);
    }
  }
});

test('every complete six-digit OTP advances both OTP steps', async () => {
  for (const next of ['pan', 'identity']) for (const otp of ['123456', '000000', '987654', '111111']) {
    const f = fixture(); f.showOTP(next);
    const field = fields(f.dialog.innerHTML).find(x => x.name === 'otp');
    await f.emit('submit', { dataset: { form: 'otp' }, elements: [{ name: 'otp', type: 'text', value: otp }], reportValidity: () => allows(field, otp) });
    assert.equal(f.location.hash, next);
  }
});

test('an incomplete OTP cannot advance', async () => {
  const f = fixture(); f.showOTP('pan');
  const field = fields(f.dialog.innerHTML).find(x => x.name === 'otp');
  for (const otp of ['', '12345', '1234567']) {
    await f.emit('submit', { dataset: { form: 'otp' }, elements: [], reportValidity: () => allows(field, otp) });
    assert.equal(f.location.hash, '');
  }
});

test('tapping or keyboard focus does not insert prepared values', async () => {
  const f = fixture(); const input = { value: '', name: 'mobile', closest: () => null };
  await f.emit('pointerdown', input); await f.emit('click', input); await f.emit('keydown', input, { key: 'Enter' });
  assert.equal(input.value, ''); assert.deepEqual(Object.keys(f.data), []);
});

test('entered data is reused and escaped; restart clears everything', async () => {
  const f = fixture();
  Object.assign(f.data, { name: 'My own name', identityAddress: '<test & address>', delivery: 'Residence Address' });
  assert.match(f.screens.identity(), /value="My own name"/);
  assert.match(f.screens.delivery(), /&lt;test &amp; address&gt;/);
  const action = { dataset: { action: 'confirm-restart' } }; action.closest = () => action;
  await f.emit('click', action);
  assert.deepEqual(Object.keys(f.data), []); assert.equal(f.location.hash, 'welcome');
});

test('bank upload offers a real file input without a prepared statement entry', () => {
  const html = fixture().screens['bank-upload']();
  assert.ok(fields(html).some(x => x.type === 'file' && x.name === 'statement'));
  assert.doesNotMatch(html, /bank-statement\.pdf|240 KB/);
});

test('local entry scripts, styles and assets exist', () => {
  const html = readFileSync(new URL('dist/index.html', root), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) assert.ok(existsSync(new URL('dist/' + match[1], root)), match[1]);
});
