import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, useWindowDimensions } from 'react-native';
import { Course } from '../types';
import { GradeThresholds } from '../utils/grades';
import { colors, fonts } from '../constants/theme';
import { notify } from '../utils/alerts';

type Props = {
  visible: boolean;
  course: Course | null;
  onCancel: () => void;
  onSave: (thresholds: GradeThresholds) => void;
};

// Lets a course use a different grading scale than the 90/80/70/60 default —
// some professors grade on a curve. Same navy-header popup style as
// AssignmentDetailModal, but a simple form instead of a detail view.
export default function GradeThresholdsModal({ visible, course, onCancel, onSave }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 700;

  const [aMin, setAMin] = useState('');
  const [bMin, setBMin] = useState('');
  const [cMin, setCMin] = useState('');
  const [dMin, setDMin] = useState('');

  useEffect(() => {
    if (!visible || !course) return;
    setAMin(String(course.gradeAMin));
    setBMin(String(course.gradeBMin));
    setCMin(String(course.gradeCMin));
    setDMin(String(course.gradeDMin));
  }, [visible, course]);

  function handleSave() {
    const a = parseFloat(aMin);
    const b = parseFloat(bMin);
    const c = parseFloat(cMin);
    const d = parseFloat(dMin);

    const allValid = [a, b, c, d].every((n) => Number.isFinite(n) && n >= 0 && n <= 100);
    if (!allValid) {
      notify('Invalid scale', 'Each cutoff must be a number between 0 and 100.');
      return;
    }
    if (!(a >= b && b >= c && c >= d)) {
      notify('Invalid scale', 'Each cutoff must be greater than or equal to the next.');
      return;
    }

    onSave({ gradeAMin: a, gradeBMin: b, gradeCMin: c, gradeDMin: d });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={[styles.modalOverlay, isWide && styles.modalOverlayWide]}>
        <View style={[styles.modalBox, isWide && styles.modalBoxWide]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>Grade Scale</Text>
              <Text style={styles.headerSubtitle}>{course?.name ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={8}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <ThresholdField label="A — minimum %" value={aMin} onChangeText={setAMin} />
            <ThresholdField label="B — minimum %" value={bMin} onChangeText={setBMin} />
            <ThresholdField label="C — minimum %" value={cMin} onChangeText={setCMin} />
            <ThresholdField label="D — minimum %" value={dMin} onChangeText={setDMin} />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ThresholdField({ label, value, onChangeText }: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalOverlayWide: { justifyContent: 'center' },
  modalBox: { backgroundColor: colors.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  modalBoxWide: { maxWidth: 520, width: '100%', alignSelf: 'center', borderRadius: 20 },
  header: {
    backgroundColor: colors.ink,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 19, fontFamily: fonts.display, color: colors.paper },
  headerSubtitle: { fontSize: 12, color: 'rgba(247,244,236,0.7)', marginTop: 2 },
  closeIcon: { fontSize: 18, color: colors.paper },
  content: { padding: 24, paddingBottom: 40 },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  fieldLabel: { fontSize: 14, color: colors.slate },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 10, fontSize: 15, backgroundColor: colors.card,
    width: 80, textAlign: 'center',
  },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText: { color: colors.muted, fontSize: 15 },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.ink, alignItems: 'center' },
  saveText: { color: colors.paper, fontSize: 15, fontWeight: '600' as const },
});
