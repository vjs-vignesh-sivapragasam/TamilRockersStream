/**
 * SplashScreen — Premium Netflix-style Cinematic Intro
 * Features:
 * - Pitch dark cinematic background with deep vignette and ambient red glow
 * - Iconic "VFLIX" red brand typography with neon backlight aura
 * - Multi-stage fluid 60fps native animations:
 *   1. Spring impact entrance & radial red aura expansion
 *   2. Glowing red neon horizon beam expansion
 *   3. Subtitle letter-spaced fade-in ("STREAM UNLIMITED")
 *   4. Luminous light streak sweep across the logo
 *   5. Epic cinematic camera fly-through zoom dissolve exit
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Text,
  Easing,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // Animation Values (Hardware accelerated via Native Driver)
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Ambient Halo / Red Glow
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.3)).current;

  // Light beam and accent line
  const beamScaleX = useRef(new Animated.Value(0)).current;
  const sweepTranslate = useRef(new Animated.Value(-120)).current;
  const sweepOpacity = useRef(new Animated.Value(0)).current;

  // Subtitle / Tagline
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    // ── Phase 1: Rapid Netflix-Style Spring Impact & Ambient Aura ──
    const entranceAnimation = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(glowScale, {
        toValue: 1,
        friction: 5,
        tension: 30,
        useNativeDriver: true,
      }),
    ]);

    // ── Phase 2: Neon Underline Expansion & Shimmer Sweep ──
    const revealAnimation = Animated.parallel([
      Animated.timing(beamScaleX, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(sweepOpacity, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(sweepTranslate, {
          toValue: 140,
          duration: 550,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sweepOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(taglineTranslateY, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]);

    // ── Phase 3: High-impact Brand Visibility Hold ──
    const holdDelay = Animated.delay(850);

    // ── Phase 4: Epic Cinematic Camera Fly-Through Zoom Dissolve ──
    const exitAnimation = Animated.parallel([
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 480,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 5.2,
        duration: 480,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]);

    // Execute sequence
    Animated.sequence([
      entranceAnimation,
      revealAnimation,
      holdDelay,
      exitAnimation,
    ]).start(() => {
      onFinish();
    });
  }, [
    beamScaleX,
    containerOpacity,
    glowOpacity,
    glowScale,
    logoOpacity,
    logoScale,
    onFinish,
    sweepOpacity,
    sweepTranslate,
    taglineOpacity,
    taglineTranslateY,
  ]);

  const interpolatedGlow = glowScale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1.6],
  });

  return (
    <Animated.View style={[styles.root, { opacity: containerOpacity }]}>
      <StatusBar hidden={false} barStyle="light-content" backgroundColor="#000000" translucent />

      {/* Dark Ambient Vignette Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['#040407', '#000000', '#070204', '#000000']}
          locations={[0, 0.4, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Ambient Pulsing Red Glow Behind Logo */}
      <Animated.View
        style={[
          styles.glowBackdrop,
          {
            opacity: glowOpacity,
            transform: [{ scale: interpolatedGlow }],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(229, 9, 20, 0.55)', 'rgba(168, 8, 16, 0.25)', 'transparent']}
          style={styles.glowGradient}
        />
      </Animated.View>

      {/* Vertical Red Light Column Beam */}
      <Animated.View
        style={[
          styles.verticalLightBeam,
          {
            opacity: glowOpacity,
            transform: [{ scaleY: interpolatedGlow }],
          },
        ]}
      />

      {/* Center Cinematic Logo Container */}
      <View style={styles.centerStage}>
        {/* Animated Brand Logo */}
        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Animated.Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          {/* Glowing Light Sweep Across Logo */}
          <Animated.View
            style={[
              styles.lightSweepBar,
              {
                opacity: sweepOpacity,
                transform: [{ translateX: sweepTranslate }, { rotate: '25deg' }],
              },
            ]}
          />
        </Animated.View>

        {/* Expanding Red Horizon Laser Line */}
        <Animated.View
          style={[
            styles.neonHorizonLine,
            {
              opacity: logoOpacity,
              transform: [{ scaleX: beamScaleX }],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', '#FF1E28', '#E50914', '#FF1E28', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Tagline: STREAM UNLIMITED */}
        <Animated.View
          style={[
            styles.taglineWrap,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslateY }],
            },
          ]}
        >
          <Text style={styles.taglineText}>STREAM UNLIMITED</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

/* ─────────────────────────── Styles ─────────────────────────── */
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  glowBackdrop: {
    position: 'absolute',
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: (width * 0.85) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: (width * 0.85) / 2,
  },
  verticalLightBeam: {
    position: 'absolute',
    width: 90,
    height: height * 0.85,
    backgroundColor: 'rgba(229, 9, 20, 0.07)',
    borderRadius: 45,
  },
  centerStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  logoImage: {
    width: 130,
    height: 174,
  },
  vflixText: {
    color: '#E50914',
    fontSize: 66,
    fontWeight: '900',
    letterSpacing: 7,
    textAlign: 'center',
    // Multi-layer glowing text shadow for neon cinematic effect
    textShadowColor: 'rgba(229, 9, 20, 0.95)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 32,
    includeFontPadding: false,
  },
  lightSweepBar: {
    position: 'absolute',
    width: 38,
    height: '140%',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 19,
  },
  neonHorizonLine: {
    width: 160,
    height: 3,
    borderRadius: 2,
    marginTop: 6,
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 12,
  },
  taglineWrap: {
    marginTop: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taglineText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 5.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});

export default SplashScreen;
