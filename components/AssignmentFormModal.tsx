import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView } from 'react-native';
import DatePickerField from './DatePickerField';
import { notify } from '../utils/alerts';
import { Assignment, Category, Course } from '../types';
import { colors, fonts, priorityColors } from '../constants/theme';
import { getAssignmentPercentage } from '../utils/grades';

const PRIORITIES = ['Low', 'Medium', 'High'] as const;

// What this component hands back to whichever screen is using it.
// The screen is still responsible for turning this into a full
// Assignment (adding an id, completed: false, etc.) and calling storage.
export type AssignmentFormValues = {
  title: string;
  dueDate: string;
  notes: string;
  priority: 'Low' | 'Medium' | 'High';
  courseId: string;
  pointsEarned: number | null;
  pointsPossible: number | null;
  categoryId: string | null;
};

type Props = {
  visible: boolean;
  editing: Assignment | null;   // null = "Add" mode, an Assignment = "Edit" mode (pre-fills the form)
  courses?: Course[];           // pass this to show a course-picker row (used on the Assignments tab)
  defaultCourseId?: string;     // used instead, when there's no picker (used on the Course Detail page)
  categories?: Category[];      // full list; filtered internally to the currently-selected course
  accentColor?: string;         // Save button color; defaults to the app's ink color
  onCancel: () => void;
  onSave: (values: AssignmentFormValues) => void;
  onDelete?: () => void;          // optional delete button (used on the Assignments tab)
};

