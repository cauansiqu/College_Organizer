import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import {
  getAssignments, getCourses, getCategories, getPlanTasks, getWorkShifts,
  getPlannerChanges, getPlannerMeta, setPlanTaskCompleted, toggleAssignment,
  deleteAssignment, updateAssignment,
} from '../../storage/storage';
import { Assignment, Category, Course, PlanTask, PlannerChange, PlannerMeta, WorkShift } from '../../types';
import { fonts, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { parseLocalDate, toLocalISODate } from '../../utils/dates';
import { notify, confirmDestructive } from '../../utils/alerts';
import {
  addDays, boardWeekStart, clockTime, groupByDay, isEmptyDay, localDayOf, monthDay,
  shiftTimeRange, shortDate, syncedLabel, weekday, type PlanDay,
} from '../../utils/plan';
import PlanDayCard from '../../components/PlanDayCard';
import WeekBoard from '../../components/WeekBoard';
import AssignmentDetailModal from '../../components/AssignmentDetailModal';
import AssignmentFormModal, { type AssignmentFormValues } from '../../components/AssignmentFormModal';

const WIDE_BREAKPOINT = 900;      // px; at or above this the week board replaces the agenda
const AGENDA_DAYS = 14;           // agenda shows today … today + 14
const BANNER_KINDS = new Set<PlannerChange['kind']>(['added', 'moved', 'removed']);

type Filter = 'days' | 'shifts' | 'changes';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'days', label: 'Next 2 weeks' },
  { key: 'shifts', label: 'Shifts' },
  { key: 'changes', label: 'Changes' },
];

// An agenda entry: a full day card, or one collapsed "Sat–Sun · off" line
type AgendaItem = { kind: 'day'; day: PlanDay } | { kind: 'off'; key: string; label: string };

