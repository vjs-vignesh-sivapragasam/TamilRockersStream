import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Text,
} from 'react-native';
import { Colors } from '../constants/theme';

interface SplashScreenProps {
  onFinish: () => void;
}

const { width } = Dimensions.get('window');

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const scaleAnim = useRef(new Animated.Value(0.35)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const containerFadeAnim = useRef(new Animated.Value(1)).current;
  const glowPulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Glow pulse loop in background
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    Animated.sequence([
      // Stage 1: Logo appears with spring bounce
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      // Stage 2: Tagline fades in
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      // Stage 3: Pause
      Animated.delay(700),
      // Stage 4: Zoom and fade out
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 3.2,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(containerFadeAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onFinish();
    });
  }, [containerFadeAnim, glowPulse, onFinish, opacityAnim, scaleAnim, taglineOpacity]);

  return (
    <Animated.View style={[styles.container, { opacity: containerFadeAnim }]}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo Mark — V in a rounded square */}
        <View style={styles.logoMarkWrapper}>
          <View style={styles.logoSquare}>
            <Text style={styles.logoV}>V</Text>
          </View>
          <Animated.View style={[styles.glowBar, { opacity: glowPulse }]} />
        </View>

        {/* Brand name */}
        <Text style={styles.brandName}>
          <Text style={styles.brandV}>V</Text>
          <Text style={styles.brandFlex}>Flix</Text>
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineWrapper, { opacity: taglineOpacity }]}>
        <Text style={styles.tagline}>Stream • Download • Watch</Text>
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
    zIndex: 999,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logoMarkWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSquare: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoV: {
    fontSize: 88,
    fontWeight: '900',
    color: Colors.netflixRed,
    lineHeight: 90,
    letterSpacing: -3,
    shadowColor: Colors.netflixRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 20,
    elevation: 10,
  },
  glowBar: {
    marginTop: 10,
    width: 80,
    height: 4,
    borderRadius: 4,
    backgroundColor: Colors.netflixRed,
    shadowColor: Colors.netflixRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
  },
  brandName: {
    fontSize: 42,
    letterSpacing: -1,
    marginTop: 4,
  },
  brandV: {
    color: Colors.netflixRed,
    fontWeight: '900',
    fontSize: 44,
  },
  brandFlex: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 38,
  },
  taglineWrapper: {
    position: 'absolute',
    bottom: '20%',
  },
  tagline: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
});
