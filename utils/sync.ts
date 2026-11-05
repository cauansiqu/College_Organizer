import type { Assignment } from '../types';

// An assignment is "synced" when a feed (Moodle, Blackboard, a syllabus
// import) owns it. Missing source = created in the app = manual.
// Synced assignments get their title, due date and course locked in the UI,
// because the next sync would overwrite (or duplicate) any edit to those.
export function isSynced(a: Pick<Assignment, 'source'>): boolean {
  return !!a.source && a.source !== 'manual';
}

// Small note shown on synced assignments, e.g. "Synced from Moodle".
// Returns null for manual assignments so callers can render it conditionally.
export function syncLabel(a: Pick<Assignment, 'source'>): string | null {
  switch (a.source) {
    case 'moodle': return 'Synced from Moodle';
    case 'blackboard': return 'Synced from Blackboard';
    case 'syllabus': return 'Imported from syllabus';
    default: return null;
  }
}
