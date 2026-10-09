import { supabase } from './supabase';
import { courseColors } from '../constants/theme';
import { toLocalISODate } from '../utils/dates';
import type { Assignment } from '../types';

// Sample data for "Try the demo" (anonymous sign-in). Called from
// app/_layout.tsx before the tabs mount, so a demo visitor never sees an
// empty account. Inserts go straight through the Supabase client (not
// storage.ts) so each table is a single bulk insert.

// A "YYYY-MM-DD" date n days from today (negative = past). Built with
// toLocalISODate so it's the user's local calendar day (CLAUDE.md gotcha #2),
// which keeps "overdue" / "due today" correct whenever the demo is opened.
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}

const DEMO_COURSES = [
  { name: 'Data Structures', professor: 'Dr. Patel', color: courseColors[0] },
  { name: 'Calculus II', professor: 'Dr. Nguyen', color: courseColors[1] },
  { name: 'Intro to Psychology', professor: 'Prof. Alvarez', color: courseColors[4] },
  { name: 'Technical Writing', professor: 'Prof. Kim', color: courseColors[5] },
];

type DemoAssignment = {
  course: string; // matched to a DEMO_COURSES name
  title: string;
  due: number;    // days from today
  priority: Assignment['priority'];
  notes?: string;
  // Only completed assignments carry a grade; incomplete ones stay null.
  grade?: { earned: number; possible: number };
};

const DEMO_ASSIGNMENTS: DemoAssignment[] = [
  // Overdue + due today, so those dashboard sections always have something
  { course: 'Calculus II', title: 'Problem Set 6', due: -2, priority: 'High', notes: 'Sections 8.1–8.3' },
  { course: 'Data Structures', title: 'Linked List Lab', due: 0, priority: 'High' },
  // Upcoming
  { course: 'Technical Writing', title: 'Memo Draft', due: 1, priority: 'Medium' },
  { course: 'Intro to Psychology', title: 'Reading Response 4', due: 3, priority: 'Low' },
  { course: 'Data Structures', title: 'Binary Tree Project', due: 5, priority: 'High', notes: 'Implement insert, delete, and in-order traversal.' },
  { course: 'Calculus II', title: 'Midterm Exam', due: 8, priority: 'High', notes: 'Covers chapters 7–9.' },
  { course: 'Technical Writing', title: 'User Manual Outline', due: 12, priority: 'Medium' },
  { course: 'Intro to Psychology', title: 'Research Summary', due: 15, priority: 'Medium' },
  // Completed (graded) — gives the Grades tab real averages
  { course: 'Data Structures', title: 'Array Warm-up', due: -10, priority: 'Low', grade: { earned: 18, possible: 20 } },
  { course: 'Calculus II', title: 'Problem Set 5', due: -9, priority: 'Medium', grade: { earned: 41, possible: 50 } },
  { course: 'Intro to Psychology', title: 'Chapter 2 Quiz', due: -6, priority: 'Low', grade: { earned: 9, possible: 10 } },
  { course: 'Technical Writing', title: 'Resume Revision', due: -4, priority: 'Medium', grade: { earned: 88, possible: 100 } },
];

export async function seedDemoData(userId: string): Promise<void> {
  // Clear anything left from an earlier, interrupted seed (e.g. the page was
  // reloaded mid-seed, before demo_seeded got set), so a retry can't
  // duplicate courses. Only ever runs for a brand-new anonymous user.
  const { error: clearAssignmentsError } = await supabase
    .from('assignments').delete().eq('user_id', userId);
  if (clearAssignmentsError) throw clearAssignmentsError;
  const { error: clearCoursesError } = await supabase
    .from('courses').delete().eq('user_id', userId);
  if (clearCoursesError) throw clearCoursesError;

  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .insert(DEMO_COURSES.map(c => ({ ...c, user_id: userId })))
    .select('id, name');
  if (coursesError) throw coursesError;

  // Look courses up by name rather than trusting the returned row order.
  const courseIdByName = new Map((courses ?? []).map(c => [c.name as string, c.id as string]));

  const rows = DEMO_ASSIGNMENTS.map(a => {
    const courseId = courseIdByName.get(a.course);
    if (!courseId) throw new Error(`Demo seed: course "${a.course}" was not created.`);
    return {
      course_id: courseId,
      title: a.title,
      due_date: daysFromNow(a.due),
      priority: a.priority,
      completed: !!a.grade,
      notes: a.notes ?? null,
      points_earned: a.grade?.earned ?? null,
      points_possible: a.grade?.possible ?? null,
      user_id: userId,
    };
  });

  const { error: assignmentsError } = await supabase.from('assignments').insert(rows);
  if (assignmentsError) throw assignmentsError;

  // Marks the account as seeded. This also fires onAuthStateChange
  // (USER_UPDATED) with the updated user, which clears the layout's spinner.
  const { error: userError } = await supabase.auth.updateUser({ data: { demo_seeded: true } });
  if (userError) throw userError;
}
