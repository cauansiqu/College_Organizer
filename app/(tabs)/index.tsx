import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAssignments, getCourses } from '../../storage/storage';
import { parseLocalDate } from '@/utils/dates';
import { Assignment, Course } from '../../types';
import { colors, fonts, priorityColors } from '../../constants/theme';

const PRIORITY_COLORS = priorityColors;

export default function HomeScreen() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // Reload data every time the Home tab is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [a, c] = await Promise.all([getAssignments(), getCourses()]);
    setAssignments(a);
    setCourses(c);
  }

  function getCourse(courseId: string) {
    return courses.find(c => c.id === courseId);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  // Only incomplete assignments
  const incomplete = assignments.filter(a => !a.completed);

  // Overdue: incomplete and due date is before today
  const overdue = incomplete
    .filter(a => parseLocalDate(a.dueDate) < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Due within the next 7 days (not overdue)
  const upcoming = incomplete
    .filter(a => {
      const due = parseLocalDate(a.dueDate);
      return due >= today && due <= in7Days;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // High priority incomplete assignments
  const highPriority = incomplete.filter(a => a.priority === 'High');

  function daysUntil(dateStr: string) {
    const due = new Date(dateStr);
    return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function dueDateLabel(dateStr: string) {
    const d = daysUntil(dateStr);
    if (d === 0) return 'Due today!';
    if (d === 1) return 'Due tomorrow';
    return `Due in ${d}d`;
  }

  function daysOverdueLabel(dateStr: string) {
    const due = parseLocalDate(dateStr);
    due.setHours(0, 0, 0, 0);
    const days = Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return `${days}d overdue`;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 20 }}>

      {/* --- Summary Stats Row --- */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{courses.length}</Text>
          <Text style={styles.statLabel}>Courses</Text>
        </View>
        {/* Pending turns red if anything is overdue */}
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, overdue.length > 0 && { color: colors.danger }]}>
            {incomplete.length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, highPriority.length > 0 && { color: colors.danger }]}>
            {highPriority.length}
          </Text>
          <Text style={styles.statLabel}>High Priority</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {assignments.length > 0
              ? Math.round((assignments.filter(a => a.completed).length / assignments.length) * 100)
              : 0}%
          </Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      {/* --- Overdue --- */}
      {overdue.length > 0 && (
        <View>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.sectionTitle}>Overdue</Text>
          </View>
          {overdue.map(item => {
            const course = getCourse(item.courseId);
            return (
              <View key={item.id} style={[styles.card, { borderLeftColor: colors.danger }]}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardCourse}>{course?.name}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.dueBadgeUrgent}>{daysOverdueLabel(item.dueDate)}</Text>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* --- Due This Week --- */}
      <View>
        <View style={styles.sectionHeader}>
          <Ionicons name="calendar-outline" size={16} color={colors.slate} />
          <Text style={styles.sectionTitle}>Due this week</Text>
        </View>
        {upcoming.length === 0 ? (
          <Text style={styles.emptySection}>Nothing due in the next 7 days.</Text>
        ) : (
          upcoming.map(item => {
            const course = getCourse(item.courseId);
            const days = daysUntil(item.dueDate);
            const isUrgent = days <= 1;
            return (
              <Pressable
                key={item.id}
                onPress={() => router.push('/assignments')}
                style={({ pressed }) => [
                  styles.card,
                  { borderLeftColor: course?.color ?? colors.muted },
                  pressed && styles.pressedCard,
                ]}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardCourse}>{course?.name}</Text>
                </View>

                <View style={styles.cardRight}>
                  <Text style={[styles.dueBadge, isUrgent && styles.dueBadgeUrgent]}>
                    {dueDateLabel(item.dueDate)}
                  </Text>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: PRIORITY_COLORS[item.priority] },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      {/* --- High Priority --- */}
      {highPriority.length > 0 && (
        <View>
          <View style={styles.sectionHeader}>
            <Ionicons name="flag" size={15} color={colors.danger} />
            <Text style={styles.sectionTitle}>High priority</Text>
          </View>
          {highPriority.map(item => {
            const course = getCourse(item.courseId);
            return (
              <View key={item.id} style={[styles.card, { borderLeftColor: colors.danger }]}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardCourse}>{course?.name}</Text>
                </View>
                <Text style={styles.cardDate}>{item.dueDate}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* --- Your Courses --- */}
      <View>
        <View style={styles.sectionHeader}>
          <Ionicons name="school-outline" size={16} color={colors.slate} />
          <Text style={styles.sectionTitle}>Your courses</Text>
        </View>
        {courses.length === 0 ? (
          <Text style={styles.emptySection}>No courses added yet.</Text>
        ) : (
          <View style={styles.courseGrid}>
            {courses.map(c => {
              const count = incomplete.filter(a => a.courseId === c.id).length;
              return (
                <Pressable
                  key={c.id}
                  onPress={() =>
                    router.push({
                      pathname: '/course/[id]',
                      params: { id: String(c.id) },
                    })
                  }
                  style={({ pressed }) => [
                    styles.courseChip,
                    { backgroundColor: c.color },
                    pressed && styles.pressedCourseChip,
                  ]}
                >
                  <Text style={styles.courseChipName}>{c.name}</Text>
                  <Text style={styles.courseChipCount}>{count} pending</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 12,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  statNumber: { fontSize: 24, fontFamily: fonts.mono, fontWeight: '700' as const, color: colors.slate },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.slate },
  emptySection: { fontSize: 14, color: colors.muted, fontStyle: 'italic' },
  card: {
    backgroundColor: colors.card, borderRadius: 10, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 3, marginBottom: 10,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '500' as const, color: colors.slate },
  cardCourse: { fontSize: 12, color: colors.muted, marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardDate: { fontSize: 12, color: colors.muted, fontFamily: fonts.mono },
  dueBadge: {
    fontSize: 10, fontFamily: fonts.mono, color: colors.slate,
    backgroundColor: colors.paper, paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: colors.border,
  },
  dueBadgeUrgent: {
    fontSize: 10, fontFamily: fonts.mono,
    backgroundColor: '#FCEBEB', color: colors.danger,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
  },
  pressedCard: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  pressedCourseChip: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  courseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  courseChip: { borderRadius: 10, padding: 14, minWidth: 140 },
  courseChipName: { color: '#fff', fontFamily: fonts.display, fontSize: 14 },
  courseChipCount: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, fontFamily: fonts.mono },
});