const DEFAULT_PAGE_SIZE = 1000;
const DEFAULT_MAX_PAGES = 100;

/**
 * Read every page from a PostgREST query. Supabase commonly applies a
 * server-side 1,000-row limit, so a single select() is never sufficient for
 * audit, usage, or administration data.
 *
 * The caller supplies a fresh query builder for each range. When the safety
 * ceiling is reached, this throws instead of silently returning an incomplete
 * result set.
 */
async function fetchAllRows(buildQuery, {
  label = 'rows',
  pageSize = DEFAULT_PAGE_SIZE,
  maxPages = DEFAULT_MAX_PAGES,
} = {}) {
  if (typeof buildQuery !== 'function') {
    throw new TypeError('A query builder function is required');
  }

  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || DEFAULT_PAGE_SIZE));
  const safeMaxPages = Math.max(1, Math.floor(Number(maxPages) || DEFAULT_MAX_PAGES));
  const rows = [];

  for (let page = 0; page < safeMaxPages; page += 1) {
    const from = page * safePageSize;
    const to = from + safePageSize - 1;
    const result = await buildQuery(from, to);

    if (result?.error) {
      throw new Error(`Failed to fetch ${label}: ${result.error.message || result.error}`);
    }

    const batch = Array.isArray(result?.data) ? result.data : [];
    rows.push(...batch);

    if (batch.length < safePageSize) {
      return rows;
    }
  }

  const nextFrom = safeMaxPages * safePageSize;
  const nextResult = await buildQuery(nextFrom, nextFrom + safePageSize - 1);

  if (nextResult?.error) {
    throw new Error(`Failed to fetch ${label}: ${nextResult.error.message || nextResult.error}`);
  }

  if (Array.isArray(nextResult?.data) && nextResult.data.length > 0) {
    throw new Error(`Failed to fetch ${label}: pagination limit reached`);
  }

  return rows;
}

module.exports = {
  DEFAULT_MAX_PAGES,
  DEFAULT_PAGE_SIZE,
  fetchAllRows,
};