export default function PlanScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [changes, setChanges] = useState<PlannerChange[]>([]);
  const [meta, setMeta] = useState<PlannerMeta | null>(null);
  const [loaded, setLoaded] = useState(false);
  // When the data was last loaded. "Last 24 h" and "upcoming" are measured
  // from this, since calling Date.now() during render isn't allowed (it would
  // make renders impure). It refreshes on every focus/reload.
  const [loadedAt, setLoadedAt] = useState(0);

  const [filter, setFilter] = useState<Filter>('days');
  const [weekOffset, setWeekOffset] = useState(0);   // week board: 0 = this week
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Assignment | null>(null);

  // Dates are local "YYYY-MM-DD" strings, which compare correctly as strings
  const todayIso = toLocalISODate(new Date());
  const weekStart = boardWeekStart(todayIso, weekOffset);
  const agendaEnd = addDays(todayIso, AGENDA_DAYS);
  // One fetch range that covers both layouts: the agenda and the shown
  // week + the week after (for "Coming up").
  const rangeFrom = todayIso < weekStart ? todayIso : weekStart;
  const rangeTo = agendaEnd > addDays(weekStart, 13) ? agendaEnd : addDays(weekStart, 13);

  const loadData = useCallback(async () => {
    try {
      // Shifts are timestamps, so the range is local midnight → local midnight
      const fromTs = parseLocalDate(rangeFrom).toISOString();
      const toTs = parseLocalDate(addDays(rangeTo, 1)).toISOString();
      const [c, cat, a, t, s, ch, m] = await Promise.all([
        getCourses(), getCategories(), getAssignments(), getPlanTasks(rangeFrom, rangeTo),
        getWorkShifts(fromTs, toTs), getPlannerChanges(), getPlannerMeta(),
      ]);
      setCourses(c);
      setCategories(cat);
      setAssignments(a);
      setTasks(t);
      setShifts(s);
      setChanges(ch);
      setMeta(m);
      setLoadedAt(Date.now());
    } catch (e) {
      notify('Could not load your plan', e instanceof Error ? e.message : String(e));
    } finally {
      setLoaded(true);
    }
  }, [rangeFrom, rangeTo]);

  // Reload whenever the tab is focused (like Home), and when the range
  // changes because the week board moved to another week.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // "synced 6:47 AM" on the right of the navy header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Text style={styles.headerSynced}>{syncedLabel(meta?.courseworkSyncedAt)}</Text>
      ),
    });
  }, [navigation, meta, styles]);

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  // Bucket everything by local day once; buildDay() then just looks days up.
  const byDay = useMemo(() => {
    const open = assignments.filter((a) => !a.completed);
    return {
      due: groupByDay(open, (a) => a.dueDate),
      tasks: groupByDay(tasks, (t) => t.planDate),
      shifts: groupByDay(shifts, (s) => localDayOf(s.startsAt)),
    };
  }, [assignments, tasks, shifts]);

  const buildDay = useCallback((iso: string): PlanDay => ({
    iso,
    due: byDay.due.get(iso) ?? [],
    tasks: byDay.tasks.get(iso) ?? [],
    shifts: byDay.shifts.get(iso) ?? [],
  }), [byDay]);

  // --- Agenda days, with empty weekends collapsed to one line ---
  const agenda: AgendaItem[] = useMemo(() => {
    const items: AgendaItem[] = [];
    for (let i = 0; i <= AGENDA_DAYS; i++) {
      const iso = addDays(todayIso, i);
      const day = buildDay(iso);
      const dow = weekday(iso);
      if (dow === 6 && i < AGENDA_DAYS) {
        // Saturday with its Sunday also in range: collapse the pair if both empty
        const sunday = buildDay(addDays(iso, 1));
        if (isEmptyDay(day) && isEmptyDay(sunday)) {
          items.push({ kind: 'off', key: iso, label: 'Sat–Sun · off' });
          i++; // Sunday is covered by this line
          continue;
        }
      } else if ((dow === 0 && i === 0) || (dow === 6 && i === AGENDA_DAYS)) {
        // A lone weekend day at either end of the range
        if (isEmptyDay(day)) {
          items.push({ kind: 'off', key: iso, label: `${dow === 0 ? 'Sun' : 'Sat'} · off` });
          continue;
        }
      }
      items.push({ kind: 'day', day });
    }
    return items;
  }, [todayIso, buildDay]);

  // "New: …" banner: added/moved/removed changes from the last 24 hours
  const bannerMessages = useMemo(() => {
    const since = loadedAt - 24 * 60 * 60 * 1000;
    return changes
      .filter((c) => BANNER_KINDS.has(c.kind) && new Date(c.happenedAt).getTime() >= since)
      .slice(0, 3)
      .map((c) => c.message);
  }, [changes, loadedAt]);

  // Upcoming shifts (still running or later) through the agenda's last day
  const upcomingShifts = shifts.filter(
    (s) => new Date(s.endsAt).getTime() > loadedAt && localDayOf(s.startsAt) <= agendaEnd,
  );

  const hasPlan = tasks.some((t) => t.planDate >= todayIso && t.planDate <= agendaEnd)
    || (isWide && tasks.some((t) => t.planDate >= weekStart && t.planDate <= addDays(weekStart, 6)));

  // --- Plan task checkbox: update the UI first, undo if the save fails ---
  async function handleToggleTask(task: PlanTask) {
    const next = !task.completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)));
    try {
      await setPlanTaskCompleted(task.id, next);
    } catch (e) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t)));
      notify('Could not update task', e instanceof Error ? e.message : String(e));
    }
  }

  // --- Due item → existing detail popup (same handlers as the Assignments tab) ---
  // Derived from `assignments` so the popup never shows stale data.
  const detailAssignment = assignments.find((a) => a.id === detailId) ?? null;

  async function handleToggleAssignment(id: string) {
    await toggleAssignment(id);
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a)));
  }

  function handleDeleteAssignment(id: string) {
    confirmDestructive('Delete Assignment', 'Are you sure?', 'Delete', async () => {
      await deleteAssignment(id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setDetailId(null);
      setEditing(null);
    });
  }

  async function handleFormSave(values: AssignmentFormValues) {
    if (!editing) return;
    const updated: Assignment = { ...editing, ...values };
    await updateAssignment(updated);
    setAssignments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditing(null);
  }

  const openAssignment = (a: Assignment) => setDetailId(a.id);

  // --- Week board data ---
  const weekdays = [0, 1, 2, 3, 4].map((i) => buildDay(addDays(weekStart, i)));
  const weekend = [5, 6].map((i) => buildDay(addDays(weekStart, i)));
  const nextWeekFrom = addDays(weekStart, 7);
  const nextWeekTo = addDays(weekStart, 13);
  const nextWeekDue = assignments
    .filter((a) => !a.completed && a.dueDate >= nextWeekFrom && a.dueDate <= nextWeekTo)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {loaded && !hasPlan && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No plan yet — the morning sync fills this in.</Text>
          </View>
        )}

        {isWide ? (
          <WeekBoard
            weekStart={weekStart}
            todayIso={todayIso}
            weekdays={weekdays}
            weekend={weekend}
            nextWeekDue={nextWeekDue}
            courseById={courseById}
            onToggleTask={handleToggleTask}
            onOpenAssignment={openAssignment}
            onPrevWeek={() => setWeekOffset((w) => w - 1)}
            onThisWeek={() => setWeekOffset(0)}
            onNextWeek={() => setWeekOffset((w) => w + 1)}
          />
        ) : (
          <>
            {/* Filter pills */}
            <View style={styles.pillRow}>
              {FILTERS.map((f) => {
                const selected = filter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    style={[styles.pill, selected && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextActive]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {filter === 'days' && (
              <>
                {bannerMessages.length > 0 && (
                  <View style={styles.banner}>
                    <Text style={styles.bannerText}>New: {bannerMessages.join(' · ')}</Text>
                  </View>
                )}
                {agenda.map((item) =>
                  item.kind === 'off' ? (
                    <Text key={item.key} style={styles.offLine}>{item.label}</Text>
                  ) : (
                    <PlanDayCard
                      key={item.day.iso}
                      day={item.day}
                      todayIso={todayIso}
                      courseById={courseById}
                      onToggleTask={handleToggleTask}
                      onOpenAssignment={openAssignment}
                    />
                  ),
                )}
              </>
            )}

            {filter === 'shifts' && (
              upcomingShifts.length === 0 ? (
                <Text style={styles.offLine}>No upcoming shifts.</Text>
              ) : (
                upcomingShifts.map((s) => (
                  <View key={s.id} style={styles.listRow}>
                    <Text style={styles.listDate}>{shortDate(localDayOf(s.startsAt))}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>{s.title}</Text>
                      <Text style={styles.listSub}>{shiftTimeRange(s)}</Text>
                    </View>
                  </View>
                ))
              )
            )}

            {filter === 'changes' && (
              changes.length === 0 ? (
                <Text style={styles.offLine}>No changes yet.</Text>
              ) : (
                changes.map((c) => (
                  <View key={c.id} style={styles.listRow}>
                    <Text style={styles.listDate}>
                      {monthDay(localDayOf(c.happenedAt))}{'\n'}{clockTime(c.happenedAt)}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.kindBadge}>{c.kind.toUpperCase()}</Text>
                      <Text style={styles.listTitle}>{c.message}</Text>
                    </View>
                  </View>
                ))
              )
            )}
          </>
        )}
      </ScrollView>

      <AssignmentDetailModal
        visible={detailAssignment !== null}
        assignment={detailAssignment}
        course={detailAssignment ? courseById.get(detailAssignment.courseId) : undefined}
        onClose={() => setDetailId(null)}
        onEdit={() => {
          if (!detailAssignment) return;
          setDetailId(null);
          setEditing(detailAssignment);
        }}
        onToggleComplete={() => detailAssignment && handleToggleAssignment(detailAssignment.id)}
        onDelete={() => detailAssignment && handleDeleteAssignment(detailAssignment.id)}
      />

      <AssignmentFormModal
        visible={editing !== null}
        editing={editing}
        courses={courses}
        categories={categories}
        onCancel={() => setEditing(null)}
        onSave={handleFormSave}
        onDelete={editing ? () => handleDeleteAssignment(editing.id) : undefined}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 12 },
  headerSynced: { fontSize: 11, fontFamily: fonts.mono, color: colors.headerText, opacity: 0.75, marginRight: 16 },
  emptyCard: {
    backgroundColor: colors.card, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14, color: colors.muted, fontStyle: 'italic', textAlign: 'center' },
  // Same pill look as Home's Appearance picker
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.muted },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, color: colors.muted },
  pillTextActive: { color: colors.onPrimary },
  banner: { backgroundColor: colors.infoBg, borderRadius: 10, padding: 12 },
  bannerText: { fontSize: 13, color: colors.infoText },
  offLine: { fontSize: 13, color: colors.muted, fontFamily: fonts.mono, paddingHorizontal: 4, paddingVertical: 4 },
  listRow: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  listDate: { fontSize: 11, fontFamily: fonts.mono, color: colors.muted, width: 90 },
  listTitle: { fontSize: 14, color: colors.slate },
  listSub: { fontSize: 12, fontFamily: fonts.mono, color: colors.infoText, marginTop: 2 },
  kindBadge: { fontSize: 10, fontFamily: fonts.mono, color: colors.muted, marginBottom: 2 },
});
