import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../lib/supabase';
import { notify } from '../../utils/alerts';
import { fonts, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function AuthScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // True right after a successful signup — we can't log the user in yet
  // because email confirmation is required, so we show this instead.
  const [signupSuccess, setSignupSuccess] = useState(false);

  function toggleMode() {
    setMode(m => (m === 'login' ? 'signup' : 'login'));
    setSignupSuccess(false);
  }

  function backToLogin() {
    setMode('login');
    setSignupSuccess(false);
    setPassword('');
  }

  async function handleSubmit() {
    if (!email.trim() || !password) {
      notify('Missing info', 'Please enter both an email and a password.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        // On success there's nothing else to do — app/_layout.tsx is
        // subscribed to onAuthStateChange and will swap to the tabs itself.
        if (error) {
          // GoTrue's message for this case is terse — give a clearer nudge.
          const message =
            error.message === 'Email not confirmed'
              ? 'Please confirm your email first — check your inbox for the confirmation link.'
              : error.message;
          notify('Login failed', message);
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          notify('Sign up failed', error.message);
        } else {
          setSignupSuccess(true);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const headerIcon: IconName = signupSuccess ? 'mail-outline' : 'school-outline';
  const headerTitle = signupSuccess
    ? 'Check your email'
    : mode === 'login'
    ? 'Welcome back'
    : 'Create your account';
  const headerSubtitle = signupSuccess
    ? "One more step before you're in."
    : mode === 'login'
    ? 'Log in to see your courses and assignments.'
    : 'Track your courses and due dates in one place.';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name={headerIcon} size={32} color={colors.amber} />
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
        </View>

        <View style={styles.body}>
          {signupSuccess ? (
            <>
              <View style={styles.callout}>
                <Text style={styles.calloutText}>
                  We sent a confirmation link to{' '}
                  <Text style={styles.calloutBold}>{email.trim()}</Text>.
                </Text>
              </View>
              <Text style={styles.spamHint}>
                Didn&apos;t get it? Check your spam folder — delivery can take a minute.
              </Text>
              <Pressable style={styles.submitBtn} onPress={backToLogin}>
                <Text style={styles.submitText}>Back to Log In</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.inputWithIcon]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    secureTextEntry={!showPassword}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.muted}
                    />
                  </Pressable>
                </View>
                {mode === 'signup' && <Text style={styles.hint}>At least 6 characters.</Text>}
              </View>

              <Pressable
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitText}>
                  {submitting ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
                </Text>
              </Pressable>

              <Pressable onPress={toggleMode}>
                <Text style={styles.toggleText}>
                  {mode === 'login'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Log in'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  header: {
    backgroundColor: colors.headerBg,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    gap: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: fonts.display,
    color: colors.headerText,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    // colors.muted is tuned for the light `paper` background — too low
    // contrast on navy, so use a translucent paper tone here instead.
    color: 'rgba(247,244,236,0.65)',
    textAlign: 'center',
  },
  body: {
    backgroundColor: colors.card,
    padding: 24,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.paper,
    color: colors.slate,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputWithIcon: {
    paddingRight: 40,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  callout: {
    backgroundColor: colors.warningBg,
    borderLeftWidth: 4,
    borderLeftColor: colors.amber,
    padding: 14,
    marginBottom: 12,
  },
  calloutText: {
    fontSize: 14,
    color: colors.slate,
    lineHeight: 20,
  },
  calloutBold: {
    fontWeight: '700',
  },
  spamHint: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
});
