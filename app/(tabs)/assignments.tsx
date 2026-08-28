import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList,
         Modal, TextInput, Alert, ScrollView, useWindowDimensions } from 'react-native';
import { getAssignments, saveAssignment, deleteAssignment, toggleAssignment, updateAssignment, getCourses } from '../../storage/storage';
import { Assignment, Course } from '../../types';
import DatePickerField from '../../components/DatePickerField';
import CalendarMonth from '../../components/CalendarMonth';
import { colors, fonts, priorityColors } from '../../constants/theme';

const PRIORITIES = ['Low', 'Medium', 'High'] as const;
type SortMode = 'date' | 'priority';
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function daysUntil(dueDate: string) {
  const due = new Date(dueDate.slice(0, 10) + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  return diff;
}

export default function AssignmentsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('date');

  // Form fields
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [a, c] = await Promise.all([getAssignments(), getCourses()]);
    setAssignments(a);
    setCourses(c);
    if (c.length > 0) setSelectedCourse(c[0].id);
  }

  function getCourse(courseId: string) {
    return courses.find(c => c.id === courseId);
  }

  function openModal(assignment?: Assignment) {
    if (assignment) {
      setEditingAssignment(assignment);
      setTitle(assignment.title);
      setDueDate(assignment.dueDate);
      setNotes(assignment.notes);
      setSelectedCourse(assignment.courseId);
      setSelectedPriority(assignment.priority);
    } else {
      setEditingAssignment(null);
      resetForm();
    }
    setModalVisible(true);
  }

  async function handleSave() {
    if (!title.trim()) { Alert.alert('Missing info', 'Please enter a title.'); return; }
    if (!dueDate.trim()) { Alert.alert('Missing info', 'Please enter a due date (e.g. 2025-12-01).'); return; }
    if (!selectedCourse) { Alert.alert('Missing info', 'Please add a course first.'); return; }

    if (editingAssignment) {
      const updated: Assignment = {
        ...editingAssignment,
        title: title.trim(),
        dueDate: dueDate.trim(),
        notes: notes.trim(),
        courseId: selectedCourse,
        priority: selectedPriority,
      };
      await updateAssignment(updated);
      setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a));
    } else {
      const newAssignment: Assignment = {
        id: Date.now().toString(),
        courseId: selectedCourse,
        title: title.trim(),
        dueDate: dueDate.trim(),
        priority: selectedPriority,
        completed: false,
        notes: notes.trim(),
        description: '',
      };
      await saveAssignment(newAssignment);
      setAssignments(prev => [...prev, newAssignment]);
    }

    resetForm();
    setModalVisible(false);
  }

  async function handleToggle(id: string) {
    await toggleAssignment(id);
    setAssignments(prev =>
      prev.map(a => a.id === id ? { ...a, completed: !a.completed } : a)
    );
  }

  async function handleDelete(id: string) {
    Alert.alert('Delete Assignment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteAssignment(id);
          setAssignments(prev => prev.filter(a => a.id !== id));
        }
      }
    ]);
  }

  function resetForm() {
    setTitle('');
    setDueDate('');
    setNotes('');
    setSelectedPriority('Medium');
    if (courses.length > 0) setSelectedCourse(courses[0].id);
  }

  const sorted = [...assignments].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (sortMode === 'priority') {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    return a.dueDate.localeCompare(b.dueDate);
  });

  const checklist = (
    <View style={{ flex: 1 }}>
      <View style={styles.checklistHeader}>
        <Text style={styles.sectionLabel}>Checklist</Text>
        <View style={styles.sortToggle}>
          <TouchableOpacity
            style={[styles.sortPill, sortMode === 'date' && styles.sortPillActive]}
            onPress={() => setSortMode('date')}
          >
            <Text style={[styles.sortPillText, sortMode === 'date' && styles.sortPillTextActive]}>Date</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortPill, sortMode === 'priority' && styles.sortPillActive]}
            onPress={() => setSortMode('priority')}
          >
            <Text style={[styles.sortPillText, sortMode === 'priority' && styles.sortPillTextActive]}>Priority</Text>
          </TouchableOpacity>
        </View>
      </View>

      {assignments.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No assignments yet.</Text>
          <Text style={styles.emptySubText}>Tap + to add one.</Text>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        scrollEnabled={!isWide}
        renderItem={({ item }) => {
          const course = getCourse(item.courseId);
          const diff = daysUntil(item.dueDate);
          const dueLabel = item.completed ? null
            : diff < 0 ? `${Math.abs(diff)}D LATE`
            : diff === 0 ? 'DUE TODAY'
            : `DUE ${String(diff).padStart(2, '0')}D`;
          return (
            <TouchableOpacity
              style={[styles.card, item.completed && styles.cardDone, { borderLeftColor: course?.color ?? colors.muted }]}
              onPress={() => openModal(item)}
              onLongPress={() => handleDelete(item.id)}
            >
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, item.completed && styles.cardTitleDone]}>
                  {item.title}
                </Text>
                <Text style={styles.cardCourse}>{course?.name ?? 'Unknown course'}</Text>
                {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
              </View>

              {item.completed ? (
                <TouchableOpacity onPress={() => handleToggle(item.id)}>
                  <Text style={styles.checkIcon}>✓</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => handleToggle(item.id)}>
                  <Text style={styles.dueBadge}>{dueLabel}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ gap: 10, paddingBottom: 90 }}
      />
    </View>
  );

  const calendar = (
    <View style={isWide ? styles.calendarPaneWide : undefined}>
      <CalendarMonth assignments={assignments} courses={courses} />
    </View>
  );

  return (
    <View style={styles.container}>
      {isWide ? (
        <View style={styles.splitRow}>
          {calendar}
          {checklist}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {calendar}
          <View style={{ height: 16 }} />
          {checklist}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingAssignment ? 'Edit Assignment' : 'Add Assignment'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Title (e.g. Chapter 5 Homework)"
              value={title}
              onChangeText={setTitle}
            />
            <DatePickerField
              label="Due date:"
              value={dueDate}
              onChange={setDueDate}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <Text style={styles.label}>Course:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {courses.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, { borderColor: c.color },
                    selectedCourse === c.id && { backgroundColor: c.color }]}
                  onPress={() => setSelectedCourse(c.id)}
                >
                  <Text style={[styles.chipText,
                    selectedCourse === c.id && { color: '#fff' }]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Priority:</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn,
                    { borderColor: priorityColors[p] },
                    selectedPriority === p && { backgroundColor: priorityColors[p] }]}
                  onPress={() => setSelectedPriority(p)}
                >
                  <Text style={[styles.priorityText,
                    selectedPriority === p && { color: '#fff' }]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => { setModalVisible(false); resetForm(); }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveText}>
                  {editingAssignment ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  splitRow: { flex: 1, flexDirection: 'row', gap: 16, padding: 16 },
  calendarPaneWide: { flex: 1.3 },
  sectionLabel: { fontFamily: fonts.display, fontSize: 17, color: colors.slate },
  checklistHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sortToggle: { flexDirection: 'row', gap: 4 },
  sortPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.muted },
  sortPillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  sortPillText: { fontSize: 12, color: colors.muted },
  sortPillTextActive: { color: colors.paper },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontFamily: fonts.display, color: colors.slate },
  emptySubText: { fontSize: 13, color: colors.muted, marginTop: 6 },
  card: {
    backgroundColor: colors.card, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, padding: 12,
  },
  cardDone: { opacity: 0.55 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '500' as const, color: colors.slate },
  cardTitleDone: { textDecorationLine: 'line-through', color: colors.muted },
  cardCourse: { fontSize: 11, color: colors.muted, marginTop: 1 },
  cardNotes: { fontSize: 11, color: colors.muted, marginTop: 4, fontStyle: 'italic' },
  dueBadge: {
    fontFamily: fonts.mono, fontSize: 10, color: '#854F0B',
    backgroundColor: '#FAEEDA', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
  },
  checkIcon: { fontSize: 16, color: colors.success },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: colors.ink, width: 56, height: 56,
    borderRadius: 28, alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: colors.amber, fontSize: 28, lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 19, fontFamily: fonts.display, marginBottom: 16, color: colors.slate },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, backgroundColor: colors.card },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  chipText: { fontSize: 13, color: colors.slate },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  priorityBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  priorityText: { fontSize: 13, fontWeight: '600' as const, color: colors.slate },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 15 },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center' },
  saveText: { color: colors.paper, fontSize: 15, fontWeight: '600' as const },
});
