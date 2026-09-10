import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Assignment, Course } from '../types';
import { colors, fonts, fadeColor } from '../constants/theme';
import { toLocalISODate } from '../utils/dates';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

type Props = {
  assignments: Assignment[];
  courses: Course[];
  onDayPress?: (dateISO: string) => void;
  onAssignmentPress?: (assignment: Assignment) => void;
};

export default function CalendarMonth({ assignments, courses, onDayPress, onAssignmentPress }: Props) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 700; // below this, a 7-col month grid gets too cramped

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const courseColor = (courseId: string) =>
    courses.find(c => c.id === courseId)?.color ?? colors.muted;

  // Completed assignments get a lighter, desaturated version of their
  // course color so they stay visible but visually de-emphasized.
  const chipColor = (a: Assignment) => {
    const base = courseColor(a.courseId);
    return a.completed ? fadeColor(base) : base;
  };

  // Map "YYYY-MM-DD" -> assignments due that day
  const byDay = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) {
      const key = a.dueDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [assignments]);

  function goMonth(delta: number) {
    setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  if (isNarrow) {
    // Week strip: today + next 6 days, horizontally
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
    return (
      <View style={styles.weekStrip}>
        {days.map(d => {
          const key = toLocalISODate(d);
          const items = byDay[key] ?? [];
          return (
            <TouchableOpacity
              key={key}
              style={styles.weekCell}
              onPress={() => { if (items.length > 0) onDayPress?.(key); }}
            >
              <Text style={styles.weekDayLabel}>{WEEKDAY_LABELS[d.getDay()]}</Text>
              <Text style={styles.weekDateNum}>{d.getDate()}</Text>
              {items.slice(0, 1).map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.weekChip, { backgroundColor: chipColor(a) }]}
                  onPress={() => onAssignmentPress?.(a)}
                  hitSlop={8}
                />
              ))}
              {items.length > 1 && (
                <TouchableOpacity onPress={() => onDayPress?.(key)} hitSlop={8}>
                  <Text style={styles.weekMore}>+{items.length - 1}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Month grid
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const todayKey = toLocalISODate(new Date());

  return (
    <View>
      <View style={styles.monthHeader}>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => goMonth(-1)} hitSlop={8}>
            <Text style={styles.monthNavArrow}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goMonth(1)} hitSlop={8}>
            <Text style={styles.monthNavArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text key={i} style={styles.weekdayLabel}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.dayCellEmpty} />;
          const key = toLocalISODate(d);
          const items = byDay[key] ?? [];
          const isToday = key === todayKey;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayCell, isToday && styles.dayCellToday]}
              onPress={() => { if (items.length > 0) onDayPress?.(key); }}
            >
              <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{d.getDate()}</Text>
              {items.slice(0, 2).map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.chip, { backgroundColor: chipColor(a) }]}
                  onPress={() => onAssignmentPress?.(a)}
                >
                  <Text style={[styles.chipText, a.completed && styles.chipTextDone]} numberOfLines={1}>{a.title}</Text>
                </TouchableOpacity>
              ))}
              {items.length > 2 && (
                <TouchableOpacity onPress={() => onDayPress?.(key)} hitSlop={4}>
                  <Text style={styles.moreLabel}>+{items.length - 2} more</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  monthLabel: { fontFamily: fonts.display, fontSize: 17, color: colors.slate },
  monthNav: { flexDirection: 'row', gap: 16 },
  monthNavArrow: { fontSize: 20, color: colors.slate },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCellEmpty: { width: `${100 / 7}%`, minHeight: 64 },
  dayCell: {
    width: `${100 / 7}%`, minHeight: 64, padding: 3,
    backgroundColor: colors.card, borderRadius: 6, borderWidth: 1, borderColor: 'transparent',
  },
  dayCellToday: { borderColor: colors.ink },
  dayNum: { fontSize: 11, color: colors.slate, marginBottom: 2 },
  dayNumToday: { fontFamily: fonts.mono, fontWeight: '700' as const },
  chip: { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 1 },
  chipText: { fontSize: 9, color: '#fff' },
  chipTextDone: { color: colors.slate },
  moreLabel: { fontSize: 8, color: colors.muted },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  weekCell: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 8, padding: 8, width: 44 },
  weekDayLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  weekDateNum: { fontSize: 14, color: colors.slate, marginVertical: 2 },
  weekChip: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  weekMore: { fontSize: 8, color: colors.muted },
});
