import { useState, useEffect } from 'react';
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

// "YYYY-MM-DD" (stored) → "MM-DD-YYYY" (what the web textbox shows)
function toMDY(isoStr: string): string {
  if (!isoStr) return '';
  const [year, month, day] = isoStr.split('-');
  if (!year || !month || !day) return '';
  return `${month}-${day}-${year}`;
}

// "MM-DD-YYYY" (what the user typed) → "YYYY-MM-DD" (what gets stored)
// Returns null if what's typed isn't a complete, valid-looking date yet.
function fromMDY(mdyStr: string): string | null {
  const match = mdyStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

export default function DatePickerField({ value, onChange, label }: Props) {
  const [show, setShow] = useState(false);

  // What's currently typed in the web textbox. Kept separate from `value`
  // so half-typed dates (like "12-0") don't get lost or rejected.
  const [webText, setWebText] = useState(() => toMDY(value));

  // If `value` changes from outside (e.g. opening Edit on a different
  // assignment), keep the textbox showing the right thing.
  useEffect(() => {
    setWebText(toMDY(value));
  }, [value]);

  // Parse stored string back into a Date for the picker
  const dateValue = value ? new Date(value + 'T12:00:00') : new Date();

  // Web: just use a plain text input since native picker doesn't work in browsers
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <TextInput
          style={styles.input}
          placeholder="MM-DD-YYYY"
          value={webText}
          onChangeText={(text) => {
            setWebText(text);           // always show exactly what they typed
            const iso = fromMDY(text);  // try to convert it
            if (iso) onChange(iso);     // only save upward once it's a full valid date
          }}
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