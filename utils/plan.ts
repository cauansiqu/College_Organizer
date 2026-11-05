import { parseLocalDate, toLocalISODate } from './dates';
import type { Assignment, PlanTask, WorkShift } from '../types';

// Everything shown for one calendar day (agenda card, board column, weekend)
export type PlanDay = {
  iso: string;            // "YYYY-MM-DD"
  due: Assignment[];      // incomplete assignments due that day
  tasks: PlanTask[];      // plan_tasks for that day, in sort order
  shifts: WorkShift[];    // work shifts starting that (local) day
};

export function isEmptyDay(day: PlanDay): boolean {
  return day.due.length === 0 && day.tasks.length === 0 && day.shifts.length === 0;
}

// Pure date/format helpers for the Plan tab. Date-only strings ("YYYY-MM-DD")
// always go through parseLocalDate/toLocalISODate (CLAUDE.md gotcha #2).
// Timestamps (dueAt, shift times, sync times) are real instants with an
// offset, so `new Date(iso)` is correct for those.

// "YYYY-MM-DD" n days after `iso` (negative = before)
export function addDays(iso: string, n: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}

// 0 = Sunday … 6 = Saturday
export function weekday(iso: string): number {
  return parseLocalDate(iso).getDay();
}

export function isWeekend(iso: string): boolean {
  const d = weekday(iso);
  return d === 0 || d === 6;
}

// Monday the week board shows: this week's Monday, or next Monday on a
// weekend (the week is "over" by Saturday). `offset` moves whole weeks.
export function boardWeekStart(todayIso: string, offset: number): string {
  const day = weekday(todayIso);
  const toMonday = day === 0 ? 1 : day === 6 ? 2 : 1 - day;
  return addDays(todayIso, toMonday + offset * 7);
}

// The local calendar day a timestamp falls on. A shift at 01:00 UTC is still
// the evening before in US time, so never slice the date off the UTC string.
export function localDayOf(isoTimestamp: string): string {
  return toLocalISODate(new Date(isoTimestamp));
}

// "Thu Nov 5"
export function shortDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

// "Nov 9"
export function monthDay(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// "Today · Thu Nov 5" / "Tomorrow · Fri Nov 6" / "Sat Nov 7"
export function dayHeading(iso: string, todayIso: string): string {
  if (iso === todayIso) return `Today · ${shortDate(iso)}`;
  if (iso === addDays(todayIso, 1)) return `Tomorrow · ${shortDate(iso)}`;
  return shortDate(iso);
}

// Hour/minute parts of a time, e.g. { time: "7:00", ampm: "PM" }
function timeParts(date: Date, dropZeroMinutes: boolean): { time: string; ampm: string } {
  const h24 = date.getHours();
  const m = date.getMinutes();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const time = dropZeroMinutes && m === 0 ? `${h12}` : `${h12}:${String(m).padStart(2, '0')}`;
  return { time, ampm: h24 < 12 ? 'AM' : 'PM' };
}

// "DUE 11 PM" / "DUE 11:59 PM" from the exact due time; just "DUE" when the
// assignment only has a date.
export function dueTimeLabel(a: Pick<Assignment, 'dueAt'>): string {
  if (!a.dueAt) return 'DUE';
  const { time, ampm } = timeParts(new Date(a.dueAt), true);
  return `DUE ${time} ${ampm}`;
}

// "7:00–11:00 PM", or "10:00 AM–2:00 PM" when the halves differ.
// compact drops ":00" ("11 AM–3 PM") for tighter spots like the day list.
export function shiftTimeRange(s: Pick<WorkShift, 'startsAt' | 'endsAt'>, compact = false): string {
  const start = timeParts(new Date(s.startsAt), compact);
  const end = timeParts(new Date(s.endsAt), compact);
  return start.ampm === end.ampm
    ? `${start.time}–${end.time} ${end.ampm}`
    : `${start.time} ${start.ampm}–${end.time} ${end.ampm}`;
}

// Very short hours for calendar chips: "7–11p", "11a–3p", "7:30–11p".
// The a/p suffix appears once when both ends share it.
export function shortShiftHours(s: Pick<WorkShift, 'startsAt' | 'endsAt'>): string {
  const start = timeParts(new Date(s.startsAt), true);
  const end = timeParts(new Date(s.endsAt), true);
  const suffix = (ampm: string) => (ampm === 'AM' ? 'a' : 'p');
  return start.ampm === end.ampm
    ? `${start.time}–${end.time}${suffix(end.ampm)}`
    : `${start.time}${suffix(start.ampm)}–${end.time}${suffix(end.ampm)}`;
}

// "7:02 AM"
export function clockTime(isoTimestamp: string): string {
  const { time, ampm } = timeParts(new Date(isoTimestamp), false);
  return `${time} ${ampm}`;
}

// Header text: "synced 7:02 AM" today, "synced Nov 4, 7:02 AM" otherwise
export function syncedLabel(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return 'not synced yet';
  const day = localDayOf(isoTimestamp);
  const time = clockTime(isoTimestamp);
  return day === toLocalISODate(new Date())
    ? `synced ${time}`
    : `synced ${monthDay(day)}, ${time}`;
}

// "" (not rolled), "↻ rolled over", "↻ rolled over 2×"
export function rolledLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '↻ rolled over' : `↻ rolled over ${count}×`;
}

// Buckets items by "YYYY-MM-DD" day, using `dayOf` to pick each item's day
export function groupByDay<T>(items: T[], dayOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const day = dayOf(item);
    const list = map.get(day);
    if (list) list.push(item);
    else map.set(day, [item]);
  }
  return map;
}
