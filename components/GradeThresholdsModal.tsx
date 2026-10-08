import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Category, Course } from '../types';
import { GradeThresholds } from '../utils/grades';
import { fonts, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { notify, confirmDestructive } from '../utils/alerts';

type Props = {
  visible: boolean;
  course: Course | null;
  categories: Category[]; // pre-filtered to this course by the caller
  onCancel: () => void;
  onSave: (thresholds: GradeThresholds) => void;
  onAddCategory: (name: string, weight: number) => void;
  onUpdateCategory: (category: Category) => void;
  onDeleteCategory: (id: string) => void;
};

// Lets a course use a different grading scale than the 90/80/70/60 default —
// some professors grade on a curve. Same navy-header popup style as
// AssignmentDetailModal, but a simple form instead of a detail view.
export default function GradeThresholdsModal({
  visible, course, categories, onCancel, onSave, onAddCategory, onUpdateCategory, onDeleteCategory,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [aMin, setAMin] = useState('');
  const [bMin, setBMin] = useState('');
  const [cMin, setCMin] = useState('');
  const [dMin, setDMin] = useState('');

  // Add/edit form for a single category. `editingCategoryId` is null while
  // adding a new one, or the id of the category being edited.
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryWeight, setCategoryWeight] = useState('');

  // Compares against the last-seen [visible, course] pair during render —
  // React's endorsed alternative to an effect for this — so opening the
  // modal (or switching which course it's editing) resets the form without
  // re-running on every re-render in between.
  const [seen, setSeen] = useState<{ visible: boolean; course: Course | null }>({ visible, course });
  if (visible !== seen.visible || course !== seen.course) {
    setSeen({ visible, course });
    if (visible && course) {
      setAMin(String(course.gradeAMin));
      setBMin(String(course.gradeBMin));
      setCMin(String(course.gradeCMin));
      setDMin(String(course.gradeDMin));
      setEditingCategoryId(null);
      setCategoryName('');
      setCategoryWeight('');
    }
  }

  const weightsTotal = categories.reduce((sum, c) => sum + (c.weight ?? 0), 0);

  function startAddCategory() {
    setEditingCategoryId(null);
    setCategoryName('');
    setCategoryWeight('');
  }

  function startEditCategory(category: Category) {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setCategoryWeight(category.weight != null ? String(category.weight) : '');
  }

  function handleDeleteCategory(category: Category) {
    confirmDestructive(
      'Delete Category',
      `Assignments in "${category.name}" will become uncategorized, not deleted. Are you sure?`,
      'Delete',
      () => {
        onDeleteCategory(category.id);
        if (editingCategoryId === category.id) startAddCategory();
      },
    );
  }

  function handleSaveCategory() {
    const name = categoryName.trim();
    const weight = parseFloat(categoryWeight);
    if (!name) {
      notify('Missing info', 'Please enter a category name.');
      return;
    }
    if (!Number.isFinite(weight) || weight < 0) {
      notify('Invalid weight', 'Weight must be a number of 0 or more.');
      return;
    }

    if (editingCategoryId) {
      const existing = categories.find((c) => c.id === editingCategoryId);
      if (existing) onUpdateCategory({ ...existing, name, weight });
    } else {
      onAddCategory(name, weight);
    }
    startAddCategory();
  }

  function handleSave() {
    const a = parseFloat(aMin);
    const b = parseFloat(bMin);
    const c = parseFloat(cMin);
    const d = parseFloat(dMin);

    const allValid = [a, b, c, d].every((n) => Number.isFinite(n) && n >= 0 && n <= 100);
    if (!allValid) {
      notify('Invalid scale', 'Each cutoff must be a number between 0 and 100.');
      return;
    }
    if (!(a >= b && b >= c && c >= d)) {
      notify('Invalid scale', 'Each cutoff must be greater than or equal to the next.');
      return;
    }

    onSave({ gradeAMin: a, gradeBMin: b, gradeCMin: c, gradeDMin: d });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={[styles.modalOverlay, isWide && styles.modalOverlayWide]}>
        <View style={[styles.modalBox, isWide && styles.modalBoxWide]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Grade Scale</Text>
              <Text style={styles.headerSubtitle}>{course?.name ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={8}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <ThresholdField label="A — minimum %" value={aMin} onChangeText={setAMin} />
            <ThresholdField label="B — minimum %" value={bMin} onChangeText={setBMin} />
            <ThresholdField label="C — minimum %" value={cMin} onChangeText={setCMin} />
            <ThresholdField label="D — minimum %" value={dMin} onChangeText={setDMin} />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Categories</Text>
            {categories.length > 0 ? (
              <>
                {categories.map((category) => (
                  <View key={category.id} style={styles.categoryRow}>
                    <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
                    <Text style={styles.categoryWeight}>{category.weight ?? 0}%</Text>
                    <TouchableOpacity onPress={() => startEditCategory(category)} hitSlop={8}>
                      <Ionicons name="pencil" size={15} color={colors.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteCategory(category)} hitSlop={8}>
                      <Ionicons name="trash" size={15} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
                <Text style={[styles.weightsTotal, weightsTotal !== 100 && styles.weightsTotalWarning]}>
                  Weights total {weightsTotal}%
                </Text>
              </>
            ) : (
              <Text style={styles.noCategories}>No categories yet — grades use the flat point total.</Text>
            )}

            <View style={styles.categoryForm}>
              <TextInput
                style={[styles.categoryInputBase, styles.categoryNameInput]}
                placeholder="Category name"
                value={categoryName}
                onChangeText={setCategoryName}
              />
              <TextInput
                style={[styles.categoryInputBase, styles.categoryWeightInput]}
                placeholder="Weight %"
                value={categoryWeight}
                onChangeText={setCategoryWeight}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.modalButtons}>
              {editingCategoryId && (
                <TouchableOpacity onPress={startAddCategory} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleSaveCategory} style={styles.saveBtn}>
                <Text style={styles.saveText}>{editingCategoryId ? 'Update Category' : 'Add Category'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ThresholdField({ label, value, onChangeText }: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalOverlayWide: { justifyContent: 'center' },
  modalBox: { backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalBoxWide: { maxWidth: 520, width: '100%', alignSelf: 'center', borderRadius: 20 },
  header: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 19, fontFamily: fonts.display, color: colors.headerText },
  headerSubtitle: { fontSize: 12, color: 'rgba(247,244,236,0.7)', marginTop: 2 },
  closeIcon: { fontSize: 18, color: colors.headerText },
  content: { padding: 24, paddingBottom: 40 },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  fieldLabel: { fontSize: 14, color: colors.slate },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 10, fontSize: 15, backgroundColor: colors.card, color: colors.inputText,
    width: 80, textAlign: 'center',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 15 },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  saveText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' as const },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 20 },
  sectionTitle: { fontSize: 16, fontFamily: fonts.display, color: colors.slate, marginBottom: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  categoryName: { flex: 1, fontSize: 14, color: colors.slate },
  categoryWeight: { fontSize: 13, fontFamily: fonts.mono, color: colors.muted },
  weightsTotal: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  weightsTotalWarning: { color: colors.warning },
  noCategories: { fontSize: 13, color: colors.muted, fontStyle: 'italic' as const, marginBottom: 12 },
  categoryForm: { flexDirection: 'row', gap: 8 },
  categoryInputBase: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 10, fontSize: 15, backgroundColor: colors.card, color: colors.inputText,
  },
  categoryNameInput: { flex: 2 },
  categoryWeightInput: { flex: 1, textAlign: 'center' },
});
