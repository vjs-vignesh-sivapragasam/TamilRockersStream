import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Animated,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Mail,
  Copy,
  Check,
  Code2,
  Cpu,
  Sparkles,
  ShieldCheck,
  Heart,
  Share2,
  ExternalLink,
  Laptop,
  Flame,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';

interface AboutUsScreenProps {
  onBack?: () => void;
  onClose?: () => void;
  onNavigateToDonate?: () => void;
  onOpenDonate?: () => void;
}

const DEVELOPER_PHOTO = require('../../assets/vignesh.jpg');
const DEVELOPER_NAME = 'Vignesh S';
const DEVELOPER_ROLE = 'Software Engineer';
const DEVELOPER_EMAIL = 'vigneshmake28@gmail.com';
const APP_VERSION = 'v2.4.0 (Build 57.0)';

export const AboutUsScreen: React.FC<AboutUsScreenProps> = ({
  onBack,
  onClose,
  onNavigateToDonate,
  onOpenDonate,
}) => {
  const insets = useSafeAreaInsets();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const handleBack = onClose || onBack || (() => {});
  const handleDonate = onOpenDonate || onNavigateToDonate;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Subtle pulsing ring on developer avatar
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, [fadeAnim, slideAnim, pulseAnim]);

  const handleSendEmail = async () => {
    try {
      await Linking.openURL(`mailto:${DEVELOPER_EMAIL}?subject=VFlix Feedback & Queries`);
    } catch {
      handleCopyEmail();
    }
  };

  const handleCopyEmail = () => {
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        title: 'VFlix',
        message:
          'Experience VFlix - high-speed torrent movie streaming and offline player crafted by Vignesh S!',
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <ArrowLeft color="#FFFFFF" size={22} />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>About Developer</Text>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShareApp}
          activeOpacity={0.7}
        >
          <Share2 color="#FFFFFF" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Hero Developer Profile Card */}
          <LinearGradient
            colors={['#2A080A', '#1E1215', '#141414']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Glowing Avatar Container */}
            <View style={styles.avatarWrapper}>
              <Animated.View
                style={[
                  styles.avatarGlowRing,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <View style={styles.avatarBorder}>
                <Image source={DEVELOPER_PHOTO} style={styles.avatarImage} resizeMode="cover" />
              </View>
              <View style={styles.onlineBadge}>
                <Sparkles color="#FFFFFF" size={10} />
              </View>
            </View>

            {/* Developer Details */}
            <Text style={styles.devName}>{DEVELOPER_NAME}</Text>
            <View style={styles.rolePill}>
              <Laptop color={Colors.netflixRed} size={14} />
              <Text style={styles.roleText}>{DEVELOPER_ROLE}</Text>
            </View>

            <Text style={styles.devBio}>
              Architect & Full-Stack Mobile Engineer. Creator of VFlix,
              passionate about high-performance media architectures, decentralized P2P systems, and buttery-smooth native user interfaces.
            </Text>

            {/* Contact Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.primaryContactBtn}
                onPress={handleSendEmail}
                activeOpacity={0.85}
              >
                <Mail color="#FFFFFF" size={16} />
                <Text style={styles.primaryContactText}>Email Me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryContactBtn}
                onPress={handleCopyEmail}
                activeOpacity={0.85}
              >
                {copiedEmail ? (
                  <>
                    <Check color="#46D369" size={16} />
                    <Text style={[styles.secondaryContactText, { color: '#46D369' }]}>
                      Copied!
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy color="#CCCCCC" size={16} />
                    <Text style={styles.secondaryContactText}>Copy Email</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Email Address Display */}
            <Text style={styles.emailDisplay}>{DEVELOPER_EMAIL}</Text>
          </LinearGradient>

          {/* App Version & Specs Showcase */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Flame color={Colors.netflixRed} size={18} />
              <Text style={styles.sectionTitle}>Application Information</Text>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>App Name</Text>
                <Text style={styles.infoValue}>VFlix</Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>App Version</Text>
                <View style={styles.versionPill}>
                  <Text style={styles.versionPillText}>{APP_VERSION}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Framework</Text>
                <Text style={styles.infoValue}>React Native 0.86 • Expo 57</Text>
              </View>

              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>P2P Engine</Text>
                <Text style={styles.infoValue}>WebTorrent Swarm Engine</Text>
              </View>
            </View>
          </View>

          {/* Key Features & Architecture Card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Code2 color="#46D369" size={18} />
              <Text style={styles.sectionTitle}>Built-In Capabilities</Text>
            </View>

            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <ShieldCheck color="#46D369" size={18} />
                </View>
                <View style={styles.featureTextBox}>
                  <Text style={styles.featureTitle}>Vulnerable Ad & Popup Shield</Text>
                  <Text style={styles.featureDesc}>
                    Real-time network filter prevents malicious redirects and popups automatically.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Cpu color="#FFB800" size={18} />
                </View>
                <View style={styles.featureTextBox}>
                  <Text style={styles.featureTitle}>Hardware Video Player & MX Gestures</Text>
                  <Text style={styles.featureDesc}>
                    Full-screen landscape rotation, brightness swipe, sound swipe, and scrubbing.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconBox}>
                  <Sparkles color="#E50914" size={18} />
                </View>
                <View style={styles.featureTextBox}>
                  <Text style={styles.featureTitle}>Direct Device Storage Access</Text>
                  <Text style={styles.featureDesc}>
                    Downloaded movies automatically save into internal storage directory.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Support / Donate Banner */}
          {handleDonate && (
            <TouchableOpacity
              style={styles.donateBanner}
              onPress={handleDonate}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#E50914', '#B20710']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.donateBannerGradient}
              >
                <View style={styles.donateBannerContent}>
                  <Heart color="#FFFFFF" size={24} fill="#FFFFFF" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.donateBannerTitle}>Support Vignesh's Work</Text>
                    <Text style={styles.donateBannerSubtitle}>
                      Help maintain server trackers and unlock more free features!
                    </Text>
                  </View>
                  <ExternalLink color="#FFFFFF" size={18} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Footer Copyright */}
          <Text style={styles.footerNote}>
            Crafted with ❤️ by Vignesh S • VFlix {APP_VERSION}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#262626',
    backgroundColor: '#121212',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGlowRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(229, 9, 20, 0.25)',
  },
  avatarBorder: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 3,
    borderColor: Colors.netflixRed,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 6,
    backgroundColor: '#46D369',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#121212',
  },
  devName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  roleText: {
    color: Colors.netflixRed,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  devBio: {
    color: '#BBBBBB',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 10,
  },
  primaryContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.netflixRed,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: Colors.netflixRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryContactText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#383838',
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryContactText: {
    color: '#EEEEEE',
    fontSize: 13,
    fontWeight: '700',
  },
  emailDisplay: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  infoGrid: {
    gap: 10,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#262626',
  },
  infoLabel: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  versionPill: {
    backgroundColor: 'rgba(70, 211, 105, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  versionPillText: {
    color: '#46D369',
    fontSize: 11,
    fontWeight: '700',
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  featureTextBox: {
    flex: 1,
    gap: 3,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  featureDesc: {
    color: '#8E8E93',
    fontSize: 11,
    lineHeight: 16,
  },
  donateBanner: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.netflixRed,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  donateBannerGradient: {
    padding: 18,
  },
  donateBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  donateBannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  donateBannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    lineHeight: 15,
  },
  footerNote: {
    color: '#666666',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
});
