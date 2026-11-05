import { supabase } from "../lib/supabase";
import { cancelAssignmentReminders, scheduleAssignmentReminders } from "../lib/notifications";
import {
    Course, Assignment, Category, PlanTask, WorkShift, PlannerChange, PlannerMeta,
} from "../types";

// The DB uses snake_case columns; the app's types use camelCase. These
// shapes describe what Supabase actually returns, and the map*FromRow
// helpers below translate rows into the app's existing Course/Assignment
// types so nothing outside this file needs to know about the DB's naming.
type CourseRow = {
    id: string;
    name: string;
    professor: string | null;
    color: string | null;
    grade_a_min: number;
    grade_b_min: number;
    grade_c_min: number;
    grade_d_min: number;
    code: string | null;
};

type AssignmentRow = {
    id: string;
    course_id: string | null;
    title: string;
    due_date: string;
    priority: Assignment["priority"];
    completed: boolean;
    notes: string | null;
    points_earned: number | null;
    points_possible: number | null;
    category_id: string | null;
    source: NonNullable<Assignment["source"]>;
    external_id: string | null;
    due_at: string | null;
    item_type: string | null;
};

type CategoryRow = {
    id: string;
    course_id: string | null;
    name: string;
    weight: number | null;
};

type PlanTaskRow = {
    id: string;
    course_id: string | null;
    assignment_id: string | null;
    plan_date: string;
    title: string;
    note: string | null;
    sort_order: number;
    rolled_count: number;
    completed: boolean;
    created_at: string;
};

type WorkShiftRow = {
    id: string;
    external_id: string | null;
    title: string;
    starts_at: string;
    ends_at: string;
    source: string;
};

type PlannerChangeRow = {
    id: string;
    happened_at: string;
    kind: PlannerChange["kind"];
    message: string;
};

type PlannerMetaRow = {
    coursework_synced_at: string | null;
    sling_synced_at: string | null;
    plan_made_at: string | null;
};

function courseFromRow(row: CourseRow): Course {
    return {
        id: row.id,
        name: row.name,
        professor: row.professor ?? "",
        color: row.color ?? "",
        gradeAMin: row.grade_a_min,
        gradeBMin: row.grade_b_min,
        gradeCMin: row.grade_c_min,
        gradeDMin: row.grade_d_min,
        code: row.code ?? null,
    };
}

function assignmentFromRow(row: AssignmentRow): Assignment {
    return {
        id: row.id,
        courseId: row.course_id ?? "",
        title: row.title,
        dueDate: row.due_date,
        priority: row.priority,
        completed: row.completed,
        notes: row.notes ?? "",
        pointsEarned: row.points_earned ?? null,
        pointsPossible: row.points_possible ?? null,
        categoryId: row.category_id ?? null,
        source: row.source ?? "manual",
        externalId: row.external_id ?? null,
        dueAt: row.due_at ?? null,
        itemType: row.item_type ?? null,
    };
}

function categoryFromRow(row: CategoryRow): Category {
    return {
        id: row.id,
        courseId: row.course_id ?? "",
        name: row.name,
        weight: row.weight ?? null,
    };
}

function planTaskFromRow(row: PlanTaskRow): PlanTask {
    return {
        id: row.id,
        courseId: row.course_id ?? null,
        assignmentId: row.assignment_id ?? null,
        planDate: row.plan_date,
        title: row.title,
        note: row.note ?? null,
        sortOrder: row.sort_order,
        rolledCount: row.rolled_count,
        completed: row.completed,
        createdAt: row.created_at,
    };
}

function workShiftFromRow(row: WorkShiftRow): WorkShift {
    return {
        id: row.id,
        externalId: row.external_id ?? null,
        title: row.title,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        source: row.source,
    };
}

function plannerChangeFromRow(row: PlannerChangeRow): PlannerChange {
    return {
        id: row.id,
        happenedAt: row.happened_at,
        kind: row.kind,
        message: row.message,
    };
}

function plannerMetaFromRow(row: PlannerMetaRow): PlannerMeta {
    return {
        courseworkSyncedAt: row.coursework_synced_at ?? null,
        slingSyncedAt: row.sling_synced_at ?? null,
        planMadeAt: row.plan_made_at ?? null,
    };
}

// Every screen that reaches storage.ts is already behind the root layout's
// auth gate, so a session is always expected to exist here.
async function currentUserId(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
        throw new Error("No logged-in user — storage.ts requires an active session.");
    }
    return userId;
}

// --- COURSES ---

// Load all courses belonging to the current user
export async function getCourses(): Promise<Course[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map(courseFromRow);
}

// Save a new course. Postgres generates the real id — the id on the
// passed-in course object is ignored, and the DB-created row is returned
// so callers can use its real id instead.
export async function saveCourse(course: Course): Promise<Course> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("courses")
        .insert({
            name: course.name,
            professor: course.professor,
            color: course.color,
            user_id: userId,
        })
        .select()
        .single();
    if (error) throw error;
    return courseFromRow(data);
}

// Delete a course by ID
export async function deleteCourse(id: string): Promise<void> {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) throw error;
}

// --- ASSIGNMENTS ---

// Load all assignments belonging to the current user
export async function getAssignments(): Promise<Assignment[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map(assignmentFromRow);
}

