import { describe, expect, it } from "vitest";
import { rankSuggestions } from "./suggest";

// Ordered the way the server sends it: most-used first.
const HISTORY = [
  "Weekly review",
  "Interview preparation",
  "Intense study session",
  "Client call (invoicing)",
  "Refactor the importer",
];

describe("rankSuggestions", () => {
  it("offers the whole history when nothing has been typed", () => {
    expect(rankSuggestions(HISTORY, "", 3)).toEqual([
      "Weekly review",
      "Interview preparation",
      "Intense study session",
    ]);
  });

  it("puts matches at the start of the text before matches inside a word", () => {
    expect(rankSuggestions(HISTORY, "i", 10)).toEqual([
      "Interview preparation",
      "Intense study session",
      // "i" buried in "Client"/"Refactor"; ranked on the later "(invoicing)"/"importer".
      "Client call (invoicing)",
      "Refactor the importer",
      // "review" left; its "i" is mid-word.
      "Weekly review",
    ]);
  });

  it("ranks the start of the text, then a later word, then mid-word", () => {
    expect(rankSuggestions(HISTORY, "re", 10)).toEqual([
      "Refactor the importer", // starts with it
      "Weekly review", // starts "review"
      "Interview preparation", // buried in "preparation"
    ]);
  });

  it("keeps the most-used order within one band", () => {
    // Both start with the query, so history order decides, not alphabet (which would put "Sprint planning" first).
    const history = ["Standup", "Alpha review", "Sprint planning"];
    expect(rankSuggestions(history, "s", 10)).toEqual(["Standup", "Sprint planning"]);
  });

  it("ignores case and surrounding space", () => {
    expect(rankSuggestions(HISTORY, "  INTERVIEW ", 10)).toEqual([
      "Interview preparation",
    ]);
  });

  it("drops an exact match, which has nothing left to complete", () => {
    expect(rankSuggestions(HISTORY, "Weekly review", 10)).toEqual([]);
  });

  it("returns nothing when the query matches nothing", () => {
    expect(rankSuggestions(HISTORY, "zzz", 10)).toEqual([]);
  });

  it("honours the limit", () => {
    expect(rankSuggestions(HISTORY, "i", 2)).toEqual([
      "Interview preparation",
      "Intense study session",
    ]);
  });
});
