/** Description autocomplete matching. History arrives most-used-first, so this only filters and breaks ties: start-of-text beats start-of-later-word beats mid-word. Typing "i" offers "Interview preparation" before "Weekly review". */

/** What counts as the start of a word: whitespace and the usual separators. */
const WORD_BREAK = /[\s\-–/(\[.,:]/;

/** Best rank the needle earns anywhere in the text, not the first place it appears: "i" is inside "Client" before "(invoicing)", and the second is the one you meant. */
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

  // Stable sort keeps the most-used-first order within each band instead of going alphabetical.
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((item) => item.value);
}
