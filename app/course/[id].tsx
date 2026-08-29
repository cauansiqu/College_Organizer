import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity,
         Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getCourses, getAssignments, saveAssignment,
         deleteAssignment, toggleAssignment, updateAssignment, updateCourse, deleteCourse } from '../../storage/storage';
import { Course, Assignment } from '../../types';
import AssignmentFormModal, { AssignmentFormValues } from '../../components/AssignmentFormModal';
import { notify, confirmDestructive } from '../../utils/alerts';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, priorityColors } from '../../constants/theme';

const PRIORITY_COLORS = priorityColors;
const COLORS = ['#4A90E2', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'];

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Assignment modal state
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Course edit modal state
  const [courseModalVisible, setCourseModalVisible] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseProfessor, setCourseProfessor] = useState('');
  const [courseColor, setCourseColor] = useState(COLORS[0]);

  useFocusEffect(
  useCallback(() => {
    async function load() {
      const [allCourses, allAssignments] = await Promise.all([getCourses(), getAssignments()]);
      const found = allCourses.find(c => c.id === id) ?? null;
      setCourse(found);
      setAssignments(allAssignments.filter(a => a.courseId === id));
    }
    load();
  }, [id])
);

  // --- Assignment handlers ---

  function openAssignModal(assignment?: Assignment) {
    setEditingAssignment(assignment ?? null);
    setAssignModalVisible(true);
  }

  function closeAssignModal() {
    setAssignModalVisible(false);
    setEditingAssignment(null);
  }

  // Called by AssignmentFormModal once the form is valid and Save/Update is tapped.
  // No course picker here — the course is always this page's `id`.
  async function handleSaveAssignment(values: AssignmentFormValues) {
    if (editingAssignment) {
      const updated: Assignment = { ...editingAssignment, ...values, courseId: id };
      await updateAssignment(updated);
      setAssignments(prev => prev.map(a => a.id === updated.id ? updated : a));
    } else {
      const newA: Assignment = {
        id: Date.now().toString(),
        completed: false,
        description: '',
        ...values,
        courseId: id,
      };
      await saveAssignment(newA);
      setAssignments(prev => [...prev, newA]);
    }
    closeAssignModal();
  }

  async function handleToggle(assignId: string) {
    await toggleAssignment(assignId);
    setAssignments(prev => prev.map(a => a.id === assignId ? { ...a, completed: !a.completed } : a));
  }

  function handleDeleteAssignment(assignId: string) {
    confirmDestructive('Delete Assignment', 'Are you sure?', 'Delete', async () => {
      await deleteAssignment(assignId);
      setAssignments(prev => prev.filter(a => a.id !== assignId));
      closeAssignModal();
    });
  }

  // --- Course edit/delete handlers ---

  function openCourseModal() {
    if (!course) return;
    setCourseName(course.name);
    setCourseProfessor(course.professor);
    setCourseColor(course.color);
    setCourseModalVisible(true);
  }

  async function handleSaveCourse() {
    if (!courseName.trim()) { notify('Missing info', 'Please enter a course name.'); return; }
    const updated: Course = { ...course!, name: courseName.trim(), professor: courseProfessor.trim(), color: courseColor };
    await updateCourse(updated);
    setCourse(updated);
    setCourseModalVisible(false);
  }

  function handleDeleteCourse() {
    confirmDestructive('Delete Course', 'This will not delete your assignments. Are you sure?', 'Delete', async () => {
      await deleteCourse(id);
      router.back(); // go back to courses tab
    });
  }

  if (!course) return null;

  const completed = assignments.filter(a => a.completed).length;
  const pending = assignments.filter(a => !a.completed).length;
  const sorted = [...assignments].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  return (
    <View style={styles.container}>

      {/* Course header banner */}
      <View style={[styles.banner, { backgroundColor: course.color }]}>
        <View style={styles.bannerTop}>
          <View>
            <Text style={styles.bannerName}>{course.name}</Text>
            {course.professor ? <Text style={styles.bannerProfessor}>Prof. {course.professor}</Text> : null}
          </View>
          {/* Edit and delete buttons */}
          <View style={styles.bannerActions}>
            <TouchableOpacity onPress={openCourseModal} style={styles.bannerBtn}>
              <Ionicons name="pencil" size={13} color="#fff" />
              <Text style={styles.bannerBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteCourse} style={styles.bannerBtnDanger}>
              <Ionicons name="trash" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.bannerStats}>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatNum}>{assignments.length}</Text>
            <Text style={styles.bannerStatLabel}>Total</Text>
          </View>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatNum}>{pending}</Text>
            <Text style={styles.bannerStatLabel}>Pending</Text>
          </View>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatNum}>{completed}</Text>
            <Text style={styles.bannerStatLabel}>Done</Text>
          </View>
        </View>
      </View>

      {/* Assignments list */}
      {assignments.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No assignments yet.</Text>
          <Text style={styles.emptySubText}>Tap + to add one.</Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, item.completed && styles.cardDone]}
              onPress={() => openAssignModal(item)}
              onLongPress={() => handleDeleteAssignment(item.id)}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, item.completed && styles.cardTitleDone]}>
                    {item.title}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: PRIORITY_COLORS[item.priority] }]}>
                    <Text style={styles.badgeText}>{item.priority}</Text>
                  </View>
                </View>
                <View style={styles.cardDateRow}>
                  <Ionicons name="calendar-outline" size={12} color={colors.muted} />
                  <Text style={styles.cardDate}>{item.dueDate}</Text>
                </View>
                {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleToggle(item.id)}>
                <Ionicons
                  name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={item.completed ? colors.success : colors.muted}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ padding: 16, gap: 12 }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: course.color }]} onPress={() => openAssignModal()}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add/Edit Assignment — shared component, no course picker, tinted to this course's color */}
      <AssignmentFormModal
        visible={assignModalVisible}
        editing={editingAssignment}
        defaultCourseId={id}
        accentColor={course.color}
        onCancel={closeAssignModal}
        onSave={handleSaveAssignment}
        onDelete={editingAssignment ? () => handleDeleteAssignment(editingAssignment.id) : undefined}
      />

      {/* Edit Course Modal */}
      <Modal visible={courseModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Edit Course</Text>
            <TextInputField placeholder="Course name" value={courseName} onChangeText={setCourseName} />
            <TextInputField placeholder="Professor (optional)" value={courseProfessor} onChangeText={setCourseProfessor} />
            <Text style={styles.label}>Color:</Text>
            <View style={styles.colorRow}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorCircle, { backgroundColor: color },
                    courseColor === color && styles.colorCircleSelected]}
                  onPress={() => setCourseColor(color)}
                />
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setCourseModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveCourse} style={styles.saveBtn}>
                <Text style={styles.saveText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// Small helper component to avoid repeating TextInput styles (used by the Course edit modal)
function TextInputField({ placeholder, value, onChangeText, multiline }: {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
}) {
  return (
    <TextInput
      style={[styles.input, multiline && { height: 80 }]}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  banner: { padding: 20, paddingTop: 24, paddingBottom: 20 },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  bannerName: { fontSize: 22, fontFamily: fonts.display, color: '#fff' },
  bannerProfessor: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  bannerActions: { flexDirection: 'row', gap: 8 },
  bannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  bannerBtnDanger: { backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  bannerBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' as const },
  bannerStats: { flexDirection: 'row', gap: 24 },
  bannerStat: { alignItems: 'center' },
  bannerStatNum: { fontSize: 22, fontFamily: fonts.mono, fontWeight: '700' as const, color: '#fff' },
  bannerStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontFamily: fonts.display, color: colors.slate },
  emptySubText: { fontSize: 14, color: colors.muted, marginTop: 6 },
  card: {
    backgroundColor: colors.card, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden', borderWidth: 1, borderColor: colors.border,
  },
  cardDone: { opacity: 0.55 },
  cardContent: { flex: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '500' as const, color: colors.slate, flex: 1 },
  cardTitleDone: { textDecorationLine: 'line-through', color: colors.muted },
  cardDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: 12, color: colors.muted, fontFamily: fonts.mono },
  cardNotes: { fontSize: 12, color: colors.muted, marginTop: 4, fontStyle: 'italic' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' as const },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 19, fontFamily: fonts.display, marginBottom: 16, color: colors.slate },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, backgroundColor: colors.card },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  colorCircle: { width: 32, height: 32, borderRadius: 16 },
  colorCircleSelected: { borderWidth: 3, borderColor: colors.slate },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 15 },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center' },
  saveText: { color: colors.paper, fontSize: 15, fontWeight: '600' as const },
});
