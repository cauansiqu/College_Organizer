import { Assignment, Category, Course } from "../types";

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

// Caller pre-filters `assignments` down to whatever group it wants summarized
// (a course, or a single category within a course). Ungraded assignments are
// excluded entirely from the earned/possible totals — never treated as 0.
export function summarizeGrades(assignments: Assignment[]): CourseGradeSummary {
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

export type CategoryBreakdown = {
    category: Category;
    gradedCount: number;
    totalCount: number;
    percentage: number | null; // this category's own percentage; null if nothing graded in it yet
};

export type CourseGradeResult = {
    hasCategories: boolean;
    percentage: number | null; // flat or weighted average, whichever applies
    gradedCount: number; // total graded assignments in the course, regardless of category
    totalCount: number;
    uncategorizedGradedCount: number; // graded assignments with no categoryId (0 when !hasCategories)
    categoryBreakdown: CategoryBreakdown[]; // empty when !hasCategories
};

// A course with no categories keeps the flat points-based average. A course
// with categories switches to a weighted average of each category's own
// percentage — but only categories that have at least one graded assignment
// count, and the weights are renormalized across just those (against the sum
// of their weights, not against 100) so an as-yet-ungraded category (e.g.
// "Exams 50%" before any exam is taken) doesn't drag the average down as if
// it were a zero.
export function summarizeCourse(
    courseAssignments: Assignment[],
    courseCategories: Category[]
): CourseGradeResult {
    const flat = summarizeGrades(courseAssignments);

    if (courseCategories.length === 0) {
        return {
            hasCategories: false,
            percentage: flat.percentage,
            gradedCount: flat.gradedCount,
            totalCount: flat.totalCount,
            uncategorizedGradedCount: 0,
            categoryBreakdown: [],
        };
    }

    const categoryBreakdown: CategoryBreakdown[] = courseCategories.map((category) => {
        const categoryAssignments = courseAssignments.filter((a) => a.categoryId === category.id);
        const summary = summarizeGrades(categoryAssignments);
        return {
            category,
            gradedCount: summary.gradedCount,
            totalCount: categoryAssignments.length,
            percentage: summary.percentage,
        };
    });

    const included = categoryBreakdown.filter((b) => b.percentage != null);
    const totalWeight = included.reduce((sum, b) => sum + (b.category.weight ?? 0), 0);
    const percentage =
        totalWeight > 0
            ? included.reduce(
                  (sum, b) => sum + (b.percentage as number) * ((b.category.weight ?? 0) / totalWeight),
                  0
              )
            : null;

    const uncategorizedGradedCount = courseAssignments.filter(
        (a) => a.categoryId == null && isAssignmentGraded(a)
    ).length;

    return {
        hasCategories: true,
        percentage,
        gradedCount: flat.gradedCount,
        totalCount: flat.totalCount,
        uncategorizedGradedCount,
        categoryBreakdown,
    };
}
