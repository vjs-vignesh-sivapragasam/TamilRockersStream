import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Text,
  Easing,
} from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  // Animation Refs (100% native driver compatible)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const translateYAnim = useRef(new Animated.Value(14)).current;

  const subtextFadeAnim = useRef(new Animated.Value(0)).current;
  const subtextTranslateYAnim = useRef(new Animated.Value(8)).current;

  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Neat & Simple Animation Sequence
    Animated.sequence([
      // 1. Smooth, elegant fade-in & scale of main VFlix text
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // 2. Subtext gentle fade in
      Animated.parallel([
        Animated.timing(subtextFadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(subtextTranslateYAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // 3. Short hold for pleasant readability
      Animated.delay(650),

      // 4. Smooth fade out into main app
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onFinish();
    });
  }, [
    containerOpacity,
    fadeAnim,
    onFinish,
    scaleAnim,
    subtextFadeAnim,
    subtextTranslateYAnim,
    translateYAnim,
  ]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Center Minimal Content */}
      <View style={styles.centerBox}>
        {/* Main Brand Text: VFlix */}
        <Animated.View
          style={[
            styles.brandTitleRow,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: translateYAnim },
              ],
            },
          ]}
        >
          <Text style={styles.brandTitleViki}>V</Text>
          <Text style={styles.brandTitleFlex}>FLIX</Text>
        </Animated.View>

        {/* Minimal Subtext */}
        <Animated.View
          style={{
            opacity: subtextFadeAnim,
            transform: [{ translateY: subtextTranslateYAnim }],
          }}
        >
          <Text style={styles.subtext}>CINEMA STREAMING</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0A0A0C',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitleViki: {
    color: '#E50914',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 1,
    textShadowColor: 'rgba(229, 9, 20, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  brandTitleFlex: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subtext: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 5,
    marginTop: 10,
    textAlign: 'center',
  },
});
