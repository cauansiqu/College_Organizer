import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList,
         Modal, TextInput, Alert, ScrollView } from 'react-native';
import { getAssignments, saveAssignment, deleteAssignment, toggleAssignment, updateAssignment, getCourses } from '../../storage/storage';
import { Assignment, Course } from '../../types';
import DatePickerField from '../../components/DatePickerField';

const PRIORITIES = ['Low', 'Medium', 'High'] as const;

const PRIORITY_COLORS: Record<string, string> = {
  Low: '#2ECC71',
  Medium: '#F39C12',
  High: '#E74C3C',
};

export default function AssignmentsScreen() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

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

  // Opens modal — pass an assignment to edit it, nothing to add new
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
      // --- EDIT MODE: update existing ---
      const updated: Assignment = {
        ...editingAssignment,   // keep id and completed status
        title: title.trim(),
        dueDate: dueDate.trim(),
        notes: notes.trim(),
        courseId: selectedCourse,
        priority: selectedPriority,
      };
      await updateAssignment(updated);
      setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a));
    } else {
      // --- ADD MODE: create new ---
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

  // Sort: incomplete first, then by due date
  const sorted = [...assignments].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <View style={styles.container}>

      {assignments.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No assignments yet.</Text>
          <Text style={styles.emptySubText}>Tap + to add one.</Text>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const course = getCourse(item.courseId);
          return (
            <TouchableOpacity
              style={[styles.card, item.completed && styles.cardDone]}
              onPress={() => openModal(item)}           // tap = edit
              onLongPress={() => handleDelete(item.id)}  // hold = delete
            >
              {/* Left color bar from the linked course */}
              <View style={[styles.colorBar, { backgroundColor: course?.color ?? '#ccc' }]} />

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, item.completed && styles.cardTitleDone]}>
                    {item.title}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: PRIORITY_COLORS[item.priority] }]}>
                    <Text style={styles.badgeText}>{item.priority}</Text>
                  </View>
                </View>
                <Text style={styles.cardCourse}>{course?.name ?? 'Unknown course'}</Text>
                <Text style={styles.cardDate}>📅 Due: {item.dueDate}</Text>
                {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
              </View>

              {/* Tap just the checkbox to toggle done, not the whole card */}
              <TouchableOpacity onPress={() => handleToggle(item.id)}>
                <Text style={styles.checkmark}>{item.completed ? '✅' : '⬜'}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      />

      {/* Floating + button */}
      <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add / Edit Assignment Modal */}
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

            {/* Course picker */}
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

            {/* Priority picker */}
            <Text style={styles.label}>Priority:</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn,
                    { borderColor: PRIORITY_COLORS[p] },
                    selectedPriority === p && { backgroundColor: PRIORITY_COLORS[p] }]}
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#555' },
  emptySubText: { fontSize: 14, color: '#999', marginTop: 6 },
  card: {
    backgroundColor: '#fff', borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardDone: { opacity: 0.5 },
  colorBar: { width: 5, alignSelf: 'stretch' },
  cardContent: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#222', flex: 1 },
  cardTitleDone: { textDecorationLine: 'line-through', color: '#999' },
  cardCourse: { fontSize: 12, color: '#888', marginBottom: 2 },
  cardDate: { fontSize: 12, color: '#555' },
  cardNotes: { fontSize: 12, color: '#777', marginTop: 4, fontStyle: 'italic' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  checkmark: { fontSize: 20, marginRight: 12 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: '#4A90E2', width: 56, height: 56,
    borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#222' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, backgroundColor: '#fafafa' },
  label: { fontSize: 14, color: '#555', marginBottom: 8 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  chipText: { fontSize: 13, color: '#444' },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  priorityBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  priorityText: { fontSize: 13, fontWeight: '600', color: '#444' },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
  cancelText: { color: '#555', fontSize: 15 },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#4A90E2', alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});