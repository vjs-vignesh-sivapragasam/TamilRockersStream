import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Text,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Animation values
  const ribbonLeftHeight = useRef(new Animated.Value(0)).current;
  const ribbonRightHeight = useRef(new Animated.Value(0)).current;
  const ribbonCenterGlow = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkTracking = useRef(new Animated.Value(20)).current;
  const shimmerTranslate = useRef(new Animated.Value(-120)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const spectrumOpacity = useRef(new Animated.Value(0)).current;
  const spectrumScale = useRef(new Animated.Value(0.8)).current;
  const ambientPulse = useRef(new Animated.Value(0.3)).current;
  const containerFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Ambient Background Pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(ambientPulse, { toValue: 0.7, duration: 1100, useNativeDriver: true }),
        Animated.timing(ambientPulse, { toValue: 0.3, duration: 1100, useNativeDriver: true }),
      ])
    ).start();

    // 2. Orchestrated Netflix "Ta-Dum" Cinematic Sequence
    Animated.sequence([
      // Stage 1: Left & Right Ribbons descend and converge into the iconic 'V'
      Animated.parallel([
        Animated.timing(ribbonLeftHeight, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(120),
          Animated.timing(ribbonRightHeight, {
            toValue: 1,
            duration: 480,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),

      // Stage 2: Central intersection flares with light and wordmark emerges
      Animated.parallel([
        Animated.timing(ribbonCenterGlow, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(wordmarkTracking, {
          toValue: 8,
          duration: 500,
          useNativeDriver: true,
        }),
        // Light shimmer sweep across the face of the logo
        Animated.timing(shimmerTranslate, {
          toValue: 140,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),

      // Stage 3: Dramatic pause before the "Ta-Dum" impact
      Animated.delay(450),

      // Stage 4: "TA-DUM" ZOOM IMPACT — Flying through the ribbons into the spectrum!
      Animated.parallel([
        // Massive exponential zoom towards camera lens
        Animated.timing(logoScale, {
          toValue: 14,
          duration: 750,
          useNativeDriver: true,
        }),
        // Center reveals the explosion of colored Netflix spectrum ribbons
        Animated.sequence([
          Animated.delay(100),
          Animated.parallel([
            Animated.timing(spectrumOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(spectrumScale, {
              toValue: 4.5,
              duration: 650,
              useNativeDriver: true,
            }),
          ]),
        ]),
        // Smooth container fade-out right into the home screen
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(containerFade, {
            toValue: 0,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start(() => {
      onFinish();
    });
  }, [
    ambientPulse,
    containerFade,
    logoScale,
    onFinish,
    ribbonCenterGlow,
    ribbonLeftHeight,
    ribbonRightHeight,
    shimmerTranslate,
    spectrumOpacity,
    spectrumScale,
    wordmarkOpacity,
    wordmarkTracking,
  ]);

  // Spectrum ribbon colors matching the iconic Netflix explosion
  const SPECTRUM_COLORS = [
    '#E50914',
    '#B81D24',
    '#9B26AF',
    '#5C258D',
    '#2196F3',
    '#00BCD4',
    '#4CAF50',
    '#FFC107',
    '#FF5722',
    '#E50914',
  ];

  return (
    <Animated.View style={[styles.container, { opacity: containerFade }]}>
      {/* ── Background Cinematic Radial Glow ── */}
      <Animated.View
        style={[
          styles.ambientGlowWrap,
          {
            opacity: ambientPulse,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(229, 9, 20, 0.45)', 'rgba(150, 10, 20, 0.18)', 'transparent']}
          style={styles.ambientGlow}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* ── The Netflix Spectrum Exploding Ribbons (Revealed on Zoom) ── */}
      <Animated.View
        style={[
          styles.spectrumContainer,
          {
            opacity: spectrumOpacity,
            transform: [{ scale: spectrumScale }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.spectrumRibbonsRow}>
          {SPECTRUM_COLORS.map((col, idx) => (
            <LinearGradient
              key={`spec-${idx}`}
              colors={['transparent', col, col, 'transparent']}
              style={[styles.spectrumStripe, { backgroundColor: col }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          ))}
        </View>
      </Animated.View>

      {/* ── Main Iconic Logo Structure ── */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        {/* Ribbon 'V' Logo Mark */}
        <View style={styles.ribbonMarkBox}>
          {/* Left Ribbon Arm (Descends from top-left) */}
          <Animated.View
            style={[
              styles.ribbonArm,
              styles.ribbonLeftArm,
              {
                opacity: ribbonLeftHeight,
                transform: [
                  { rotate: '22deg' },
                  {
                    scaleY: ribbonLeftHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.05, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#831010', '#B20710', '#E50914']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.3, y: 1 }}
            />
            {/* Edge Shadow Gradient for 3D depth */}
            <LinearGradient
              colors={['rgba(0,0,0,0.55)', 'transparent']}
              style={[StyleSheet.absoluteFill, { width: 6 }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>

          {/* Right Ribbon Arm (Descends from top-right) */}
          <Animated.View
            style={[
              styles.ribbonArm,
              styles.ribbonRightArm,
              {
                opacity: ribbonRightHeight,
                transform: [
                  { rotate: '-22deg' },
                  {
                    scaleY: ribbonRightHeight.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.05, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['#FF1E27', '#E50914', '#B20710']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.3, y: 1 }}
            />
            {/* Highlight gleam on right ribbon edge */}
            <LinearGradient
              colors={['rgba(255,255,255,0.4)', 'transparent']}
              style={[StyleSheet.absoluteFill, { width: 4 }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>

          {/* Central Intersection Flare Glow */}
          <Animated.View
            style={[
              styles.vertexGlow,
              {
                opacity: ribbonCenterGlow,
                transform: [{ scale: ribbonCenterGlow }],
              },
            ]}
          >
            <LinearGradient
              colors={['#FFFFFF', '#FF375F', '#E50914', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0.5 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>

          {/* Shimmer Light Reflection Sweep across Logo */}
          <Animated.View
            style={[
              styles.shimmerBeam,
              {
                transform: [
                  { translateX: shimmerTranslate },
                  { rotate: '35deg' },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255, 255, 255, 0.65)', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </View>

        {/* ── Cinematic Netflix-Style Wordmark: VFLEX ── */}
        <Animated.View
          style={[
            styles.wordmarkContainer,
            {
              opacity: wordmarkOpacity,
            },
          ]}
        >
          <View style={styles.wordmarkRow}>
            <Text style={styles.brandV}>V</Text>
            <Animated.Text
              style={[
                styles.brandFlex,
                {
                  letterSpacing: wordmarkTracking,
                },
              ]}
            >
              FLEX
            </Animated.Text>
          </View>

          <Text style={styles.cinemaSubtext}>ORIGINAL CINEMA</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  ambientGlowWrap: {
    position: 'absolute',
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlow: {
    width: '100%',
    height: '100%',
    borderRadius: 160,
  },
  // Multi-colored spectrum burst (Netflix ribbon explosion on zoom)
  spectrumContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spectrumRibbonsRow: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    justifyContent: 'space-around',
  },
  spectrumStripe: {
    width: 14,
    height: '100%',
    opacity: 0.85,
  },
  // Main Logo
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbonMarkBox: {
    width: 120,
    height: 140,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ribbonArm: {
    position: 'absolute',
    width: 32,
    height: 150,
    borderRadius: 4,
    top: -5,
    overflow: 'hidden',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 18,
    elevation: 12,
  },
  ribbonLeftArm: {
    left: 14,
  },
  ribbonRightArm: {
    right: 14,
    zIndex: 2,
  },
  vertexGlow: {
    position: 'absolute',
    bottom: -6,
    width: 44,
    height: 44,
    borderRadius: 22,
    zIndex: 3,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 16,
  },
  shimmerBeam: {
    position: 'absolute',
    top: -30,
    bottom: -30,
    width: 38,
    zIndex: 5,
  },
  // Wordmark
  wordmarkContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandV: {
    color: '#E50914',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(229, 9, 20, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 14,
  },
  brandFlex: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 8,
    marginLeft: 2,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  cinemaSubtext: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
});
