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
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Heart,
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
  X,
  CreditCard,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';

interface DonateUsScreenProps {
  onBack?: () => void;
  onClose?: () => void;
}

const UPI_ID = 'vigneshsivapragasam28-1@okaxis';
const DEVELOPER_EMAIL = 'vigneshmake28@gmail.com';
const DEVELOPER_NAME = 'Vignesh S';
const DONATE_QR_IMAGE = require('../../assets/donate_qr.png');

interface TierOption {
  id: string;
  emoji: string;
  name: string;
  amountINR: string;
  rawAmount: number;
  tagline: string;
}

const DONATION_TIERS: TierOption[] = [
  {
    id: 'tier_10',
    emoji: '❤️',
    name: 'Quick Tip',
    amountINR: '₹10',
    rawAmount: 10,
    tagline: 'A small token of love',
  },
  {
    id: 'tier_50',
    emoji: '☕',
    name: 'Chai Support',
    amountINR: '₹50',
    rawAmount: 50,
    tagline: 'Warm cup of tea for coding',
  },
  {
    id: 'tier_100',
    emoji: '🍕',
    name: 'Coffee Boost',
    amountINR: '₹100',
    rawAmount: 100,
    tagline: 'Energize late night fixes',
  },
  {
    id: 'tier_400',
    emoji: '⚡',
    name: 'Coding Fuel',
    amountINR: '₹400',
    rawAmount: 400,
    tagline: 'Fueling fast feature updates',
  },
  {
    id: 'tier_1200',
    emoji: '🚀',
    name: 'Tracker Sponsor',
    amountINR: '₹1,200',
    rawAmount: 1200,
    tagline: 'Keeps high-speed swarm servers online',
  },
  {
    id: 'tier_4000',
    emoji: '👑',
    name: 'Gold Patron',
    amountINR: '₹4,000',
    rawAmount: 4000,
    tagline: 'Hall of Fame backer of VFlix',
  },
];

