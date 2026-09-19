#!/usr/bin/env node
/**
 * Guards the service-role key. Never prints any secret value.
 *
 *   node scripts/check-service-role-usage.mjs [--bundle] [file-to-scan ...]
 *
 * 1. SOURCE: SUPABASE_SERVICE_ROLE_KEY may only be *referenced* in
 *    lib/supabase-admin.ts (plus docs/examples/scripts/supabase). No NEXT_PUBLIC_
 *    name may contain SERVICE_ROLE / SECRET.
 * 2. IMPORTS: lib/supabase-admin may only be imported from app/api/** and must
 *    never be imported by a file that starts with "use client".
 * 3. BUNDLE (--bundle, after `next build`): .next/static (what browsers download)
 *    must not contain the variable name, a service_role JWT, an sb_secret_ key,
 *    or (if SUPABASE_SERVICE_ROLE_KEY is set in the environment) its literal value.
 *    Extra files given on the command line (build log, git diff, etc.) are
 *    scanned for the literal value and for service_role JWTs / sb_secret_ keys.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const scanBundle = args.includes("--bundle");
const extraFiles = args.filter((a) => !a.startsWith("--"));
const failures = [];
const fail = (msg) => failures.push(msg);

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "docs", "supabase"]);
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

// ── 1 + 2: source scan ────────────────────────────────────────────────
const ALLOWED_REF = new Set(["lib/supabase-admin.ts"]);
for (const file of walk(root)) {
  const rel = relative(root, file).split(sep).join("/");
  if (rel.startsWith("scripts/")) continue;
  if (!SRC_EXT.test(rel)) continue;
  const text = readFileSync(file, "utf8");

  if (/NEXT_PUBLIC_[A-Z0-9_]*(SERVICE_ROLE|SECRET)/.test(text)) {
    fail(`${rel}: a NEXT_PUBLIC_ variable name contains SERVICE_ROLE/SECRET`);
  }
  if (text.includes("SUPABASE_SERVICE_ROLE_KEY") && !ALLOWED_REF.has(rel)) {
    fail(`${rel}: references SUPABASE_SERVICE_ROLE_KEY (only lib/supabase-admin.ts may)`);
  }
  if (rel !== "lib/supabase-admin.ts" && /from\s+["'](@\/lib|\.{1,2}\/lib|\.{1,2})\/supabase-admin["']/.test(text)) {
    if (!rel.startsWith("app/api/")) fail(`${rel}: imports supabase-admin but is not under app/api/`);
    const head = text.slice(0, 200);
    if (/^\s*(\/\*[\s\S]*?\*\/\s*)?["']use client["']/.test(text) || /["']use client["']/.test(head)) {
      fail(`${rel}: is a client component and imports supabase-admin`);
    }
  }
}

// ── 3: bundle / extra-file scan ───────────────────────────────────────
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;
const literal = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function scanText(label, text, { checkName }) {
  if (checkName && text.includes("SUPABASE_SERVICE_ROLE_KEY")) fail(`${label}: contains the name SUPABASE_SERVICE_ROLE_KEY`);
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) fail(`${label}: contains an sb_secret_ key`);
  if (literal && literal.length >= 20 && text.includes(literal)) fail(`${label}: contains the literal service-role key value`);
  for (const m of text.matchAll(JWT)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
      if (payload.role === "service_role") fail(`${label}: contains a JWT with role=service_role`);
    } catch { /* not a JWT payload */ }
  }
}

if (scanBundle) {
  const staticDir = join(root, ".next", "static");
  if (!existsSync(staticDir)) {
    fail("--bundle given but .next/static does not exist (run `next build` first)");
  } else {
    let n = 0;
    for (const file of walk2(staticDir)) {
      n++;
      scanText(relative(root, file).split(sep).join("/"), readFileSync(file, "utf8"), { checkName: true });
    }
    console.log(`bundle: scanned ${n} files under .next/static`);
  }
}
for (const f of extraFiles) {
  if (!existsSync(f)) { fail(`extra file not found: ${f}`); continue; }
  scanText(f, readFileSync(f, "utf8"), { checkName: false });
}

function* walk2(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk2(full);
    else yield full;
  }
}

if (failures.length) {
  console.error("SECURITY CHECK FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}
console.log("security check passed");
