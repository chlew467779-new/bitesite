/**
 * Admin Owner assign / transfer wiring. Database behaviour is tested by
 * supabase/tests/owner_assign_behavior_tests.sql.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (relPath) => (await readFile(new URL(`../${relPath}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");

const route = await read("app/api/admin/merchant-memberships/route.ts");
const post = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function PATCH"));
assert.match(post, /verifyAdminToken|authError\(request\)/, "Admin only");
assert.match(post, /rpc\('merchant_owner_assign'/, "linking goes through the one-transaction RPC");
assert.doesNotMatch(post, /\.upsert\(|\.update\(|merchant_membership_audit/, "no separate membership writes that could leave two active Owners or none");
assert.match(route, /error\?\.code === '23505'/, "reactivating while another Owner is active explains itself");

const manager = await read("app/admin/components/merchant-manager.tsx");
assert.match(manager, /window\.confirm\(`Make \$\{membershipEmail\.trim\(\)\} the Owner/, "Admin confirms before moving a restaurant");
assert.doesNotMatch(manager, /magic link first/, "hint no longer mentions magic links");

const migration = await read("supabase/migrations/20260928120000_merchant_owner_assign.sql");
assert.ok(migration.indexOf("set status = 'suspended'") < migration.indexOf("insert into public.merchant_memberships"), "the previous Owner is suspended before the new one is activated");

console.log("owner assign checks passed");
