import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getCourses, saveCourse, deleteCourse } from '../../storage/storage';
import { Course } from '../../types';
import { fonts, tintColor, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { notify, confirmDestructive } from '../../utils/alerts';

const COLORS = ['#4A90E2', '#E74C3C', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'];

export default function CoursesScreen() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [professor, setProfessor] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  async function loadCourses() {
    setCourses(await getCourses());
  }

  // Reload every time the Courses tab is focused, same as Home/Assignments/
  // Grades — also sidesteps a lint rule that (correctly, if indirectly) can't
  // tell a plain useEffect fetch-on-mount apart from a riskier setState-in-effect.
  useFocusEffect(
    useCallback(() => {
      loadCourses();
    }, []),
  );

  // Opens the modal for adding only (editing moved to detail page)
  function openModal() {
    setName('');
    setProfessor('');
    setSelectedColor(COLORS[0]);
    setModalVisible(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      notify('Missing info', 'Please enter a course name.');
      return;
    }

    const newCourse: Course = {
      id: Date.now().toString(),
      name: name.trim(),
      professor: professor.trim(),
      color: selectedColor,
      // Matches the DB column defaults — saveCourse() doesn't send these on
      // insert, so Postgres fills them in; kept here just to satisfy the type.
      gradeAMin: 90,
      gradeBMin: 80,
      gradeCMin: 70,
      gradeDMin: 60,
    };
    const created = await saveCourse(newCourse);
    setCourses(prev => [...prev, created]);
    setModalVisible(false);
  }

  function handleDelete(id: string) {
    confirmDestructive('Delete Course', 'Are you sure?', 'Delete', async () => {
      await deleteCourse(id);
      setCourses(prev => prev.filter(c => c.id !== id));
    });
  }

  return (
    <View style={styles.container}>
      {courses.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No courses yet.</Text>
          <Text style={styles.emptySubText}>Tap + to add your first course.</Text>
        </View>
      )}

      <FlatList
        data={courses}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              { backgroundColor: tintColor(item.color, scheme), borderLeftColor: item.color },
            ]}
            onPress={() => router.push(`/course/${item.id}` as any)}  // tap = go to detail
            onLongPress={() => handleDelete(item.id)}           // hold = delete
          >
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
            <View style={styles.cardText}>
              <Text style={styles.courseName}>{item.name}</Text>
              {item.professor ? <Text style={styles.professor}>Prof. {item.professor}</Text> : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 16, gap: 12 }}
      />

      <TouchableOpacity style={styles.fab} onPress={openModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Add Course</Text>

            <TextInput
              style={styles.input}
              placeholder="Course name (e.g. Calculus II)"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Professor (optional)"
              value={professor}
              onChangeText={setProfessor}
            />

            <Text style={styles.colorLabel}>Pick a color:</Text>
            <View style={styles.colorRow}>
              {COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorCircle, { backgroundColor: color },
                    selectedColor === color && styles.colorCircleSelected]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 18, fontFamily: fonts.display, color: colors.slate },
  emptySubText: { fontSize: 14, color: colors.muted, marginTop: 6 },
  card: {
    borderRadius: 10, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, borderWidth: 1, borderColor: colors.border, borderLeftColor: colors.border,
  },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  cardText: { flex: 1 },
  courseName: { fontSize: 16, fontFamily: fonts.display, color: colors.slate },
  professor: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.muted, marginLeft: 8 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: colors.primary, width: 56, height: 56,
    borderRadius: 28, alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: colors.amber, fontSize: 28, lineHeight: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 19, fontFamily: fonts.display, marginBottom: 16, color: colors.slate },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, backgroundColor: colors.card, color: colors.inputText },
  colorLabel: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  colorCircle: { width: 32, height: 32, borderRadius: 16 },
  colorCircleSelected: { borderWidth: 3, borderColor: colors.slate },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 15 },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  saveText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' as const },
});