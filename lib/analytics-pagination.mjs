/** Read complete analytics inputs without silently hitting the Data API row cap.
 * Callers keep authorization, filters and any primary ordering; id breaks ordering ties.
 * Build a fresh query per page so range/order mutations never leak between requests.
 * A failed page throws: no caller may report partial totals as a successful result.
 */
const PAGE_SIZE = 1000;

export async function selectAllPages(queryBuilderFactory) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryBuilderFactory()
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Analytics page read failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
