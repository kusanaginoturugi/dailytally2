import { listDatesInRange, todayISO } from "../lib/dates.js";

// 同一 (fellowship, item, date) は最大1件しかない前提で、map で索引化
function buildTalliesIndex(tallies) {
  const index = new Map();
  for (const tally of tallies) {
    const key = `${tally.fellowshipId}:${tally.itemId}:${tally.date}`;
    index.set(key, tally.value);
  }
  return index;
}

function getStoredValue(index, fellowshipId, itemId, date) {
  return index.get(`${fellowshipId}:${itemId}:${date}`) || 0;
}

function getCarriedValue(index, fellowshipId, itemId, weekDates, untilDate) {
  let carried = 0;
  for (const date of weekDates) {
    if (date > untilDate) {
      break;
    }
    const value = getStoredValue(index, fellowshipId, itemId, date);
    if (value > 0) {
      carried = value;
    }
  }
  return carried;
}

export function buildSummary({ ceremony, items, fellowships, tallies, fellowshipTargets, summaryOverrides }) {
  const weekDates = listDatesInRange(ceremony.beginAt, ceremony.endAt);
  const today = todayISO();
  const talliesIndex = buildTalliesIndex(tallies);
  const fellowshipTargetIndex = new Map(
    fellowshipTargets.map((t) => [`${t.fellowshipId}:${t.itemId}`, t.value]),
  );
  const overrideIndex = new Map(summaryOverrides.map((o) => [o.itemId, o.value]));

  const dailyTotals = weekDates.map((date) => {
    if (date > today) {
      return { date, totals: null };
    }
    const totals = Object.fromEntries(items.map((item) => [item.id, 0]));
    for (const item of items) {
      for (const fellowship of fellowships) {
        totals[item.id] += getCarriedValue(talliesIndex, fellowship.id, item.id, weekDates, date);
      }
    }
    return { date, totals };
  });

  const finalTotals = ceremony.endAt && ceremony.endAt <= today
    ? Object.fromEntries(
        items.map((item) => {
          let sum = 0;
          for (const fellowship of fellowships) {
            const finalValue = getStoredValue(talliesIndex, fellowship.id, item.id, ceremony.endAt);
            const carried = getCarriedValue(talliesIndex, fellowship.id, item.id, weekDates, ceremony.endAt);
            sum += finalValue || carried;
          }
          return [item.id, sum];
        }),
      )
    : null;

  const targetTotals = Object.fromEntries(
    items.map((item) => {
      let sum = 0;
      for (const fellowship of fellowships) {
        sum += fellowshipTargetIndex.get(`${fellowship.id}:${item.id}`) || 0;
      }
      return [item.id, sum];
    }),
  );

  const summaryTargetByItem = Object.fromEntries(
    items.map((item) => [item.id, overrideIndex.has(item.id) ? overrideIndex.get(item.id) : targetTotals[item.id]]),
  );

  return { weekDates, dailyTotals, finalTotals, targetTotals, summaryTargetByItem };
}
