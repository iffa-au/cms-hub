/**
 * Remembers where in the Content library (page, search, status, filters) the
 * reviewer opened a film from, so BACK on the details page — and the redirects
 * after Undo/Delete/Approve — land on that same page instead of page 1.
 *
 * sessionStorage (per tab) rather than a query param on the details URL, so it
 * survives View → Edit → View round trips that rebuild the URL.
 */
const RETURN_URL_KEY = 'submissions:returnUrl';
const FILTERS_KEY = 'submissions:filters';

export const SUBMISSIONS_PATH = '/submissions';

function safeGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode / storage blocked: fall back to page 1 */
  }
}

export function saveSubmissionsListState(url: string, filters: unknown) {
  safeSet(RETURN_URL_KEY, url);
  safeSet(FILTERS_KEY, JSON.stringify(filters));
}

/** The Content library URL to go back to; `/submissions` if none recorded. */
export function getSubmissionsReturnUrl(): string {
  const url = safeGet(RETURN_URL_KEY);
  // Only ever navigate back into the list itself.
  return url && url.startsWith(SUBMISSIONS_PATH) ? url : SUBMISSIONS_PATH;
}

export function getSavedSubmissionsFilters<T>(): T | null {
  const raw = safeGet(FILTERS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
