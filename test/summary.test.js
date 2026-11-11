import assert from "node:assert/strict";
import test from "node:test";
import { buildSummary } from "../src/services/summary.js";

const item = { id: 1, name: "得道者数" };
const fellowship = { id: 25, name: "山梨" };
const tally = { fellowshipId: 25, itemId: 1, date: "2026-11-15", value: 9 };
const tallyDates = [{ date: "2026-11-15" }, { date: "2026-12-15" }, { date: "2027-03-21", isFinal: true }];

test("Senshu Shuten includes pre-entered values only on its first tally date", () => {
  const summary = buildSummary({
    ceremony: { id: 10, beginAt: "2026-11-15", endAt: "2027-03-21" },
    items: [item],
    fellowships: [fellowship],
    tallies: [tally],
    fellowshipTargets: [],
    summaryOverrides: [],
    tallyDates,
    today: "2026-11-11",
  });

  assert.deepEqual(summary.dailyTotals[0], { date: "2026-11-15", totals: { 1: 9 } });
  assert.deepEqual(summary.dailyTotals[1], { date: "2026-12-15", totals: null });
});

test("other ceremonies keep future tally totals hidden", () => {
  const summary = buildSummary({
    ceremony: { id: 9, beginAt: "2026-11-15", endAt: "2027-03-21" },
    items: [item],
    fellowships: [fellowship],
    tallies: [tally],
    fellowshipTargets: [],
    summaryOverrides: [],
    tallyDates,
    today: "2026-11-11",
  });

  assert.deepEqual(summary.dailyTotals[0], { date: "2026-11-15", totals: null });
});
