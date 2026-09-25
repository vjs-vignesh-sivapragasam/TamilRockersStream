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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HardDrive,
  Trash2,
  ShieldCheck,
  RotateCcw,
  Wifi,
  Film,
  Download,
  Folder,
  Layers,
  Info,
  ChevronRight,
  Globe,
  Check,
  Radio,
  Activity,
  Server,
  Zap,
  Heart,
  Smartphone,
  Cpu,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { useDownloads } from '../context/DownloadContext';
import { formatBytes } from '../services/downloadService';
import { debridService } from '../services/debridService';
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
    testPing,
    isBackendConnected,
  } = useDownloads();

  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [donateModalVisible, setDonateModalVisible] = useState(false);

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

  // Debrid Proxy State
  const initialDebrid = debridService.getConfig();
  const [debridEnabled, setDebridEnabled] = useState(initialDebrid.enabled);
  const [debridKey, setDebridKey] = useState(initialDebrid.apiKey);

  // TamilMV Source URL State
  const [tamilMvUrl, setTamilMvUrl] = useState(tamilMvService.getBaseUrl());

  const updateDebridConfig = (enabled: boolean, key: string) => {
    debridService.setConfig({
      provider: 'real-debrid',
      enabled,
      apiKey: key,
    });
  };

  const handleUpdateTamilMvUrl = (url: string) => {
    tamilMvService.setBaseUrl(url);
    setTamilMvUrl(tamilMvService.getBaseUrl());
  };

  const completedCount = downloads.filter((d) => d.status === 'completed').length;
  const totalDisk = storageStats.totalBytes || 1;
  const freeDisk = storageStats.freeBytes || 0;
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* iOS Large Navigation Title */}
        <View style={styles.largeTitleContainer}>
          <Text style={styles.largeTitle}>Settings</Text>
        </View>

        {/* ── Apple ID / Developer Profile Card ── */}
        <View style={styles.iosSection}>
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
                <Text style={styles.profileName}>Vignesh S</Text>
                <Text style={styles.profileSubtitle}>Lead Engineer • VFlix Engine</Text>
                <Text style={styles.profileEmail}>vigneshmake28@gmail.com</Text>
              </View>
              <ChevronRight color="#48484A" size={20} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section: Torrent & Stream Server ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>STREAMING & BACKEND SERVER</Text>
          <View style={styles.iosCard}>
            {/* Server Status Row */}
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#0A84FF' }]}>
                <Radio color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Backend Engine</Text>
                <Text style={styles.iosSubtitle}>HTTP Range & Peer Seeding</Text>
              </View>
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

            {/* Server URL Input */}
            <View style={styles.iosInputCardRow}>
              <Text style={styles.iosInputLabel}>SERVER URL</Text>
              <TextInput
                style={styles.iosTextInput}
                placeholder="https://vflix-torrent-stream.loca.lt"
                placeholderTextColor="#636366"
                value={customServerUrl}
                onChangeText={handleApplyServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.iosDivider} />

            {/* Ping Test Row */}
            <View style={styles.iosActionRow}>
              <TouchableOpacity
                style={styles.iosPillActionBtn}
                onPress={handleTestPing}
                disabled={pingLoading}
                activeOpacity={0.7}
              >
                {pingLoading ? (
                  <ActivityIndicator size="small" color="#0A84FF" />
                ) : (
                  <Activity color="#0A84FF" size={15} strokeWidth={2.2} />
                )}
                <Text style={styles.iosPillActionText}>
                  {pingLoading ? 'Testing...' : 'Test Server Ping'}
                </Text>
              </TouchableOpacity>

              {pingResult && (
                <View
                  style={[
                    styles.pingResultPill,
                    {
                      backgroundColor: pingResult.ok ? 'rgba(48, 209, 88, 0.12)' : 'rgba(255, 69, 58, 0.12)',
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
                    {pingResult.ok ? `✓ ${pingResult.message}` : `✕ ${pingResult.message}`}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.iosDivider} />

            {/* Server Presets */}
            <View style={styles.presetsCardWrap}>
              <Text style={styles.presetsHeaderLabel}>PRESETS</Text>
              <View style={styles.presetsGrid}>
                {[
                  { label: 'Wi-Fi LAN (Fastest)', url: 'http://192.168.1.6:3000' },
                  { label: 'Cloud Tunnel (Live)', url: 'https://wild-results-help.loca.lt' },
                  { label: 'Local PC', url: 'http://localhost:3000' },
                  { label: 'Android Emulator', url: 'http://10.0.2.2:3000' },
                ].map((item) => {
                  const isActive = customServerUrl.toLowerCase() === item.url.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={item.url}
                      onPress={() => handleApplyServerUrl(item.url)}
                      style={[styles.presetChip, isActive && styles.presetChipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
          <Text style={styles.iosSectionFooter}>
            The backend engine handles WebTorrent peer swarms and feeds high-speed HTTP streams into VFlix.
          </Text>
        </View>

        {/* ── Section: Torrent Proxy (Debrid) ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>TORRENT PROXY</Text>
          <View style={styles.iosCard}>
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#AF52DE' }]}>
                <Zap color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Real-Debrid Proxy</Text>
                <Text style={styles.iosSubtitle}>Instant cloud cache downloads</Text>
              </View>
              <Switch
                value={debridEnabled}
                onValueChange={(val) => {
                  setDebridEnabled(val);
                  updateDebridConfig(val, debridKey);
                }}
                trackColor={{ false: '#39393D', true: '#30D158' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {debridEnabled && (
              <>
                <View style={styles.iosDivider} />
                <View style={styles.iosInputCardRow}>
                  <Text style={styles.iosInputLabel}>API KEY</Text>
                  <TextInput
                    style={styles.iosTextInput}
                    placeholder="Enter Real-Debrid API token..."
                    placeholderTextColor="#636366"
                    value={debridKey}
                    onChangeText={(val: string) => {
                      setDebridKey(val);
                      updateDebridConfig(debridEnabled, val);
                    }}
                    secureTextEntry
                  />
                </View>
              </>
            )}
          </View>
          <Text style={styles.iosSectionFooter}>
            Converts low-seed torrents into direct high-speed HTTP links via Real-Debrid servers.
          </Text>
        </View>

        {/* ── Section: Search Mirror & Source ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>SEARCH MIRROR</Text>
          <View style={styles.iosCard}>
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#30D158' }]}>
                <Globe color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Active Domain</Text>
                <Text style={styles.iosSubtitle}>Site used by Movie Finder</Text>
              </View>
              <Text style={styles.iosValueText} numberOfLines={1}>
                {tamilMvUrl.replace(/^https?:\/\/(www\.)?/, '')}
              </Text>
            </View>

            <View style={styles.iosDivider} />

            <View style={styles.iosInputCardRow}>
              <Text style={styles.iosInputLabel}>CUSTOM URL</Text>
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

            <View style={styles.iosDivider} />

            <View style={styles.presetsCardWrap}>
              <Text style={styles.presetsHeaderLabel}>POPULAR MIRRORS</Text>
              <View style={styles.presetsGrid}>
                {POPULAR_MIRRORS.slice(0, 4).map((mirror) => {
                  const isActive = tamilMvUrl.toLowerCase() === mirror.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={mirror}
                      onPress={() => handleUpdateTamilMvUrl(mirror)}
                      style={[styles.presetChip, isActive && styles.presetChipActive]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                        {mirror.replace(/^https?:\/\/(www\.)?/, '')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* ── Section: Storage & Downloads ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>STORAGE & DOWNLOADS</Text>
          <View style={styles.iosCard}>
            {/* Storage Path */}
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#FF9500' }]}>
                <Folder color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Storage Folder</Text>
                <Text style={styles.iosSubtitle}>Internal / VFlix_Movies</Text>
              </View>
              <TouchableOpacity
                style={styles.iosSmallPillBtn}
                onPress={handleRescan}
                activeOpacity={0.7}
                disabled={scanning}
              >
                <RotateCcw color="#0A84FF" size={13} strokeWidth={2.2} />
                <Text style={styles.iosSmallPillText}>
                  {scanning ? 'Scanning...' : 'Rescan'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.iosDivider} />

            {/* App Downloads Stats */}
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#0A84FF' }]}>
                <Film color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <Text style={styles.iosTitle}>Downloaded Movies</Text>
              <Text style={styles.iosValueText}>
                {formatBytes(appDownloads)} ({completedCount})
              </Text>
            </View>

            <View style={styles.iosDivider} />

            {/* Free Storage */}
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#8E8E93' }]}>
                <HardDrive color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <Text style={styles.iosTitle}>Free Device Space</Text>
              <Text style={[styles.iosValueText, { color: '#30D158' }]}>
                {formatBytes(freeDisk)} free
              </Text>
            </View>

            <View style={styles.iosDivider} />

            {/* Wi-Fi Only */}
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#0A84FF' }]}>
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

            <View style={styles.iosDivider} />

            {/* Clean Downloaded Movies Button (iOS Destructive Cell) */}
            <TouchableOpacity
              style={styles.iosDestructiveRow}
              onPress={handleClearDownloads}
              activeOpacity={0.7}
            >
              <Trash2 color="#FF453A" size={18} strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={styles.iosDestructiveText}>Clean All Downloaded Movies</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section: Browser Security & Ad Shield ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>SECURITY & AD SHIELD</Text>
          <View style={styles.iosCard}>
            <View style={styles.iosRow}>
              <View style={[styles.iosIconBox, { backgroundColor: '#30D158' }]}>
                <ShieldCheck color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <View style={styles.iosTitleGroup}>
                <Text style={styles.iosTitle}>Ad & Popup Blocker</Text>
                <Text style={styles.iosSubtitle}>Blocks 70+ ad networks & popups</Text>
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
                <Text style={styles.iosSubtitle}>Blocks background page hijacks</Text>
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

        {/* ── Section: Video Player Preferences ── */}
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
          <Text style={styles.iosSectionFooter}>
            When turned on, streams will prompt to open directly in your installed external video player.
          </Text>
        </View>

        {/* ── Section: Support & Developer ── */}
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
              <Text style={styles.iosTitle}>Donate & Support Us</Text>
              <Text style={[styles.iosValueText, { color: Colors.primary, fontWeight: '600' }]}>
                Contribute
              </Text>
              <ChevronRight color="#48484A" size={18} strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.iosDivider} />

            <TouchableOpacity
              style={styles.iosRow}
              activeOpacity={0.7}
              onPress={() => {
                if (onOpenAbout) onOpenAbout();
                else setAboutModalVisible(true);
              }}
            >
              <View style={[styles.iosIconBox, { backgroundColor: '#5856D6' }]}>
                <Info color="#FFFFFF" size={16} strokeWidth={2.2} />
              </View>
              <Text style={styles.iosTitle}>About Developer</Text>
              <Text style={styles.iosValueText}>Vignesh S</Text>
              <ChevronRight color="#48484A" size={18} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Section: Application Information ── */}
        <View style={styles.iosSection}>
          <Text style={styles.iosSectionHeader}>APPLICATION INFO</Text>
          <View style={styles.iosCard}>
            <View style={styles.iosRow}>
              <Text style={styles.iosTitle}>App Name</Text>
              <Text style={styles.iosValueText}>VFlix</Text>
            </View>
            <View style={styles.iosDivider} />

            <View style={styles.iosRow}>
              <Text style={styles.iosTitle}>Version</Text>
              <Text style={[styles.iosValueText, { color: Colors.primary, fontWeight: '600' }]}>
                v2.4.0 (57.0)
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
          </View>
        </View>
      </ScrollView>

      {/* About Us Screen Modal */}
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

      {/* Donate Us Screen Modal */}
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
    paddingTop: 8,
  },
  largeTitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.35,
  },
  // Profile Banner (Apple ID style)
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profileAvatarWrapper: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  profileSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 1,
  },
  profileEmail: {
    fontSize: 12,
    color: '#636366',
  },
  // iOS Grouped Sections
  iosSection: {
    marginBottom: 24,
  },
  iosSectionHeader: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#8E8E93',
    marginLeft: 32,
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  iosSectionFooter: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 32,
    marginRight: 24,
    marginTop: 7,
    lineHeight: 16,
  },
  iosCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
  },
  iosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 48,
    paddingVertical: 10,
  },
  iosIconBox: {
    width: 29,
    height: 29,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosTitleGroup: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  iosTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '400',
    flex: 1,
    marginLeft: 12,
  },
  iosSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 1,
  },
  iosValueText: {
    fontSize: 15,
    color: '#8E8E93',
    marginRight: 4,
  },
  iosDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#38383A',
    marginLeft: 57,
  },
  // Inputs & Custom Rows
  iosInputCardRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1C1C1E',
  },
  iosInputLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  iosTextInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
  },
  iosActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  iosPillActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  iosPillActionText: {
    color: '#0A84FF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  iosSmallPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  iosSmallPillText: {
    color: '#0A84FF',
    fontSize: 11.5,
    fontWeight: '600',
  },
  pingResultPill: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  pingResultText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
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
  presetsCardWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  presetsHeaderLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#38383A',
  },
  presetChipActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    borderColor: '#0A84FF',
  },
  presetChipText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
  },
  presetChipTextActive: {
    color: '#0A84FF',
    fontWeight: '600',
  },
  // Destructive Action Row
  iosDestructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: '#1C1C1E',
  },
  iosDestructiveText: {
    color: '#FF453A',
    fontSize: 15.5,
    fontWeight: '600',
  },
});
