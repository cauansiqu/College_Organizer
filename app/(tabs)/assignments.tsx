import { confirmDestructive, notify } from "@/utils/alerts";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import AssignmentDetailModal from "../../components/AssignmentDetailModal";
import AssignmentFormModal, {
  AssignmentFormValues,
} from "../../components/AssignmentFormModal";
import CalendarMonth from "../../components/CalendarMonth";
import DayListSheet from "../../components/DayListSheet";
import { fonts, priorityColors, tintColor, type ThemeColors } from "../../constants/theme";
import { useTheme } from "../../context/ThemeContext";
import {
  deleteAssignment,
  getAssignments,
  getCategories,
  getCourses,
  getWorkShifts,
  saveAssignment,
  toggleAssignment,
  updateAssignment,
} from "../../storage/storage";
import { Assignment, Category, Course, WorkShift } from "../../types";
import { dueLabel, parseLocalDate, toLocalISODate } from "../../utils/dates";
import { addDays } from "../../utils/plan";
import { useShowWorkShifts } from "../../lib/showWorkShifts";

type SortMode = "date" | "priority";
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export default function AssignmentsScreen() {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(
    null,
  );
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [dayListDate, setDayListDate] = useState<string | null>(null);
  // Store just the id, not the Assignment object, so the detail popup always
  // re-derives from live `assignments` state and never shows stale data
  // after a toggle or edit.
  const [detailAssignmentId, setDetailAssignmentId] = useState<string | null>(
    null,
  );

  // Calendar month lives here (not in CalendarMonth) so we know which
  // month's work shifts to load.
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [showShifts, setShowShifts] = useShowWorkShifts();

  async function loadData() {
    const [a, c, cat] = await Promise.all([getAssignments(), getCourses(), getCategories()]);
    setAssignments(a);
    setCourses(c);
    setCategories(cat);
  }

  // Shift range covers the visible month AND the phone's 7-day strip, which
  // can run into next month. "YYYY-MM-DD" strings compare correctly.
  const todayIso = toLocalISODate(new Date());
  const monthFrom = toLocalISODate(calendarMonth);
  const monthTo = toLocalISODate(
    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1),
  );
  const shiftsFrom = monthFrom < todayIso ? monthFrom : todayIso;
  const weekEnd = addDays(todayIso, 7);
  const shiftsTo = monthTo > weekEnd ? monthTo : weekEnd;

  // Kept separate from loadData so a shift error never blocks assignments —
  // the calendar just shows assignments only.
  const loadShifts = useCallback(async () => {
    try {
      setShifts(await getWorkShifts(
        parseLocalDate(shiftsFrom).toISOString(),
        parseLocalDate(shiftsTo).toISOString(),
      ));
    } catch (e) {
      notify("Could not load work shifts", e instanceof Error ? e.message : String(e));
    }
  }, [shiftsFrom, shiftsTo]);

  // Reload on focus; loadShifts also re-runs when the month changes
  useFocusEffect(
    useCallback(() => {
      loadData();
      loadShifts();
    }, [loadShifts]),
  );

  // Toggle off = hide shifts everywhere on this screen
  const visibleShifts = showShifts ? shifts : [];

  function getCourse(courseId: string) {
    return courses.find((c) => c.id === courseId);
  }

  function openModal(assignment?: Assignment) {
    setEditingAssignment(assignment ?? null);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditingAssignment(null);
  }

  function openDayList(dateISO: string) {
    setDayListDate(dateISO);
  }

  function closeDayList() {
    setDayListDate(null);
  }

  function openDetail(assignment: Assignment) {
    setDetailAssignmentId(assignment.id);
  }

  function closeDetail() {
    setDetailAssignmentId(null);
  }

  // Called by AssignmentFormModal once the form is valid and Save/Update is tapped
  async function handleFormSave(values: AssignmentFormValues) {
    if (editingAssignment) {
      const updated: Assignment = { ...editingAssignment, ...values };
      await updateAssignment(updated);
      setAssignments((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
    } else {
      const newAssignment: Assignment = {
        id: Date.now().toString(),
        completed: false,
        ...values,
      };
      const created = await saveAssignment(newAssignment);
      setAssignments((prev) => [...prev, created]);
    }
    closeModal();
  }

  async function handleToggle(id: string) {
    await toggleAssignment(id);
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a)),
    );
  }

  function handleDelete(id: string) {
    confirmDestructive(
      "Delete Assignment",
      "Are you sure?",
      "Delete",
      async () => {
        await deleteAssignment(id);
        setAssignments((prev) => prev.filter((a) => a.id !== id));
        closeModal();
        setDetailAssignmentId(null); // no-op if delete wasn't triggered from the detail popup
      },
    );
  }

  const sorted = [...assignments].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (sortMode === "priority") {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    return a.dueDate.localeCompare(b.dueDate);
  });

  // Derived (not stored) so the detail popup can never show stale data
  // after a toggle-complete or an edit save.
  const detailAssignment =
    assignments.find((a) => a.id === detailAssignmentId) ?? null;
  const detailCourse = detailAssignment
    ? getCourse(detailAssignment.courseId)
    : undefined;

  const checklist = (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View style={styles.checklistHeader}>
        <Text style={styles.sectionLabel}>Checklist</Text>
        <View style={styles.sortToggle}>
          <TouchableOpacity
            style={[
              styles.sortPill,
              sortMode === "date" && styles.sortPillActive,
            ]}
            onPress={() => setSortMode("date")}
          >
            <Text
              style={[
                styles.sortPillText,
                sortMode === "date" && styles.sortPillTextActive,
              ]}
            >
              Date
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sortPill,
              sortMode === "priority" && styles.sortPillActive,
            ]}
            onPress={() => setSortMode("priority")}
          >
            <Text
              style={[
                styles.sortPillText,
                sortMode === "priority" && styles.sortPillTextActive,
              ]}
            >
              Priority
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {assignments.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No assignments yet.</Text>
          <Text style={styles.emptySubText}>Tap + to add one.</Text>
        </View>
      )}

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        style={{ flex: 1, minHeight: 0 }}
        renderItem={({ item }) => {
          const course = getCourse(item.courseId);
          const dueBadgeLabel = dueLabel(item.dueDate, item.completed);
          return (
            <TouchableOpacity
              style={[
                styles.card,
                item.completed && styles.cardDone,
                {
                  backgroundColor: tintColor(course?.color ?? colors.muted, scheme),
                  borderLeftColor: course?.color ?? colors.muted,
                },
              ]}
              onPress={() => openModal(item)}
              onLongPress={() => handleDelete(item.id)}
            >
              <View style={styles.cardContent}>
                <Text
                  style={[
                    styles.cardTitle,
                    item.completed && styles.cardTitleDone,
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.cardCourse}>
                  {course?.name ?? "Unknown course"}
                </Text>
                {item.notes ? (
                  <Text style={styles.cardNotes}>{item.notes}</Text>
                ) : null}
              </View>

              {item.completed ? (
                <TouchableOpacity onPress={() => handleToggle(item.id)}>
                  <Text style={styles.checkIcon}>✓</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.cardRight}>
                  <TouchableOpacity onPress={() => handleToggle(item.id)}>
                    <Text style={styles.dueBadge}>{dueBadgeLabel}</Text>
                  </TouchableOpacity>
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: priorityColors[item.priority] },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ gap: 10, paddingBottom: 90 }}
      />
    </View>
  );

  const calendar = (
    <View style={isWide ? styles.calendarPaneWide : undefined}>
      {/* Per-device "Show work shifts" toggle (saved in AsyncStorage) */}
      <View style={styles.shiftToggleRow}>
        <Ionicons name="briefcase" size={14} color={colors.infoText} />
        <Text style={styles.shiftToggleLabel}>Show work shifts</Text>
        <Switch
          value={showShifts}
          onValueChange={setShowShifts}
          trackColor={{ true: colors.infoText, false: colors.border }}
          thumbColor={colors.card}
        />
      </View>
      <CalendarMonth
        assignments={assignments}
        courses={courses}
        shifts={visibleShifts}
        month={calendarMonth}
        onChangeMonth={setCalendarMonth}
        onDayPress={openDayList}
        onAssignmentPress={openDetail}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {isWide ? (
        <View style={styles.splitRow}>
          {calendar}
          {checklist}
        </View>
      ) : (
        <View style={styles.stackedContainer}>
          {calendar}
          <View style={{ height: 16 }} />
          {checklist}
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AssignmentFormModal
        visible={modalVisible}
        editing={editingAssignment}
        courses={courses}
        categories={categories}
        onCancel={closeModal}
        onSave={handleFormSave}
        onDelete={
          editingAssignment
            ? () => handleDelete(editingAssignment.id)
            : undefined
        }
      />

      <DayListSheet
        visible={dayListDate !== null}
        date={dayListDate}
        assignments={assignments}
        courses={courses}
        shifts={visibleShifts}
        onClose={closeDayList}
        onSelectAssignment={openDetail}
      />

      <AssignmentDetailModal
        visible={detailAssignment !== null}
        assignment={detailAssignment}
        course={detailCourse}
        onClose={closeDetail}
        onEdit={() => {
          if (!detailAssignment) return;
          closeDetail();
          openModal(detailAssignment);
        }}
        onToggleComplete={() =>
          detailAssignment && handleToggle(detailAssignment.id)
        }
        onDelete={() => detailAssignment && handleDelete(detailAssignment.id)}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  shiftToggleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  shiftToggleLabel: { flex: 1, fontSize: 13, color: colors.slate },
  splitRow: { flex: 1, flexDirection: "row", gap: 16, padding: 16 },
  stackedContainer: { flex: 1, padding: 16 },
  calendarPaneWide: { flex: 1.3 },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.slate,
  },
  checklistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sortToggle: { flexDirection: "row", gap: 4 },
  sortPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.muted,
  },
  sortPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortPillText: { fontSize: 12, color: colors.muted },
  sortPillTextActive: { color: colors.onPrimary },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: { fontSize: 16, fontFamily: fonts.display, color: colors.slate },
  emptySubText: { fontSize: 13, color: colors.muted, marginTop: 6 },
  card: {
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 3,
    padding: 12,
  },
  cardDone: { opacity: 0.55 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "500" as const, color: colors.slate },
  cardTitleDone: { textDecorationLine: "line-through", color: colors.muted },
  cardCourse: { fontSize: 11, color: colors.muted, marginTop: 1 },
  cardNotes: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    fontStyle: "italic",
  },
  dueBadge: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.warningText,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  checkIcon: { fontSize: 16, color: colors.success },
  cardRight: { alignItems: "flex-end", gap: 6 },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    backgroundColor: colors.primary,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { color: colors.amber, fontSize: 28, lineHeight: 32 },
});
