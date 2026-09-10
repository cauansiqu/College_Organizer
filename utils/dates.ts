// Turns a stored "YYYY-MM-DD" string into a Date representing LOCAL
// midnight on that exact calendar day.
//
// Do NOT parse dates with `new Date("YYYY-MM-DD")` directly — that's a
// classic JavaScript trap: a date-only string gets treated as UTC, which
// can silently shift it back a day in any timezone behind UTC (all of
// the US). This function avoids that by building the Date from separate
// year/month/day numbers instead of parsing a string.
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Formats a Date as a local "YYYY-MM-DD" string — the inverse of
// parseLocalDate(). date.toISOString() must not be used for this: it
// converts to UTC first, silently shifting the date by one day for
// anyone west of UTC (all of the US) in the evening.
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Formats a stored "YYYY-MM-DD" due date as a human label, e.g. "Wed, Sep 10, 2026".
export function formatDisplayDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

// Whole calendar days between today and a stored "YYYY-MM-DD" due date.
// Negative means overdue.
export function daysUntil(dueDate: string): number {
  const due = parseLocalDate(dueDate.slice(0, 10) + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// Short due-status label for badges, e.g. "DUE 03D" / "DUE TODAY" / "1D LATE".
// Returns null for a completed assignment, which has nothing left to be due.
export function dueLabel(dueDate: string, completed: boolean): string | null {
  if (completed) return null;
  const diff = daysUntil(dueDate);
  if (diff < 0) return `${Math.abs(diff)}D LATE`;
  if (diff === 0) return 'DUE TODAY';
  return `DUE ${String(diff).padStart(2, '0')}D`;
}