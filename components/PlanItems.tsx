import { useMemo } from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { Assignment, Course, WorkShift } from '../types';
import { fonts, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { dueTimeLabel, shiftTimeRange } from '../utils/plan';

// Small building blocks shared by the agenda (PlanDayCard) and WeekBoard.

// "DUE 11 PM · CS 476 Quiz-Test 1" in the warning colors. Tapping opens the
// assignment's detail popup.
export function DueItem({
  assignment, course, onPress,
}: { assignment: Assignment; course: Course | undefined; onPress: (a: Assignment) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const code = course?.code || course?.name;

  return (
    <Pressable
      onPress={() => onPress(assignment)}
      style={({ pressed }) => [styles.due, pressed && { opacity: 0.75 }]}
    >
      <Text style={styles.dueText}>
        <Text style={styles.mono}>{dueTimeLabel(assignment)}</Text>
        {' · '}
        {code ? `${code} ` : ''}
        {assignment.title}
      </Text>
    </Pressable>
  );
}

// "WORK 7:00–11:00 PM · Tech Worker" in the info colors
export function ShiftItem({ shift }: { shift: WorkShift }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.shift}>
      <Text style={styles.shiftText}>
        <Text style={styles.mono}>WORK {shiftTimeRange(shift)}</Text>
        {' · '}
        {shift.title}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  due: { backgroundColor: colors.warningBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6 },
  dueText: { fontSize: 13, color: colors.warningText },
  shift: { backgroundColor: colors.infoBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6 },
  shiftText: { fontSize: 13, color: colors.infoText },
  mono: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '700' as const },
});
