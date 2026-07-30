/**
 * Matching for the entry editor's description autocomplete.
 *
 * The history arrives already ordered by how often each description has been
 * used, so this only filters and breaks ties: a match at the start of the text
 * beats a match at the start of a later word, which beats a match buried inside
 * one. Typing "i" therefore offers "Interview preparation" before "Weekly
 * review", which is the order you had in mind when you typed the letter.
 */

/** What counts as the start of a word: whitespace and the usual separators. */
const WORD_BREAK = /[\s\-–/(\[.,:]/;

/**
 * The best rank the needle earns anywhere in the text, not the rank of the first
 * place it happens to appear: "i" is inside "Client" before it starts
 * "(invoicing)", and the second is the one that made you type the letter.
 */
function score(haystack: string, needle: string): number | null {
  let best: number | null = null;

  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
    if (at === 0) return 0;
    const rank = WORD_BREAK.test(haystack[at - 1]) ? 1 : 2;
    if (best === null || rank < best) best = rank;
    if (best === 1) break;
  }

  return best;
}

export function rankSuggestions(
  history: string[],
  query: string,
  limit: number,
): string[] {
  const needle = query.trim().toLowerCase();
  const ranked: { value: string; rank: number }[] = [];

  for (const value of history) {
    const haystack = value.toLowerCase();
    // An exact match has nothing left to complete; offering it is just noise.
    if (haystack === needle) continue;
    const rank = needle === "" ? 0 : score(haystack, needle);
    if (rank === null) continue;
    ranked.push({ value, rank });
  }

  // Sort is stable, so the history's most-used-first order survives inside each
  // band rather than being reshuffled alphabetically.
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((item) => item.value);
}
