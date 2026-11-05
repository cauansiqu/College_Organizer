import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Assignment, Course, PlanTask } from '../types';
import { fonts, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { isEmptyDay, monthDay, shortDate, type PlanDay } from '../utils/plan';
import PlanTaskRow from './PlanTaskRow';
import { DueItem, ShiftItem } from './PlanItems';

type Props = {
  weekStart: string;          // Monday, "YYYY-MM-DD"
  todayIso: string;
  weekdays: PlanDay[];        // Mon–Fri of the shown week
  weekend: PlanDay[];         // Sat–Sun of the shown week
  nextWeekDue: Assignment[];  // incomplete assignments due Mon–Sun of the week after
  courseById: Map<string, Course>;
  onToggleTask: (task: PlanTask) => void;
  onOpenAssignment: (a: Assignment) => void;
  onPrevWeek: () => void;
  onThisWeek: () => void;
  onNextWeek: () => void;
};

// Wide-screen layout: five Mon–Fri columns (shifts, due items, tasks), then
// "Coming up the week after" and a Weekend card underneath.
export default function WeekBoard({
  weekStart, todayIso, weekdays, weekend, nextWeekDue, courseById,
  onToggleTask, onOpenAssignment, onPrevWeek, onThisWeek, onNextWeek,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const weekendTasks = weekend.flatMap((d) => d.tasks);

  return (
    <View style={{ gap: 16 }}>
      {/* Title + week navigation */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Week of {monthDay(weekStart)}</Text>
        <View style={styles.navRow}>
          <NavButton label="‹" onPress={onPrevWeek} styles={styles} />
          <NavButton label="This week" onPress={onThisWeek} styles={styles} />
          <NavButton label="›" onPress={onNextWeek} styles={styles} />
        </View>
      </View>

      {/* Mon–Fri columns */}
      <View style={styles.columns}>
        {weekdays.map((day) => (
          // Days before today are dimmed ("YYYY-MM-DD" strings compare correctly)
          <View
            key={day.iso}
            style={[styles.column, day.iso === todayIso && styles.today, day.iso < todayIso && styles.past]}
          >
            <Text style={styles.colHeading}>{shortDate(day.iso)}</Text>
            {day.shifts.map((s) => <ShiftItem key={s.id} shift={s} />)}
            {day.due.map((a) => (
              <DueItem key={a.id} assignment={a} course={courseById.get(a.courseId)} onPress={onOpenAssignment} />
            ))}
            {day.tasks.map((t) => (
              <View key={t.id} style={styles.taskCard}>
                <PlanTaskRow
                  task={t}
                  course={t.courseId ? courseById.get(t.courseId) : undefined}
                  onToggle={onToggleTask}
                />
              </View>
            ))}
            {isEmptyDay(day) && <Text style={styles.nothing}>—</Text>}
          </View>
        ))}
      </View>

      {/* Below the columns: next week's due items + the weekend */}
      <View style={styles.bottomRow}>
        <View style={[styles.panel, { flex: 2 }]}>
          <Text style={styles.panelTitle}>Coming up the week after</Text>
          {nextWeekDue.length === 0 ? (
            <Text style={styles.nothing}>Nothing due yet.</Text>
          ) : (
            nextWeekDue.map((a) => {
              const course = courseById.get(a.courseId);
              return (
                <Pressable key={a.id} onPress={() => onOpenAssignment(a)} style={styles.nextRow}>
                  <Text style={styles.nextDate}>{shortDate(a.dueDate)}</Text>
                  <View style={[styles.dot, { backgroundColor: course?.color || colors.muted }]} />
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {course?.code ? `${course.code} ` : ''}{a.title}
                  </Text>
                  {a.itemType ? <Text style={styles.typeBadge}>{a.itemType.toUpperCase()}</Text> : null}
                </Pressable>
              );
            })
          )}
        </View>

        {/* Dimmed once the whole weekend is in the past (when viewing an earlier week) */}
        <View style={[styles.panel, { flex: 1 }, weekend[1].iso < todayIso && styles.past]}>
          <Text style={styles.panelTitle}>Weekend</Text>
          {weekend.every(isEmptyDay) ? (
            <Text style={styles.nothing}>Sat–Sun · off</Text>
          ) : (
            <>
              {weekend.flatMap((d) => d.shifts).map((s) => <ShiftItem key={s.id} shift={s} />)}
              {weekend.flatMap((d) => d.due).map((a) => (
                <DueItem key={a.id} assignment={a} course={courseById.get(a.courseId)} onPress={onOpenAssignment} />
              ))}
              {weekendTasks.map((t) => (
                <PlanTaskRow
                  key={t.id}
                  task={t}
                  course={t.courseId ? courseById.get(t.courseId) : undefined}
                  onToggle={onToggleTask}
                />
              ))}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function NavButton({
  label, onPress, styles,
}: { label: string; onPress: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}>
      <Text style={styles.navText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontFamily: fonts.display, color: colors.slate },
  navRow: { flexDirection: 'row', gap: 8 },
  navBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  navText: { fontSize: 13, color: colors.slate },
  columns: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  column: {
    flex: 1, minWidth: 0, backgroundColor: colors.card, borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  today: { borderWidth: 2, borderColor: colors.text },
  past: { opacity: 0.5 },
  colHeading: { fontSize: 14, fontFamily: fonts.display, color: colors.slate, marginBottom: 8 },
  taskCard: { borderTopWidth: 1, borderTopColor: colors.border },
  nothing: { fontSize: 13, color: colors.muted, fontStyle: 'italic' },
  bottomRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  panel: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  panelTitle: { fontSize: 15, fontFamily: fonts.display, color: colors.slate, marginBottom: 8 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  nextDate: { fontSize: 11, fontFamily: fonts.mono, color: colors.muted, width: 80 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nextTitle: { flex: 1, fontSize: 13, color: colors.slate },
  typeBadge: {
    fontSize: 10, fontFamily: fonts.mono, color: colors.infoText, backgroundColor: colors.infoBg,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
});
