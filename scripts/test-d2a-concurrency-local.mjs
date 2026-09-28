#!/usr/bin/env node
/**
 * D2-A concurrency tests: two real, overlapping database transactions against a LOCAL Supabase
 * database container (supabase start). A third connection proves the second transaction is
 * actually waiting on a lock (pg_stat_activity wait_event_type = 'Lock') before the first one
 * commits, so overlap is shown, not guessed with sleeps.
 *
 *   D2A_DB_CONTAINER=supabase_db_local-supabase node scripts/test-d2a-concurrency-local.mjs
 *
 * Uses psql inside the container (no extra npm dependency). Creates only zz-d2c-* rows and
 * deletes them at the end. Not part of `npm run verify` (it needs Docker).
 */
import { spawn, execFileSync } from "node:child_process";

const container = process.env.D2A_DB_CONTAINER || "supabase_db_local-supabase";
if (!/^supabase_db_[A-Za-z0-9_-]+$/.test(container)) { console.error("REFUSING: D2A_DB_CONTAINER must be a local supabase_db_* container."); process.exit(2); }
execFileSync("docker", ["inspect", container], { stdio: "ignore" });

let marker = 0;
class Session {
  constructor(name) {
    this.name = name;
    this.buffer = "";
    this.waiters = [];
    this.proc = spawn("docker", ["exec", "-i", container, "sh", "-c", "psql -U postgres -d postgres -At -q -v ON_ERROR_STOP=0 2>&1"]);
    this.proc.stdout.on("data", (chunk) => { this.buffer += chunk.toString(); this.flush(); });
    this.send(`set application_name = '${name}';`);
  }
  flush() {
    for (const waiter of [...this.waiters]) {
      const index = this.buffer.indexOf(waiter.tag);
      if (index >= 0) {
        const out = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + waiter.tag.length);
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(out);
      }
    }
  }
  /** Sends SQL and resolves with its output once psql has finished it. */
  send(sql) {
    const tag = `__done_${++marker}__`;
    const promise = new Promise((resolve) => this.waiters.push({ tag, resolve }));
    this.proc.stdin.write(`${sql}\n\\echo ${tag}\n`);
    return promise;
  }
  close() { this.proc.stdin.end(); }
}

