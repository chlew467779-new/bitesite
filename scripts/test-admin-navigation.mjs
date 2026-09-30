/**
 * Admin leave guard: execute the actual TypeScript guard and the form's navigation callbacks.
 * Fake section handles isolate navigation from HTTP/database access. Source assertions cover
 * shell/dialog wiring; browser verification covers rendering and keyboard interaction separately.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const read = async (path) => (await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const guardSource = await read('lib/unsaved-guard.ts');
const formSource = await read('app/admin/components/merchant-form.tsx');
const shellSource = await read('app/admin/components/admin-shell.tsx');
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Select real callback declarations with the TS parser, so the behavioural tests do not maintain
// a second implementation or depend on regex matching balanced braces.
const wanted = new Set(['anyStatus', 'openLeavePrompt', 'cancelLeave', 'leave', 'requestBack', 'finishLeave', 'saveAllAndLeave', 'discardAndLeave']);
const ast = ts.createSourceFile('merchant-form.tsx', formSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'MerchantForm');
const callbacks = component.body.statements.filter((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((decl) => wanted.has(decl.name.getText(ast))));
assert.equal(callbacks.length, wanted.size, 'all navigation callbacks must be tested');
const registration = component.body.statements.find((node) => ts.isExpressionStatement(node) && node.getText(ast).includes('registerLeaveCheck'));
assert.ok(registration, 'the restaurant editor must register its sidebar guard');

function harness(entries = []) {
  const h = { prompt: null, saving: false, navigated: [], back: 0, refreshed: 0, alerts: [], confirms: [], confirmations: true };
  const sandbox = {
    exports: {},
    window: { alert: (message) => h.alerts.push(message), confirm: (message) => { h.confirms.push(message); return h.confirmations; } },
    handles: { current: new Map(entries) }, pendingLeave: { current: null }, savingAllRef: { current: false },
    useCallback: (callback) => callback, useEffect: (effect) => { h.cleanup = effect(); },
    setLeavePrompt: (message) => { h.prompt = message; }, setSavingAll: (value) => { h.saving = value; },
    onSaved: () => { h.refreshed++; }, onBack: () => { h.back++; },
  };
  vm.createContext(sandbox);
  vm.runInContext(transpile(guardSource), sandbox);
  sandbox.registerLeaveCheck = sandbox.exports.registerLeaveCheck;
  vm.runInContext(transpile(`${callbacks.map((node) => node.getText(ast)).join('\n')}\n${registration.getText(ast)}\nexports.form = { ${[...wanted].join(', ')} };`), sandbox);
  return { ...sandbox.exports, h, sandbox };
}

function section(outcome = 'saved', changes = {}) {
  const state = { dirty: true, conflicts: false, pending: false, unknown: false, ...changes };
  const calls = { save: 0, discard: 0 };
  const handle = {
    status: () => ({ ...state }),
    save: async () => { calls.save++; if (outcome === 'saved' || outcome === 'noop') state.dirty = false; return outcome; },
    discard: () => { calls.discard++; if (!state.pending && !state.unknown) { state.dirty = false; state.conflicts = false; } },
  };
  return { state, calls, handle };
}

/* clean, cancel, discard and first requested destination */
{
  const c = harness();
  c.requestLeave(() => c.h.navigated.push('overview'));
  assert.deepEqual(c.h.navigated, ['overview']);
  c.form.requestBack();
  assert.equal(c.h.back, 1);
  assert.equal(c.h.refreshed, 1);
}
{
  const s = section(); const c = harness([['about', s.handle]]);
  c.requestLeave(() => c.h.navigated.push('overview'));
  c.requestLeave(() => c.h.navigated.push('signout'));
  assert.equal(c.h.prompt, '');
  assert.deepEqual(c.h.navigated, []);
  c.form.cancelLeave();
  assert.equal(c.h.prompt, null);
  assert.equal(s.state.dirty, true);
  c.requestLeave(() => c.h.navigated.push('stories'));
  c.form.discardAndLeave();
  assert.deepEqual(c.h.navigated, ['stories'], 'Cancel must clear the old destination');
  assert.equal(s.calls.discard, 1);
  assert.equal(s.calls.save, 0);
}
{
  const s = section(); const c = harness([['about', s.handle]]);
  c.requestLeave(() => c.h.navigated.push('overview'));
  c.requestLeave(() => c.h.navigated.push('signout'));
  await c.form.saveAllAndLeave();
  assert.deepEqual(c.h.navigated, ['overview'], 'repeated sidebar clicks keep the first destination');
}

/* pending / unknown block both navigation and a stale Discard or Save click */
for (const key of ['pending', 'unknown']) {
  const s = section(); const c = harness([['about', s.handle]]);
  c.requestLeave(() => c.h.navigated.push('signout'));
  s.state[key] = true;
  c.form.discardAndLeave();
  await c.form.saveAllAndLeave();
  c.requestLeave(() => c.h.navigated.push('overview'));
  assert.deepEqual(c.h.navigated, []);
  assert.equal(s.calls.save + s.calls.discard, 0);
  assert.equal(c.h.alerts.length, 1);
}

