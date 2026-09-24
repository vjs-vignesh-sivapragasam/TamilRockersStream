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
  CheckCircle2,
  ExternalLink,
  Heart,
  ChevronRight,
  Globe,
  Check,
  Radio,
  Activity,
  Server,
  Zap,
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

  // Real App Preferences
  const [wifiOnly, setWifiOnly] = useState(true);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [strictRedirectBlock, setStrictRedirectBlock] = useState(true);
  const [autoInterceptTorrents, setAutoInterceptTorrents] = useState(true);
  const [preferExternalPlayer, setPreferExternalPlayer] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Backend Torrent / Streaming Server State
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

  // TamilMV Configurable Source URL State
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
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Storage & Directory Card */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>INTERNAL STORAGE & MOVIES DIRECTORY</Text>

          <View style={styles.card}>
            {/* Storage directory indicator */}
            <View style={styles.directoryRow}>
              <View style={styles.folderIconBox}>
                <Folder color="#46D369" size={20} />
              </View>
              <View style={styles.directoryInfo}>
                <Text style={styles.directoryLabel}>Movie Storage Location</Text>
                <Text style={styles.directoryPath} numberOfLines={1}>
                  Internal Storage / VFlix_Movies
                </Text>
              </View>
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={handleRescan}
                activeOpacity={0.7}
                disabled={scanning}
              >
                <RotateCcw color={Colors.netflixRed} size={14} />
                <Text style={styles.rescanBtnText}>
                  {scanning ? 'Scanning...' : 'Rescan'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Storage Usage Stats */}
            <View style={styles.storageUsageBox}>
              <View style={styles.storageStatRow}>
                <Text style={styles.storageStatLabel}>App Downloaded Movies:</Text>
                <Text style={styles.storageStatValue}>
                  {formatBytes(appDownloads)} ({completedCount} files)
                </Text>
              </View>
              <View style={styles.storageStatRow}>
                <Text style={styles.storageStatLabel}>Free Storage Space:</Text>
                <Text style={[styles.storageStatValue, { color: '#46D369' }]}>
                  {formatBytes(freeDisk)}
                </Text>
              </View>
              <View style={styles.storageStatRow}>
                <Text style={styles.storageStatLabel}>Total Storage Capacity:</Text>
                <Text style={styles.storageStatValue}>{formatBytes(totalDisk)}</Text>
              </View>
            </View>

            {/* Clear Downloads Button */}
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={handleClearDownloads}
              activeOpacity={0.8}
            >
              <Trash2 color="#FF4D4D" size={16} />
              <Text style={styles.clearBtnText}>Clean Downloaded Movies</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 1.25. Torrent & Stream Server Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>TORRENT & STREAM SERVER CONFIGURATION</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconWrapper}>
                <Radio color={Colors.netflixRed} size={18} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Backend Torrent Server</Text>
                <Text style={styles.settingSubtitle}>
                  Powers background torrent downloads & HTTP range streaming
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: isBackendConnected ? 'rgba(70, 211, 105, 0.15)' : 'rgba(255, 77, 77, 0.15)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: isBackendConnected ? '#46D369' : '#FF4D4D',
                  }}
                />
                <Text
                  style={{
                    color: isBackendConnected ? '#46D369' : '#FF4D4D',
                    fontSize: 10,
                    fontWeight: '700',
                  }}
                >
                  {isBackendConnected ? 'Connected' : 'Offline'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Torrent Backend Server URL:</Text>
              <TextInput
                style={styles.textInputModern}
                placeholder="https://vflix-torrent-stream.loca.lt"
                placeholderTextColor="#555"
                value={customServerUrl}
                onChangeText={handleApplyServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Test Ping Button & Result */}
            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#28282E',
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#3A3A42',
                }}
                onPress={handleTestPing}
                disabled={pingLoading}
                activeOpacity={0.7}
              >
                {pingLoading ? (
                  <ActivityIndicator size="small" color={Colors.netflixRed} />
                ) : (
                  <Activity color={Colors.netflixRed} size={14} />
                )}
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                  {pingLoading ? 'Testing Ping...' : 'Test Server Ping'}
                </Text>
              </TouchableOpacity>

              {pingResult && (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: pingResult.ok ? 'rgba(70, 211, 105, 0.12)' : 'rgba(255, 77, 77, 0.12)',
                    borderColor: pingResult.ok ? '#46D369' : '#FF4D4D',
                    borderWidth: 0.5,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      color: pingResult.ok ? '#46D369' : '#FF4D4D',
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                    numberOfLines={1}
                  >
                    {pingResult.ok ? `🟢 ${pingResult.message}` : `🔴 ${pingResult.message}`}
                  </Text>
                </View>
              )}
            </View>

            {/* Quick Server Presets */}
            <View style={{ marginTop: 12, gap: 6 }}>
              <Text style={{ color: '#777', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>
                SERVER PRESETS:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: 'Cloud Tunnel (Live)', url: 'https://polite-glasses-bow.loca.lt' },
                  { label: 'Android Emulator', url: 'http://10.0.2.2:3000' },
                  { label: 'Local PC', url: 'http://localhost:3000' },
                ].map((item) => {
                  const isActive = customServerUrl.toLowerCase() === item.url.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={item.url}
                      onPress={() => handleApplyServerUrl(item.url)}
                      style={{
                        backgroundColor: isActive ? 'rgba(255,0,64,0.15)' : '#222228',
                        borderColor: isActive ? Colors.netflixRed : '#33333D',
                        borderWidth: 1,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive ? Colors.netflixRed : '#CCC',
                          fontSize: 10,
                          fontWeight: isActive ? '700' : '500',
                        }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* 1.5. Torrent Proxy (Debrid) */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>FAST DOWNLOAD PROXY (REAL-DEBRID)</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconWrapper}>
                <Layers color={Colors.netflixRed} size={18} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Enable Torrent Proxy</Text>
                <Text style={styles.settingSubtitle}>
                  Converts 0-peer torrents to fast direct HTTP downloads
                </Text>
              </View>
              <Switch
                value={debridEnabled}
                onValueChange={(val) => {
                  setDebridEnabled(val);
                  updateDebridConfig(val, debridKey);
                }}
                trackColor={{ false: '#333333', true: Colors.netflixRed }}
                thumbColor="#FFFFFF"
              />
            </View>
            
            {debridEnabled && (
              <>
                <View style={styles.divider} />
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Real-Debrid API Key:</Text>
                  <TextInput
                    style={styles.textInputModern}
                    placeholder="Enter your API token..."
                    placeholderTextColor="#555"
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
        </View>

        {/* 2. 1TamilMV Movie Finder Source URL Config */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>1TAMILMV SEARCH & SOURCE URL</Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconWrapper}>
                <Globe color={Colors.netflixRed} size={18} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Search Domain / Mirror</Text>
                <Text style={styles.settingSubtitle}>
                  Active site used by the Movie Finder tab
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Configured Website URL:</Text>
              <TextInput
                style={styles.textInputModern}
                placeholder="https://www.1tamilmv.lease"
                placeholderTextColor="#555"
                value={tamilMvUrl}
                onChangeText={handleUpdateTamilMvUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={{ marginTop: 10, gap: 6 }}>
              <Text style={{ color: '#777', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>
                QUICK MIRROR PRESETS:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {POPULAR_MIRRORS.slice(0, 4).map((mirror) => {
                  const isActive = tamilMvUrl.toLowerCase() === mirror.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={mirror}
                      onPress={() => handleUpdateTamilMvUrl(mirror)}
                      style={{
                        backgroundColor: isActive ? 'rgba(255,0,64,0.15)' : '#222228',
                        borderColor: isActive ? Colors.netflixRed : '#33333D',
                        borderWidth: 1,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive ? Colors.netflixRed : '#CCC',
                          fontSize: 10,
                          fontWeight: isActive ? '700' : '500',
                        }}
                      >
                        {mirror.replace('https://www.', '')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* 3. Download Manager & Network Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>DOWNLOAD & NETWORK PREFERENCES</Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconWrapper}>
                <Wifi color={Colors.netflixRed} size={18} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Download Over Wi-Fi Only</Text>
                <Text style={styles.settingSubtitle}>
                  Avoid cellular data usage for large movie downloads
                </Text>
              </View>
              <Switch
                value={wifiOnly}
                onValueChange={setWifiOnly}
                trackColor={{ false: '#333333', true: Colors.netflixRed }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingIconWrapper}>
                <Download color={Colors.netflixRed} size={18} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Auto-Intercept Torrent Links</Text>
                <Text style={styles.settingSubtitle}>
                  Instantly queue .torrent and magnet links from the browser
                </Text>
              </View>
              <Switch
                value={autoInterceptTorrents}
                onValueChange={setAutoInterceptTorrents}
                trackColor={{ false: '#333333', true: Colors.netflixRed }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* 3. Browser Ad Shield & Popup Protection */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>BROWSER & AD SHIELD SECURITY</Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconWrapper}>
                <ShieldCheck color="#46D369" size={18} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Ad & Pop-Under Blocker</Text>
                <Text style={styles.settingSubtitle}>
                  Blocks 70+ ad networks, popups, and clickjacking overlays
                </Text>
              </View>
              <Switch
                value={adBlockEnabled}
                onValueChange={setAdBlockEnabled}
                trackColor={{ false: '#333333', true: Colors.netflixRed }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingIconWrapper}>
                <ShieldCheck color="#46D369" size={18} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Strict Anti-Redirect Protection</Text>
                <Text style={styles.settingSubtitle}>
                  Prevents websites from automatically opening new tabs or redirecting
                </Text>
              </View>
              <Switch
                value={strictRedirectBlock}
                onValueChange={setStrictRedirectBlock}
                trackColor={{ false: '#333333', true: Colors.netflixRed }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* 4. Video Player Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>VIDEO PLAYER PREFERENCES</Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconWrapper}>
                <Film color={Colors.netflixRed} size={18} />
              </View>
              <View style={styles.settingTextGroup}>
                <Text style={styles.settingTitle}>Prefer External Video Player</Text>
                <Text style={styles.settingSubtitle}>
                  Launch movies directly in VLC or MX Player instead of built-in player
                </Text>
              </View>
              <Switch
                value={preferExternalPlayer}
                onValueChange={setPreferExternalPlayer}
                trackColor={{ false: '#333333', true: Colors.netflixRed }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* 5. Developer & Project Support */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>DEVELOPER & PROJECT SUPPORT</Text>

          {/* About Developer Card */}
          <TouchableOpacity
            style={styles.devCard}
            activeOpacity={0.8}
            onPress={() => {
              if (onOpenAbout) onOpenAbout();
              else setAboutModalVisible(true);
            }}
          >
            <View style={styles.devCardRow}>
              <View style={styles.devAvatarBorder}>
                <Image
                  source={require('../../assets/vignesh.jpg')}
                  style={styles.devAvatarImg}
                />
              </View>
              <View style={styles.devCardInfo}>
                <View style={styles.devNameBadgeRow}>
                  <Text style={styles.devCardName}>Vignesh S</Text>
                  <View style={styles.devRoleBadge}>
                    <Text style={styles.devRoleBadgeText}>Developer</Text>
                  </View>
                </View>
                <Text style={styles.devCardRole}>Software Engineer</Text>
                <Text style={styles.devCardEmail}>vigneshmake28@gmail.com</Text>
              </View>
              <ChevronRight color="#666666" size={20} />
            </View>
          </TouchableOpacity>

          {/* Donate Us Card */}
          <TouchableOpacity
            style={[styles.devCard, { marginTop: 10, borderColor: 'rgba(229, 9, 20, 0.4)' }]}
            activeOpacity={0.8}
            onPress={() => {
              if (onOpenDonate) onOpenDonate();
              else setDonateModalVisible(true);
            }}
          >
            <View style={styles.devCardRow}>
              <View style={styles.donateIconBox}>
                <Heart color="#FFFFFF" fill={Colors.netflixRed} size={22} />
              </View>
              <View style={styles.devCardInfo}>
                <View style={styles.devNameBadgeRow}>
                  <Text style={styles.devCardName}>Donate & Support Us</Text>
                  <View style={styles.supportBadge}>
                    <Text style={styles.supportBadgeText}>Appreciate</Text>
                  </View>
                </View>
                <Text style={styles.devCardRole}>Support Tracker Servers & Development</Text>
                <Text style={styles.devCardSubtext}>Contribute via UPI or Buy a Coffee</Text>
              </View>
              <ChevronRight color="#E50914" size={20} />
            </View>
          </TouchableOpacity>
        </View>

        {/* 6. App & Engine Information */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>APPLICATION INFO</Text>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Name</Text>
              <Text style={styles.infoValue}>VFlix</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Version</Text>
              <Text style={[styles.infoValue, { color: Colors.netflixRed, fontWeight: '700' }]}>
                v2.4.0 (Build 57.0)
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lead Engineer</Text>
              <Text style={styles.infoValue}>Vignesh S</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contact Email</Text>
              <Text style={styles.infoValue}>vigneshmake28@gmail.com</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Torrent Engine</Text>
              <Text style={styles.infoValue}>WebTorrent P2P + Resumable HTTP Seed</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>
                {Platform.OS.toUpperCase()} (Native FileSystem)
              </Text>
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
    backgroundColor: '#141414',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#262626',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  directoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  folderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(70, 211, 105, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  directoryInfo: {
    flex: 1,
    gap: 2,
  },
  directoryLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  directoryPath: {
    color: '#AAAAAA',
    fontSize: 11,
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  rescanBtnText: {
    color: Colors.netflixRed,
    fontSize: 11,
    fontWeight: '700',
  },
  storageUsageBox: {
    backgroundColor: '#161616',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  storageStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageStatLabel: {
    color: '#8E8E93',
    fontSize: 12,
  },
  storageStatValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.25)',
  },
  clearBtnText: {
    color: '#FF4D4D',
    fontSize: 12,
    fontWeight: '700',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingIconWrapper: {
    width: 32,
    alignItems: 'flex-start',
  },
  settingTextGroup: {
    flex: 1,
    paddingRight: 10,
    gap: 2,
  },
  settingTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  settingSubtitle: {
    color: '#888888',
    fontSize: 11,
    lineHeight: 15,
  },
  inputContainer: {
    backgroundColor: '#121212',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  inputLabel: {
    color: '#8E8E93',
    fontSize: 11,
    marginBottom: 4,
  },
  textInputModern: {
    color: '#FFFFFF',
    fontSize: 14,
    paddingVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  infoLabel: {
    color: '#8E8E93',
    fontSize: 13,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  devCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  devCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  devAvatarBorder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: Colors.netflixRed,
    padding: 2,
    backgroundColor: '#000000',
  },
  devAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  donateIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 9, 20, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devCardInfo: {
    flex: 1,
    gap: 2,
  },
  devNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devCardName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  devRoleBadge: {
    backgroundColor: 'rgba(70, 211, 105, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(70, 211, 105, 0.3)',
  },
  devRoleBadgeText: {
    color: '#46D369',
    fontSize: 10,
    fontWeight: '700',
  },
  supportBadge: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.4)',
  },
  supportBadgeText: {
    color: '#FF6B6B',
    fontSize: 10,
    fontWeight: '700',
  },
  devCardRole: {
    color: '#D0D0D0',
    fontSize: 12,
    fontWeight: '600',
  },
  devCardEmail: {
    color: '#8E8E93',
    fontSize: 11,
  },
  devCardSubtext: {
    color: '#AAAAAA',
    fontSize: 11,
  },
});
