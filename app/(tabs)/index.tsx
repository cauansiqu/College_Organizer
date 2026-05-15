import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getAssignments, getCourses } from '../../storage/storage';
import { Assignment, Course } from '../../types';

const PRIORITY_COLORS: Record<string, string> = {
  Low: '#2ECC71',
  Medium: '#F39C12',
  High: '#E74C3C',
};

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
    .filter(a => new Date(a.dueDate) < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Due within the next 7 days (not overdue)
  const upcoming = incomplete
    .filter(a => {
      const due = new Date(a.dueDate);
      return due >= today && due <= in7Days;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // High priority incomplete assignments
  const highPriority = incomplete.filter(a => a.priority === 'High');

  function daysUntil(dateStr: string) {
    const due = new Date(dateStr);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function dueDateLabel(dateStr: string) {
    const d = daysUntil(dateStr);
    if (d === 0) return 'Due today!';
    if (d === 1) return 'Due tomorrow';
    return `Due in ${d}d`;
  }

  function daysOverdueLabel(dateStr: string) {
    const due = new Date(dateStr);
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
          <Text style={[styles.statNumber, overdue.length > 0 && { color: '#E74C3C' }]}>
            {incomplete.length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, highPriority.length > 0 && { color: '#E74C3C' }]}>
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
          <Text style={styles.sectionTitle}>🚨 Overdue</Text>
          {overdue.map(item => {
            const course = getCourse(item.courseId);
            return (
              <View key={item.id} style={[styles.card, { borderLeftColor: '#E74C3C' }]}>
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
        <Text style={styles.sectionTitle}>📅 Due This Week</Text>
        {upcoming.length === 0 ? (
          <Text style={styles.emptySection}>Nothing due in the next 7 days 🎉</Text>
        ) : (
          upcoming.map(item => {
            const course = getCourse(item.courseId);
            const days = daysUntil(item.dueDate);
            const isUrgent = days <= 1;
            return (
              <View key={item.id} style={[styles.card, { borderLeftColor: course?.color ?? '#ccc' }]}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardCourse}>{course?.name}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[styles.dueBadge, isUrgent && styles.dueBadgeUrgent]}>
                    {dueDateLabel(item.dueDate)}
                  </Text>
                  <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] }]} />
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* --- High Priority --- */}
      {highPriority.length > 0 && (
        <View>
          <Text style={styles.sectionTitle}>🔴 High Priority</Text>
          {highPriority.map(item => {
            const course = getCourse(item.courseId);
            return (
              <View key={item.id} style={[styles.card, { borderLeftColor: '#E74C3C' }]}>
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
        <Text style={styles.sectionTitle}>🎓 Your Courses</Text>
        {courses.length === 0 ? (
          <Text style={styles.emptySection}>No courses added yet.</Text>
        ) : (
          <View style={styles.courseGrid}>
            {courses.map(c => {
              const count = incomplete.filter(a => a.courseId === c.id).length;
              return (
                <View key={c.id} style={[styles.courseChip, { backgroundColor: c.color }]}>
                  <Text style={styles.courseChipName}>{c.name}</Text>
                  <Text style={styles.courseChipCount}>{count} pending</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12,
    padding: 12, alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
  },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#222' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 10 },
  emptySection: { fontSize: 14, color: '#999', fontStyle: 'italic' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 5, marginBottom: 10,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#222' },
  cardCourse: { fontSize: 12, color: '#888', marginTop: 2 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardDate: { fontSize: 12, color: '#888' },
  dueBadge: {
    fontSize: 11, fontWeight: '600', color: '#555',
    backgroundColor: '#eee', paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 10,
  },
  dueBadgeUrgent: {
    fontSize: 11, fontWeight: '600',
    backgroundColor: '#FDECEA', color: '#E74C3C',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  courseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  courseChip: {
    borderRadius: 12, padding: 14, minWidth: 140,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
  },
  courseChipName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  courseChipCount: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
});