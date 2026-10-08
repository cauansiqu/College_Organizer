import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, useWindowDimensions } from 'react-native';
import { Assignment, Course } from '../types';
import { fonts, priorityColors, tintColor, tintTextColor, fadeColor, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { formatDisplayDate, dueLabel } from '../utils/dates';

type Props = {
  visible: boolean;
  date: string | null; // "YYYY-MM-DD" of the day being shown, or null when closed
  assignments: Assignment[]; // full list; this component filters down to `date` itself
  courses: Course[];
  onClose: () => void;
  onSelectAssignment: (assignment: Assignment) => void;
};

// Bottom-sheet listing every assignment due on the tapped calendar day —
// this is also where "+N more" clipped-from-the-cell assignments become
// reachable, since CalendarMonth only shows the first 1-2 per day.
export default function DayListSheet({ visible, date, assignments, courses, onClose, onSelectAssignment }: Props) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const getCourse = (courseId: string) => courses.find(c => c.id === courseId);

  const items = date ? assignments.filter(a => a.dueDate.slice(0, 10) === date) : [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, isWide && styles.modalOverlayWide]}>
        <View style={[styles.modalBox, isWide && styles.modalBoxWide]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{date ? formatDisplayDate(date) : ''}</Text>
              <Text style={styles.headerCount}>
                {items.length} assignment{items.length === 1 ? '' : 's'} due
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {items.length === 0 ? (
              // Reachable if the last item for this day is deleted while the
              // sheet is open — show an empty state rather than auto-closing.
              <Text style={styles.emptyText}>No assignments due this day.</Text>
            ) : (
              <FlatList
                data={items}
                keyExtractor={a => a.id}
                style={styles.list}
                renderItem={({ item }) => {
                  const course = getCourse(item.courseId);
                  const rawColor = course?.color ?? colors.muted;
                  // Completed rows use the same faded course color CalendarMonth
                  // already uses to de-emphasize completed chips.
                  const rowColor = item.completed ? fadeColor(rawColor, scheme) : rawColor;
                  const badge = dueLabel(item.dueDate, item.completed);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.row,
                        {
                          backgroundColor: tintColor(rowColor, scheme),
                          borderColor: item.completed ? colors.border : colors.text,
                          borderLeftColor: rowColor,
                        },
                      ]}
                      onPress={() => onSelectAssignment(item)}
                    >
                      <View style={styles.rowContent}>
                        <Text
                          style={[
                            styles.rowTitle,
                            { color: tintTextColor(rowColor, scheme) },
                            item.completed && styles.rowTitleDone,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={[styles.rowCourse, { color: tintTextColor(rowColor, scheme) }]}>
                          {course?.name ?? 'Unknown course'}
                        </Text>
                      </View>
                      {item.completed ? (
                        <Text style={styles.completeIcon}>✓</Text>
                      ) : (
                        <View style={styles.badges}>
                          {badge && <Text style={styles.dueBadge}>{badge}</Text>}
                          <View style={[styles.priorityPill, { backgroundColor: priorityColors[item.priority] }]}>
                            <Text style={styles.priorityPillText}>{item.priority}</Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
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
  headerCount: { fontSize: 12, color: 'rgba(247,244,236,0.7)', marginTop: 2 },
  closeIcon: { fontSize: 18, color: colors.headerText },
  content: { padding: 24, paddingBottom: 40 },
  list: { maxHeight: 360 },
  emptyText: { color: colors.muted, fontSize: 14, paddingVertical: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderLeftWidth: 5,
    marginBottom: 8,
  },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '500' as const },
  rowTitleDone: { textDecorationLine: 'line-through' },
  rowCourse: { fontSize: 11, marginTop: 1, opacity: 0.85 },
  badges: { alignItems: 'flex-end', gap: 4, marginLeft: 8 },
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
  completeIcon: { fontSize: 18, color: colors.success, marginLeft: 8 },
});
