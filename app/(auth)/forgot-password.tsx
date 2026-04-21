// app/(auth)/forgot-password.tsx
import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/themes';
import { Ionicons } from '@expo/vector-icons';

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const { signIn, isLoaded } = useSignIn();
  const router = useRouter();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onRequestReset = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email });
      setStep('reset');
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const onReset = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });
      if (result.status === 'complete') {
        Alert.alert('Password reset! ✅', 'You can now sign in with your new password.');
        router.replace('/(auth)/sign-in');
      } else {
        Alert.alert('Error', 'Password reset failed. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.errors?.[0]?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.brandSub}>PRASA Metrorail</Text>
          </View>

          {step === 'email' ? (
            <View style={styles.form}>
              <View style={styles.stepHero}>
                <Text style={styles.stepEmoji}>🔐</Text>
                <Text style={styles.title}>Reset your password</Text>
                <Text style={styles.subtitle}>Enter your email address and we'll send you a code to reset your password.</Text>
              </View>

              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.btn, (!email || loading) && styles.btnDisabled]}
                onPress={onRequestReset}
                disabled={!email || loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnText}>Send Reset Code</Text>
                }
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Remember your password?</Text>
                <Link href="/(auth)/sign-in" asChild>
                  <TouchableOpacity><Text style={styles.footerLink}>Sign in</Text></TouchableOpacity>
                </Link>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.stepHero}>
                <Text style={styles.stepEmoji}>📧</Text>
                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.subtitle}>
                  We sent a reset code to{'\n'}<Text style={styles.emailHighlight}>{email}</Text>
                </Text>
              </View>

              <Text style={styles.label}>Reset Code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="000000"
                placeholderTextColor={COLORS.textMuted}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />

              <Text style={styles.label}>New Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Your new password"
                  placeholderTextColor={COLORS.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.btn, (!code || !newPassword || loading) && styles.btnDisabled]}
                onPress={onReset}
                disabled={!code || !newPassword || loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnText}>Reset Password</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resend}
                onPress={() => { setStep('email'); setCode(''); setNewPassword(''); }}
              >
                <Text style={styles.resendText}>← Back to email step</Text>
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
  stepHero: { alignItems: 'center', marginBottom: 32 },
  stepEmoji: { fontSize: 48, marginBottom: SPACING.sm },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.4, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22, textAlign: 'center' },
  emailHighlight: { color: COLORS.primary, fontWeight: '600' },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 16 },
  input: {
    height: 50, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, fontSize: 15, color: COLORS.textPrimary, backgroundColor: COLORS.background,
  },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center', height: 50,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background, paddingLeft: 14, paddingRight: 4,
  },
  passwordInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  eyeBtn: { padding: 10 },

  btn: { height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: 28, marginBottom: 24 },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },

  resend: { alignItems: 'center', marginTop: 4 },
  resendText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 14, color: COLORS.textMuted },
  footerLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});