const monitor = new Session("d2c-monitor");
async function waitUntilBlocked(sessionName, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const out = await monitor.send(`select count(*) from pg_stat_activity where application_name = '${sessionName}' and wait_event_type = 'Lock';`);
    if (out.trim() === "1") return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

let passed = 0, failed = 0;
const expect = (label, cond, detail) => { if (cond) { passed++; console.log(`  ok   ${label}`); } else { failed++; console.error(`  FAIL ${label} — ${detail}`); } };
const parse = (out) => { if (/ERROR:/.test(out)) return { error: out.match(/ERROR:\s+(\S+)/)?.[1] ?? out }; try { return JSON.parse(out.split("\n").pop()); } catch { return { raw: out }; } };
const q = (s) => `'${s.replaceAll("'", "''")}'`;

const OWNER = "00000000-0000-4000-8000-0000000d2c11";
const M = "00000000-0000-4000-8000-0000000d2c01";
const patchSql = (requestId, patches) =>
  `select public.merchant_field_patch('owner', '${OWNER}', '${M}', '${requestId}', ${q(JSON.stringify(patches))}::jsonb);`;
const p = (path, expected, value) => ({ path, expected: expected === undefined ? { exists: false } : { exists: true, value: expected }, value });
const uuid = () => crypto.randomUUID();

async function reset(admin) {
  await admin.send(`
    delete from public.story_submissions where merchant_slug = 'zz-d2c-a';
    delete from public.merchant_memberships where merchant_id = '${M}';
    delete from public.merchants where id = '${M}';
    delete from auth.users where id = '${OWNER}';
    insert into auth.users (id, email) values ('${OWNER}', 'zz-d2c-owner@example.test');
    insert into public.merchants (id, slug, name, is_published, platform_status, phone, tagline)
      values ('${M}', 'zz-d2c-a', 'ZZ D2C A', true, 'PUBLISHED', '+60100000000', 'base');
    insert into public.merchant_memberships (merchant_id, user_id, role, status) values ('${M}', '${OWNER}', 'owner', 'active');`);
}
const value = async (admin, sql) => (await admin.send(sql)).trim();

const admin = new Session("d2c-admin");
const s1 = new Session("d2c-s1");
const s2 = new Session("d2c-s2");
await s1.send("set role service_role;");
await s2.send("set role service_role;");

try {
  console.log("1) same field from the same baseline: one wins, the other conflicts");
  await reset(admin);
  await s1.send("begin;");
  let r1 = parse(await s1.send(patchSql(uuid(), [p("profile.tagline", "base", "one")])));
  let r2p = s2.send(patchSql(uuid(), [p("profile.tagline", "base", "two")]));
  expect("second transaction waits on the merchant lock", await waitUntilBlocked("d2c-s2"), "not blocked");
  await s1.send("commit;");
  let r2 = parse(await r2p);
  expect("first applied", r1.status === "applied", JSON.stringify(r1));
  expect("second got FIELD_CONFLICT with the committed value", r2.status === "conflict" && r2.conflicts?.[0]?.current?.value === "one", JSON.stringify(r2));
  expect("stored value is the winner's", (await value(admin, `select tagline from public.merchants where id = '${M}';`)) === "one", "wrong value");

  console.log("2) different fields from the same baseline: both kept");
  await reset(admin);
  await s1.send("begin;");
  r1 = parse(await s1.send(patchSql(uuid(), [p("profile.description", null, "desc")])));
  r2p = s2.send(patchSql(uuid(), [p("profile.phone", "+60100000000", "+60111111111")]));
  expect("second transaction waits", await waitUntilBlocked("d2c-s2"), "not blocked");
  await s1.send("commit;");
  r2 = parse(await r2p);
  expect("both applied", r1.status === "applied" && r2.status === "applied", `${JSON.stringify(r1)} ${JSON.stringify(r2)}`);
  expect("both values stored", (await value(admin, `select description || '|' || phone from public.merchants where id = '${M}';`)) === "desc|+60111111111", "lost update");
  expect("revision advanced twice", (await value(admin, `select revision from public.merchants where id = '${M}';`)) === "2", "revision");

  console.log("3) same request id, same payload, concurrently: executed once");
  await reset(admin);
  const key = uuid();
  const patches = [p("profile.tagline", "base", "once")];
  await s1.send("begin;");
  r1 = parse(await s1.send(patchSql(key, patches)));
  r2p = s2.send(patchSql(key, patches));
  expect("second transaction waits", await waitUntilBlocked("d2c-s2"), "not blocked");
  await s1.send("commit;");
  r2 = parse(await r2p);
  expect("second is a replay of the first", r1.status === "applied" && r2.status === "applied" && r2.replayed === true && r2.revision === r1.revision, `${JSON.stringify(r1)} ${JSON.stringify(r2)}`);
  expect("one revision, one audit row", (await value(admin, `select revision || '|' || (select count(*) from public.merchant_change_log where merchant_id = '${M}' and operation = 'merchant_field_patch') from public.merchants where id = '${M}';`)) === "1|1", "double execution");

  console.log("4) membership revoked first, then save");
  await reset(admin);
  await admin.send("begin;");
  await admin.send(`update public.merchant_memberships set status = 'suspended' where merchant_id = '${M}';`);
  r2p = s2.send(patchSql(uuid(), [p("profile.tagline", "base", "after revoke")]));
  expect("save waits on the membership row", await waitUntilBlocked("d2c-s2"), "not blocked");
  await admin.send("commit;");
  r2 = parse(await r2p);
  expect("save refused as 404", r2.error === "RESOURCE_NOT_FOUND", JSON.stringify(r2));
  expect("nothing written", (await value(admin, `select tagline from public.merchants where id = '${M}';`)) === "base", "written");

  console.log("5) save first, then membership revoked");
  await reset(admin);
  await s1.send("begin;");
  r1 = parse(await s1.send(patchSql(uuid(), [p("profile.tagline", "base", "before revoke")])));
  const revokeP = s2.send(`reset role; update public.merchant_memberships set status = 'suspended' where merchant_id = '${M}'; set role service_role;`);
  expect("revocation waits for the save", await waitUntilBlocked("d2c-s2"), "not blocked");
  await s1.send("commit;");
  await revokeP;
  expect("save applied, then revoked", r1.status === "applied" && (await value(admin, `select tagline || '|' || (select status from public.merchant_memberships where merchant_id = '${M}') from public.merchants where id = '${M}';`)) === "before revoke|suspended", "order");

  console.log("6) restaurant suspended first, then save");
  await reset(admin);
  await admin.send("begin;");
  await admin.send(`update public.merchants set platform_status = 'SUSPENDED' where id = '${M}';`);
  r2p = s2.send(patchSql(uuid(), [p("profile.tagline", "base", "after suspend")]));
  expect("save waits on the merchant row", await waitUntilBlocked("d2c-s2"), "not blocked");
  await admin.send("commit;");
  r2 = parse(await r2p);
  expect("save refused as suspended", r2.error === "MERCHANT_SUSPENDED", JSON.stringify(r2));

  console.log("7) save first, then restaurant suspended");
  await reset(admin);
  await s1.send("begin;");
  r1 = parse(await s1.send(patchSql(uuid(), [p("profile.tagline", "base", "before suspend")])));
  const suspendP = s2.send(`reset role; update public.merchants set platform_status = 'SUSPENDED' where id = '${M}'; set role service_role;`);
  expect("suspension waits for the save", await waitUntilBlocked("d2c-s2"), "not blocked");
  await s1.send("commit;");
  await suspendP;
  expect("save applied, then suspended", r1.status === "applied" && (await value(admin, `select tagline || '|' || platform_status from public.merchants where id = '${M}';`)) === "before suspend|SUSPENDED", "order");

  console.log("8) Story insert vs membership revoked first");
  await reset(admin);
  await admin.send("begin;");
  await admin.send(`update public.merchant_memberships set status = 'suspended' where merchant_id = '${M}';`);
  r2p = s2.send(`select public.merchant_story_submission_create('${OWNER}', '${M}', '{"title": "ZZ", "content": "x"}');`);
  expect("Story insert waits", await waitUntilBlocked("d2c-s2"), "not blocked");
  await admin.send("commit;");
  r2 = parse(await r2p);
  expect("Story insert refused, no row", r2.error === "RESOURCE_NOT_FOUND" && (await value(admin, `select count(*) from public.story_submissions where merchant_slug = 'zz-d2c-a';`)) === "0", JSON.stringify(r2));

  console.log("9) change request vs restaurant suspended first");
  await reset(admin);
  await admin.send("begin;");
  await admin.send(`update public.merchants set platform_status = 'SUSPENDED' where id = '${M}';`);
  r2p = s2.send(`select public.merchant_profile_change_request_create('${OWNER}', '${M}', '{"name": "x"}');`);
  expect("change request waits", await waitUntilBlocked("d2c-s2"), "not blocked");
  await admin.send("commit;");
  r2 = parse(await r2p);
  expect("change request refused as suspended", r2.error === "MERCHANT_SUSPENDED", JSON.stringify(r2));
} catch (error) {
  failed++;
  console.error(`  FAIL run — ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await admin.send("rollback;");
  await admin.send(`
    delete from public.merchant_profile_change_requests where merchant_id = '${M}';
    delete from public.story_submissions where merchant_slug = 'zz-d2c-a';
    delete from public.merchant_memberships where merchant_id = '${M}';
    delete from public.merchants where id = '${M}';
    delete from auth.users where id = '${OWNER}';`);
  for (const s of [s1, s2, admin, monitor]) s.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
