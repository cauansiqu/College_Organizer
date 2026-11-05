// A "Course" represents one of the college classes
export type Course = {
    id: string;     // Unique identifier
    name: string;   // Name of the Course
    professor: string;  // Name of the professor
    color: string;  // Color code for UI representation (e.g., "#FF5733")
    gradeAMin: number;  // Minimum percentage for an A in this course
    gradeBMin: number;  // Minimum percentage for a B
    gradeCMin: number;  // Minimum percentage for a C
    gradeDMin: number;  // Minimum percentage for a D (below this is an F)
    code?: string | null;   // Short course code (e.g. "CS 330"); syncs match feed items by it
}

// Where an assignment came from. Anything other than 'manual' is owned by a
// sync, so its title/due date/course are read-only in the UI.
export type AssignmentSource = "manual" | "moodle" | "blackboard" | "syllabus";

// An "Assignment" is any task linked to a course
export type Assignment = {
    id: string;         // Unique identifier
    courseId: string;   // ID of the course this assignment belongs to
    title: string;      // Title of the assignment
    dueDate: string;    // Date-only string, "YYYY-MM-DD" (see utils/dates.ts)
    priority: "Low" | "Medium" | "High";  // Priority level of the assignment
    completed: boolean;     // Completion status of the assignment
    notes: string;          // Additional notes for the assignment
    pointsEarned: number | null;    // Points scored; null until graded
    pointsPossible: number | null;  // Points the assignment was worth; null until graded
    categoryId: string | null;      // Weighted grade category this belongs to; null if uncategorized
    // Sync metadata — optional so app-created assignments don't need to set
    // them (the DB defaults source to 'manual'). Missing source = manual.
    source?: AssignmentSource;
    externalId?: string | null;     // The feed's id for synced rows
    dueAt?: string | null;          // Exact due time (ISO timestamp); dueDate stays the date the app uses
    itemType?: string | null;       // exam | project | quiz | hw | reading | post | lab | other
}

// A "Category" is a weighted grouping of assignments within a course
// (e.g. "Homework" 30%, "Exams" 50%) used to compute a weighted average
// instead of a flat points total.
export type Category = {
    id: string;
    courseId: string;
    name: string;
    weight: number | null;  // percentage weight; nullable to match the DB column
}

// --- Semester Planner ---

// One item on the day-by-day plan, optionally tied to a course/assignment
export type PlanTask = {
    id: string;
    courseId: string | null;
    assignmentId: string | null;
    planDate: string;       // Date-only string, "YYYY-MM-DD" (see utils/dates.ts)
    title: string;
    note: string | null;
    sortOrder: number;      // Order within the day
    rolledCount: number;    // How many times it was carried over to a later day
    completed: boolean;
    createdAt: string;      // ISO timestamp
}

// A work shift pulled from the schedule feed (Sling)
export type WorkShift = {
    id: string;
    externalId: string | null;
    title: string;
    startsAt: string;       // ISO timestamp
    endsAt: string;         // ISO timestamp
    source: string;
}

// One entry in the planner's activity log
export type PlannerChange = {
    id: string;
    happenedAt: string;     // ISO timestamp
    kind: "added" | "moved" | "removed" | "shift" | "info" | "syllabus";
    message: string;
}

// Per-user timestamps of the last sync / plan run (ISO strings; null = never)
export type PlannerMeta = {
    courseworkSyncedAt: string | null;
    slingSyncedAt: string | null;
    planMadeAt: string | null;
}