export default function AssignmentFormModal({
  visible, editing, courses, defaultCourseId, categories, accentColor, onCancel, onSave, onDelete,
}: Props) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [courseId, setCourseId] = useState('');
  const [pointsEarned, setPointsEarned] = useState('');
  const [pointsPossible, setPointsPossible] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Every time the modal opens, either pre-fill it (editing an existing
  // assignment) or reset it to blank (adding a new one). Compares against
  // the last-seen [visible, editing] pair during render — React's endorsed
  // alternative to an effect for this — so re-renders in between don't
  // re-trigger it, without needing an exhaustive-deps escape hatch.
  const [seen, setSeen] = useState<{ visible: boolean; editing: Assignment | null }>({
    visible,
    editing,
  });
  if (visible !== seen.visible || editing !== seen.editing) {
    setSeen({ visible, editing });
    if (visible) {
      if (editing) {
        setTitle(editing.title);
        setDueDate(editing.dueDate);
        setNotes(editing.notes);
        setPriority(editing.priority);
        setCourseId(editing.courseId);
        setPointsEarned(editing.pointsEarned != null ? String(editing.pointsEarned) : '');
        setPointsPossible(editing.pointsPossible != null ? String(editing.pointsPossible) : '');
        setCategoryId(editing.categoryId);
      } else {
        setTitle('');
        setDueDate('');
        setNotes('');
        setPriority('Medium');
        setCourseId(defaultCourseId ?? (courses && courses.length > 0 ? courses[0].id : ''));
        setPointsEarned('');
        setPointsPossible('');
        setCategoryId(null);
      }
    }
  }

  const saveColor = accentColor ?? colors.ink;

  // Categories belong to a course, so recompute which ones are valid options
  // every render from the currently-selected course rather than syncing via
  // an effect. If `categoryId` references a category from a course the user
  // has since switched away from, it's simply treated as unselected here —
  // no separate reset step needed.
  const categoryOptions = (categories ?? []).filter((c) => c.courseId === courseId);
  const effectiveCategoryId =
    categoryId && categoryOptions.some((c) => c.id === categoryId) ? categoryId : null;

  // Live preview only, not used for validation — handleSave() re-parses the
  // raw strings itself so this can stay purely cosmetic.
  const previewPercentage = getAssignmentPercentage({
    pointsEarned: pointsEarned.trim() ? parseFloat(pointsEarned) : null,
    pointsPossible: pointsPossible.trim() ? parseFloat(pointsPossible) : null,
  });

  function handleSave() {
    if (!title.trim()) { notify('Missing info', 'Please enter a title.'); return; }
    if (!dueDate.trim()) { notify('Missing info', 'Please pick a due date.'); return; }
    if (courses && !courseId) { notify('Missing info', 'Please add a course first.'); return; }

    const earnedText = pointsEarned.trim();
    const possibleText = pointsPossible.trim();
    if (!!earnedText !== !!possibleText) {
      notify('Missing value', 'Enter both points earned and possible, or leave both blank.');
      return;
    }
    let parsedEarned: number | null = null;
    let parsedPossible: number | null = null;
    if (earnedText && possibleText) {
      parsedEarned = parseFloat(earnedText);
      parsedPossible = parseFloat(possibleText);
      if (!Number.isFinite(parsedEarned) || parsedEarned < 0) {
        notify('Invalid value', 'Points earned must be a number of 0 or more.');
        return;
      }
      if (!Number.isFinite(parsedPossible) || parsedPossible <= 0) {
        notify('Invalid value', 'Points possible must be greater than 0.');
        return;
      }
    }

    onSave({
      title: title.trim(),
      dueDate: dueDate.trim(),
      notes: notes.trim(),
      priority,
      courseId: courseId || defaultCourseId || '',
      pointsEarned: parsedEarned,
      pointsPossible: parsedPossible,
      categoryId: effectiveCategoryId,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView contentContainerStyle={styles.modalBox}>
          <Text style={styles.modalTitle}>{editing ? 'Edit Assignment' : 'Add Assignment'}</Text>

          <TextInput
            style={styles.input}
            placeholder="Title (e.g. Chapter 5 Homework)"
            value={title}
            onChangeText={setTitle}
          />
          <DatePickerField label="Due date:" value={dueDate} onChange={setDueDate} />
          <TextInput
            style={[styles.input, { height: 80 }]}
            placeholder="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Text style={styles.label}>Grade (optional):</Text>
          <View style={styles.pointsRow}>
            <TextInput
              style={[styles.input, styles.pointsInput]}
              placeholder="Earned"
              value={pointsEarned}
              onChangeText={setPointsEarned}
              keyboardType="numeric"
            />
            <Text style={styles.pointsSlash}>/</Text>
            <TextInput
              style={[styles.input, styles.pointsInput]}
              placeholder="Possible"
              value={pointsPossible}
              onChangeText={setPointsPossible}
              keyboardType="numeric"
            />
            {previewPercentage != null && (
              <Text style={styles.pointsPreview}>{Math.round(previewPercentage)}%</Text>
            )}
          </View>

          {/* Only shown when the caller passes a course list (Assignments tab).
              On the Course Detail page, `courses` is left undefined, so this
              is skipped entirely and the course is just whichever page you're on. */}
          {courses && (
            <>
              <Text style={styles.label}>Course:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {courses.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, { borderColor: c.color },
                      courseId === c.id && { backgroundColor: c.color }]}
                    onPress={() => setCourseId(c.id)}
                  >
                    <Text style={[styles.chipText, courseId === c.id && { color: '#fff' }]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Only shown when this course actually has categories set up. */}
          {categoryOptions.length > 0 && (
            <>
              <Text style={styles.label}>Category:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.categoryBtn, effectiveCategoryId === null && styles.categoryBtnActive]}
                  onPress={() => setCategoryId(null)}
                >
                  <Text style={[styles.categoryBtnText, effectiveCategoryId === null && styles.categoryBtnTextActive]}>
                    No category
                  </Text>
                </TouchableOpacity>
                {categoryOptions.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryBtn, effectiveCategoryId === cat.id && styles.categoryBtnActive]}
                    onPress={() => setCategoryId(cat.id)}
                  >
                    <Text style={[styles.categoryBtnText, effectiveCategoryId === cat.id && styles.categoryBtnTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          <Text style={styles.label}>Priority:</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.priorityBtn, { borderColor: priorityColors[p] },
                  priority === p && { backgroundColor: priorityColors[p] }]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priorityText, priority === p && { color: '#fff' }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {editing && onDelete && (
            <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteText}>Delete Assignment</Text>
            </TouchableOpacity>
          )}

          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: saveColor }]}>
              <Text style={styles.saveText}>{editing ? 'Update' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 19, fontFamily: fonts.display, marginBottom: 16, color: colors.slate },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12, backgroundColor: colors.card },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  pointsInput: { flex: 1, marginBottom: 0 },
  pointsSlash: { fontSize: 15, color: colors.muted },
  pointsPreview: { fontSize: 13, fontFamily: fonts.mono, color: colors.success, marginLeft: 4 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  chipText: { fontSize: 13, color: colors.slate },
  categoryBtn: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, marginRight: 8,
  },
  categoryBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  categoryBtnText: { fontSize: 13, fontWeight: '600' as const, color: colors.slate },
  categoryBtnTextActive: { color: '#fff' },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  priorityBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  priorityText: { fontSize: 13, fontWeight: '600' as const, color: colors.slate },
  deleteBtn: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E74C3C', alignItems: 'center', marginBottom: 12 },
  deleteText: { color: '#E74C3C', fontSize: 14, fontWeight: '600' as const },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 15 },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  saveText: { color: colors.paper, fontSize: 15, fontWeight: '600' as const },
});
