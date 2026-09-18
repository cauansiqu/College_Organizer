import { confirmDestructive } from "@/utils/alerts";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  StyleSheet,
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
import { colors, fonts, priorityColors, tintColor } from "../../constants/theme";
import {
  deleteAssignment,
  getAssignments,
  getCategories,
  getCourses,
  saveAssignment,
  toggleAssignment,
  updateAssignment,
} from "../../storage/storage";
import { Assignment, Category, Course } from "../../types";
import { dueLabel } from "../../utils/dates";

type SortMode = "date" | "priority";
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

export default function AssignmentsScreen() {
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

  async function loadData() {
    const [a, c, cat] = await Promise.all([getAssignments(), getCourses(), getCategories()]);
    setAssignments(a);
    setCourses(c);
    setCategories(cat);
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

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
                  backgroundColor: tintColor(course?.color ?? colors.muted),
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
      <CalendarMonth
        assignments={assignments}
        courses={courses}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
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
  sortPillActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  sortPillText: { fontSize: 12, color: colors.muted },
  sortPillTextActive: { color: colors.paper },
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
    color: "#854F0B",
    backgroundColor: "#FAEEDA",
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
    backgroundColor: colors.ink,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { color: colors.amber, fontSize: 28, lineHeight: 32 },
});
