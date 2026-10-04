import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Text,
  Easing,
  StatusBar,
} from 'react-native';
import { Colors } from '../constants/theme';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // Animation Refs
  const scaleAnim = useRef(new Animated.Value(0.35)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const subtextFadeAnim = useRef(new Animated.Value(0)).current;
  const subtextScaleAnim = useRef(new Animated.Value(0.9)).current;

  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Netflix style "Ta-Dum" Cinematic Animation Sequence
    Animated.sequence([
      // Step 1: Rapid Netflix-style text pop & zoom in + glow expansion
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // Step 2: Subtext elegant fade and subtle scale up
      Animated.parallel([
        Animated.timing(subtextFadeAnim, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(subtextScaleAnim, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // Step 3: Hold briefly for high-impact brand visibility
      Animated.delay(800),

      // Step 4: Netflix zoom-through cinematic exit (text scales up into screen as background dissolves)
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 450,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.25,
          duration: 450,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onFinish();
    });
  }, [
    containerOpacity,
    fadeAnim,
    glowAnim,
    onFinish,
    scaleAnim,
    subtextFadeAnim,
    subtextScaleAnim,
  ]);

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1.8],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <StatusBar hidden barStyle="light-content" backgroundColor="#000000" />
      
      {/* Background Red Ambient Glow behind logo */}
      <Animated.View
        style={[
          styles.glowCircle,
          {
            opacity: glowAnim,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Main Content */}
      <View style={styles.centerBox}>
        {/* Animated Brand Title: VFLIX */}
        <Animated.View
          style={[
            styles.brandTitleRow,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.netflixRedText}>VFLIX</Text>
        </Animated.View>

        {/* Minimal Subtext */}
        <Animated.View
          style={{
            opacity: subtextFadeAnim,
            transform: [{ scale: subtextScaleAnim }],
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
  glowCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(229, 9, 20, 0.28)',
    shadowColor: Colors.netflixRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 60,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  netflixRedText: {
    color: '#E50914',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(229, 9, 20, 0.75)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 20,
  },
  subtext: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
  },
});