/* sequential section saves, duplicate-click lock, no cancel/discard during a save */
{
  let release;
  const first = section(); const second = section();
  first.handle.save = async () => {
    first.calls.save++; first.state.pending = true;
    await new Promise((resolve) => { release = resolve; });
    first.state.pending = false; first.state.dirty = false; return 'saved';
  };
  const c = harness([['about', first.handle], ['contact', second.handle]]);
  c.requestLeave(() => c.h.navigated.push('signout'));
  const saving = c.form.saveAllAndLeave();
  assert.equal(c.h.saving, true);
  assert.equal(second.calls.save, 0, 'later sections must wait for the earlier section');
  await c.form.saveAllAndLeave();
  c.form.cancelLeave(); c.form.discardAndLeave();
  c.requestLeave(() => c.h.navigated.push('overview'));
  assert.equal(first.calls.save, 1);
  assert.equal(first.calls.discard, 0);
  assert.equal(c.h.prompt, '');
  assert.deepEqual(c.h.navigated, []);
  release(); await saving;
  assert.equal(second.calls.save, 1);
  assert.equal(c.h.saving, false);
  assert.deepEqual(c.h.navigated, ['signout']);
}

/* partial success remains saved; stop on every non-success result; do not touch later sections */
for (const outcome of ['conflict', 'error', 'unknown', 'skipped']) {
  const first = section(); const second = section(outcome); const third = section();
  const c = harness([['about', first.handle], ['contact', second.handle], ['hours', third.handle]]);
  c.form.requestBack(); await c.form.saveAllAndLeave();
  assert.equal(first.state.dirty, false);
  assert.equal(second.state.dirty, true);
  assert.equal(third.calls.save, 0);
  assert.equal(c.h.back, 0);
  assert.equal(c.h.saving, false);
  assert.match(c.h.prompt, /Sections saved before it stay saved/);
}
{
  const s = section('noop'); const c = harness([['about', s.handle]]);
  c.form.requestBack(); await c.form.saveAllAndLeave();
  assert.equal(c.h.back, 1, 'a confirmed noop also permits leaving');
}
{
  const s = section('skipped', { dirty: false, conflicts: true }); const c = harness([['about', s.handle]]);
  c.form.requestBack(); await c.form.saveAllAndLeave();
  assert.equal(s.calls.save, 1, 'unresolved conflicts cannot be treated as a clean section');
  assert.equal(c.h.back, 0);
}
{
  const s = section(); s.handle.save = async () => { throw new Error('unexpected failure'); };
  const c = harness([['about', s.handle]]);
  c.form.requestBack(); await c.form.saveAllAndLeave();
  assert.equal(c.h.saving, false, 'unexpected errors release the UI loop lock');
  assert.equal(s.state.dirty, true);
  assert.equal(c.h.back, 0);
}

/* saved reply with later typing or an independent unconfirmed save must not navigate */
for (const remaining of ['dirty', 'pending', 'unknown', 'conflicts']) {
  const s = section();
  s.handle.save = async () => { s.state.dirty = false; s.state[remaining] = true; return 'saved'; };
  const c = harness([['about', s.handle]]);
  c.requestLeave(() => c.h.navigated.push('overview'));
  await c.form.saveAllAndLeave();
  assert.deepEqual(c.h.navigated, []);
  assert.match(c.h.prompt, /still unsaved or unconfirmed/);
}

/* recheck all registered guards at continuation time; blockers precede native confirmations */
{
  const s = section(); const c = harness([['about', s.handle]]);
  let blocked = false;
  const unregister = c.registerLeaveCheck(() => blocked ? { block: true, message: 'other editor saving' } : null);
  c.requestLeave(() => c.h.navigated.push('overview'));
  blocked = true; c.form.discardAndLeave();
  assert.deepEqual(c.h.navigated, []);
  assert.deepEqual(c.h.alerts, ['other editor saving']);
  unregister(); c.requestLeave(() => c.h.navigated.push('overview'));
  assert.deepEqual(c.h.navigated, ['overview']);
}
{
  const c = harness();
  const removeDirty = c.registerLeaveCheck(() => ({ block: false, message: 'legacy dirty' }));
  const removeBusy = c.registerLeaveCheck(() => ({ block: true, message: 'busy' }));
  c.requestLeave(() => c.h.navigated.push('overview'));
  assert.equal(c.h.confirms.length, 0, 'a native discard choice cannot bypass another blocker');
  removeBusy(); c.h.confirmations = false;
  c.requestLeave(() => c.h.navigated.push('overview'));
  assert.deepEqual(c.h.navigated, []);
  c.h.confirmations = true; c.requestLeave(() => c.h.navigated.push('overview'));
  assert.deepEqual(c.h.navigated, ['overview']);
  removeDirty(); c.h.cleanup();
}

/* UI and API wiring, including the shared mobile sidebar */
assert.match(shellSource, /requestLeave\(\(\) => \{\s*onTabChange\(tab\);\s*setSidebarOpen\(false\);/);
assert.match(shellSource, /requestLeave\(\(\) => \{\s*setSidebarOpen\(false\);\s*logout\(\);/);
assert.doesNotMatch(shellSource, /confirmLeave/);
assert.match(formSource, /prompt: openLeavePrompt/);
assert.match(formSource, /disabled=\{savingAll\} onClick=\{cancelLeave\}/);
assert.match(formSource, /disabled=\{savingAll\} onClick=\{discardAndLeave\}/);
assert.match(formSource, /aria-modal="true" aria-labelledby="leave-title"/);
assert.match(formSource, /z-\[60\]/, 'the dialog must render above the mobile sidebar');
assert.match(formSource, /event\.key === 'Escape'/);
assert.match(formSource, /button:not\(:disabled\)/, 'keyboard focus stays in the dialog');
assert.doesNotMatch(formSource, /method: 'PUT'|force[Ss]ave/);
console.log('Admin navigation behaviour and wiring checks passed');
import './test-admin-nav-groups.mjs';