// Save a new assignment. Postgres generates the real id, same as saveCourse.
export async function saveAssignment(assignment: Assignment): Promise<Assignment> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("assignments")
        .insert({
            course_id: assignment.courseId || null,
            title: assignment.title,
            due_date: assignment.dueDate,
            priority: assignment.priority,
            completed: assignment.completed,
            notes: assignment.notes,
            points_earned: assignment.pointsEarned,
            points_possible: assignment.pointsPossible,
            category_id: assignment.categoryId,
            user_id: userId,
        })
        .select()
        .single();
    if (error) throw error;
    const saved = assignmentFromRow(data);
    await scheduleAssignmentReminders(saved);
    return saved;
}

// Delete an assignment by ID
export async function deleteAssignment(id: string): Promise<void> {
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) throw error;
    await cancelAssignmentReminders(id);
}

// Toggle an assignment's completion status
export async function toggleAssignment(id: string): Promise<void> {
    const { data: current, error: fetchError } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", id)
        .single();
    if (fetchError) throw fetchError;

    const { error } = await supabase
        .from("assignments")
        .update({ completed: !current.completed })
        .eq("id", id);
    if (error) throw error;

    if (current.completed) {
        // Was completed, now un-completing — reminders should exist again.
        await scheduleAssignmentReminders(assignmentFromRow({ ...current, completed: false }));
    } else {
        await cancelAssignmentReminders(id);
    }
}

// Replace a course with an updated version
export async function updateCourse(updated: Course): Promise<void> {
    const { error } = await supabase
        .from("courses")
        .update({
            name: updated.name,
            professor: updated.professor,
            color: updated.color,
            grade_a_min: updated.gradeAMin,
            grade_b_min: updated.gradeBMin,
            grade_c_min: updated.gradeCMin,
            grade_d_min: updated.gradeDMin,
        })
        .eq("id", updated.id);
    if (error) throw error;
}

// Replace an assignment with an updated version
export async function updateAssignment(updated: Assignment): Promise<void> {
    const { error } = await supabase
        .from("assignments")
        .update({
            course_id: updated.courseId || null,
            title: updated.title,
            due_date: updated.dueDate,
            priority: updated.priority,
            completed: updated.completed,
            notes: updated.notes,
            points_earned: updated.pointsEarned,
            points_possible: updated.pointsPossible,
            category_id: updated.categoryId,
        })
        .eq("id", updated.id);
    if (error) throw error;

    if (updated.completed) {
        await cancelAssignmentReminders(updated.id);
    } else {
        await scheduleAssignmentReminders(updated);
    }
}

// --- CATEGORIES ---

// Load all categories belonging to the current user
export async function getCategories(): Promise<Category[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map(categoryFromRow);
}

// Save a new category. Postgres generates the real id, same as saveCourse.
export async function saveCategory(category: Category): Promise<Category> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("categories")
        .insert({
            course_id: category.courseId,
            name: category.name,
            weight: category.weight,
            user_id: userId,
        })
        .select()
        .single();
    if (error) throw error;
    return categoryFromRow(data);
}

// Replace a category with an updated version
export async function updateCategory(updated: Category): Promise<void> {
    const { error } = await supabase
        .from("categories")
        .update({
            course_id: updated.courseId,
            name: updated.name,
            weight: updated.weight,
        })
        .eq("id", updated.id);
    if (error) throw error;
}

// Delete a category by ID
export async function deleteCategory(id: string): Promise<void> {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
}

// --- PLANNER ---

// Load the current user's plan tasks between two "YYYY-MM-DD" dates
// (inclusive), in the order they should appear: by day, then sort_order.
export async function getPlanTasks(fromDate: string, toDate: string): Promise<PlanTask[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("plan_tasks")
        .select("*")
        .eq("user_id", userId)
        .gte("plan_date", fromDate)
        .lte("plan_date", toDate)
        .order("plan_date", { ascending: true })
        .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(planTaskFromRow);
}

// Mark a plan task done/not done. RLS limits this to the user's own rows.
export async function setPlanTaskCompleted(id: string, completed: boolean): Promise<void> {
    const { error } = await supabase
        .from("plan_tasks")
        .update({ completed })
        .eq("id", id);
    if (error) throw error;
}

// Load the current user's work shifts that OVERLAP [fromISO, toISO) — not
// just ones that start inside it — so a shift crossing midnight still shows
// up on the day it ends.
export async function getWorkShifts(fromISO: string, toISO: string): Promise<WorkShift[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("work_shifts")
        .select("*")
        .eq("user_id", userId)
        .gt("ends_at", fromISO)
        .lt("starts_at", toISO)
        .order("starts_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(workShiftFromRow);
}

// Load the most recent planner activity-log entries, newest first
export async function getPlannerChanges(limit = 30): Promise<PlannerChange[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("planner_changes")
        .select("*")
        .eq("user_id", userId)
        .order("happened_at", { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data ?? []).map(plannerChangeFromRow);
}

// Load the user's last-sync/plan timestamps. Returns null if the user has
// never synced (no row yet) — maybeSingle() instead of single(), which
// would throw on zero rows.
export async function getPlannerMeta(): Promise<PlannerMeta | null> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from("planner_meta")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) throw error;
    return data ? plannerMetaFromRow(data) : null;
}
