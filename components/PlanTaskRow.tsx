import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Course, PlanTask } from '../types';
import { fonts, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { rolledLabel } from '../utils/plan';

type Props = {
  task: PlanTask;
  course: Course | undefined;
  onToggle: (task: PlanTask) => void;
};

// One plan_tasks row: checkbox, course dot + code, title, then the note and
// a "rolled over" hint underneath. Shared by the agenda and the week board.
export default function PlanTaskRow({ task, course, onToggle }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rolled = rolledLabel(task.rolledCount);

  return (
    <Pressable
      onPress={() => onToggle(task)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.completed }}
    >
      <Ionicons
        name={task.completed ? 'checkbox' : 'square-outline'}
        size={18}
        color={task.completed ? colors.success : colors.muted}
      />
      <View style={styles.body}>
        {/* Course on its own small line, so every task's title starts at the
            same place no matter how long it is */}
        <View style={styles.courseLine}>
          <View style={[styles.dot, { backgroundColor: course?.color || colors.muted }]} />
          <Text style={styles.code} numberOfLines={1}>
            {course ? course.code || course.name : 'No course'}
          </Text>
        </View>
        <Text style={[styles.title, task.completed && styles.done]}>{task.title}</Text>
        {task.note ? <Text style={styles.note}>{task.note}</Text> : null}
        {rolled ? <Text style={styles.rolled}>{rolled}</Text> : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  body: { flex: 1 },
  courseLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  code: { fontSize: 11, fontFamily: fonts.mono, color: colors.muted, flexShrink: 1 },
  title: { fontSize: 14, color: colors.slate },
  done: { color: colors.muted, textDecorationLine: 'line-through' },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rolled: { fontSize: 11, fontFamily: fonts.mono, color: colors.warningText, marginTop: 2 },
});
