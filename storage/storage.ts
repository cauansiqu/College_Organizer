import AsyncStorage from "@react-native-async-storage/async-storage";
import { Course, Assignment } from "../types";

// Storage keys
const COURSES_KEY = "courses";
const ASSIGNMENTS_KEY = "assignments";

// --- COURSES ---

// Load all courses from storage
export async function getCourses(): Promise<Course[]> {
    const data = await AsyncStorage.getItem(COURSES_KEY);
    return data ? JSON.parse(data) : [];
}

// Save a new course (loads existing courses, adds the new one, and saves back to storage)
export async function saveCourse(course: Course): Promise<void> {
    const existing = await getCourses();
    const updated = [...existing, course];
    await AsyncStorage.setItem(COURSES_KEY, JSON.stringify(updated));
}

// Delete a course by ID
export async function deleteCourse(id: string): Promise<void> {
    const existing = await getCourses();
    const updated = existing.filter(course => course.id !== id);
    await AsyncStorage.setItem(COURSES_KEY, JSON.stringify(updated));
}

// --- ASSIGNMENTS ---

// Load all assignments from storage
export async function getAssignments(): Promise<Assignment[]> {
    const data = await AsyncStorage.getItem(ASSIGNMENTS_KEY);
    return data ? JSON.parse(data) : [];
}

// Save a new assignment
export async function saveAssignment(assignment: Assignment): Promise<void> {
    const existing = await getAssignments();
    const updated = [...existing, assignment];
    await AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(updated));
}

// Delete an assignment by ID
export async function deleteAssignment(id: string): Promise<void> {
    const existing = await getAssignments();
    const updated = existing.filter(assignment => assignment.id !== id);
    await AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(updated));
}

// Toggle an assignment's completion status
export async function toggleAssignment(id: string): Promise<void> {
    const existing = await getAssignments();
    const updated = existing.map(a => a.id === id ? { ...a, completed: !a.completed } : a);
    await AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(updated));
}

// Replace a course with an updated version
export async function updateCourse(updated: Course): Promise<void> {
    const existing = await getCourses();
    const newList = existing.map(c => c.id === updated.id ? updated: c);
    await AsyncStorage.setItem(COURSES_KEY, JSON.stringify(newList));
}

// Replace an assignment with an updated version
export async function updateAssignment(updated: Assignment): Promise<void> {
    const existing = await getAssignments();
    const newList = existing.map(a => a.id === updated.id ? updated : a);
    await AsyncStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(newList));
}