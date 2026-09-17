import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { Assignment } from "../types";
import { parseLocalDate } from "../utils/dates";

// Makes reminders show a banner/alert if they fire while the app is open,
// instead of being silently swallowed (expo-notifications' default handler
// suppresses foreground notifications).
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

// Days-before-due-date offsets, each paired with the local hour/minute the
// reminder should fire at. 0 days (due-day itself) fires in the morning —
// firing exactly at the deadline isn't a useful reminder.
const REMINDER_OFFSETS = [
    { days: 5, hour: 18, minute: 0, label: "5 days left" },
    { days: 3, hour: 18, minute: 0, label: "3 days left" },
    { days: 1, hour: 18, minute: 0, label: "1 day left" },
    { days: 0, hour: 8, minute: 0, label: "Due today" },
];

function reminderId(assignmentId: string, days: number): string {
    return `${assignmentId}-${days}d`;
}

// Requests notification permission (once — does nothing if already granted
// or already denied) and sets up the Android notification channel required
// for local notifications to display on that platform. Call once at app
// startup, after a session exists.
export async function setupNotifications(): Promise<void> {
    if (Platform.OS === "web") return;

    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
    }
}

// Schedules (or reschedules) the due-date reminders for one assignment.
// Always cancels any existing reminders for this assignment first, so this
// doubles as the "reschedule after an edit" path. Silently does nothing on
// web, or if notification permission isn't granted.
export async function scheduleAssignmentReminders(
    assignment: Assignment,
    courseName?: string,
): Promise<void> {
    if (Platform.OS === "web") return;

    await cancelAssignmentReminders(assignment.id);

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    const dueDate = parseLocalDate(assignment.dueDate);
    const now = Date.now();

    for (const offset of REMINDER_OFFSETS) {
        const triggerDate = new Date(dueDate);
        triggerDate.setDate(triggerDate.getDate() - offset.days);
        triggerDate.setHours(offset.hour, offset.minute, 0, 0);

        // Skip any offset whose time has already passed — no point
        // scheduling a "3 days before" reminder for something due tomorrow.
        if (triggerDate.getTime() <= now) continue;

        await Notifications.scheduleNotificationAsync({
            identifier: reminderId(assignment.id, offset.days),
            content: {
                title:
                    offset.days === 0
                        ? `${assignment.title} is due today`
                        : `${assignment.title} due in ${offset.days} day${offset.days === 1 ? "" : "s"}`,
                body: courseName ?? undefined,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate,
            },
        });
    }
}

// Cancels all reminders that may have been scheduled for one assignment.
// Canceling an identifier that was never scheduled is a safe no-op in the
// expo-notifications API, so this doesn't need to check what's currently
// scheduled first.
export async function cancelAssignmentReminders(assignmentId: string): Promise<void> {
    if (Platform.OS === "web") return;

    await Promise.all(
        REMINDER_OFFSETS.map((offset) => offset.days).map((days) =>
            Notifications.cancelScheduledNotificationAsync(reminderId(assignmentId, days)),
        ),
    );
}
