// Executes the real TypeScript route handlers with mocked provider I/O.
// Database transactions/role boundaries are covered separately by the SQL suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { validateCredentials, validateRestaurantDraft } from '../lib/merchant-auth-validation.mjs';
import { MERCHANT_TERMS_VERSION } from '../lib/merchant-terms.mjs';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
const load = (file, mocks = {}) => {
  const output = ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports,process){${output}\n})`)(name => mocks[name] ?? require(name), loaded, loaded.exports, process);
  return loaded.exports;
};
const bounded = load('lib/bounded-json.ts');
const validation = { validateCredentials, validateRestaurantDraft };
let gate, finished, auth, calls, authenticated, createResult;
function reset() {
  gate = { data: { allowed: true, ticket: 'ticket' }, error: null };
  finished = { data: { accepted: true, retry_after: 0 }, error: null };
  auth = { data: { user: { email_confirmed_at: '2026-09-27' }, session: { access_token: 'local-access', refresh_token: 'local-refresh' } }, error: null };
  authenticated = { user: { id: 'verified-owner', email_confirmed_at: '2026-09-27', is_anonymous: false } };
  createResult = { data: { id: 'created-draft' }, error: null }; calls = [];
  process.env.NODE_ENV = 'development'; delete process.env.VERCEL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:55321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-public-key';
}
const admin = { rpc: async (name, args) => { calls.push({ name, args }); return name.endsWith('_begin') ? gate : name.endsWith('_finish') ? finished : createResult; } };
const passwordRoute = load('app/api/auth/password/route.ts', {
  '@/lib/supabase-admin': { supabaseAdmin: admin }, '@/lib/bounded-json': bounded,
  '@/lib/merchant-auth-validation.mjs': validation,
  '@supabase/supabase-js': { createClient: () => ({ auth: { signInWithPassword: async input => { calls.push({ name: 'password', input }); if (auth instanceof Error) throw auth; return auth; } } }) },
});
const restaurantRoute = load('app/api/merchant/restaurants/route.ts', {
  '@/lib/supabase-admin': { supabaseAdmin: admin }, '@/lib/bounded-json': bounded,
  '@/lib/merchant-auth-validation.mjs': validation,
  '@/lib/merchant-terms.mjs': { MERCHANT_TERMS_VERSION },
  '@/app/api/merchant/_lib/merchant-access': {
    requireMerchantUser: async () => authenticated,
    merchantErrorResponse: (status, code, error) => NextResponse.json({ code, error }, { status }),
  },
});
const req = (path, body, headers = {}) => new NextRequest(`http://localhost:3301${path}`, { method: 'POST', headers: { origin: 'http://localhost:3301', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const credentials = { email: 'owner@example.test', password: 'correct password' };
const password = () => passwordRoute.POST(req('/api/auth/password', credentials));
reset(); let response = await password(); assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.equal((await response.json()).session.access_token, 'local-access');
assert.equal(calls.at(-1).args.p_outcome, 'success');
reset(); response = await passwordRoute.POST(req('/api/auth/password', credentials, { origin: 'https://foreign.example' })); assert.equal(response.status, 403); assert.equal(calls.length, 0);
reset(); response = await passwordRoute.POST(req('/api/auth/password', { email: 'bad', password: '' })); assert.equal(response.status, 400); assert.equal(calls.length, 0);
reset(); gate = { data: { allowed: false, retry_after: 899 }, error: null }; response = await password(); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '899'); assert.equal(calls.length, 1);
reset(); gate.error = {}; response = await password(); assert.equal(response.status, 503); assert.equal(calls.length, 1);
reset(); auth = { data: { user: null, session: null }, error: { code: 'invalid_credentials' } }; response = await password(); assert.equal(response.status, 401); assert.equal(calls.at(-1).args.p_outcome, 'failure');
reset(); auth = { data: { user: null, session: null }, error: { code: 'invalid_credentials' } }; finished.data.retry_after = 900; response = await password(); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '900');
reset(); auth.error = { code: 'email_not_confirmed' }; response = await password(); assert.equal(response.status, 401); assert.equal(calls.at(-1).args.p_outcome, 'other');
reset(); auth.data.user.email_confirmed_at = null; response = await password(); assert.equal(response.status, 401); assert.ok(!(await response.json()).session);
reset(); auth = new Error('network'); response = await password(); assert.equal(response.status, 503); assert.equal(calls.at(-1).args.p_outcome, 'other');
reset(); finished.error = {}; response = await password(); assert.equal(response.status, 503); assert.ok(!(await response.json()).session);
reset(); finished.data.accepted = false; response = await password(); assert.equal(response.status, 503);
reset(); process.env.NODE_ENV = 'production'; response = await password(); assert.equal(response.status, 503); assert.equal(calls.length, 0);
reset(); process.env.NODE_ENV = 'production'; process.env.VERCEL = '1'; response = await password(); assert.equal(response.status, 503);
reset(); process.env.NODE_ENV = 'production'; process.env.VERCEL = '1'; response = await passwordRoute.POST(req('/api/auth/password', credentials, { 'x-vercel-forwarded-for': '203.0.113.1', 'x-forwarded-for': 'forged' })); assert.equal(response.status, 200); assert.match(calls[0].args.p_source, /^[0-9a-f]{64}$/);
const draft = { name: 'New restaurant', requestId: '00000000-0000-4000-8000-000000000001', termsVersion: MERCHANT_TERMS_VERSION, rightsDeclared: true };
reset(); response = await restaurantRoute.POST(req('/api/merchant/restaurants', draft)); assert.equal(response.status, 201); assert.equal(calls[0].args.p_actor_user_id, 'verified-owner'); assert.equal(calls[0].name, 'merchant_restaurant_create_v2'); assert.equal(calls[0].args.p_terms_version, MERCHANT_TERMS_VERSION);
reset(); response = await restaurantRoute.POST(req('/api/merchant/restaurants', { name: draft.name, requestId: draft.requestId })); assert.equal(response.status, 400); assert.equal(calls.length, 0);
reset(); response = await restaurantRoute.POST(req('/api/merchant/restaurants', { ...draft, rightsDeclared: false })); assert.equal(response.status, 400); assert.equal(calls.length, 0);
reset(); response = await restaurantRoute.POST(req('/api/merchant/restaurants', { ...draft, termsVersion: 'old-version' })); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'TERMS_OUTDATED'); assert.equal(calls.length, 0);
reset(); authenticated = { response: NextResponse.json({ error: 'signed out' }, { status: 401 }) }; response = await restaurantRoute.POST(req('/api/merchant/restaurants', draft)); assert.equal(response.status, 401); assert.equal(calls.length, 0);
reset(); authenticated.user.email_confirmed_at = null; response = await restaurantRoute.POST(req('/api/merchant/restaurants', draft)); assert.equal(response.status, 403); assert.equal(calls.length, 0);
reset(); authenticated.user.is_anonymous = true; response = await restaurantRoute.POST(req('/api/merchant/restaurants', draft)); assert.equal(response.status, 403);
for (const field of ['merchantId', 'userId', 'role', 'is_published']) {
  reset(); response = await restaurantRoute.POST(req('/api/merchant/restaurants', { ...draft, [field]: 'foreign' })); assert.equal(response.status, 400); assert.equal(calls.length, 0);
}
reset(); createResult.error = {}; response = await restaurantRoute.POST(req('/api/merchant/restaurants', draft)); assert.equal(response.status, 503);
reset(); createResult.data = { code: 'REQUEST_CONFLICT' }; response = await restaurantRoute.POST(req('/api/merchant/restaurants', draft)); assert.equal(response.status, 409);
reset(); createResult.data = { code: 'TERMS_OUTDATED' }; response = await restaurantRoute.POST(req('/api/merchant/restaurants', draft)); assert.equal(response.status, 409); assert.equal((await response.json()).code, 'TERMS_OUTDATED');
console.log('merchant auth routes PASS (29 request scenarios; real handlers, mocked provider I/O)');
