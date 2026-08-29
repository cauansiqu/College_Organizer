import { Alert, Platform } from 'react-native';

// Simple one-button "OK" style alert. Alert.alert() is a complete no-op
// on web (react-native-web doesn't implement it — see its source), so
// this falls back to the browser's own window.alert() there instead.
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

// Confirm/cancel style alert for destructive actions (like deleting).
// Calls onConfirm() only if the user actually confirms. Same web
// fallback reasoning as notify() above — uses window.confirm() there.
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  }
}