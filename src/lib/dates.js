export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function todayISO() {
  return new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function nowJST(date = new Date()) {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

export function addDaysISO(iso, days) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function formatJSTTimestamp(date = new Date()) {
  return nowJST(date).toISOString().replace("T", " ").slice(0, 16);
}

export function formatShortDate(iso) {
  if (!iso) {
    return "";
  }
  const [, month, day] = iso.split("-").map(Number);
  return `${month}/${day}`;
}

export function listDatesInRange(beginAt, endAt) {
  if (!isValidISODate(beginAt) || !isValidISODate(endAt) || endAt < beginAt) {
    return [];
  }
  const dates = [];
  let current = beginAt;
  while (current <= endAt && dates.length < 366) {
    dates.push(current);
    current = addDaysISO(current, 1);
  }
  return dates;
}
