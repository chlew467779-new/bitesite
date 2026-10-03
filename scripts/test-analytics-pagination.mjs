import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { selectAllPages } from '../lib/analytics-pagination.mjs';

for (const size of [0, 999, 1000, 2500]) {
  const rows = Array.from({ length: size }, (_, id) => ({ id, count: id + 1 }));
  const requests = [];
  let factories = 0;
  const result = await selectAllPages(() => {
    factories++;
    return {
      order(column, options) {
        assert.equal(column, 'id');
        assert.deepEqual(options, { ascending: true });
        return this;
      },
      async range(from, to) {
        requests.push([from, to]);
        return { data: rows.slice(from, to + 1), error: null };
      },
    };
  });
  assert.deepEqual(result.data, rows, `${size} rows: ordered, no losses or duplicates`);
  assert.equal(result.data.reduce((sum, row) => sum + row.count, 0), size * (size + 1) / 2);
  const pages = Math.floor(size / 1000) + 1;
  assert.equal(factories, pages, 'each page gets a fresh query');
  assert.deepEqual(requests, Array.from({ length: pages }, (_, i) => [i * 1000, i * 1000 + 999]));
}

const nullPage = await selectAllPages(() => ({ order() { return this; }, range: async () => ({ data: null, error: null }) }));
assert.deepEqual(nullPage.data, []);
let calls = 0;
await assert.rejects(selectAllPages(() => ({
  order() { return this; },
  async range() {
    calls++;
    return calls === 1
      ? { data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null }
      : { data: null, error: { message: 'page unavailable' } };
  },
})), /Analytics page read failed: page unavailable/, 'later-page failures never return a partial total');
assert.equal(calls, 2);
await assert.rejects(selectAllPages(() => ({ order() { return this; }, range() { throw new Error('network failure'); } })), /network failure/);

// Walk every Admin read of either table: a new unpaged route cannot silently slip in.
const routes = ['merchants', 'locations', 'export', 'overview', 'trends', 'devices', 'events', 'hourly', 'map', 'referrers', 'search-keywords', 'realtime', 'stories-analytics', 'merchants-crud'];
const { readdir } = await import('node:fs/promises');
const actualRoutes = await readdir(new URL('../app/api/admin/', import.meta.url), { withFileTypes: true });
let checkedQueries = 0;
for (const dir of actualRoutes.filter(d => d.isDirectory())) {
  const url = new URL(`../app/api/admin/${dir.name}/route.ts`, import.meta.url);
  let source;
  try { source = await readFile(url, 'utf8'); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const sf = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);
  let routeQueries = 0;
  function walk(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'from' && ts.isStringLiteral(node.arguments[0])
      && ['merchant_daily_views', 'page_views'].includes(node.arguments[0].text)) {
      let ancestor = node.parent;
      while (ancestor && !(ts.isCallExpression(ancestor) && ancestor.expression.getText(sf) === 'selectAllPages')) ancestor = ancestor.parent;
      assert.ok(ancestor, `${dir.name}: ${node.arguments[0].text} must use complete pagination`);
      const callback = ancestor.arguments[0];
      assert.ok(ts.isArrowFunction(callback), `${dir.name}: pass a factory, not a reused builder`);
      assert.ok(node.getStart(sf) >= callback.getStart(sf) && node.end <= callback.end);
      routeQueries++; checkedQueries++;
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);
  if (routes.includes(dir.name)) {
    assert.ok(routeQueries > 0, `${dir.name} is guarded`);
    assert.match(source, /import \{ selectAllPages \} from '@\/lib\/analytics-pagination\.mjs'/);
    // Auth happens before analytics queries; this refactor never widens access.
    assert.ok(source.indexOf('verifyAdminToken(token)') < source.indexOf('selectAllPages(() =>') || dir.name === 'merchants-crud');
  }
}
assert.equal(checkedQueries, 30);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.scripts['test:analytics-pagination'], 'node scripts/test-analytics-pagination.mjs');
assert.ok(pkg.scripts.verify.includes('npm run test:analytics-pagination'));
// Each Admin chart reads its own route (Trends once showed a copy of the Stories chart).
for (const [file, route] of [['trend-chart', 'trends'], ['stories-chart', 'stories-analytics']]) {
  const chart = await readFile(new URL(`../app/admin/components/${file}.tsx`, import.meta.url), 'utf8');
  assert.ok(chart.includes(`/api/admin/${route}?range=`), `${file} must request /api/admin/${route}`);
  assert.equal((chart.match(/\/api\/admin\/[a-z-]+/g) ?? []).filter((r) => r !== `/api/admin/${route}`).length, 0, `${file} requests only its own route`);
}
console.log(`analytics pagination checks passed: 0/999/1000/2500 rows, errors, ${routes.length} routes, ${checkedQueries} queries`);
