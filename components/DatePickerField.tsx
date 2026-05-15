import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, TextInput, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = {
  value: string;           // ISO date string e.g. "2025-12-01"
  onChange: (date: string) => void;
  label?: string;
};

// Converts a Date object → "YYYY-MM-DD" string for storage
function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Converts "YYYY-MM-DD" → a readable label e.g. "Dec 1, 2025"
function toDisplayLabel(dateStr: string): string {
  if (!dateStr) return 'Pick a date';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DatePickerField({ value, onChange, label }: Props) {
  const [show, setShow] = useState(false);

  // Parse stored string back into a Date for the picker
  const dateValue = value ? new Date(value + 'T12:00:00') : new Date();

  // Web: just use a plain text input since native picker doesn't work in browsers
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={value}
          onChangeText={onChange}
        />
      </View>
    );
  }

  // iOS and Android: use the native date picker
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Button that shows the currently selected date */}
      <TouchableOpacity style={styles.button} onPress={() => setShow(true)}>
        <Text style={styles.buttonText}>📅 {toDisplayLabel(value)}</Text>
      </TouchableOpacity>

      {/* The actual date picker — only rendered when open */}
      {show && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShow(false); // close after picking on Android
            if (selectedDate) {
              onChange(toISODate(selectedDate));
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 14, color: '#555', marginBottom: 8 },
  button: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 12, backgroundColor: '#fafafa',
  },
  buttonText: { fontSize: 15, color: '#333' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 12, fontSize: 15, backgroundColor: '#fafafa',
  },
});