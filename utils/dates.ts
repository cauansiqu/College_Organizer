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