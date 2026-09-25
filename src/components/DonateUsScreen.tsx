import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Animated,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Heart,
  Coffee,
  Check,
  Copy,
  Sparkles,
  QrCode,
  ShieldCheck,
  Zap,
  Server,
  ExternalLink,
  Gift,
  Share2,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';

interface DonateUsScreenProps {
  onBack?: () => void;
  onClose?: () => void;
}

const UPI_ID = 'vigneshmake28@okhdfcbank';
const DEVELOPER_EMAIL = 'vigneshmake28@gmail.com';
const DEVELOPER_NAME = 'Vignesh S';

interface TierOption {
  id: string;
  emoji: string;
  name: string;
  amountINR: string;
  amountUSD: string;
  tagline: string;
}

const DONATION_TIERS: TierOption[] = [
  {
    id: 'coffee',
    emoji: '☕',
    name: 'Buy a Coffee',
    amountINR: '₹150',
    amountUSD: '$2',
    tagline: 'Instant boost to code late night updates',
  },
  {
    id: 'fuel',
    emoji: '🍕',
    name: 'Coding Fuel',
    amountINR: '₹400',
    amountUSD: '$5',
    tagline: 'Fueling fast feature improvements',
  },
  {
    id: 'server',
    emoji: '🚀',
    name: 'Tracker Sponsor',
    amountINR: '₹1,200',
    amountUSD: '$15',
    tagline: 'Keeps high-speed WebTorrent swarms online',
  },
  {
    id: 'patron',
    emoji: '👑',
    name: 'Gold Supporter',
    amountINR: '₹4,000',
    amountUSD: '$50',
    tagline: 'Hall of Fame backer of VFlix',
  },
];

