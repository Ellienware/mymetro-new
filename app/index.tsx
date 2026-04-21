// app/index.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// ─── Exact brand palette (sampled from the uploaded logo) ────────────────────
// The logo is navy (#2B3896) on pure white. No gradients. No other colours.
// The onboarding mirrors this: white ground, navy type and elements.
const NAVY   = '#2B3896';   // primary brand navy
const NAVY2  = '#1E2A6E';   // slightly deeper — used for headline weight
const TINTED = '#F0F2FD';   // barely-blue white — card/pill background
const WHITE  = '#FFFFFF';
const MUTED  = '#8890C4';   // muted navy — secondary text

// ─── Splash ───────────────────────────────────────────────────────────────────

function Splash({ opacity, progress }: { opacity: Animated.Value; progress: Animated.Value }) {
  return (
    <Animated.View style={[styles.splash, { opacity }]}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
      {/*
       * The wordmark logo (logo.png) is navy on white — display it as-is on
       * the white splash, NO tintColor so the brand colours are exact.
       */}
      <Image
        source={require('@/assets/logo.png')}
        style={styles.splashLogo}
        resizeMode="contain"
      />
      {/* Animated progress bar in brand navy */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
    </Animated.View>
  );
}

// ─── Main onboarding ──────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [showSplash, setShowSplash] = useState(true);

  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashProgress = useRef(new Animated.Value(0)).current;

  // Staggered content animations
  const iconAnim   = useRef(new Animated.Value(0)).current;
  const titleAnim  = useRef(new Animated.Value(0)).current;
  const pillsAnim  = useRef(new Animated.Value(0)).current;
  const ctaAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Run progress bar during splash
    Animated.timing(splashProgress, {
      toValue: 1,
      duration: 2200,
      useNativeDriver: false, // width animation requires JS driver
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
        // Staggered spring entrance
        Animated.stagger(100, [
          Animated.spring(iconAnim,  { toValue: 1, useNativeDriver: true, tension: 55, friction: 8 }),
          Animated.spring(titleAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 8 }),
          Animated.spring(pillsAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 8 }),
          Animated.spring(ctaAnim,   { toValue: 1, useNativeDriver: true, tension: 55, friction: 8 }),
        ]).start();
      });
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  // Separate effect: auto-navigate once splash is dismissed
  useEffect(() => {
    if (!showSplash && isSignedIn) {
      router.replace('/(tabs)/home');
    }
  }, [showSplash, isSignedIn]);

  const handleGetStarted = () => {
    router.replace(isSignedIn ? '/(tabs)/home' : '/(auth)/sign-in');
  };

  // Animate helper
  const enter = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{
      translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
    }],
  });

  if (showSplash) {
    return <Splash opacity={splashOpacity} progress={splashProgress} />;
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* ── Top: icon + wordmark ── */}
      <Animated.View style={[styles.brand, { paddingTop: insets.top + 32 }, enter(iconAnim)]}>
        {/*
         * App icon (app-icon.png) — the rounded-square navy icon — displayed
         * at natural size, NO tintColor.
         */}
        <Image
          source={require('@/assets/app-icon.png')}
          style={styles.appIcon}
          resizeMode="contain"
        />
        {/*
         * Wordmark (logo.png) — navy on white, displayed as-is.
         * NO tintColor: the file already has the correct navy colour.
         */}
        <Image
          source={require('@/assets/logo.png')}
          style={styles.wordmark}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Hero text ── */}
      <Animated.View style={[styles.hero, enter(titleAnim)]}>
        <Text style={styles.headline}>
          Arrive on Time,{'\n'}Every Time.
        </Text>
        <Text style={styles.subline}>
          Plan, pay and track every journey across{'\n'}
          Gautrain, Metrorail, Rea Vaya and Metrobus.
        </Text>
      </Animated.View>

      {/* ── Feature pills ── */}
      <Animated.View style={[styles.pillsRow, enter(pillsAnim)]}>
        {[
          { icon: '🚆', label: 'Train'   },
          { icon: '🚌', label: 'Bus'     },
          { icon: '🚶', label: 'Walk'    },
          { icon: '💳', label: 'Pay'     },
        ].map(p => (
          <View key={p.label} style={styles.pill}>
            <Text style={styles.pillIcon}>{p.icon}</Text>
            <Text style={styles.pillLabel}>{p.label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* ── CTA ── */}
      <Animated.View style={[styles.ctaBlock, { paddingBottom: insets.bottom + 24 }, enter(ctaAnim)]}>
        <TouchableOpacity style={styles.ctaBtn} onPress={handleGetStarted} activeOpacity={0.88}>
          <Text style={styles.ctaBtnText}>
            {isSignedIn ? 'Open App' : 'Get Started'}
          </Text>
          <Text style={styles.ctaArrow}>→</Text>
        </TouchableOpacity>

        {!isSignedIn && (
          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => router.replace('/(auth)/sign-in')}
            activeOpacity={0.7}
          >
            <Text style={styles.signInText}>
              Already have an account?{' '}
              <Text style={styles.signInBold}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Decorative navy M shapes in bottom-right (echoes the logo) ── */}
      <View style={styles.decor} pointerEvents="none">
        <View style={[styles.decorCircle, { width: 240, height: 240, right: -80, bottom: -80, opacity: 0.04 }]} />
        <View style={[styles.decorCircle, { width: 140, height: 140, right: 40,  bottom: 100, opacity: 0.06 }]} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Splash
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: WHITE,
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          999,
  },
  splashLogo: {
    width:        200,
    height:       70,
    marginBottom: 52,
  },
  progressTrack: {
    width:           100,
    height:          2,
    backgroundColor: '#E2E5F5',
    borderRadius:    1,
    overflow:        'hidden',
  },
  progressFill: {
    height:          2,
    backgroundColor: NAVY,
    borderRadius:    1,
  },

  // Main screen — white background, navy content
  screen: {
    flex:            1,
    backgroundColor: WHITE,
    justifyContent:  'space-between',
  },

  // Brand block
  brand: {
    paddingHorizontal: 28,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
  },
  appIcon: {
    width:        44,
    height:       44,
    borderRadius: 10,
  },
  wordmark: {
    width:  130,
    height: 36,
  },

  // Hero
  hero: {
    flex:              1,
    justifyContent:    'center',
    paddingHorizontal: 28,
  },
  headline: {
    fontSize:      40,
    fontWeight:    '800',
    color:         NAVY2,
    lineHeight:    48,
    letterSpacing: -0.8,
    marginBottom:  16,
  },
  subline: {
    fontSize:   16,
    lineHeight: 26,
    color:      MUTED,
  },

  // Pills
  pillsRow: {
    flexDirection:     'row',
    paddingHorizontal: 28,
    gap:               10,
    marginBottom:      32,
    flexWrap:          'wrap',
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingVertical:   8,
    paddingHorizontal: 14,
    backgroundColor:   TINTED,
    borderRadius:      100,
    borderWidth:       1,
    borderColor:       '#D6DAF5',
  },
  pillIcon:  { fontSize: 14 },
  pillLabel: { fontSize: 13, fontWeight: '600', color: NAVY },

  // CTA
  ctaBlock: {
    paddingHorizontal: 28,
  },
  ctaBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    backgroundColor: NAVY,
    paddingVertical: 17,
    borderRadius:    14,
    shadowColor:     NAVY,
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.25,
    shadowRadius:    16,
    elevation:       10,
  },
  ctaBtnText: {
    fontSize:   17,
    fontWeight: '700',
    color:      WHITE,
  },
  ctaArrow: {
    fontSize:   18,
    fontWeight: '700',
    color:      WHITE,
  },
  signInLink: {
    marginTop:  18,
    alignItems: 'center',
  },
  signInText: {
    fontSize: 14,
    color:    MUTED,
  },
  signInBold: {
    fontWeight: '700',
    color:      NAVY,
  },

  // Decorative elements
  decor: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  decorCircle: {
    position:        'absolute',
    borderRadius:    999,
    backgroundColor: NAVY,
  },
});