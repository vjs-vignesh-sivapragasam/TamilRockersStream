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

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // Animation Refs (Driven by Native Driver for 60fps cinematic fluidity)
  const logoScale = useRef(new Animated.Value(0.55)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.2)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const beamWidth = useRef(new Animated.Value(0)).current;

  const subtextOpacity = useRef(new Animated.Value(0)).current;
  const subtextTranslateY = useRef(new Animated.Value(12)).current;

  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Cinematic Netflix "Ta-Dum" Animation Sequence
    Animated.sequence([
      // Phase 1: Rapid Netflix logo spring entrance & ambient red glow expansion
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(glowScale, {
          toValue: 1,
          friction: 5,
          tension: 35,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2: Red accent line expansion & subtext reveal
      Animated.parallel([
        Animated.timing(beamWidth, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(subtextOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(subtextTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),

      // Phase 3: Hold for high-impact brand visibility
      Animated.delay(750),

      // Phase 4: Iconic Netflix cinematic zoom-through exit
      // Text zooms dramatically towards camera into the screen while dissolving into app
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 450,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 4.8,
          duration: 450,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onFinish();
    });
  }, [
    beamWidth,
    containerOpacity,
    glowOpacity,
    glowScale,
    logoOpacity,
    logoScale,
    onFinish,
    subtextOpacity,
    subtextTranslateY,
  ]);

  const beamScaleX = beamWidth.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const interpolatedGlowScale = glowScale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1.8],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <StatusBar hidden={false} barStyle="light-content" backgroundColor="#000000" translucent />

      {/* Pitch Dark Background */}
      <View style={styles.darkBackground} />

      {/* Ambient Netflix Red Glow */}
      <Animated.View
        style={[
          styles.glowCircle,
          {
            opacity: glowOpacity,
            transform: [{ scale: interpolatedGlowScale }],
          },
        ]}
      />

      {/* Vertical Light Ribbon Beam Accent */}
      <Animated.View
        style={[
          styles.ribbonBeam,
          {
            opacity: glowOpacity,
            transform: [{ scaleY: interpolatedGlowScale }],
          },
        ]}
      />

      {/* Central Brand Content Box */}
      <View style={styles.centerBox}>
        {/* Netflix Red Animated Brand Logo Text */}
        <Animated.View
          style={[
            styles.brandTitleContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Text style={styles.netflixRedText}>VFLIX</Text>
        </Animated.View>

        {/* Expanding Red Accent Line */}
        <Animated.View
          style={[
            styles.redAccentBeam,
            {
              opacity: logoOpacity,
              transform: [{ scaleX: beamScaleX }],
            },
          ]}
        />

        {/* Subtext Reveal */}
        <Animated.View
          style={{
            opacity: subtextOpacity,
            transform: [{ translateY: subtextTranslateY }],
            marginTop: 14,
          }}
        >
          <Text style={styles.subtext}>UNLIMITED MOVIES & TV SHOWS</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  darkBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  glowCircle: {
    position: 'absolute',
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: (width * 0.75) / 2,
    backgroundColor: 'rgba(229, 9, 20, 0.32)',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 70,
    elevation: 25,
  },
  ribbonBeam: {
    position: 'absolute',
    width: 120,
    height: height * 0.8,
    backgroundColor: 'rgba(229, 9, 20, 0.08)',
    borderRadius: 60,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  brandTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  netflixRedText: {
    color: '#E50914',
    fontSize: 62,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(229, 9, 20, 0.9)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 28,
  },
  redAccentBeam: {
    height: 3,
    width: 140,
    backgroundColor: '#E50914',
    borderRadius: 2,
    marginTop: 8,
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },
  subtext: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4.5,
    textAlign: 'center',
  },
});
