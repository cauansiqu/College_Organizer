import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, useWindowDimensions } from 'react-native';
import { Assignment, Course } from '../types';
import { fonts, priorityColors, tintColor, tintTextColor, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { formatDisplayDate, dueLabel } from '../utils/dates';

type Props = {
  visible: boolean;
  assignment: Assignment | null;
  course: Course | undefined; // caller resolves this via its existing getCourse()
  onClose: () => void;
  onEdit: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
};

export default function AssignmentDetailModal({
  visible, assignment, course, onClose, onEdit, onToggleComplete, onDelete,
}: Props) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  // Keep the last non-null assignment/course around locally so content
  // doesn't blank out mid slide-down — the parent sets `assignment` to null
  // at the same moment `visible` flips to false.
  const [display, setDisplay] = useState<{ a: Assignment; c: Course | undefined } | null>(null);
  // Compares against the last-seen [assignment, course] pair during render —
  // React's endorsed alternative to an effect for deriving state from props —
  // instead of updating `display` in an effect after the fact.
  const [seen, setSeen] = useState<{ assignment: Assignment | null; course: Course | undefined }>({
    assignment,
    course,
  });
  if (assignment !== seen.assignment || course !== seen.course) {
    setSeen({ assignment, course });
    if (assignment) setDisplay({ a: assignment, c: course });
  }

  const shown = display?.a;
  const shownCourse = display?.c;
  const courseColor = shownCourse?.color ?? colors.muted;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, isWide && styles.modalOverlayWide]}>
        <View style={[styles.modalBox, isWide && styles.modalBoxWide]}>
          {shown && (
            <>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>{shown.title}</Text>
                  <Text style={styles.headerCourse}>{shownCourse?.name ?? 'Unknown course'}</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                <View style={styles.badges}>
                  {dueLabel(shown.dueDate, shown.completed) && (
                    <Text style={styles.dueBadge}>{dueLabel(shown.dueDate, shown.completed)}</Text>
                  )}
                  <View style={[styles.priorityPill, { backgroundColor: priorityColors[shown.priority] }]}>
                    <Text style={styles.priorityPillText}>{shown.priority}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Due</Text>
                  <Text style={styles.metaValue}>{formatDisplayDate(shown.dueDate)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Course</Text>
                  <Text style={styles.metaValue}>{shownCourse?.name ?? 'Unknown course'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Status</Text>
                  <Text style={styles.metaValue}>{shown.completed ? 'Completed' : 'Pending'}</Text>
                </View>

                {shown.notes ? (
                  <View
                    style={[
                      styles.notesBox,
                      { backgroundColor: tintColor(courseColor, scheme), borderLeftColor: courseColor },
                    ]}
                  >
                    <Text style={[styles.notesLabel, { color: tintTextColor(courseColor, scheme) }]}>Notes</Text>
                    <Text style={[styles.notesText, { color: tintTextColor(courseColor, scheme) }]}>{shown.notes}</Text>
                  </View>
                ) : null}

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.toggleBtn} onPress={onToggleComplete}>
                    <Text style={styles.toggleText}>
                      {shown.completed ? 'Mark Incomplete' : 'Mark Complete'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  // On wide screens the popup reads better as a centered dialog than a
  // sheet stuck to the bottom of a large viewport.
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
  headerCourse: { fontSize: 12, color: 'rgba(247,244,236,0.7)', marginTop: 2 },
  closeIcon: { fontSize: 18, color: colors.headerText },
  content: { padding: 24, paddingBottom: 40 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dueBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.warningText,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  priorityPillText: { color: '#fff', fontSize: 11, fontWeight: '600' as const },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  metaLabel: { fontSize: 13, color: colors.muted },
  metaValue: { fontSize: 13, color: colors.slate, fontWeight: '500' as const },
  notesBox: { marginTop: 12, borderLeftWidth: 4, padding: 10 },
  notesLabel: { fontSize: 12, marginBottom: 4 },
  notesText: { fontSize: 13, fontStyle: 'italic' as const },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 20 },
  toggleBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.success, alignItems: 'center' },
  toggleText: { color: colors.success, fontSize: 13, fontWeight: '600' as const },
  editBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  editText: { color: colors.onPrimary, fontSize: 15 },
  deleteBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.danger, alignItems: 'center' },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' as const },
});
