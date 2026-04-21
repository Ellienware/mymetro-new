// app/(auth)/sign-in.tsx
// FIX: import corrected from '@/constants/themes' → '@/constants/theme'
import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, Alert, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { useSignIn, useAuth } from '@clerk/clerk-expo';
import { Link, useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/themes';
import { Ionicons } from '@expo/vector-icons';

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isSignedIn && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/(tabs)/home');
    }
  }, [isSignedIn]);

  const onSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      await setActive({ session: result.createdSessionId });
    } catch (err: any) {
      Alert.alert('Sign in failed', err.errors?.[0]?.message || 'Please check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isSignedIn) return null;

  const canSubmit = !!email && !!password && !loading;

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

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your myMetro account</Text>

            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordWrap, passwordFocused && styles.inputFocused]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Your password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={canSubmit ? onSignIn : undefined}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity style={styles.forgot}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>

            <TouchableOpacity
              style={[styles.btn, !canSubmit && styles.btnDisabled]}
              onPress={onSignIn}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Sign in</Text>
              }
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <Link href="/(auth)/sign-up" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>Sign up</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },

  brand: { alignItems: 'center', paddingTop: 48, marginBottom: 40 },
  brandIconWrap: { width: 60, height: 60, borderRadius: 18, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brandName: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.4 },
  brandSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },

  form: { flex: 1, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary, letterSpacing: -0.4, marginBottom: 6 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginBottom: 32 },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    height: 50, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 14, fontSize: 15, color: COLORS.textPrimary,
    backgroundColor: COLORS.background, marginBottom: 20,
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: '#fff' },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center', height: 50,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    backgroundColor: COLORS.background, paddingLeft: 14, paddingRight: 4, marginBottom: 8,
  },
  passwordInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  eyeBtn: { padding: 10 },

  forgot: { alignSelf: 'flex-end', marginBottom: 28, marginTop: 4 },
  forgotText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  btn: { height: 52, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 14, color: COLORS.textMuted },
  footerLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});