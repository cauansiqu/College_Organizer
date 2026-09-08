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
import AssignmentFormModal, {
  AssignmentFormValues,
} from "../../components/AssignmentFormModal";
import CalendarMonth from "../../components/CalendarMonth";
import { colors, fonts, priorityColors } from "../../constants/theme";
import {
  deleteAssignment,
  getAssignments,
  getCourses,
  saveAssignment,
  toggleAssignment,
  updateAssignment,
} from "../../storage/storage";
import { Assignment, Course } from "../../types";
import { parseLocalDate } from "../../utils/dates";

type SortMode = "date" | "priority";
const PRIORITY_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function daysUntil(dueDate: string) {
  const due = parseLocalDate(dueDate.slice(0, 10) + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  return diff;
}

export default function AssignmentsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(
    null,
  );
  const [sortMode, setSortMode] = useState<SortMode>("date");

  async function loadData() {
    const [a, c] = await Promise.all([getAssignments(), getCourses()]);
    setAssignments(a);
    setCourses(c);
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
        description: "",
        ...values,
      };
      await saveAssignment(newAssignment);
      setAssignments((prev) => [...prev, newAssignment]);
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
          const diff = daysUntil(item.dueDate);
          const dueLabel = item.completed
            ? null
            : diff < 0
              ? `${Math.abs(diff)}D LATE`
              : diff === 0
                ? "DUE TODAY"
                : `DUE ${String(diff).padStart(2, "0")}D`;
          return (
            <TouchableOpacity
              style={[
                styles.card,
                item.completed && styles.cardDone,
                { borderLeftColor: course?.color ?? colors.muted },
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
                    <Text style={styles.dueBadge}>{dueLabel}</Text>
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
      <CalendarMonth assignments={assignments} courses={courses} />
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
        onCancel={closeModal}
        onSave={handleFormSave}
        onDelete={
          editingAssignment
            ? () => handleDelete(editingAssignment.id)
            : undefined
        }
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
    backgroundColor: colors.card,
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
