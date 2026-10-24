import assert from "node:assert/strict";
import test from "node:test";

import { scheduleBucket } from "./window.mjs";

test("air dates land in today, this week, or outside the window", () => {
  const now = new Date(2026, 9, 24);
  assert.equal(scheduleBucket("2026-10-24", now), "today");
  assert.equal(scheduleBucket("2026-10-30", now), "week");
  assert.equal(scheduleBucket("2026-10-31", now), null);
  assert.equal(scheduleBucket("2026-10-23", now), null);
  assert.equal(scheduleBucket("soon", now), null);
});
