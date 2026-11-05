import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Assignment, Course, PlanTask } from '../types';
import { fonts, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { dayHeading, type PlanDay } from '../utils/plan';
import PlanTaskRow from './PlanTaskRow';
import { DueItem, ShiftItem } from './PlanItems';

type Props = {
  day: PlanDay;
  todayIso: string;
  courseById: Map<string, Course>;
  onToggleTask: (task: PlanTask) => void;
  onOpenAssignment: (a: Assignment) => void;
};

// One day in the agenda: heading + "N left", then due items, plan tasks,
// and work shifts. Today's card gets a strong outline.
export default function PlanDayCard({ day, todayIso, courseById, onToggleTask, onOpenAssignment }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isToday = day.iso === todayIso;
  const left = day.tasks.filter((t) => !t.completed).length;

  return (
    // Days before today are dimmed. The agenda currently starts at today, so
    // this only kicks in if it's ever given earlier days.
    <View style={[styles.card, isToday && styles.today, day.iso < todayIso && styles.past]}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>{dayHeading(day.iso, todayIso)}</Text>
        {day.tasks.length > 0 && <Text style={styles.left}>{left} left</Text>}
      </View>

      {day.due.map((a) => (
        <DueItem key={a.id} assignment={a} course={courseById.get(a.courseId)} onPress={onOpenAssignment} />
      ))}
      {day.tasks.map((t) => (
        <PlanTaskRow
          key={t.id}
          task={t}
          course={t.courseId ? courseById.get(t.courseId) : undefined}
          onToggle={onToggleTask}
        />
      ))}
      {day.shifts.map((s) => (
        <ShiftItem key={s.id} shift={s} />
      ))}

      {day.due.length + day.tasks.length + day.shifts.length === 0 && (
        <Text style={styles.nothing}>Nothing planned.</Text>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  today: { borderWidth: 2, borderColor: colors.text },
  past: { opacity: 0.5 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  heading: { fontSize: 16, fontFamily: fonts.display, color: colors.slate },
  left: { fontSize: 11, fontFamily: fonts.mono, color: colors.muted },
  nothing: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
});