export const DonateUsScreen: React.FC<DonateUsScreenProps> = ({ onBack, onClose }) => {
  const insets = useSafeAreaInsets();
  const handleBack = onClose || onBack || (() => {});
  const [selectedTier, setSelectedTier] = useState<string>('fuel');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const heartScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Heart beat animation
    const heartBeat = Animated.loop(
      Animated.sequence([
        Animated.timing(heartScaleAnim, {
          toValue: 1.15,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(heartScaleAnim, {
          toValue: 1.0,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    heartBeat.start();

    return () => heartBeat.stop();
  }, [fadeAnim, slideAnim, heartScaleAnim]);

  const handleCopyUpi = () => {
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handlePayViaUpiApp = async (tier: TierOption) => {
    const rawAmount = tier.amountINR.replace(/[^0-9]/g, '');
    const upiUrl = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(
      DEVELOPER_NAME
    )}&am=${rawAmount}&cu=INR&tn=${encodeURIComponent(
      `Support VFlix (${tier.name})`
    )}`;

    try {
      const supported = await Linking.canOpenURL(upiUrl).catch(() => false);
      if (supported) {
        await Linking.openURL(upiUrl);
        return;
      }
    } catch {}

    // Fallback: Copy UPI ID
    handleCopyUpi();
    Alert.alert(
      'UPI ID Copied',
      `UPI ID ${UPI_ID} has been copied to your clipboard. Open Google Pay, PhonePe, or Paytm and transfer ${tier.amountINR}. Thank you!`,
      [{ text: 'OK' }]
    );
  };

  const handleContactDev = async () => {
    try {
      await Linking.openURL(
        `mailto:${DEVELOPER_EMAIL}?subject=Donation & Sponsorship - VFlix`
      );
    } catch {
      handleCopyUpi();
    }
  };

  const activeTierObj = DONATION_TIERS.find((t) => t.id === selectedTier) || DONATION_TIERS[1];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft color="#FFFFFF" size={22} />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Support Developer</Text>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() =>
            Share.share({
              title: 'Support VFlix',
              message:
                'Support developer Vignesh S in building VFlix - 100% free and open high-speed streaming!',
            })
          }
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
          {/* Glowing Hero Banner */}
          <LinearGradient
            colors={['#3B0A0F', '#200D12', '#141414']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <Animated.View
              style={[
                styles.heartCircle,
                { transform: [{ scale: heartScaleAnim }] },
              ]}
            >
              <Heart color="#FFFFFF" size={36} fill={Colors.netflixRed} />
            </Animated.View>

            <Text style={styles.heroTitle}>Keep VFlix Alive</Text>
            <Text style={styles.heroSubtitle}>
              Built with care by <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Vignesh S</Text>.
              Your support powers fast decentralized trackers, ad shields, and new media player features.
            </Text>

            <View style={styles.perksRow}>
              <View style={styles.perkPill}>
                <ShieldCheck color="#46D369" size={13} />
                <Text style={styles.perkText}>100% Ad-Free</Text>
              </View>
              <View style={styles.perkPill}>
                <Zap color="#FFB800" size={13} />
                <Text style={styles.perkText}>High-Speed Swarms</Text>
              </View>
              <View style={styles.perkPill}>
                <Sparkles color={Colors.primary} size={13} />
                <Text style={styles.perkText}>Open & Free</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Tier Selection */}
          <Text style={styles.sectionHeading}>CHOOSE A SUPPORT TIER</Text>
          <View style={styles.tierGrid}>
            {DONATION_TIERS.map((tier) => {
              const isSelected = selectedTier === tier.id;
              return (
                <TouchableOpacity
                  key={tier.id}
                  style={[styles.tierCard, isSelected && styles.tierCardActive]}
                  onPress={() => setSelectedTier(tier.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.tierHeader}>
                    <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                    <View style={styles.tierAmountBadge}>
                      <Text style={[styles.tierAmount, isSelected && { color: Colors.netflixRed }]}>
                        {tier.amountINR}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.tierName}>{tier.name}</Text>
                  <Text style={styles.tierTagline}>{tier.tagline}</Text>

                  {isSelected && (
                    <View style={styles.selectedMarker}>
                      <Check color="#FFFFFF" size={12} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick UPI & Payment Gateway Action */}
          <View style={styles.paymentCard}>
            <View style={styles.paymentCardHeader}>
              <QrCode color={Colors.netflixRed} size={20} />
              <Text style={styles.paymentCardTitle}>Instant UPI Contribution</Text>
            </View>

            <Text style={styles.paymentDesc}>
              Supports Google Pay, PhonePe, Paytm, BHIM & all major Indian bank apps:
            </Text>

            {/* UPI ID Copy Capsule */}
            <TouchableOpacity
              style={styles.upiCapsule}
              onPress={handleCopyUpi}
              activeOpacity={0.8}
            >
              <Text style={styles.upiIdText}>{UPI_ID}</Text>
              <View style={styles.copyBadge}>
                {copiedUpi ? (
                  <>
                    <Check color="#46D369" size={14} />
                    <Text style={[styles.copyBadgeText, { color: '#46D369' }]}>Copied!</Text>
                  </>
                ) : (
                  <>
                    <Copy color="#AAAAAA" size={14} />
                    <Text style={styles.copyBadgeText}>Copy</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {/* 1-Tap Pay Button */}
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => handlePayViaUpiApp(activeTierObj)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={[Colors.primary, '#B51527']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payBtnGradient}
              >
                <Gift color="#FFFFFF" size={18} />
                <Text style={styles.payBtnText}>
                  Send {activeTierObj.amountINR} via UPI / GPay
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* International & Custom Sponsorship Card */}
          <View style={styles.intlCard}>
            <View style={styles.intlHeader}>
              <Server color="#46D369" size={18} />
              <Text style={styles.intlTitle}>International Supporters & Inquiries</Text>
            </View>
            <Text style={styles.intlText}>
              For PayPal, Crypto, or direct engineering partnerships, feel free to email Vignesh S directly.
            </Text>
            <TouchableOpacity
              style={styles.emailBtn}
              onPress={handleContactDev}
              activeOpacity={0.8}
            >
              <Text style={styles.emailBtnText}>{DEVELOPER_EMAIL}</Text>
              <ExternalLink color="#888888" size={14} />
            </TouchableOpacity>
          </View>

          {/* Thank You Note */}
          <Text style={styles.thankYouNote}>
            Every contribution directly funds tracker bandwidth and hardware decoder optimizations. Thank you for being part of this journey!
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#262626',
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroBanner: {
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.3)',
    shadowColor: Colors.netflixRed,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  heartCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(250, 36, 60, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(250, 36, 60, 0.4)',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    color: '#AAAAAA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  perksRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1C1C1C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#303030',
  },
  perkText: {
    color: '#DDDDDD',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeading: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
    marginLeft: 4,
  },
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tierCard: {
    width: '48%',
    backgroundColor: '#1C1C1C',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    position: 'relative',
    gap: 6,
  },
  tierCardActive: {
    borderColor: Colors.netflixRed,
    backgroundColor: 'rgba(250, 36, 60, 0.08)',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tierEmoji: {
    fontSize: 26,
  },
  tierAmountBadge: {
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tierAmount: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tierName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  tierTagline: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 15,
  },
  selectedMarker: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.netflixRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 14,
  },
  paymentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  paymentDesc: {
    color: '#AAAAAA',
    fontSize: 12,
    lineHeight: 17,
  },
  upiCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141414',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  upiIdText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBadgeText: {
    color: '#CCCCCC',
    fontSize: 11,
    fontWeight: '600',
  },
  payBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: Colors.netflixRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  intlCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#282828',
    gap: 8,
  },
  intlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intlTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  intlText: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 17,
  },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#222222',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  emailBtnText: {
    color: '#46D369',
    fontSize: 12,
    fontWeight: '600',
  },
  thankYouNote: {
    color: '#666666',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 16,
    marginTop: 6,
  },
});