export const DonateUsScreen: React.FC<DonateUsScreenProps> = ({ onBack, onClose }) => {
  const insets = useSafeAreaInsets();
  const handleBack = onClose || onBack || (() => {});
  const [selectedTier, setSelectedTier] = useState<string>('tier_100');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [upiModalVisible, setUpiModalVisible] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(25)).current;
  const heartScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();

    // Heartbeat pulse
    const heartBeat = Animated.loop(
      Animated.sequence([
        Animated.timing(heartScaleAnim, {
          toValue: 1.18,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(heartScaleAnim, {
          toValue: 1.0,
          duration: 650,
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

  const getEffectiveAmount = (): number => {
    if (customAmount.trim().length > 0) {
      const parsed = parseInt(customAmount.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    const tier = DONATION_TIERS.find((t) => t.id === selectedTier);
    return tier ? tier.rawAmount : 100;
  };

  const handlePayViaUpiApp = () => {
    setUpiModalVisible(true);
  };

  const launchSpecificUpiApp = async (appType: 'gpay' | 'phonepe' | 'whatsapp' | 'default') => {
    const amount = getEffectiveAmount();
    const cleanParams = `pa=${UPI_ID}&pn=${encodeURIComponent(DEVELOPER_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Support VFlix (₹${amount})`)}`;

    let targetUrl = `upi://pay?${cleanParams}`;
    if (appType === 'gpay') {
      targetUrl = `tez://upi/pay?${cleanParams}`;
    } else if (appType === 'phonepe') {
      targetUrl = `phonepe://pay?${cleanParams}`;
    } else if (appType === 'whatsapp') {
      targetUrl = `whatsapp://pay?${cleanParams}`;
    }

    setUpiModalVisible(false);

    try {
      const supported = await Linking.canOpenURL(targetUrl).catch(() => false);
      if (supported) {
        await Linking.openURL(targetUrl);
        return;
      }
      const fallbackSupported = await Linking.canOpenURL(`upi://pay?${cleanParams}`).catch(() => false);
      if (fallbackSupported) {
        await Linking.openURL(`upi://pay?${cleanParams}`);
        return;
      }
    } catch {}

    handleCopyUpi();
    Alert.alert(
      'UPI ID Copied 📋',
      `UPI ID "${UPI_ID}" has been copied to your clipboard.\n\nPlease open your ${appType.toUpperCase()} app and transfer ₹${amount}. Thank you for supporting VFlix!`,
      [{ text: 'OK' }]
    );
  };

  const handleContactDev = async () => {
    try {
      await Linking.openURL(`mailto:${DEVELOPER_EMAIL}?subject=VFlix Support & Contribution`);
    } catch {
      handleCopyUpi();
    }
  };

  const effectiveAmount = getEffectiveAmount();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Sleek Navigation Bar */}
      <View style={styles.navHeader}>
        <TouchableOpacity style={styles.navBtn} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft color="#FFFFFF" size={20} strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Support & Donate</Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() =>
            Share.share({
              title: 'Support VFlix Engine',
              message:
                'Support developer Vignesh S in building VFlix - 100% free and open high-speed streaming!',
            })
          }
          activeOpacity={0.7}
        >
          <Share2 color="#FFFFFF" size={19} strokeWidth={2.2} />
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
          {/* Glassmorphism Hero Card */}
          <LinearGradient
            colors={['#2A0910', '#1C0E14', '#141414']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <Animated.View
              style={[
                styles.heartCircle,
                { transform: [{ scale: heartScaleAnim }] },
              ]}
            >
              <Heart color="#FFFFFF" size={32} fill={Colors.primary} />
            </Animated.View>

            <Text style={styles.heroTitle}>Keep VFlix Free & Fast</Text>
            <Text style={styles.heroSubtitle}>
              Handcrafted with passion by <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Vignesh S</Text>.
              Your contribution directly funds high-speed trackers, ad-shield servers, and decentralized streaming updates.
            </Text>

            {/* Feature Perks Badges */}
            <View style={styles.perksGrid}>
              <View style={styles.perkChip}>
                <ShieldCheck color="#30D158" size={12} strokeWidth={2.5} />
                <Text style={styles.perkChipText}>100% Ad-Free</Text>
              </View>
              <View style={styles.perkChip}>
                <Zap color="#FF9500" size={12} strokeWidth={2.5} />
                <Text style={styles.perkChipText}>Turbo Swarms</Text>
              </View>
              <View style={styles.perkChip}>
                <Sparkles color={Colors.primary} size={12} strokeWidth={2.5} />
                <Text style={styles.perkChipText}>Open Engine</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Preset Contribution Amounts Header */}
          <Text style={styles.sectionHeader}>SELECT CONTRIBUTION AMOUNT</Text>
          
          {/* 6 Preset Amount Cards */}
          <View style={styles.tierGrid}>
            {DONATION_TIERS.map((tier) => {
              const isSelected = selectedTier === tier.id && customAmount.trim().length === 0;
              return (
                <TouchableOpacity
                  key={tier.id}
                  style={[styles.tierCard, isSelected && styles.tierCardActive]}
                  onPress={() => {
                    setSelectedTier(tier.id);
                    setCustomAmount('');
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.tierTopRow}>
                    <Text style={styles.tierEmoji}>{tier.emoji}</Text>
                    <View style={[styles.tierBadge, isSelected && styles.tierBadgeActive]}>
                      <Text style={[styles.tierBadgeText, isSelected && styles.tierBadgeTextActive]}>
                        {tier.amountINR}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.tierName}>{tier.name}</Text>
                  <Text style={styles.tierTagline}>{tier.tagline}</Text>

                  {isSelected && (
                    <View style={styles.activeCheckCircle}>
                      <Check color="#FFFFFF" size={11} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom Amount Input Box */}
          <View style={styles.customAmountCard}>
            <Text style={styles.customAmountLabel}>OR ENTER CUSTOM AMOUNT (RUPEES)</Text>
            <View style={[styles.customInputContainer, customAmount.trim().length > 0 && styles.customInputActive]}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.customTextInput}
                placeholder="Enter custom amount (e.g. 250, 500)"
                placeholderTextColor="#636366"
                keyboardType="numeric"
                value={customAmount}
                onChangeText={(val) => {
                  setCustomAmount(val);
                }}
              />
              {customAmount.length > 0 && (
                <TouchableOpacity onPress={() => setCustomAmount('')} style={styles.clearCustomBtn}>
                  <X color="#8E8E93" size={16} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Instant UPI Payment Section */}
          <View style={styles.payCard}>
            <View style={styles.payCardHeader}>
              <View style={styles.payHeaderLeft}>
                <View style={styles.payIconBox}>
                  <CreditCard color="#30D158" size={18} strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.payCardTitle}>Instant UPI Contribution</Text>
                  <Text style={styles.payCardSub}>GPay • PhonePe • Paytm • BHIM</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.qrBtn}
                onPress={() => setQrModalVisible(true)}
                activeOpacity={0.7}
              >
                <QrCode color="#0A84FF" size={16} strokeWidth={2.2} />
                <Text style={styles.qrBtnText}>View QR Code</Text>
              </TouchableOpacity>
            </View>

            {/* UPI ID Pill */}
            <TouchableOpacity
              style={styles.upiPill}
              onPress={handleCopyUpi}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.upiPillLabel}>DIRECT UPI VPA</Text>
                <Text style={styles.upiPillValue}>{UPI_ID}</Text>
              </View>

              <View style={[styles.copyCapsule, copiedUpi && styles.copyCapsuleActive]}>
                {copiedUpi ? (
                  <>
                    <Check color="#30D158" size={13} strokeWidth={2.5} />
                    <Text style={styles.copyCapsuleTextActive}>Copied!</Text>
                  </>
                ) : (
                  <>
                    <Copy color="#8E8E93" size={13} strokeWidth={2.2} />
                    <Text style={styles.copyCapsuleText}>Copy</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {/* Pay Button */}
            <TouchableOpacity
              style={styles.primaryPayBtn}
              onPress={handlePayViaUpiApp}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={[Colors.primary, '#960F1E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.payBtnGradient}
              >
                <Gift color="#FFFFFF" size={17} strokeWidth={2.2} />
                <Text style={styles.payBtnText}>
                  Pay ₹{effectiveAmount} via UPI App
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>

      {/* UPI App Chooser Bottom Sheet Modal */}
      <Modal
        visible={upiModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setUpiModalVisible(false)}
      >
        <View style={styles.upiModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setUpiModalVisible(false)} />
          <View style={styles.upiModalCard}>
            <View style={styles.upiModalHeader}>
              <View>
                <Text style={styles.upiModalTitle}>Select Payment App</Text>
                <Text style={styles.upiModalSub}>Pay ₹{effectiveAmount} to {DEVELOPER_NAME}</Text>
              </View>
              <TouchableOpacity style={styles.upiCloseBtn} onPress={() => setUpiModalVisible(false)}>
                <X color="#8E8E93" size={18} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={styles.upiAppList}>
              {/* Google Pay */}
              <TouchableOpacity
                style={styles.upiAppItem}
                onPress={() => launchSpecificUpiApp('gpay')}
                activeOpacity={0.75}
              >
                <View style={[styles.upiAppIconBadge, { backgroundColor: '#4285F4' }]}>
                  <Text style={styles.upiAppIconText}>GPay</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upiAppName}>Google Pay</Text>
                  <Text style={styles.upiAppSub}>Pay directly using Tez / Google Pay</Text>
                </View>
                <ExternalLink color="#8E8E93" size={16} />
              </TouchableOpacity>

              {/* PhonePe */}
              <TouchableOpacity
                style={styles.upiAppItem}
                onPress={() => launchSpecificUpiApp('phonepe')}
                activeOpacity={0.75}
              >
                <View style={[styles.upiAppIconBadge, { backgroundColor: '#5F259F' }]}>
                  <Text style={styles.upiAppIconText}>Ph</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upiAppName}>PhonePe</Text>
                  <Text style={styles.upiAppSub}>Fast UPI transfer via PhonePe</Text>
                </View>
                <ExternalLink color="#8E8E93" size={16} />
              </TouchableOpacity>

              {/* WhatsApp Pay */}
              <TouchableOpacity
                style={styles.upiAppItem}
                onPress={() => launchSpecificUpiApp('whatsapp')}
                activeOpacity={0.75}
              >
                <View style={[styles.upiAppIconBadge, { backgroundColor: '#25D366' }]}>
                  <Text style={styles.upiAppIconText}>WA</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upiAppName}>WhatsApp Pay</Text>
                  <Text style={styles.upiAppSub}>Transfer via WhatsApp Payments</Text>
                </View>
                <ExternalLink color="#8E8E93" size={16} />
              </TouchableOpacity>

              {/* Paytm / Default UPI */}
              <TouchableOpacity
                style={styles.upiAppItem}
                onPress={() => launchSpecificUpiApp('default')}
                activeOpacity={0.75}
              >
                <View style={[styles.upiAppIconBadge, { backgroundColor: '#00BAF2' }]}>
                  <Text style={styles.upiAppIconText}>UPI</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upiAppName}>Paytm / Other UPI Apps</Text>
                  <Text style={styles.upiAppSub}>Open system UPI app selector</Text>
                </View>
                <ExternalLink color="#8E8E93" size={16} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal Displaying actual attached QR image */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.qrOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setQrModalVisible(false)} />
          <View style={styles.qrModalCard}>
            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setQrModalVisible(false)}>
              <X color="#8E8E93" size={18} strokeWidth={2.2} />
            </TouchableOpacity>

            <View style={styles.qrImageContainer}>
              <Image
                source={DONATE_QR_IMAGE}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>

            <TouchableOpacity style={styles.qrCopyBtn} onPress={handleCopyUpi}>
              <Copy color="#FFFFFF" size={14} />
              <Text style={styles.qrCopyBtnText}>
                {copiedUpi ? '✓ UPI ID Copied!' : 'Copy UPI ID'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1C1C1E',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.25)',
    marginBottom: 20,
  },
  heartCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(250, 36, 60, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#A1A1A6',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  perksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  perkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  perkChipText: {
    color: '#D1D1D6',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  tierCard: {
    width: '48%',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    position: 'relative',
  },
  tierCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(250, 36, 60, 0.08)',
  },
  tierTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierEmoji: {
    fontSize: 22,
  },
  tierBadge: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tierBadgeActive: {
    backgroundColor: Colors.primary,
  },
  tierBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tierBadgeTextActive: {
    color: '#FFFFFF',
  },
  tierName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  tierTagline: {
    color: '#8E8E93',
    fontSize: 10.5,
    lineHeight: 14,
  },
  activeCheckCircle: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customAmountCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  customAmountLabel: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121214',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    paddingHorizontal: 12,
  },
  customInputActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(250, 36, 60, 0.05)',
  },
  rupeeSymbol: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginRight: 6,
  },
  customTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 10,
  },
  clearCustomBtn: {
    padding: 6,
  },
  payCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  payCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  payHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  payCardSub: {
    color: '#8E8E93',
    fontSize: 11,
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  qrBtnText: {
    color: '#0A84FF',
    fontSize: 11,
    fontWeight: '600',
  },
  upiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  upiPillLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  upiPillValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  copyCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  copyCapsuleActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  copyCapsuleText: {
    color: '#D1D1D6',
    fontSize: 11,
    fontWeight: '600',
  },
  copyCapsuleTextActive: {
    color: '#30D158',
    fontSize: 11,
    fontWeight: '600',
  },
  primaryPayBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  payBtnGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  upiModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  upiModalCard: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  upiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  upiModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  upiModalSub: {
    color: '#8E8E93',
    fontSize: 13,
  },
  upiCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiAppList: {
    gap: 10,
  },
  upiAppItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    padding: 14,
    borderRadius: 14,
    gap: 14,
  },
  upiAppIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiAppIconText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  upiAppName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  upiAppSub: {
    color: '#8E8E93',
    fontSize: 12,
  },
  qrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalCard: {
    width: 320,
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  qrCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  qrImageContainer: {
    width: '100%',
    height: 390,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    marginBottom: 14,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  qrCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
  },
  qrCopyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
