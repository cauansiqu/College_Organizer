import { supabase } from "../lib/supabase";
import { cancelAssignmentReminders, scheduleAssignmentReminders } from "../lib/notifications";
import { Course, Assignment, Category } from "../types";

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
};

type CategoryRow = {
    id: string;
    course_id: string | null;
    name: string;
    weight: number | null;
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
