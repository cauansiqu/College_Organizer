import { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts } from '../../constants/theme';
import {
  getAssignments,
  getCategories,
  getCourses,
  saveCategory,
  updateAssignment,
  updateCategory,
  updateCourse,
  deleteCategory,
} from '../../storage/storage';
import { Assignment, Category, Course } from '../../types';
import {
  GradeThresholds,
  getAssignmentPercentage,
  getLetterGrade,
  summarizeCourse,
  summarizeGrades,
  thresholdsFromCourse,
} from '../../utils/grades';
import GradeThresholdsModal from '../../components/GradeThresholdsModal';

type Draft = { earned: string; possible: string };

export default function GradesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Per-assignment in-progress text for the inline earned/possible inputs.
  // Kept separate from `assignments` so a background refetch never clobbers
  // what the user is mid-typing.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  // Validation/save-failure messages shown inline under a row, keyed by
  // assignment id, so a bad entry or a failed write is visible instead of
  // silently disappearing.
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [thresholdsCourse, setThresholdsCourse] = useState<Course | null>(null);
  const hasExpandedDefault = useRef(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const [a, c, cat] = await Promise.all([getAssignments(), getCourses(), getCategories()]);
        setAssignments(a);
        setCourses(c);
        setCategories(cat);
        if (!hasExpandedDefault.current && c.length > 0) {
          hasExpandedDefault.current = true;
          setExpandedIds(new Set([c[0].id]));
        }
      }
      load();
    }, []),
  );

  function toggleExpanded(courseId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function draftFor(assignment: Assignment): Draft {
    return (
      drafts[assignment.id] ?? {
        earned: assignment.pointsEarned != null ? String(assignment.pointsEarned) : '',
        possible: assignment.pointsPossible != null ? String(assignment.pointsPossible) : '',
      }
    );
  }

  function setDraft(assignmentId: string, draft: Draft) {
    setDrafts((prev) => ({ ...prev, [assignmentId]: draft }));
  }

  function setRowError(assignmentId: string, message: string) {
    setRowErrors((prev) => ({ ...prev, [assignmentId]: message }));
  }

  function clearRowError(assignmentId: string) {
    setRowErrors((prev) => {
      if (!(assignmentId in prev)) return prev;
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
  }

  // Called on blur (and Enter) of either the earned or possible input for a
  // row. Only acts when the pair is unambiguous — both filled, or both
  // blank. If only one field is filled, the user is very likely mid-tab
  // between the two inputs in the same row (typing earned, then Tab into
  // possible fires this on the earned field's blur while possible is still
  // empty) — in that case we leave the draft exactly as typed and do
  // nothing, rather than guessing that it's wrong and reverting it. Genuine
  // problems (bad numbers, or a failed write) are surfaced as an inline
  // error on the row instead of silently discarding what was typed.
  async function commitDraft(assignment: Assignment) {
    const draft = draftFor(assignment);
    const earnedText = draft.earned.trim();
    const possibleText = draft.possible.trim();

    if (!earnedText && !possibleText) {
      clearRowError(assignment.id);
      if (assignment.pointsEarned != null || assignment.pointsPossible != null) {
        await saveGrade(assignment, null, null);
      }
      return;
    }

    if (!earnedText || !possibleText) {
      // Incomplete pair — leave it alone, not an error yet.
      clearRowError(assignment.id);
      return;
    }

    const earned = parseFloat(earnedText);
    const possible = parseFloat(possibleText);

    if (!Number.isFinite(earned) || earned < 0) {
      setRowError(assignment.id, 'Points earned must be a number of 0 or more.');
      return;
    }
    if (!Number.isFinite(possible) || possible <= 0) {
      setRowError(assignment.id, 'Points possible must be greater than 0.');
      return;
    }

    await saveGrade(assignment, earned, possible);
  }

  async function saveGrade(assignment: Assignment, earned: number | null, possible: number | null) {
    const updated: Assignment = { ...assignment, pointsEarned: earned, pointsPossible: possible };
    try {
      await updateAssignment(updated);
    } catch (err) {
      // Keep the typed values in place — surface the failure instead of
      // reverting, so it's clear the save didn't just silently drop.
      setRowError(
        assignment.id,
        `Couldn't save: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return;
    }
    setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[assignment.id];
      return next;
    });
    clearRowError(assignment.id);
  }

  async function handleSaveThresholds(thresholds: GradeThresholds) {
    if (!thresholdsCourse) return;
    const updated: Course = { ...thresholdsCourse, ...thresholds };
    await updateCourse(updated);
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setThresholdsCourse(null);
  }

  async function handleAddCategory(name: string, weight: number) {
    if (!thresholdsCourse) return;
    const created = await saveCategory({ id: '', courseId: thresholdsCourse.id, name, weight });
    setCategories((prev) => [...prev, created]);
  }

  async function handleUpdateCategory(updated: Category) {
    await updateCategory(updated);
    setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function handleDeleteCategory(id: string) {
    await deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    // The DB already un-links these via ON DELETE SET NULL — mirror that
    // locally so the UI doesn't wait on a refetch to reflect it.
    setAssignments((prev) => prev.map((a) => (a.categoryId === id ? { ...a, categoryId: null } : a)));
  }

  return (
    <View style={styles.container}>
      {courses.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No courses yet.</Text>
          <Text style={styles.emptySubText}>Add a course to start tracking grades.</Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          renderItem={({ item: course }) => {
            const courseAssignments = assignments
              .filter((a) => a.courseId === course.id)
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            const courseCategories = categories.filter((c) => c.courseId === course.id);
            const result = summarizeCourse(courseAssignments, courseCategories);
            const flatPoints = summarizeGrades(courseAssignments);
            const expanded = expandedIds.has(course.id);
            const letter =
              result.percentage != null
                ? getLetterGrade(result.percentage, thresholdsFromCourse(course))
                : null;

            return (
              <View style={styles.card}>
                <View style={[styles.header, { backgroundColor: course.color }]}>
                  <View style={styles.headerTop}>
                    <View style={styles.headerText}>
                      <Text style={styles.courseName}>{course.name}</Text>
                      <Text style={styles.summaryLine}>
                        {result.gradedCount > 0
                          ? result.hasCategories
                            ? `Weighted · ${result.gradedCount} graded`
                            : `${trimNum(flatPoints.earned)} / ${trimNum(flatPoints.possible)} points · ${result.gradedCount} graded`
                          : `No grades entered yet · ${result.totalCount} assignment${result.totalCount === 1 ? '' : 's'}`}
                      </Text>
                    </View>
                    <View style={styles.headerActions}>
                      {result.percentage != null && letter && (
                        <View style={styles.gradeBadge}>
                          <Text style={styles.gradePercent}>{Math.round(result.percentage)}%</Text>
                          <Text style={styles.gradeLetter}>{letter}</Text>
                        </View>
                      )}
                      <TouchableOpacity onPress={() => setThresholdsCourse(course)} hitSlop={8}>
                        <Ionicons name="settings-outline" size={18} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => toggleExpanded(course.id)} hitSlop={8}>
                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {expanded && (
                  <View style={styles.body}>
                    {result.hasCategories && (
                      <View style={styles.breakdown}>
                        {result.categoryBreakdown.map((b) => {
                          const graded = b.percentage != null;
                          const strong = graded && (b.percentage as number) >= course.gradeBMin;
                          const barColor = graded ? (strong ? colors.success : colors.warning) : colors.border;
                          return (
                            <View key={b.category.id} style={styles.breakdownRow}>
                              <Text style={styles.breakdownName} numberOfLines={1}>
                                {b.category.name}
                              </Text>
                              <Text style={styles.breakdownWeight}>{trimNum(b.category.weight ?? 0)}%</Text>
                              <View style={styles.progressTrack}>
                                <View
                                  style={[
                                    styles.progressFill,
                                    { width: `${Math.min(100, Math.max(0, graded ? (b.percentage as number) : 0))}%`, backgroundColor: barColor },
                                  ]}
                                />
                              </View>
                              <Text
                                style={[
                                  styles.breakdownPercent,
                                  graded ? { color: strong ? colors.success : colors.warning } : styles.rowPercentUngraded,
                                ]}
                              >
                                {graded ? `${Math.round(b.percentage as number)}%` : '—'}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {courseAssignments.length === 0 ? (
                      <Text style={styles.noAssignments}>No assignments in this course yet.</Text>
                    ) : (
                      courseAssignments.map((assignment) => {
                        const draft = draftFor(assignment);
                        const percentage = getAssignmentPercentage(assignment);
                        const isGraded = percentage != null;
                        const uncounted = result.hasCategories && isGraded && assignment.categoryId == null;
                        const strong = isGraded && percentage >= course.gradeBMin;
                        const rowError = rowErrors[assignment.id];
                        const assignmentCategory = categories.find((c) => c.id === assignment.categoryId);

                        return (
                          <View key={assignment.id} style={styles.rowWrap}>
                            <View style={styles.row}>
                              <View style={styles.rowTitleWrap}>
                                <Text style={styles.rowTitle} numberOfLines={1}>
                                  {assignment.title}
                                </Text>
                                {result.hasCategories && assignmentCategory && (
                                  <View style={styles.categoryChip}>
                                    <Text style={styles.categoryChipText} numberOfLines={1}>{assignmentCategory.name}</Text>
                                  </View>
                                )}
                                {uncounted && (
                                  <View style={styles.categoryChipMissing}>
                                    <Text style={styles.categoryChipMissingText}>No category</Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.rowInputs}>
                                <TextInput
                                  style={[styles.rowInput, !draft.earned && styles.rowInputEmpty]}
                                  value={draft.earned}
                                  placeholder="—"
                                  keyboardType="numeric"
                                  onChangeText={(text) => setDraft(assignment.id, { ...draft, earned: text })}
                                  onBlur={() => commitDraft(assignment)}
                                  onSubmitEditing={() => commitDraft(assignment)}
                                />
                                <Text style={styles.rowSlash}>/</Text>
                                <TextInput
                                  style={[styles.rowInput, !draft.possible && styles.rowInputEmpty]}
                                  value={draft.possible}
                                  placeholder="—"
                                  keyboardType="numeric"
                                  onChangeText={(text) => setDraft(assignment.id, { ...draft, possible: text })}
                                  onBlur={() => commitDraft(assignment)}
                                  onSubmitEditing={() => commitDraft(assignment)}
                                />
                              </View>
                              <Text
                                style={[
                                  styles.rowPercent,
                                  isGraded
                                    ? { color: uncounted ? colors.muted : strong ? colors.success : colors.warning }
                                    : styles.rowPercentUngraded,
                                ]}
                              >
                                {isGraded ? `${Math.round(percentage)}%` : 'ungraded'}
                              </Text>
                            </View>
                            {rowError && <Text style={styles.rowError}>{rowError}</Text>}
                          </View>
                        );
                      })
                    )}

                    {result.hasCategories && result.uncategorizedGradedCount > 0 && (
                      <Text style={styles.uncategorizedWarning}>
                        {`${result.uncategorizedGradedCount} graded assignment${result.uncategorizedGradedCount === 1 ? '' : 's'} aren't in a category and aren't counted toward the average.`}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <GradeThresholdsModal
        visible={thresholdsCourse !== null}
        course={thresholdsCourse}
        categories={thresholdsCourse ? categories.filter((c) => c.courseId === thresholdsCourse.id) : []}
        onCancel={() => setThresholdsCourse(null)}
        onSave={handleSaveThresholds}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
      />
    </View>
  );
}

// Drops a trailing ".0" so whole-number point totals read cleanly.
function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontFamily: fonts.display, color: colors.slate },
  emptySubText: { fontSize: 14, color: colors.muted, marginTop: 6 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { padding: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerText: { flex: 1, marginRight: 12 },
  courseName: { fontSize: 18, fontFamily: fonts.display, color: '#fff' },
  summaryLine: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gradeBadge: { alignItems: 'flex-end', marginRight: 2 },
  gradePercent: { fontSize: 18, fontFamily: fonts.mono, fontWeight: '700' as const, color: '#fff' },
  gradeLetter: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  body: { padding: 16, paddingTop: 12, gap: 12 },
  noAssignments: { fontSize: 13, color: colors.muted, fontStyle: 'italic' as const },
  breakdown: { gap: 8, marginBottom: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownName: { width: 90, fontSize: 12, color: colors.slate },
  breakdownWeight: { width: 36, fontSize: 11, fontFamily: fonts.mono, color: colors.muted },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  breakdownPercent: { width: 44, fontSize: 12, fontFamily: fonts.mono, textAlign: 'right' },
  rowWrap: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowError: { fontSize: 11, color: colors.danger },
  rowTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { flexShrink: 1, fontSize: 14, color: colors.slate },
  categoryChip: { backgroundColor: colors.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 90 },
  categoryChipText: { fontSize: 10, color: colors.slate },
  categoryChipMissing: { backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  categoryChipMissingText: { fontSize: 10, color: '#fff', fontWeight: '600' as const },
  uncategorizedWarning: { fontSize: 11, color: colors.danger, marginTop: 4 },
  rowInputs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowInput: {
    width: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: colors.paper,
    color: colors.slate,
  },
  rowInputEmpty: { borderStyle: 'dashed' },
  rowSlash: { fontSize: 13, color: colors.muted },
  rowPercent: { width: 60, fontSize: 13, fontFamily: fonts.mono, textAlign: 'right' },
  rowPercentUngraded: { color: colors.muted },
});
