import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Trash2,
  ShieldCheck,
  RotateCcw,
  Wifi,
  Film,
  Download,
  Info,
  ChevronRight,
  Globe,
  Radio,
  Activity,
  Heart,
  X,
  Server,
  Cpu,
  Layers,
  Check,
  HardDrive,
  Folder,
  Upload,
  Zap,
  Gauge,
  Palette,
} from 'lucide-react-native';
import { Colors, THEME_OPTIONS, ThemeKey } from '../constants/theme';
import { useDownloads } from '../context/DownloadContext';
import { formatBytes, downloadService, getStorageLocationText } from '../services/downloadService';
import { tamilMvService, POPULAR_MIRRORS } from '../services/tamilMvService';
import { AboutUsScreen } from './AboutUsScreen';
import { DonateUsScreen } from './DonateUsScreen';

interface SettingsScreenProps {
  onOpenAbout?: () => void;
  onOpenDonate?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onOpenAbout,
  onOpenDonate,
}) => {
  const insets = useSafeAreaInsets();
  const {
    storageStats,
    clearCompleted,
    rescanStorage,
    downloads,
    backendUrl,
    setBackendUrl,
    downloadMode,
    setDownloadMode,
    themeKey,
    setThemeKey,
    testPing,
    boostDownloads,
    isBackendConnected,
  } = useDownloads();

  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [donateModalVisible, setDonateModalVisible] = useState(false);
  const [domainModalVisible, setDomainModalVisible] = useState(false);
  const [appInfoModalVisible, setAppInfoModalVisible] = useState(false);
  const [storageModalVisible, setStorageModalVisible] = useState(false);
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [boosterModalVisible, setBoosterModalVisible] = useState(false);
  const [downloadModeModalVisible, setDownloadModeModalVisible] = useState(false);

  // Speed Booster States
  const [autoTurbo, setAutoTurbo] = useState(true);
  const [maxConnsBoost, setMaxConnsBoost] = useState(true);
  const [boosting, setBoosting] = useState(false);
  const [boostMessage, setBoostMessage] = useState<string | null>(null);

  const handleApplySpeedBoost = async () => {
    setBoosting(true);
    setBoostMessage(null);
    try {
      const res = await boostDownloads();
      setBoostMessage(res.message);
    } catch (err: any) {
      setBoostMessage(err?.message || 'Speed boost applied!');
    } finally {
      setBoosting(false);
    }
  };

  // App Preferences
  const [wifiOnly, setWifiOnly] = useState(true);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [strictRedirectBlock, setStrictRedirectBlock] = useState(true);
  const [autoInterceptTorrents, setAutoInterceptTorrents] = useState(true);
  const [preferExternalPlayer, setPreferExternalPlayer] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Backend Torrent Server State
  const [customServerUrl, setCustomServerUrl] = useState(backendUrl);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; latency: number; message: string } | null>(null);

  useEffect(() => {
    setCustomServerUrl(backendUrl);
  }, [backendUrl]);

  const handleTestPing = async () => {
    setPingLoading(true);
    setPingResult(null);
    try {
      const res = await testPing(customServerUrl);
      setPingResult(res);
    } catch (e: any) {
      setPingResult({ ok: false, latency: 0, message: e?.message || 'Connection failed' });
    } finally {
      setPingLoading(false);
    }
  };

  const handleApplyServerUrl = (url: string) => {
    setBackendUrl(url);
    setCustomServerUrl(url);
    setPingResult(null);
  };

  // TamilMV Active Source URL State
  const [tamilMvUrl, setTamilMvUrl] = useState(tamilMvService.getBaseUrl());

  const handleUpdateTamilMvUrl = (url: string) => {
    tamilMvService.setBaseUrl(url);
    setTamilMvUrl(tamilMvService.getBaseUrl());
  };

  const completedCount = downloads.filter((d) => d.status === 'completed').length;
  const appDownloads = storageStats.appDownloadsBytes || 0;

  const handleClearDownloads = () => {
    if (completedCount === 0) {
      Alert.alert('No Downloads', 'There are no completed downloads to remove.');
      return;
    }

    Alert.alert(
      'Clean Downloaded Movies',
      `Are you sure you want to delete all ${completedCount} downloaded movie(s) from internal storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await clearCompleted();
            Alert.alert('Cleaned', 'All downloaded movies have been removed.');
          },
        },
      ]
    );
  };

  const handleRescan = async () => {
    setScanning(true);
    try {
      await rescanStorage();
      Alert.alert('Storage Synced', 'Successfully scanned and indexed internal storage movies.');
    } catch {
      Alert.alert('Scan Failed', 'Could not scan internal storage directory.');
    } finally {
      setScanning(false);
    }
  };

  const totalDisk = storageStats.totalBytes || 1;
  const freeDisk = storageStats.freeBytes || 0;
  const usedDisk = Math.max(0, totalDisk - freeDisk);
  const appPercent = Math.min(100, Math.max(1, (appDownloads / totalDisk) * 100));
  const otherPercent = Math.min(100, Math.max(1, ((usedDisk - appDownloads) / totalDisk) * 100));

  const displayDomain = tamilMvUrl.replace(/^https?:\/\/(www\.)?/, '');
  const currentDownloadsDir = downloadService.getDownloadsDirectory();
  const locationLabel = getStorageLocationText(currentDownloadsDir);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* Navigation Title */}
        <View style={styles.largeTitleContainer}>
          <Text style={styles.largeTitle}>Settings</Text>
        </View>

        {/* ── 1. About Us & Creator Card (Top of Settings) ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>ABOUT US & CREATOR</Text>
          <View style={styles.iosCard}>
            <TouchableOpacity
              style={styles.profileRow}
              activeOpacity={0.7}
              onPress={() => {
                if (onOpenAbout) onOpenAbout();
                else setAboutModalVisible(true);
              }}
            >
              <View style={styles.profileAvatarWrapper}>
                <Image
                  source={require('../../assets/vignesh.jpg')}
                  style={styles.profileAvatar}
                />
              </View>
              <View style={styles.profileInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={styles.profileName}>Vignesh S</Text>
                  <View style={styles.aboutVersionBadge}>
                    <Text style={styles.aboutVersionText}>v2.4.0</Text>
                  </View>
                </View>
                <Text style={styles.profileSubtitle}>Lead Architect & Full-Stack Engineer</Text>
                <Text style={styles.profileEmail}>Tap to view About Us & App Capabilities</Text>
              </View>
              <ChevronRight color="#48484A" size={20} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 1.5. App Theme & Accent Color Section ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>APP THEME & ACCENT COLOR</Text>
          <View style={styles.iosCard}>
            <View style={styles.themeHeaderRow}>
              <View style={[styles.iosIconBox, { backgroundColor: Colors.primary }]}>
                <Palette color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>App Theme</Text>
                <Text style={styles.iosSubtitle}>Select app accent color for buttons, badges & UI</Text>
              </View>
              <Text style={[styles.iosValueText, { color: Colors.primary, fontWeight: '800' }]}>
                {THEME_OPTIONS[themeKey]?.name || 'Red'}
              </Text>
            </View>

            {/* Color Swatch Options Grid */}
            <View style={styles.themeGrid}>
              {Object.values(THEME_OPTIONS).map((theme) => {
                const isSelected = themeKey === theme.key;
                return (
                  <TouchableOpacity
                    key={theme.key}
                    style={[
                      styles.themeChip,
                      isSelected && { borderColor: theme.primary, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                    ]}
                    onPress={() => setThemeKey(theme.key as ThemeKey)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.themeDot, { backgroundColor: theme.primary }]}>
                      {isSelected && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                    </View>
                    <Text style={[styles.themeChipText, isSelected && { color: '#FFFFFF', fontWeight: '800' }]}>
                      {theme.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── 2. Device Storage Section (Menu Row -> Opens Storage Popup Modal) ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>DEVICE STORAGE & DIRECTORY</Text>
          <View style={styles.iosCard}>
            <TouchableOpacity
              style={styles.iosRow}
              activeOpacity={0.7}
              onPress={() => setStorageModalVisible(true)}
            >
              <View style={[styles.iosIconBox, { backgroundColor: Colors.primary }]}>
                <HardDrive color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Device Storage & Directory</Text>
                <Text style={styles.iosSubtitle} numberOfLines={1}>
                  {locationLabel} • {formatBytes(appDownloads)} downloaded
                </Text>
                <Text style={[styles.iosSubtitle, { color: '#8E8E93', fontSize: 11, marginTop: 2 }]} numberOfLines={1}>
                  {currentDownloadsDir || 'VFlix_Movies/'}
                </Text>
              </View>
              <Text style={styles.iosValueText}>{formatBytes(freeDisk)} Free</Text>
              <ChevronRight color="#48484A" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 3. Streaming & Backend Server Section (Menu Row -> Opens Server Popup Modal) ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>STREAMING & BACKEND SERVER</Text>
          <View style={styles.iosCard}>
            <TouchableOpacity
              style={styles.iosRow}
              activeOpacity={0.7}
              onPress={() => setServerModalVisible(true)}
            >
              <View style={[styles.iosIconBox, { backgroundColor: '#0A84FF' }]}>
                <Radio color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Streaming & Backend Server</Text>
                <Text style={styles.iosSubtitle}>HTTP Range & WebTorrent Seeding</Text>
              </View>
              <Text
                style={[
                  styles.iosValueText,
                  { color: isBackendConnected ? '#30D158' : '#FF453A', fontWeight: '600' },
                ]}
              >
                {isBackendConnected ? 'Connected' : 'Offline'}
              </Text>
              <ChevronRight color="#48484A" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 3.5. Download Speed Booster Section (Menu Row -> Opens Speed Booster Modal) ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>DOWNLOAD SPEED BOOSTER</Text>
          <View style={styles.iosCard}>
            <TouchableOpacity
              style={styles.iosRow}
              activeOpacity={0.7}
              onPress={() => setBoosterModalVisible(true)}
            >
              <View style={[styles.iosIconBox, { backgroundColor: '#FF9500' }]}>
                <Zap color="#FFFFFF" size={16} strokeWidth={2.4} fill="#FFFFFF" />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Download Speed Booster</Text>
                <Text style={styles.iosSubtitle}>Re-announce 20+ trackers & flush sockets</Text>
              </View>
              <Text style={[styles.iosValueText, { color: '#FF9500', fontWeight: '600' }]}>
                {downloads.filter((d) => d.status === 'downloading').length > 0
                  ? `${downloads.filter((d) => d.status === 'downloading').length} Active`
                  : 'Turbo Ready'}
              </Text>
              <ChevronRight color="#48484A" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section: Search Mirror ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>SEARCH MIRROR</Text>
          <View style={styles.iosCard}>
            <TouchableOpacity
              style={styles.iosRow}
              activeOpacity={0.7}
              onPress={() => setDomainModalVisible(true)}
            >
              <View style={[styles.iosIconBox, { backgroundColor: '#30D158' }]}>
                <Globe color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Active Domain</Text>
                <Text style={styles.iosSubtitle}>Movie Finder source mirror</Text>
              </View>
              <Text style={styles.iosValueText} numberOfLines={1}>
                {displayDomain}
              </Text>
              <ChevronRight color="#48484A" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section: Download Preferences ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>DOWNLOAD PREFERENCES</Text>
          <View style={styles.iosCard}>
            {/* Download Mode */}
            <TouchableOpacity
              style={styles.iosRow}
              activeOpacity={0.7}
              onPress={() => setDownloadModeModalVisible(true)}
            >
              <View style={[styles.iosIconBox, { backgroundColor: '#FF9500' }]}>
                <Zap color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Download Mode</Text>
                <Text style={styles.iosSubtitle}>Select engine mode for downloads</Text>
              </View>
              <Text style={styles.iosValueText} numberOfLines={1}>
                {downloadMode === 'direct_http'
                  ? 'Direct HTTP (Default)'
                  : downloadMode === 'local_p2p'
                  ? 'Local P2P Bridge'
                  : 'Cloud Backend Relay'}
              </Text>
              <ChevronRight color="#48484A" size={18} strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.iosDivider} />

            {/* Wi-Fi Only */}
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#32D74B' }]}>
                <Wifi color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Wi-Fi Only Downloads</Text>
                <Text style={styles.iosSubtitle}>Prevent cellular data usage</Text>
              </View>
              <Switch
                value={wifiOnly}
                onValueChange={setWifiOnly}
                trackColor={{ false: '#39393D', true: '#30D158' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.iosDivider} />

            {/* Auto-Intercept Torrents */}
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#FF2D55' }]}>
                <Download color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Auto-Intercept Torrents</Text>
                <Text style={styles.iosSubtitle}>Catch magnet links from browser</Text>
              </View>
              <Switch
                value={autoInterceptTorrents}
                onValueChange={setAutoInterceptTorrents}
                trackColor={{ false: '#39393D', true: '#30D158' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* ── Section: Security & Ad Shield ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>SECURITY & AD SHIELD</Text>
          <View style={styles.iosCard}>
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#30D158' }]}>
                <ShieldCheck color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Ad & Popup Blocker</Text>
                <Text style={styles.iosSubtitle}>Blocks ad networks & popups</Text>
              </View>
              <Switch
                value={adBlockEnabled}
                onValueChange={setAdBlockEnabled}
                trackColor={{ false: '#39393D', true: '#30D158' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.iosDivider} />

            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#32D74B' }]}>
                <ShieldCheck color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Anti-Redirect Protection</Text>
                <Text style={styles.iosSubtitle}>Blocks page hijacks</Text>
              </View>
              <Switch
                value={strictRedirectBlock}
                onValueChange={setStrictRedirectBlock}
                trackColor={{ false: '#39393D', true: '#30D158' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* ── Section: Video Playback ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>VIDEO PLAYBACK</Text>
          <View style={styles.iosCard}>
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#FF375F' }]}>
                <Film color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Prefer External Player</Text>
                <Text style={styles.iosSubtitle}>Launch in VLC or MX Player</Text>
              </View>
              <Switch
                value={preferExternalPlayer}
                onValueChange={setPreferExternalPlayer}
                trackColor={{ false: '#39393D', true: '#30D158' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* ── Section: Support & Appreciation (Refactored - Duplicate About Dev Removed) ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>SUPPORT & APPRECIATION</Text>
          <View style={styles.iosCard}>
            <TouchableOpacity
              style={styles.iosRow}
              activeOpacity={0.7}
              onPress={() => {
                if (onOpenDonate) onOpenDonate();
                else setDonateModalVisible(true);
              }}
            >
              <View style={[styles.iosIconBox, { backgroundColor: '#FF3B30' }]}>
                <Heart color="#FFFFFF" fill="#FFFFFF" size={15} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Donate & Support Us</Text>
                <Text style={styles.iosSubtitle}>Fund high-speed swarms & engine</Text>
              </View>
              <Text style={[styles.iosValueText, { color: Colors.primary, fontWeight: '600' }]}>
                Contribute
              </Text>
              <ChevronRight color="#48484A" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section: Application Information (Single Row -> Opens Sub-screen Modal) ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>APPLICATION INFO</Text>
          <View style={styles.iosCard}>
            <TouchableOpacity
              style={styles.iosRow}
              activeOpacity={0.7}
              onPress={() => setAppInfoModalVisible(true)}
            >
              <View style={[styles.iosIconBox, { backgroundColor: '#5856D6' }]}>
                <Info color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Application Info</Text>
                <Text style={styles.iosSubtitle}>v2.4.0 (Build 57.0)</Text>
              </View>
              <Text style={styles.iosValueText}>VFlix Stream</Text>
              <ChevronRight color="#48484A" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ── 0. Download Modes Sub-Screen Modal ── */}
      <Modal
        visible={downloadModeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDownloadModeModalVisible(false)}
      >
        <View style={[styles.subModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 10 }]}>
          <View style={styles.subModalHeader}>
            <Text style={styles.subModalHeaderTitle}>Download Modes</Text>
            <TouchableOpacity
              style={styles.subModalCloseBtn}
              onPress={() => setDownloadModeModalVisible(false)}
            >
              <X color="#8E8E93" size={18} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.subModalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>SELECT ACTIVE DOWNLOAD ENGINE MODE</Text>
              <View style={{ gap: 12 }}>
                {/* 1. Direct HTTP Downloader */}
                <TouchableOpacity
                  style={[
                    styles.serverPresetCard,
                    downloadMode === 'direct_http' && styles.serverPresetCardActive,
                  ]}
                  onPress={() => {
                    setDownloadMode('direct_http');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.presetLeft}>
                    <View style={[styles.presetIconBadge, { backgroundColor: 'rgba(255, 149, 0, 0.18)' }]}>
                      <Zap color="#FF9500" size={18} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.presetName}>Direct HTTP Downloader</Text>
                        <View style={{ backgroundColor: 'rgba(255, 149, 0, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: '#FF9500', fontSize: 10, fontWeight: '700' }}>DEFAULT</Text>
                        </View>
                      </View>
                      <Text style={styles.presetUrl}>
                        Direct HTTP range chunk downloader. Saves video files natively directly to phone internal storage.
                      </Text>
                    </View>
                  </View>
                  {downloadMode === 'direct_http' && (
                    <Check color="#FF9500" size={20} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>

                {/* 2. Local P2P WebTorrent Bridge */}
                <TouchableOpacity
                  style={[
                    styles.serverPresetCard,
                    downloadMode === 'local_p2p' && styles.serverPresetCardActive,
                  ]}
                  onPress={() => {
                    setDownloadMode('local_p2p');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.presetLeft}>
                    <View style={[styles.presetIconBadge, { backgroundColor: 'rgba(10, 132, 255, 0.18)' }]}>
                      <Cpu color="#0A84FF" size={18} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.presetName}>Local P2P WebTorrent Bridge</Text>
                      <Text style={styles.presetUrl}>
                        Client-side peer-to-peer WebTorrent engine running inside the mobile app using WSS & WebRTC trackers.
                      </Text>
                    </View>
                  </View>
                  {downloadMode === 'local_p2p' && (
                    <Check color="#0A84FF" size={20} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>

                {/* 3. Cloud Backend Relay */}
                <TouchableOpacity
                  style={[
                    styles.serverPresetCard,
                    downloadMode === 'backend_relay' && styles.serverPresetCardActive,
                  ]}
                  onPress={() => {
                    setDownloadMode('backend_relay');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.presetLeft}>
                    <View style={[styles.presetIconBadge, { backgroundColor: 'rgba(250, 36, 60, 0.18)' }]}>
                      <Server color={Colors.primary} size={18} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.presetName}>Cloud Backend Relay</Text>
                      <Text style={styles.presetUrl}>
                        Relays torrent downloads through VFlix backend server over Socket.io and streams completed media.
                      </Text>
                    </View>
                  </View>
                  {downloadMode === 'backend_relay' && (
                    <Check color={Colors.primary} size={20} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.iosSectionFooter}>
                All 3 download modes are active and handled in VFlix. By default, Direct HTTP Downloader is selected for maximum speed and compatibility.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── 1. Active Domain Settings Sub-Screen Modal ── */}
      <Modal
        visible={domainModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDomainModalVisible(false)}
      >
        <View style={[styles.subModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 10 }]}>
          <View style={styles.subModalHeader}>
            <Text style={styles.subModalHeaderTitle}>Active Search Domain</Text>
            <TouchableOpacity
              style={styles.subModalCloseBtn}
              onPress={() => setDomainModalVisible(false)}
            >
              <X color="#8E8E93" size={18} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.subModalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>CURRENT SOURCE DOMAIN</Text>
              <View style={styles.iosCard}>
                <View style={styles.iosInputCardRow}>
                  <Text style={styles.iosInputLabel}>CUSTOM DOMAIN URL</Text>
                  <TextInput
                    style={styles.iosTextInput}
                    placeholder="https://www.1tamilmv.lease"
                    placeholderTextColor="#636366"
                    value={tamilMvUrl}
                    onChangeText={handleUpdateTamilMvUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
              <Text style={styles.iosSectionFooter}>
                This active domain mirror is used by Movie Finder to fetch releases & magnets.
              </Text>
            </View>

            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>POPULAR MIRRORS</Text>
              <View style={styles.iosCard}>
                {POPULAR_MIRRORS.map((mirror, idx) => {
                  const isActive = tamilMvUrl.toLowerCase() === mirror.toLowerCase();
                  return (
                    <React.Fragment key={mirror}>
                      {idx > 0 && <View style={styles.iosDivider} />}
                      <TouchableOpacity
                        style={styles.iosRow}
                        onPress={() => handleUpdateTamilMvUrl(mirror)}
                        activeOpacity={0.7}
                      >
                        <Globe color={isActive ? Colors.primary : '#8E8E93'} size={18} strokeWidth={2} />
                        <Text style={[styles.iosTitle, isActive && { color: Colors.primary, fontWeight: '700' }]}>
                          {mirror.replace(/^https?:\/\/(www\.)?/, '')}
                        </Text>
                        {isActive && <Check color={Colors.primary} size={18} strokeWidth={2.5} />}
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── 2. Application Information Sub-Screen Modal ── */}
      <Modal
        visible={appInfoModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAppInfoModalVisible(false)}
      >
        <View style={[styles.subModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 10 }]}>
          <View style={styles.subModalHeader}>
            <Text style={styles.subModalHeaderTitle}>Application Info</Text>
            <TouchableOpacity
              style={styles.subModalCloseBtn}
              onPress={() => setAppInfoModalVisible(false)}
            >
              <X color="#8E8E93" size={18} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.subModalBody} showsVerticalScrollIndicator={false}>
            {/* App Branding */}
            <View style={styles.appBrandingCard}>
              <View style={styles.appLogoBox}>
                <Film color="#FFFFFF" size={32} strokeWidth={2} />
              </View>
              <Text style={styles.appNameTitle}>VFlix Stream</Text>
              <Text style={styles.appTagline}>Decentralized Movie Engine & P2P Streamer</Text>
            </View>

            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>SPECIFICATIONS</Text>
              <View style={styles.iosCard}>
                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>App Name</Text>
                  <Text style={styles.iosValueText}>VFlix</Text>
                </View>

                <View style={styles.iosDivider} />

                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>Version</Text>
                  <Text style={[styles.iosValueText, { color: Colors.primary, fontWeight: '600' }]}>
                    v2.4.0 (Build 57.0)
                  </Text>
                </View>

                <View style={styles.iosDivider} />

                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>Torrent Engine</Text>
                  <Text style={styles.iosValueText}>WebTorrent P2P</Text>
                </View>

                <View style={styles.iosDivider} />

                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>Platform</Text>
                  <Text style={styles.iosValueText}>{Platform.OS.toUpperCase()}</Text>
                </View>

                <View style={styles.iosDivider} />

                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>Storage Directory</Text>
                  <Text style={styles.iosValueText}>VFlix_Movies</Text>
                </View>

                <View style={styles.iosDivider} />

                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>Backend Connection</Text>
                  <Text style={[styles.iosValueText, { color: isBackendConnected ? '#30D158' : '#FF453A' }]}>
                    {isBackendConnected ? 'Connected' : 'Offline'}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Device Storage & Directory Modal ── */}
      <Modal
        visible={storageModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStorageModalVisible(false)}
      >
        <View style={styles.subModalContainer}>
          <View style={styles.subModalHeader}>
            <Text style={styles.subModalHeaderTitle}>Device Storage & Directory</Text>
            <TouchableOpacity
              style={styles.subModalCloseBtn}
              onPress={() => setStorageModalVisible(false)}
            >
              <X color="#8E8E93" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.subModalBody} showsVerticalScrollIndicator={false}>
            {/* Storage Usage Graph */}
            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>STORAGE BREAKDOWN</Text>
              <View style={styles.storageCard}>
                <View style={styles.storageHeader}>
                  <View style={styles.storageIconWrapper}>
                    <HardDrive color={Colors.netflixRed} size={20} strokeWidth={2} />
                  </View>
                  <View style={styles.storageHeaderTitleGroup}>
                    <Text style={styles.storageTitle}>Internal Storage Usage</Text>
                    <Text style={styles.storageStatsText}>
                      {formatBytes(appDownloads)} downloaded by VFlix • {formatBytes(freeDisk)} free
                    </Text>
                  </View>
                </View>

                <View style={styles.storageBarTrack}>
                  <View style={[styles.storageBarApp, { width: `${appPercent}%` }]} />
                  <View style={[styles.storageBarOther, { width: `${otherPercent}%` }]} />
                </View>

                <View style={styles.storageLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.netflixRed }]} />
                    <Text style={styles.legendText}>VFlix ({formatBytes(appDownloads)})</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4A4E5D' }]} />
                    <Text style={styles.legendText}>Other Files ({formatBytes(Math.max(0, usedDisk - appDownloads))})</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#1E202B', borderWidth: 1, borderColor: '#4A4E5D' }]} />
                    <Text style={styles.legendText}>Free ({formatBytes(freeDisk)})</Text>
                  </View>
                </View>

                <View style={styles.folderRow}>
                  <View style={styles.folderLeft}>
                    <View style={styles.folderIconBadge}>
                      <Folder color="#30D158" size={14} strokeWidth={2} />
                    </View>
                    <View style={styles.folderTextWrapper}>
                      <Text style={styles.folderPathText}>{locationLabel}</Text>
                      <Text style={styles.folderSubText}>Active Movie Storage Location</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.rescanStorageBtn}
                    onPress={handleRescan}
                    disabled={scanning}
                  >
                    {scanning ? (
                      <ActivityIndicator size="small" color={Colors.netflixRed} />
                    ) : (
                      <>
                        <RotateCcw color={Colors.netflixRed} size={12} strokeWidth={2.5} />
                        <Text style={styles.rescanStorageText}>Rescan</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Absolute File Path Card */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#15161E',
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#262938',
                    marginTop: 10,
                  }}
                  activeOpacity={0.8}
                  onPress={() => {
                    Share.share({
                      title: 'VFlix Download Directory Path',
                      message: currentDownloadsDir,
                    }).catch(() => {});
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: '#8E8E93', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
                      FULL FILESYSTEM PATH:
                    </Text>
                    <Text style={{ color: Colors.primary, fontSize: 11, fontWeight: '600' }}>
                      Tap to Copy / Share
                    </Text>
                  </View>
                  <Text style={{ color: '#E5E5EA', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }} selectable>
                    {currentDownloadsDir}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>STORAGE ACTIONS</Text>
              <View style={styles.iosCard}>
                <TouchableOpacity style={styles.iosDestructiveRow} onPress={handleClearDownloads}>
                  <Trash2 color="#FF453A" size={18} strokeWidth={2} style={{ marginRight: 8 }} />
                  <Text style={styles.iosDestructiveText}>Delete All Downloaded Movies</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.iosSectionFooter}>
                This will permanently delete all {completedCount} downloaded movie files from your device storage.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Streaming & Backend Server Modal ── */}
      <Modal
        visible={serverModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setServerModalVisible(false)}
      >
        <View style={styles.subModalContainer}>
          <View style={styles.subModalHeader}>
            <Text style={styles.subModalHeaderTitle}>Streaming & Backend Server</Text>
            <TouchableOpacity
              style={styles.subModalCloseBtn}
              onPress={() => setServerModalVisible(false)}
            >
              <X color="#8E8E93" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.subModalBody} showsVerticalScrollIndicator={false}>
            {/* Status Section */}
            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>SERVER CONNECTION STATUS</Text>
              <View style={styles.iosCard}>
                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: isBackendConnected ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 69, 58, 0.15)' },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: isBackendConnected ? '#30D158' : '#FF453A' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: isBackendConnected ? '#30D158' : '#FF453A' },
                      ]}
                    >
                      {isBackendConnected ? 'Connected' : 'Offline'}
                    </Text>
                  </View>
                </View>
                <View style={styles.iosDivider} />
                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>Active Server IP</Text>
                  <Text style={styles.iosValueText} numberOfLines={1}>
                    {backendUrl}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Presets */}
            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>SERVER PRESETS</Text>
              <View style={{ gap: 10 }}>
                {/* Render Cloud Server Preset */}
                <TouchableOpacity
                  style={[
                    styles.serverPresetCard,
                    customServerUrl === 'https://vflix-backend.onrender.com' && styles.serverPresetCardActive,
                  ]}
                  onPress={() => handleApplyServerUrl('https://vflix-backend.onrender.com')}
                  activeOpacity={0.7}
                >
                  <View style={styles.presetLeft}>
                    <View style={[styles.presetIconBadge, { backgroundColor: 'rgba(250, 36, 60, 0.18)' }]}>
                      <Globe color={Colors.primary} size={16} strokeWidth={2} />
                    </View>
                    <View>
                      <Text style={styles.presetName}>Render Cloud Server (Online)</Text>
                      <Text style={styles.presetUrl}>https://vflix-backend.onrender.com</Text>
                    </View>
                  </View>
                  {customServerUrl === 'https://vflix-backend.onrender.com' && (
                    <Check color={Colors.primary} size={18} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>

                {/* Dev Server Preset */}
                <TouchableOpacity
                  style={[
                    styles.serverPresetCard,
                    customServerUrl === 'http://192.168.1.6:3002' && styles.serverPresetCardActive,
                  ]}
                  onPress={() => handleApplyServerUrl('http://192.168.1.6:3002')}
                  activeOpacity={0.7}
                >
                  <View style={styles.presetLeft}>
                    <View style={[styles.presetIconBadge, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                      <Cpu color="#0A84FF" size={16} strokeWidth={2} />
                    </View>
                    <View>
                      <Text style={styles.presetName}>Dev Server IP</Text>
                      <Text style={styles.presetUrl}>http://192.168.1.6:3002</Text>
                    </View>
                  </View>
                  {customServerUrl === 'http://192.168.1.6:3002' && (
                    <Check color="#0A84FF" size={18} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>

                {/* Production Server Preset */}
                <TouchableOpacity
                  style={[
                    styles.serverPresetCard,
                    customServerUrl === 'http://192.168.1.10:3002' && styles.serverPresetCardActive,
                  ]}
                  onPress={() => handleApplyServerUrl('http://192.168.1.10:3002')}
                  activeOpacity={0.7}
                >
                  <View style={styles.presetLeft}>
                    <View style={[styles.presetIconBadge, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                      <Server color="#30D158" size={16} strokeWidth={2} />
                    </View>
                    <View>
                      <Text style={styles.presetName}>Production Server IP</Text>
                      <Text style={styles.presetUrl}>http://192.168.1.10:3002</Text>
                    </View>
                  </View>
                  {customServerUrl === 'http://192.168.1.10:3002' && (
                    <Check color="#30D158" size={18} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>

                {/* Localhost Preset */}
                <TouchableOpacity
                  style={[
                    styles.serverPresetCard,
                    (customServerUrl === 'http://localhost:3002' || customServerUrl === 'http://10.0.2.2:3002') &&
                      styles.serverPresetCardActive,
                  ]}
                  onPress={() => handleApplyServerUrl(Platform.OS === 'android' ? 'http://10.0.2.2:3002' : 'http://localhost:3002')}
                  activeOpacity={0.7}
                >
                  <View style={styles.presetLeft}>
                    <View style={[styles.presetIconBadge, { backgroundColor: 'rgba(255, 159, 10, 0.15)' }]}>
                      <Activity color="#FF9F0A" size={16} strokeWidth={2} />
                    </View>
                    <View>
                      <Text style={styles.presetName}>Localhost Server</Text>
                      <Text style={styles.presetUrl}>
                        {Platform.OS === 'android' ? 'http://10.0.2.2:3002' : 'http://localhost:3002'}
                      </Text>
                    </View>
                  </View>
                  {(customServerUrl === 'http://localhost:3002' || customServerUrl === 'http://10.0.2.2:3002') && (
                    <Check color="#FF9F0A" size={18} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Custom URL Configuration */}
            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>CUSTOM BACKEND URL</Text>
              <View style={styles.iosCard}>
                <View style={styles.iosInputCardRow}>
                  <Text style={styles.iosInputLabel}>SERVER URL (HOST:PORT)</Text>
                  <TextInput
                    style={styles.iosTextInput}
                    value={customServerUrl}
                    onChangeText={setCustomServerUrl}
                    placeholder="http://192.168.1.6:3002"
                    placeholderTextColor="#555"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.iosDivider} />
                <View style={styles.iosActionRow}>
                  <TouchableOpacity
                    style={styles.iosPillActionBtn}
                    onPress={handleTestPing}
                    disabled={pingLoading}
                  >
                    {pingLoading ? (
                      <ActivityIndicator size="small" color="#0A84FF" />
                    ) : (
                      <>
                        <Activity color="#0A84FF" size={14} strokeWidth={2} />
                        <Text style={styles.iosPillActionText}>Test Ping</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {pingResult && (
                    <View
                      style={[
                        styles.pingResultPill,
                        {
                          backgroundColor: pingResult.ok ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 69, 58, 0.15)',
                          borderColor: pingResult.ok ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255, 69, 58, 0.3)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pingResultText,
                          { color: pingResult.ok ? '#30D158' : '#FF453A' },
                        ]}
                        numberOfLines={1}
                      >
                        {pingResult.ok ? `${pingResult.latency}ms • OK` : pingResult.message}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.iosPillActionBtn, { backgroundColor: Colors.primary }]}
                    onPress={() => handleApplyServerUrl(customServerUrl)}
                  >
                    <Check color="#FFFFFF" size={14} strokeWidth={2.5} />
                    <Text style={[styles.iosPillActionText, { color: '#FFFFFF' }]}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.iosSectionFooter}>
                Connect to a local Node.js backend running WebTorrent to enable live video streaming with HTTP byte ranges.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Download Speed Booster Modal ── */}
      <Modal
        visible={boosterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBoosterModalVisible(false)}
      >
        <View style={styles.subModalContainer}>
          <View style={styles.subModalHeader}>
            <Text style={styles.subModalHeaderTitle}>Download Speed Booster</Text>
            <TouchableOpacity
              style={styles.subModalCloseBtn}
              onPress={() => setBoosterModalVisible(false)}
            >
              <X color="#8E8E93" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.subModalBody} showsVerticalScrollIndicator={false}>
            {/* Speed Meter Banner */}
            <View style={styles.boosterBannerCard}>
              <LinearGradient
                colors={['#FF9500', '#FF3B30']}
                style={styles.boosterGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.boosterIconWrap}>
                  <Zap color="#FFFFFF" size={32} strokeWidth={2.5} fill="#FFFFFF" />
                </View>
                <Text style={styles.boosterBannerTitle}>Turbo Speed Booster</Text>
                <Text style={styles.boosterBannerSub}>
                  Accelerate slow downloads instantly by re-querying 20+ Tier-1 high-speed P2P trackers, optimizing TCP sockets, and maxing out peer connections.
                </Text>
              </LinearGradient>
            </View>

            {/* Action Trigger Button */}
            <View style={styles.iosSection}>
              <TouchableOpacity
                style={styles.boostActionBtn}
                onPress={handleApplySpeedBoost}
                disabled={boosting}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FF9500', '#FF2D55']}
                  style={styles.boostActionGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {boosting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Zap color="#FFFFFF" size={18} fill="#FFFFFF" />
                      <Text style={styles.boostActionText}>SPEED UP DOWNLOADS NOW</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {boostMessage && (
                <View style={styles.boostSuccessBox}>
                  <Check color="#30D158" size={16} strokeWidth={2.5} />
                  <Text style={styles.boostSuccessText}>{boostMessage}</Text>
                </View>
              )}
            </View>

            {/* Turbo Settings */}
            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>TURBO ACCELERATION PREFERENCES</Text>
              <View style={styles.iosCard}>
                <View style={styles.iosRow}>
                  <View style={[styles.iosIconBox, { backgroundColor: '#FF9500' }]}>
                    <Gauge color="#FFFFFF" size={16} strokeWidth={2.2} />
                  </View>
                  <View style={styles.iosTitleGroup}>
                    <Text style={styles.iosTitle}>Auto-Turbo Speed Mode</Text>
                    <Text style={styles.iosSubtitle}>Auto-boost when speed drops below 500 KB/s</Text>
                  </View>
                  <Switch
                    value={autoTurbo}
                    onValueChange={setAutoTurbo}
                    trackColor={{ false: '#3A3A3C', true: '#FF9500' }}
                    thumbColor={autoTurbo ? '#FFFFFF' : '#F4F3F4'}
                  />
                </View>

                <View style={styles.iosDivider} />

                <View style={styles.iosRow}>
                  <View style={[styles.iosIconBox, { backgroundColor: '#30D158' }]}>
                    <Cpu color="#FFFFFF" size={16} strokeWidth={2.2} />
                  </View>
                  <View style={styles.iosTitleGroup}>
                    <Text style={styles.iosTitle}>Max Peer Connections (350)</Text>
                    <Text style={styles.iosSubtitle}>Force high-density WebTorrent swarm discovery</Text>
                  </View>
                  <Switch
                    value={maxConnsBoost}
                    onValueChange={setMaxConnsBoost}
                    trackColor={{ false: '#3A3A3C', true: '#30D158' }}
                    thumbColor={maxConnsBoost ? '#FFFFFF' : '#F4F3F4'}
                  />
                </View>
              </View>
            </View>

            {/* Technical Specs */}
            <View style={styles.iosSection}>
              <Text style={styles.iosSectionHeader}>BOOSTER SPECIFICATIONS</Text>
              <View style={styles.iosCard}>
                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>Tier-1 Public Trackers</Text>
                  <Text style={styles.iosValueText}>20 Active Nodes</Text>
                </View>

                <View style={styles.iosDivider} />

                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>DHT Peer Discovery</Text>
                  <Text style={styles.iosValueText}>Concurrency (32)</Text>
                </View>

                <View style={styles.iosDivider} />

                <View style={styles.iosRow}>
                  <Text style={styles.iosTitle}>HTTP Keep-Alive Range</Text>
                  <Text style={styles.iosValueText}>Multi-Thread Stream</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── 3. About Us Screen Modal ── */}
      <Modal
        visible={aboutModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <AboutUsScreen
          onClose={() => setAboutModalVisible(false)}
          onOpenDonate={() => {
            setAboutModalVisible(false);
            setDonateModalVisible(true);
          }}
        />
      </Modal>

      {/* ── 4. Donate Us Screen Modal ── */}
      <Modal
        visible={donateModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setDonateModalVisible(false)}
      >
        <DonateUsScreen onClose={() => setDonateModalVisible(false)} />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  largeTitleContainer: {
    paddingVertical: 12,
  },
  largeTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  iosSection: {
    marginBottom: 24,
  },
  iosSectionHeader: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 6,
  },
  iosSectionFooter: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
    marginLeft: 6,
  },
  iosCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  profileAvatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 2,
  },
  profileEmail: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '500',
  },
  aboutVersionBadge: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(250, 36, 60, 0.35)',
  },
  aboutVersionText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  iosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  iosIconBox: {
    width: 30,
    height: 30,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iosTitleGroup: {
    flex: 1,
  },
  iosTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  iosSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 1,
  },
  iosValueText: {
    color: '#8E8E93',
    fontSize: 14,
    marginRight: 6,
  },
  iosDivider: {
    height: 0.5,
    backgroundColor: '#2C2C2E',
    marginLeft: 56,
  },
  iosInputCardRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iosInputLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  iosTextInput: {
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 4,
  },
  iosActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iosPillActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 6,
  },
  iosPillActionText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '600',
  },
  pingResultPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '55%',
  },
  pingResultText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  iosSmallPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginLeft: 6,
  },
  iosSmallPillText: {
    color: '#0A84FF',
    fontSize: 11,
    fontWeight: '600',
  },
  iosDestructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  iosDestructiveText: {
    color: '#FF453A',
    fontSize: 15,
    fontWeight: '600',
  },
  storageCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#232632',
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  storageIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageHeaderTitleGroup: {
    flex: 1,
  },
  storageTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  storageStatsText: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 1,
  },
  storageBarTrack: {
    height: 7,
    backgroundColor: '#1E202B',
    borderRadius: 3.5,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },
  storageBarApp: {
    backgroundColor: Colors.netflixRed,
    height: '100%',
  },
  storageBarOther: {
    backgroundColor: '#4A4E5D',
    height: '100%',
  },
  storageLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    color: '#8E8E93',
    fontSize: 10,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#232632',
  },
  folderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  folderIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: 'rgba(70, 211, 105, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderTextWrapper: {
    flex: 1,
  },
  folderPathText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  folderSubText: {
    color: '#8E8E93',
    fontSize: 9.5,
  },
  rescanStorageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
  },
  rescanStorageText: {
    color: Colors.netflixRed,
    fontSize: 10,
    fontWeight: '700',
  },
  subModalContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  subModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C2E',
  },
  subModalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  subModalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subModalBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  appBrandingCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  appLogoBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  appNameTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  appTagline: {
    color: '#8E8E93',
    fontSize: 13,
  },
  localhostShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  localhostShortcutText: {
    color: '#0A84FF',
    fontSize: 12,
    fontWeight: '600',
  },
  serverPresetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  serverPresetCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(250, 36, 60, 0.08)',
  },
  presetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  presetIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  presetUrl: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 1,
  },
  boosterBannerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  boosterGradient: {
    padding: 20,
    alignItems: 'center',
  },
  boosterIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  boosterBannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  boosterBannerSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  boostActionBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  boostActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
  },
  boostActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  boostSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    borderColor: 'rgba(48, 209, 88, 0.35)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 8,
  },
  boostSuccessText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  themeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#262835',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161722',
    borderWidth: 1.5,
    borderColor: '#262835',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  themeDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeChipText: {
    color: '#A09DB1',
    fontSize: 12,
    fontWeight: '600',
  },
});
