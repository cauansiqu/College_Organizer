import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Assignment, Course, WorkShift } from '../types';
import { fonts, fadeColor, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { toLocalISODate } from '../utils/dates';
import { groupByDay, localDayOf, shortShiftHours } from '../utils/plan';

const MAX_CHIPS = 3; // per month-grid day; assignments + shifts share this limit

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

type Props = {
  assignments: Assignment[];
  courses: Course[];
  shifts: WorkShift[];            // display-only; pass [] to hide them
  month: Date;                    // 1st of the month shown in the grid
  onChangeMonth: (next: Date) => void;
  onDayPress?: (dateISO: string) => void;
  onAssignmentPress?: (assignment: Assignment) => void;
};

export default function CalendarMonth({
  assignments, courses, shifts, month: cursor, onChangeMonth, onDayPress, onAssignmentPress,
}: Props) {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isNarrow = width < 700; // below this, a 7-col month grid gets too cramped

  // Narrow screens only: which view the user picked via the toggle.
  // Ignored on wide screens, which always show the month grid.
  const [mobileView, setMobileView] = useState<'week' | 'month'>('week');

  const courseColor = (courseId: string) =>
    courses.find(c => c.id === courseId)?.color ?? colors.muted;

  // Completed assignments get a lighter, desaturated version of their
  // course color so they stay visible but visually de-emphasized.
  const chipColor = (a: Assignment) => {
    const base = courseColor(a.courseId);
    return a.completed ? fadeColor(base, scheme) : base;
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

  // Shifts by the LOCAL day they start (a 01:00 UTC start is still the
  // evening before in US time), same as the Plan tab.
  const shiftsByDay = useMemo(() => groupByDay(shifts, s => localDayOf(s.startsAt)), [shifts]);

  // The month now lives in the parent (it loads that month's shifts)
  function goMonth(delta: number) {
    onChangeMonth(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  // Both views are built as JSX up front, then the single return at the
  // bottom picks one — this lets narrow screens reach the exact same
  // month-grid render path that wide screens use, instead of duplicating it.

  // Week strip: today + next 6 days, horizontally
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekStrip = (
    <View style={styles.weekStrip}>
      {days.map(d => {
        const key = toLocalISODate(d);
        const items = byDay[key] ?? [];
        const hasShift = (shiftsByDay.get(key) ?? []).length > 0;
        return (
          <TouchableOpacity
            key={key}
            style={styles.weekCell}
            onPress={() => { if (items.length > 0 || hasShift) onDayPress?.(key); }}
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
            {/* Small bar under the dots = working that day */}
            {hasShift && <View style={styles.weekShiftBar} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

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

  const monthGrid = (
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
          const dayShifts = shiftsByDay.get(key) ?? [];
          // Assignments first, then shifts fill whatever room is left
          const shownItems = items.slice(0, MAX_CHIPS);
          const shownShifts = dayShifts.slice(0, MAX_CHIPS - shownItems.length);
          const hidden = items.length + dayShifts.length - shownItems.length - shownShifts.length;
          const isToday = key === todayKey;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayCell, isToday && styles.dayCellToday]}
              onPress={() => { if (items.length + dayShifts.length > 0) onDayPress?.(key); }}
            >
              <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{d.getDate()}</Text>
              {shownItems.map(a => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.chip, { backgroundColor: chipColor(a) }]}
                  onPress={() => onAssignmentPress?.(a)}
                >
                  <Text style={[styles.chipText, a.completed && styles.chipTextDone]} numberOfLines={1}>{a.title}</Text>
                </TouchableOpacity>
              ))}
              {/* Shift chips: outlined info colors + briefcase, so they never
                  look like a course chip. Not tappable on their own. */}
              {shownShifts.map(s => (
                <View key={s.id} style={styles.shiftChip}>
                  <Ionicons name="briefcase" size={8} color={colors.infoText} />
                  <Text style={styles.shiftChipText} numberOfLines={1}>{shortShiftHours(s)}</Text>
                </View>
              ))}
              {hidden > 0 && (
                <TouchableOpacity onPress={() => onDayPress?.(key)} hitSlop={4}>
                  <Text style={styles.moreLabel}>+{hidden} more</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Wide screens: always the month grid, no toggle (unchanged behavior).
  if (!isNarrow) return monthGrid;

  // Narrow screens: plain-text toggle above whichever view is active.
  return (
    <View>
      <TouchableOpacity
        style={styles.viewToggleButton}
        onPress={() => setMobileView(v => (v === 'week' ? 'month' : 'week'))}
        hitSlop={8}
      >
        <Text style={styles.viewToggle}>
          {mobileView === 'week' ? 'Month view' : 'Week view'}
        </Text>
      </TouchableOpacity>
      {mobileView === 'week' ? weekStrip : monthGrid}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  monthLabel: { fontFamily: fonts.display, fontSize: 17, color: colors.slate },
  monthNav: { flexDirection: 'row', gap: 16 },
  monthNavArrow: { fontSize: 20, color: colors.slate },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCellEmpty: {
    width: `${100 / 7}%`, minHeight: 88,
    borderWidth: 1, borderColor: colors.border,
  },
  dayCell: {
    width: `${100 / 7}%`, minHeight: 88, padding: 3,
    backgroundColor: colors.card, borderRadius: 6, borderWidth: 1, borderColor: colors.border,
  },
  dayCellToday: { borderColor: colors.text },
  dayNum: { fontSize: 11, color: colors.slate, marginBottom: 2 },
  dayNumToday: { fontFamily: fonts.mono, fontWeight: '700' as const },
  chip: { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 1 },
  chipText: { fontSize: 9, color: '#fff' },
  chipTextDone: { color: colors.slate },
  moreLabel: { fontSize: 8, color: colors.muted },
  shiftChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.infoBg, borderWidth: 1, borderColor: colors.infoText,
    borderRadius: 3, paddingHorizontal: 3, paddingVertical: 0, marginBottom: 1,
  },
  shiftChipText: { fontSize: 9, fontFamily: fonts.mono, color: colors.infoText, flexShrink: 1 },
  weekShiftBar: { width: 14, height: 3, borderRadius: 2, backgroundColor: colors.infoText, marginTop: 3 },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  weekCell: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 8, padding: 8, width: 44 },
  weekDayLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted },
  weekDateNum: { fontSize: 14, color: colors.slate, marginVertical: 2 },
  weekChip: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  weekMore: { fontSize: 8, color: colors.muted },
  viewToggleButton: { alignSelf: 'flex-end', marginBottom: 4 },
  viewToggle: { fontFamily: fonts.mono, fontSize: 12, color: colors.slate },
});
