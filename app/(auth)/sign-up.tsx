// app/(auth)/sign-up.tsx
import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSignUp, useAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/themes';
import { Ionicons } from '@expo/vector-icons';

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSignedIn) router.replace('/(tabs)/home');
  }, [isSignedIn]);

  const onSignUp = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signUp.create({ firstName, lastName, emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      Alert.alert('Error', err.errors[0]?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      await setActive({ session: result.createdSessionId });
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Error', err.errors[0]?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!firstName && !!lastName && !!email && !!password && !loading;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.brandIconWrap}>
              <Ionicons name="train" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.brandName}>myMetro</Text>
            <Text style={styles.brandSub}>PWS Solutions</Text>
          </View>

          {!pendingVerification ? (
            <View style={styles.form}>
              <Text style={styles.title}>Join myMetro</Text>
              <Text style={styles.subtitle}>Create your account to get started</Text>

              {/* Name row */}
              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>First Name</Text>
                  <TextInput style={styles.input} placeholder="First name" placeholderTextColor={COLORS.textMuted} value={firstName} onChangeText={setFirstName} />
                </View>
                <View style={{ width: SPACING.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Last Name</Text>
                  <TextInput style={styles.input} placeholder="Last name" placeholderTextColor={COLORS.textMuted} value={lastName} onChangeText={setLastName} />
                </View>
              </View>

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input} placeholder="you@example.com" placeholderTextColor={COLORS.textMuted}
                value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              />

              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput} placeholder="Create a password" placeholderTextColor={COLORS.textMuted}
                  value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Password hint */}
              <Text style={styles.passwordHint}>Minimum 8 characters recommended</Text>

              <TouchableOpacity
                style={[styles.btn, !canSubmit && styles.btnDisabled]}
                onPress={onSignUp}
                disabled={!canSubmit}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnText}>Create Account</Text>
                }
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account?</Text>
                <Link href="/(auth)/sign-in" asChild>
                  <TouchableOpacity><Text style={styles.footerLink}>Sign In</Text></TouchableOpacity>
                </Link>
              </View>
            </View>
          ) : (
            // ─── Verification step ──────────────────
            <View style={styles.form}>
              <View style={styles.verifyHero}>
                <Text style={styles.verifyEmoji}>📧</Text>
                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.subtitle}>We sent a 6-digit code to{'\n'}<Text style={styles.emailHighlight}>{email}</Text></Text>
              </View>

              <Text style={styles.label}>Verification Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor={COLORS.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />

              <TouchableOpacity
                style={[styles.btn, (!code || loading) && styles.btnDisabled]}
                onPress={onVerify}
                disabled={!code || loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnText}>Verify Email</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.resend} onPress={() => { setPendingVerification(false); setCode(''); }}>
                <Text style={styles.resendText}>Didn't receive a code? Go back</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  brand: { alignItems: 'center', paddingTop: 40, marginBottom: 32 },
  brandIconWrap: { width: 60, height: 60, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandName: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  brandSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },

  form: { flex: 1, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.4, marginBottom: 6 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginBottom: 28, lineHeight: 22 },

  nameRow: { flexDirection: 'row', marginBottom: 0 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 16 },
  input: {
    height: 50, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.background,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center', height: 50,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background, paddingLeft: 14, paddingRight: 4,
  },
  passwordInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  eyeBtn: { padding: 10 },
  passwordHint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4, marginBottom: 24 },

  btn: { height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 14, color: COLORS.textMuted },
  footerLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },

  verifyHero: { alignItems: 'center', marginBottom: 28 },
  verifyEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  emailHighlight: { color: COLORS.primary, fontWeight: '600' },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  resend: { alignItems: 'center', marginTop: 8 },
  resendText: { fontSize: 13, color: COLORS.primary, fontWeight: '600', textDecorationLine: 'underline' },
});