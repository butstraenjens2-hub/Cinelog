import assert from "node:assert/strict";
import test from "node:test";

import { newestAndUpcoming } from "./titles.mjs";

test("upcoming titles sort soonest first and newest stay in the past", () => {
  const grouped = newestAndUpcoming(
    [
      { title: "Later", releaseDate: "2026-12-01", year: 2026 },
      { title: "Soon", releaseDate: "2026-11-02", year: 2026 },
      { title: "Old", releaseDate: "2024-01-01", year: 2024 },
      { title: "No date", year: 0 },
    ],
    new Date(2026, 9, 24),
  );
  assert.deepEqual(
    grouped.upcoming.map((item) => item.title),
    ["Soon", "Later"],
  );
  assert.deepEqual(
    grouped.newest.map((item) => item.title),
    ["Old"],
  );
});
