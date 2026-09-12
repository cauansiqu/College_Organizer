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
}

// An "Assignment" is any task linked to a course
export type Assignment = {
    id: string;         // Unique identifier
    courseId: string;   // ID of the course this assignment belongs to
    title: string;      // Title of the assignment
    dueDate: string;    // Due date in ISO format (e.g., "2024-09-30T23:59:00Z")
    priority: "Low" | "Medium" | "High";  // Priority level of the assignment
    completed: boolean;     // Completion status of the assignment
    notes: string;          // Additional notes for the assignment
    pointsEarned: number | null;    // Points scored; null until graded
    pointsPossible: number | null;  // Points the assignment was worth; null until graded
}