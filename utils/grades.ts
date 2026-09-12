import { Assignment, Course } from "../types";

export type GradeThresholds = {
    gradeAMin: number;
    gradeBMin: number;
    gradeCMin: number;
    gradeDMin: number;
};

export type LetterGrade = "A" | "B" | "C" | "D" | "F";

export function thresholdsFromCourse(course: Course): GradeThresholds {
    return {
        gradeAMin: course.gradeAMin,
        gradeBMin: course.gradeBMin,
        gradeCMin: course.gradeCMin,
        gradeDMin: course.gradeDMin,
    };
}

// null when the assignment isn't gradeable yet (missing a value, or a
// possible-points total that isn't a usable positive number).
export function getAssignmentPercentage(
    a: Pick<Assignment, "pointsEarned" | "pointsPossible">
): number | null {
    if (a.pointsEarned == null || a.pointsPossible == null) return null;
    if (!(a.pointsPossible > 0)) return null;
    return (a.pointsEarned / a.pointsPossible) * 100;
}

export function isAssignmentGraded(
    a: Pick<Assignment, "pointsEarned" | "pointsPossible">
): boolean {
    return getAssignmentPercentage(a) !== null;
}

export type CourseGradeSummary = {
    earned: number;
    possible: number;
    percentage: number | null; // null when gradedCount is 0
    gradedCount: number;
    totalCount: number;
};

// Caller pre-filters `assignments` down to one course. Ungraded assignments
// are excluded entirely from the earned/possible totals — never treated as 0.
export function summarizeCourseGrades(assignments: Assignment[]): CourseGradeSummary {
    let earned = 0;
    let possible = 0;
    let gradedCount = 0;

    for (const a of assignments) {
        if (!isAssignmentGraded(a)) continue;
        earned += a.pointsEarned as number;
        possible += a.pointsPossible as number;
        gradedCount++;
    }

    return {
        earned,
        possible,
        percentage: gradedCount > 0 ? (earned / possible) * 100 : null,
        gradedCount,
        totalCount: assignments.length,
    };
}

export function getLetterGrade(percentage: number, thresholds: GradeThresholds): LetterGrade {
    if (percentage >= thresholds.gradeAMin) return "A";
    if (percentage >= thresholds.gradeBMin) return "B";
    if (percentage >= thresholds.gradeCMin) return "C";
    if (percentage >= thresholds.gradeDMin) return "D";
    return "F";
}
