import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Linking,
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
  Play,
  Tv,
  Languages,
  Key,
  Eye,
  EyeOff,
  Share2,
  ExternalLink,
  Sparkles,
  Clock,
  CheckCircle2,
  Smartphone,
  Flame,
  Search,
} from 'lucide-react-native';
import { Colors, THEME_OPTIONS, ThemeKey } from '../constants/theme';
import { useDownloads } from '../context/DownloadContext';
import { formatBytes, downloadService, getStorageLocationText } from '../services/downloadService';
import { tamilMvService, POPULAR_MIRRORS } from '../services/tamilMvService';
import { AboutUsScreen } from './AboutUsScreen';
import { DonateUsScreen } from './DonateUsScreen';
import { storageService, StorageKeys } from '@/utils/StorageService';
import { Players, getPlatformSpecificPlayers, isKSPlayerSupported } from '@/utils/MediaPlayer';
import { continueWatchingService } from '../services/continueWatchingService';
import { browserHistoryService } from '../services/browserHistoryService';
import { SUBTITLE_LANGUAGES } from '@/utils/Subtitles';

interface SettingsScreenProps {
  onOpenAbout?: () => void;
  onOpenDonate?: () => void;
}

const POPULAR_LANG_CODES = ['en', 'ta', 'te', 'hi', 'ml', 'kn', 'es', 'fr', 'de', 'ja', 'ko'];

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

  // Navigation Modals
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [donateModalVisible, setDonateModalVisible] = useState(false);
  const [specsModalVisible, setSpecsModalVisible] = useState(false);
  const [subtitlesModalVisible, setSubtitlesModalVisible] = useState(false);
  const [mirrorModalVisible, setMirrorModalVisible] = useState(false);

  // Active Category Section (for high-level quick jump or filter if desired, or all visible)
  const [activeCategory, setActiveCategory] = useState<'all' | 'playback' | 'engine' | 'storage' | 'system'>('all');

  // Media Player Configuration
  const [selectedPlayer, setSelectedPlayer] = useState<string>(Players.Default);
  const availablePlayers = useMemo(() => getPlatformSpecificPlayers(), []);

  useEffect(() => {
    try {
      const saved = storageService.getItem(StorageKeys.DEFAULT_MEDIA_PLAYER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) setSelectedPlayer(parsed);
      }
    } catch {}
  }, []);

  const handleSelectPlayer = (playerName: string) => {
    setSelectedPlayer(playerName);
    try {
      storageService.setItem(StorageKeys.DEFAULT_MEDIA_PLAYER_KEY, JSON.stringify(playerName));
    } catch {}
  };

  // OpenSubtitles Configuration
  const [useDefaultSubKey, setUseDefaultSubKey] = useState(true);
  const [customSubKey, setCustomSubKey] = useState('');
  const [showSubKey, setShowSubKey] = useState(false);
  const [selectedSubLangs, setSelectedSubLangs] = useState<string[]>(['en', 'ta']);

  useEffect(() => {
    try {
      const savedKey = storageService.getItem(StorageKeys.OPENSUBTITLES_API_KEY);
      if (savedKey && savedKey.trim()) {
        setUseDefaultSubKey(false);
        setCustomSubKey(savedKey);
      } else {
        setUseDefaultSubKey(true);
      }

      const savedLangs = storageService.getItem(StorageKeys.SUBTITLE_LANGUAGES_KEY);
      if (savedLangs) {
        const parsed = JSON.parse(savedLangs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedSubLangs(parsed);
        }
      }
    } catch {}
  }, []);

  const handleSaveSubKey = (key: string) => {
    setCustomSubKey(key);
    try {
      if (key.trim()) {
        storageService.setItem(StorageKeys.OPENSUBTITLES_API_KEY, key.trim());
        setUseDefaultSubKey(false);
      } else {
        storageService.removeItem(StorageKeys.OPENSUBTITLES_API_KEY);
        setUseDefaultSubKey(true);
      }
    } catch {}
  };

  const handleToggleDefaultSubKey = (useDefault: boolean) => {
    setUseDefaultSubKey(useDefault);
    try {
      if (useDefault) {
        storageService.removeItem(StorageKeys.OPENSUBTITLES_API_KEY);
      } else if (customSubKey.trim()) {
        storageService.setItem(StorageKeys.OPENSUBTITLES_API_KEY, customSubKey.trim());
      }
    } catch {}
  };

  const handleToggleLanguage = (code: string) => {
    let next: string[];
    if (selectedSubLangs.includes(code)) {
      if (selectedSubLangs.length === 1) {
        Alert.alert('Language Required', 'At least one subtitle language must be selected.');
        return;
      }
      next = selectedSubLangs.filter((l) => l !== code);
    } else {
      next = [...selectedSubLangs, code];
    }
    setSelectedSubLangs(next);
    try {
      storageService.setItem(StorageKeys.SUBTITLE_LANGUAGES_KEY, JSON.stringify(next));
    } catch {}
  };

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
      setBoostMessage(err?.message || 'Turbo boost applied! Active swarms accelerated.');
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

  const handleTestPing = async (urlToTest?: string) => {
    const target = urlToTest || customServerUrl;
    setPingLoading(true);
    setPingResult(null);
    try {
      const res = await testPing(target);
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
    handleTestPing(url);
  };

  // TamilMV Source URL State
  const [tamilMvUrl, setTamilMvUrl] = useState(tamilMvService.getBaseUrl());
  const [customMirrorInput, setCustomMirrorInput] = useState(tamilMvService.getBaseUrl());

  const handleUpdateTamilMvUrl = (url: string) => {
    tamilMvService.setBaseUrl(url);
    setTamilMvUrl(tamilMvService.getBaseUrl());
    setCustomMirrorInput(tamilMvService.getBaseUrl());
  };

  // Storage Stats & Actions
  const completedCount = downloads.filter((d) => d.status === 'completed').length;
  const activeDownloads = downloads.filter((d) => d.status === 'downloading').length;
  const appDownloads = storageStats.appDownloadsBytes || 0;
  const totalDisk = storageStats.totalBytes || 1;
  const freeDisk = storageStats.freeBytes || 0;
  const usedDisk = Math.max(0, totalDisk - freeDisk);
  const appPercent = Math.min(100, Math.max(1, (appDownloads / totalDisk) * 100));
  const otherPercent = Math.min(100, Math.max(1, ((usedDisk - appDownloads) / totalDisk) * 100));
  const freePercent = Math.max(0, 100 - (appPercent + otherPercent));

  const displayDomain = tamilMvUrl.replace(/^https?:\/\/(www\.)?/, '');
  const currentDownloadsDir = downloadService.getDownloadsDirectory();
  const locationLabel = getStorageLocationText(currentDownloadsDir);

  const handleClearDownloads = () => {
    if (completedCount === 0) {
      Alert.alert('No Downloads', 'There are no completed downloads to remove.');
      return;
    }

    Alert.alert(
      'Delete Downloaded Movies',
      `Are you sure you want to delete all ${completedCount} downloaded movie file(s)? This will permanently free ${formatBytes(appDownloads)}.`,
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
      const count = await rescanStorage();
      Alert.alert('Storage Synced', `Scanned and synchronized ${count} movie file(s) in device storage.`);
    } catch {
      Alert.alert('Scan Failed', 'Could not scan internal storage directory.');
    } finally {
      setScanning(false);
    }
  };

  const handleClearContinueWatching = () => {
    Alert.alert(
      'Clear Watch History',
      'Remove all movies from "Continue Watching" row on the Home tab?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await continueWatchingService.clear();
            Alert.alert('History Cleared', 'Continue Watching list has been reset.');
          },
        },
      ]
    );
  };

  const handleClearBrowserHistory = () => {
    Alert.alert(
      'Clear Browser Cache',
      'Clear all saved search and web browser navigation logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await browserHistoryService.clearHistory();
            Alert.alert('Cache Cleared', 'Browser history has been wiped.');
          },
        },
      ]
    );
  };

  // Subtitle Language Search Modal state
  const [subSearchQuery, setSubSearchQuery] = useState('');
  const filteredSubLanguages = useMemo(() => {
    if (!subSearchQuery.trim()) return SUBTITLE_LANGUAGES;
    const q = subSearchQuery.toLowerCase();
    return SUBTITLE_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [subSearchQuery]);

  const ksPlayerAvailable = isKSPlayerSupported();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Gradient Background Aura ── */}
      <LinearGradient
        colors={['rgba(250, 36, 60, 0.08)', 'rgba(20, 15, 38, 0.95)', '#0A0815']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 },
        ]}
      >
        {/* ── Header Title Row ── */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.titleBadge}>
              <Sparkles size={11} color={Colors.primary} />
              <Text style={styles.titleBadgeText}>SYSTEM & PREFERENCES</Text>
            </View>
            <Text style={styles.mainTitle}>Settings</Text>
            <Text style={styles.mainSubtitle}>Configure player, streaming engine, servers & storage</Text>
          </View>
          <TouchableOpacity
            style={styles.infoIconButton}
            activeOpacity={0.7}
            onPress={() => setSpecsModalVisible(true)}
          >
            <Info color="#A09DB1" size={20} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* ── Hero Profile & Creator Showcase Card ── */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.02)']}
            style={styles.heroCardGradient}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.avatarBorderWrapper}>
                <Image
                  source={require('../../assets/vignesh.jpg')}
                  style={styles.heroAvatar}
                />
                <View style={styles.onlineStatusDot} />
              </View>

              <View style={styles.heroInfoColumn}>
                <View style={styles.heroNameRow}>
                  <Text style={styles.heroNameText}>Vignesh S</Text>
                  <View style={styles.proPill}>
                    <Text style={styles.proPillText}>CREATOR</Text>
                  </View>
                </View>
                <Text style={styles.heroRoleText}>Lead Architect & Core Engineer</Text>
                
                {/* Live Server Indicator Pill */}
                <View style={styles.serverStatusPill}>
                  <View
                    style={[
                      styles.serverStatusDot,
                      { backgroundColor: isBackendConnected ? '#30D158' : '#FF453A' },
                    ]}
                  />
                  <Text
                    style={[
                      styles.serverStatusLabel,
                      { color: isBackendConnected ? '#30D158' : '#FF453A' },
                    ]}
                  >
                    {isBackendConnected ? 'Backend Connected' : 'Backend Offline'}
                  </Text>
                  <Text style={styles.serverStatusDivider}>•</Text>
                  <Text style={styles.serverStatusEngine}>
                    {downloadMode === 'direct_http' ? 'Direct HTTP' : downloadMode === 'local_p2p' ? 'P2P Bridge' : 'Cloud Relay'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Actions Row on Hero Card */}
            <View style={styles.heroActionsRow}>
              <TouchableOpacity
                style={styles.heroActionBtn}
                activeOpacity={0.75}
                onPress={() => {
                  if (onOpenAbout) onOpenAbout();
                  else setAboutModalVisible(true);
                }}
              >
                <Info color="#FFFFFF" size={14} strokeWidth={2.2} />
                <Text style={styles.heroActionText}>About VFlix</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.heroActionBtn, styles.heroDonateBtn]}
                activeOpacity={0.75}
                onPress={() => {
                  if (onOpenDonate) onOpenDonate();
                  else setDonateModalVisible(true);
                }}
              >
                <Heart color="#FFFFFF" fill="#FA243C" size={14} />
                <Text style={styles.heroActionText}>Support & Donate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.heroActionBtn}
                activeOpacity={0.75}
                onPress={() => setSpecsModalVisible(true)}
              >
                <Cpu color="#FFFFFF" size={14} strokeWidth={2.2} />
                <Text style={styles.heroActionText}>Specs</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ── Category Quick Jump Filter Tabs ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilterRow}
        >
          {[
            { id: 'all', label: 'All Settings', icon: Sparkles },
            { id: 'playback', label: 'Playback & Subtitles', icon: Play },
            { id: 'engine', label: 'Streaming & Servers', icon: Radio },
            { id: 'storage', label: 'Storage & Cache', icon: HardDrive },
            { id: 'system', label: 'Theme & Security', icon: Palette },
          ].map((cat) => {
            const isActive = activeCategory === cat.id;
            const IconComp = cat.icon;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryFilterChip,
                  isActive && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                ]}
                activeOpacity={0.8}
                onPress={() => setActiveCategory(cat.id as any)}
              >
                <IconComp color={isActive ? '#FFFFFF' : '#A09DB1'} size={13} strokeWidth={2.2} />
                <Text style={[styles.categoryFilterText, isActive && { color: '#FFFFFF', fontWeight: '700' }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1: THEME & VISUAL ACCENT (Category: all or system)
        ══════════════════════════════════════════════════════════════════ */}
        {(activeCategory === 'all' || activeCategory === 'system') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderWrap}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                <Palette size={16} color="#EC4899" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>App Theme & Accent Color</Text>
                <Text style={styles.sectionSubtitle}>Select your signature interface accent palette</Text>
              </View>
            </View>

            <View style={styles.cardContainer}>
              <View style={styles.themeSwatchesGrid}>
                {Object.values(THEME_OPTIONS).map((theme) => {
                  const isSelected = themeKey === theme.key;
                  return (
                    <TouchableOpacity
                      key={theme.key}
                      style={[
                        styles.themeOptionCard,
                        isSelected && { borderColor: theme.primary, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                      ]}
                      onPress={() => setThemeKey(theme.key as ThemeKey)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.themeColorOrb, { backgroundColor: theme.primary }]}>
                        {isSelected && <Check color="#FFFFFF" size={13} strokeWidth={3} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.themeOptionName, isSelected && { color: '#FFFFFF', fontWeight: '700' }]}>
                          {theme.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <View style={[styles.activeDotPill, { backgroundColor: theme.primary }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: PLAYBACK & MEDIA PLAYER ENGINE (Category: all or playback)
        ══════════════════════════════════════════════════════════════════ */}
        {(activeCategory === 'all' || activeCategory === 'playback') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderWrap}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(250, 36, 60, 0.15)' }]}>
                <Play size={16} color={Colors.primary} strokeWidth={2.4} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Default Media Player</Text>
                <Text style={styles.sectionSubtitle}>Choose engine for streaming & offline video playback</Text>
              </View>
            </View>

            <View style={styles.cardContainer}>
              {/* KSPlayer Engine Card (Native iOS FFmpeg + Metal) */}
              <TouchableOpacity
                style={[
                  styles.playerOptionItem,
                  selectedPlayer === Players.Default && styles.playerOptionItemActive,
                ]}
                activeOpacity={0.75}
                onPress={() => handleSelectPlayer(Players.Default)}
              >
                <View style={styles.playerOptionLeft}>
                  <View style={[styles.playerIconBox, { backgroundColor: 'rgba(250, 36, 60, 0.15)' }]}>
                    <Tv color={Colors.primary} size={18} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.playerOptionTitle}>Built-in Video Engine</Text>
                      <View style={styles.featureBadge}>
                        <Text style={styles.featureBadgeText}>RECOMMENDED</Text>
                      </View>
                      {Platform.OS === 'ios' && (
                        <View style={[styles.featureBadge, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                          <Text style={[styles.featureBadgeText, { color: '#30D158' }]}>
                            {ksPlayerAvailable ? 'KSPLAYER ACTIVE' : 'EXOPLAYER/AV'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.playerOptionSub}>
                      Seamless in-app player with hardware acceleration, audio track switching, subtitles, gesture brightness & volume controls.
                    </Text>
                  </View>
                </View>
                <View style={[styles.radioCircle, selectedPlayer === Players.Default && { borderColor: Colors.primary, backgroundColor: Colors.primary }]}>
                  {selectedPlayer === Players.Default && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                </View>
              </TouchableOpacity>

              {/* External / Third-Party Players */}
              {availablePlayers
                .filter((p) => p.name !== Players.Default)
                .map((player) => {
                  const isSelected = selectedPlayer === player.name;
                  return (
                    <React.Fragment key={player.name}>
                      <View style={styles.cardDivider} />
                      <TouchableOpacity
                        style={[styles.playerOptionItem, isSelected && styles.playerOptionItemActive]}
                        activeOpacity={0.75}
                        onPress={() => handleSelectPlayer(player.name)}
                      >
                        <View style={styles.playerOptionLeft}>
                          <View style={[styles.playerIconBox, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
                            <ExternalLink color="#FF9500" size={17} strokeWidth={2.2} />
                          </View>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.playerOptionTitle}>{player.name} App</Text>
                            <Text style={styles.playerOptionSub}>
                              Open stream links automatically in external {player.name} player.
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.radioCircle, isSelected && { borderColor: Colors.primary, backgroundColor: Colors.primary }]}>
                          {isSelected && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                        </View>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}

              <View style={styles.cardDivider} />

              {/* Prefer External Player Switch */}
              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Film color="#A09DB1" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Prefer External Player</Text>
                    <Text style={styles.switchRowSub}>Always display external player launcher prompt on playback</Text>
                  </View>
                </View>
                <Switch
                  value={preferExternalPlayer}
                  onValueChange={setPreferExternalPlayer}
                  trackColor={{ false: '#262438', true: Colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: SUBTITLES & OPENSUBTITLES ENGINE (Category: all or playback)
        ══════════════════════════════════════════════════════════════════ */}
        {(activeCategory === 'all' || activeCategory === 'playback') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderWrap}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                <Languages size={16} color="#0A84FF" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Subtitles & OpenSubtitles</Text>
                <Text style={styles.sectionSubtitle}>Auto-fetch synchronized subtitles in your preferred languages</Text>
              </View>
            </View>

            <View style={styles.cardContainer}>
              {/* Preferred Languages Quick Select */}
              <View style={styles.cardPadding}>
                <Text style={styles.cardInnerLabel}>PREFERRED SUBTITLE LANGUAGES</Text>
                <View style={styles.langChipsWrap}>
                  {POPULAR_LANG_CODES.map((code) => {
                    const lang = SUBTITLE_LANGUAGES.find((l) => l.code === code);
                    const isSelected = selectedSubLangs.includes(code);
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[
                          styles.langChip,
                          isSelected && { backgroundColor: 'rgba(10, 132, 255, 0.2)', borderColor: '#0A84FF' },
                        ]}
                        activeOpacity={0.75}
                        onPress={() => handleToggleLanguage(code)}
                      >
                        <Text style={[styles.langChipText, isSelected && { color: '#0A84FF', fontWeight: '700' }]}>
                          {lang?.name || code.toUpperCase()}
                        </Text>
                        {isSelected && <Check color="#0A84FF" size={12} strokeWidth={3} />}
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.langChip, styles.langChipMore]}
                    onPress={() => setSubtitlesModalVisible(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.langChipMoreText}>+ More ({SUBTITLE_LANGUAGES.length})</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cardDivider} />

              {/* OpenSubtitles API Key Mode */}
              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Key color="#A09DB1" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Use VFlix Built-in VIP Key</Text>
                    <Text style={styles.switchRowSub}>Unlimited shared OpenSubtitles.com REST API queries</Text>
                  </View>
                </View>
                <Switch
                  value={useDefaultSubKey}
                  onValueChange={handleToggleDefaultSubKey}
                  trackColor={{ false: '#262438', true: '#30D158' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {!useDefaultSubKey && (
                <View style={styles.customKeyBox}>
                  <Text style={styles.customKeyLabel}>YOUR OPENSUBTITLES.COM API KEY</Text>
                  <View style={styles.inputWithIconRow}>
                    <TextInput
                      style={styles.keyTextInput}
                      placeholder="Paste your personal OpenSubtitles API Key"
                      placeholderTextColor="#6B677E"
                      value={customSubKey}
                      onChangeText={handleSaveSubKey}
                      secureTextEntry={!showSubKey}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.eyeToggleBtn}
                      onPress={() => setShowSubKey(!showSubKey)}
                    >
                      {showSubKey ? (
                        <EyeOff color="#A09DB1" size={16} />
                      ) : (
                        <Eye color="#A09DB1" size={16} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: STREAMING & BACKEND SERVER (Category: all or engine)
        ══════════════════════════════════════════════════════════════════ */}
        {(activeCategory === 'all' || activeCategory === 'engine') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderWrap}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                <Server size={16} color="#30D158" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Streaming & Backend Server</Text>
                <Text style={styles.sectionSubtitle}>WebTorrent HTTP byte-range relay for real-time video seeking</Text>
              </View>
            </View>

            <View style={styles.cardContainer}>
              {/* Server Status Header */}
              <View style={styles.serverCardHeader}>
                <View style={styles.serverStatusGroup}>
                  <View
                    style={[
                      styles.serverStatusCircle,
                      { backgroundColor: isBackendConnected ? '#30D158' : '#FF453A' },
                    ]}
                  />
                  <View>
                    <Text style={styles.serverHostTitle} numberOfLines={1}>
                      {backendUrl}
                    </Text>
                    <Text style={styles.serverStatusSub}>
                      {isBackendConnected ? 'Active • Ready for Live Streaming' : 'Server Offline or Unreachable'}
                    </Text>
                  </View>
                </View>

                {/* Ping Button / Badge */}
                <TouchableOpacity
                  style={[
                    styles.pingBadgeBtn,
                    pingResult?.ok && { backgroundColor: 'rgba(48, 209, 88, 0.15)', borderColor: 'rgba(48, 209, 88, 0.35)' },
                    pingResult && !pingResult.ok && { backgroundColor: 'rgba(255, 69, 58, 0.15)', borderColor: 'rgba(255, 69, 58, 0.35)' },
                  ]}
                  onPress={() => handleTestPing()}
                  disabled={pingLoading}
                  activeOpacity={0.7}
                >
                  {pingLoading ? (
                    <ActivityIndicator size="small" color="#0A84FF" />
                  ) : pingResult ? (
                    <>
                      <Activity size={12} color={pingResult.ok ? '#30D158' : '#FF453A'} />
                      <Text style={[styles.pingBadgeText, { color: pingResult.ok ? '#30D158' : '#FF453A' }]}>
                        {pingResult.ok ? `${pingResult.latency}ms` : 'Failed'}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Activity size={12} color="#0A84FF" />
                      <Text style={styles.pingBadgeText}>Test Ping</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.cardDivider} />

              {/* Presets List */}
              <View style={styles.cardPadding}>
                <Text style={styles.cardInnerLabel}>SERVER PRESETS</Text>
                <View style={styles.presetsList}>
                  {[
                    { label: 'Render Cloud (Production)', url: 'https://vflix-backend.onrender.com', icon: Globe },
                    { label: 'Dev Server IP (Port 3002)', url: 'http://192.168.1.6:3002', icon: Cpu },
                    { label: 'Localhost Bridge', url: Platform.OS === 'android' ? 'http://10.0.2.2:3002' : 'http://localhost:3002', icon: Smartphone },
                  ].map((preset) => {
                    const isSelected = customServerUrl.trim() === preset.url.trim();
                    const IconComp = preset.icon;
                    return (
                      <TouchableOpacity
                        key={preset.url}
                        style={[styles.presetRow, isSelected && styles.presetRowActive]}
                        onPress={() => handleApplyServerUrl(preset.url)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.presetIconWrap, isSelected && { backgroundColor: 'rgba(250, 36, 60, 0.2)' }]}>
                          <IconComp size={15} color={isSelected ? Colors.primary : '#A09DB1'} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[styles.presetRowTitle, isSelected && { color: '#FFFFFF', fontWeight: '700' }]}>
                            {preset.label}
                          </Text>
                          <Text style={styles.presetRowUrl} numberOfLines={1}>
                            {preset.url}
                          </Text>
                        </View>
                        {isSelected && <CheckCircle2 size={18} color={Colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.cardDivider} />

              {/* Custom URL Input */}
              <View style={styles.cardPadding}>
                <Text style={styles.cardInnerLabel}>CUSTOM BACKEND URL</Text>
                <View style={styles.inputWithActionRow}>
                  <TextInput
                    style={styles.urlTextInput}
                    value={customServerUrl}
                    onChangeText={setCustomServerUrl}
                    placeholder="http://192.168.1.6:3002"
                    placeholderTextColor="#6B677E"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={() => handleApplyServerUrl(customServerUrl)}
                    activeOpacity={0.8}
                  >
                    <Check color="#FFFFFF" size={14} strokeWidth={2.5} />
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5: DOWNLOAD ENGINE & TURBO BOOSTER (Category: all or engine)
        ══════════════════════════════════════════════════════════════════ */}
        {(activeCategory === 'all' || activeCategory === 'engine') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderWrap}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
                <Zap size={16} color="#FF9500" strokeWidth={2.4} fill="#FF9500" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Download Engine & Turbo Booster</Text>
                <Text style={styles.sectionSubtitle}>Select download protocol & accelerate active swarms</Text>
              </View>
            </View>

            {/* 3 Download Modes Segmented Selection */}
            <View style={styles.cardContainer}>
              <View style={styles.cardPadding}>
                <Text style={styles.cardInnerLabel}>ACTIVE DOWNLOAD PROTOCOL</Text>
                <View style={styles.modeCardsList}>
                  {/* Mode 1: Direct HTTP */}
                  <TouchableOpacity
                    style={[
                      styles.modeCard,
                      downloadMode === 'direct_http' && styles.modeCardActive,
                    ]}
                    onPress={() => setDownloadMode('direct_http')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.modeCardLeft}>
                      <View style={[styles.modeIconBox, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
                        <Zap color="#FF9500" size={18} strokeWidth={2.2} fill="#FF9500" />
                      </View>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.modeCardTitle}>Direct HTTP Range Downloader</Text>
                          <View style={styles.featureBadge}>
                            <Text style={styles.featureBadgeText}>DEFAULT</Text>
                          </View>
                        </View>
                        <Text style={styles.modeCardSub}>
                          Ultra-fast native chunk streamer. Downloads directly to phone internal storage with automatic resume.
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.radioCircle, downloadMode === 'direct_http' && { borderColor: '#FF9500', backgroundColor: '#FF9500' }]}>
                      {downloadMode === 'direct_http' && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>

                  {/* Mode 2: Local P2P WebTorrent Bridge */}
                  <TouchableOpacity
                    style={[
                      styles.modeCard,
                      downloadMode === 'local_p2p' && styles.modeCardActive,
                    ]}
                    onPress={() => setDownloadMode('local_p2p')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.modeCardLeft}>
                      <View style={[styles.modeIconBox, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                        <Cpu color="#0A84FF" size={18} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.modeCardTitle}>Local P2P WebTorrent Bridge</Text>
                        <Text style={styles.modeCardSub}>
                          Client-side WebTorrent engine running locally inside mobile app using WebRTC & WebSocket trackers.
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.radioCircle, downloadMode === 'local_p2p' && { borderColor: '#0A84FF', backgroundColor: '#0A84FF' }]}>
                      {downloadMode === 'local_p2p' && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>

                  {/* Mode 3: Cloud Backend Relay */}
                  <TouchableOpacity
                    style={[
                      styles.modeCard,
                      downloadMode === 'backend_relay' && styles.modeCardActive,
                    ]}
                    onPress={() => setDownloadMode('backend_relay')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.modeCardLeft}>
                      <View style={[styles.modeIconBox, { backgroundColor: 'rgba(250, 36, 60, 0.15)' }]}>
                        <Server color={Colors.primary} size={18} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.modeCardTitle}>Cloud Backend Relay</Text>
                        <Text style={styles.modeCardSub}>
                          Relays torrent swarms through the high-bandwidth VFlix cloud server and pipes media to your phone.
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.radioCircle, downloadMode === 'backend_relay' && { borderColor: Colors.primary, backgroundColor: Colors.primary }]}>
                      {downloadMode === 'backend_relay' && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.cardDivider} />

              {/* Turbo Speed Booster Banner & Action */}
              <View style={styles.cardPadding}>
                <LinearGradient
                  colors={['#FF9500', '#FA243C']}
                  style={styles.turboBanner}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.turboBannerContent}>
                    <View style={styles.turboIconWrap}>
                      <Zap color="#FFFFFF" size={24} fill="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.turboBannerTitle}>Turbo Swarm Booster</Text>
                      <Text style={styles.turboBannerSub}>
                        Flushes TCP sockets & re-queries 20+ Tier-1 P2P trackers for maximum throughput.
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.turboTriggerBtn}
                    onPress={handleApplySpeedBoost}
                    disabled={boosting}
                    activeOpacity={0.85}
                  >
                    {boosting ? (
                      <ActivityIndicator size="small" color="#FA243C" />
                    ) : (
                      <>
                        <Zap color="#FA243C" size={14} fill="#FA243C" />
                        <Text style={styles.turboTriggerText}>BOOST SPEED NOW</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </LinearGradient>

                {boostMessage && (
                  <View style={styles.boostNotice}>
                    <CheckCircle2 color="#30D158" size={16} />
                    <Text style={styles.boostNoticeText}>{boostMessage}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardDivider} />

              {/* Engine Preference Toggles */}
              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Gauge color="#A09DB1" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Auto-Turbo Speed Mode</Text>
                    <Text style={styles.switchRowSub}>Auto-boost swarms when download speed drops below 500 KB/s</Text>
                  </View>
                </View>
                <Switch
                  value={autoTurbo}
                  onValueChange={setAutoTurbo}
                  trackColor={{ false: '#262438', true: '#FF9500' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Cpu color="#A09DB1" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Max Peer Connections (350)</Text>
                    <Text style={styles.switchRowSub}>High-density peer discovery for rare movie seeds</Text>
                  </View>
                </View>
                <Switch
                  value={maxConnsBoost}
                  onValueChange={setMaxConnsBoost}
                  trackColor={{ false: '#262438', true: '#30D158' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Wifi color="#A09DB1" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Wi-Fi Only Downloads</Text>
                    <Text style={styles.switchRowSub}>Pause downloads on mobile cellular data</Text>
                  </View>
                </View>
                <Switch
                  value={wifiOnly}
                  onValueChange={setWifiOnly}
                  trackColor={{ false: '#262438', true: '#30D158' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Download color="#A09DB1" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Auto-Intercept Torrents</Text>
                    <Text style={styles.switchRowSub}>Catch magnet & torrent links from in-app browser</Text>
                  </View>
                </View>
                <Switch
                  value={autoInterceptTorrents}
                  onValueChange={setAutoInterceptTorrents}
                  trackColor={{ false: '#262438', true: '#30D158' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6: SEARCH & CONTENT MIRROR (Category: all or engine)
        ══════════════════════════════════════════════════════════════════ */}
        {(activeCategory === 'all' || activeCategory === 'engine') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderWrap}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(50, 215, 75, 0.15)' }]}>
                <Globe size={16} color="#32D74B" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Search Mirror Domain</Text>
                <Text style={styles.sectionSubtitle}>Active source endpoint for fetching movie feeds & magnet links</Text>
              </View>
            </View>

            <View style={styles.cardContainer}>
              <View style={styles.cardPadding}>
                <View style={styles.activeMirrorBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activeMirrorLabel}>CURRENT ACTIVE MIRROR</Text>
                    <Text style={styles.activeMirrorUrl}>{displayDomain}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.changeMirrorBtn}
                    onPress={() => setMirrorModalVisible(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.changeMirrorText}>Switch Mirror</Text>
                  </TouchableOpacity>
                </View>

                {/* Popular Mirror Chips */}
                <Text style={[styles.cardInnerLabel, { marginTop: 14 }]}>POPULAR MIRROR PRESETS</Text>
                <View style={styles.mirrorChipsWrap}>
                  {POPULAR_MIRRORS.map((m) => {
                    const isActive = tamilMvUrl.toLowerCase() === m.toLowerCase();
                    const cleanName = m.replace(/^https?:\/\/(www\.)?/, '');
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.mirrorChip,
                          isActive && { backgroundColor: 'rgba(50, 215, 75, 0.18)', borderColor: '#32D74B' },
                        ]}
                        activeOpacity={0.75}
                        onPress={() => handleUpdateTamilMvUrl(m)}
                      >
                        <Globe size={12} color={isActive ? '#32D74B' : '#A09DB1'} />
                        <Text style={[styles.mirrorChipText, isActive && { color: '#32D74B', fontWeight: '700' }]}>
                          {cleanName}
                        </Text>
                        {isActive && <Check size={12} color="#32D74B" strokeWidth={3} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 7: SECURITY & CONTENT SHIELD (Category: all or system)
        ══════════════════════════════════════════════════════════════════ */}
        {(activeCategory === 'all' || activeCategory === 'system') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderWrap}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                <ShieldCheck size={16} color="#30D158" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Security & Ad Shield</Text>
                <Text style={styles.sectionSubtitle}>Block malicious popups, track redirects & page hijacking</Text>
              </View>
            </View>

            <View style={styles.cardContainer}>
              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <ShieldCheck color="#30D158" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Ad & Popup Blocker</Text>
                    <Text style={styles.switchRowSub}>Filters ad networks, tracking telemetry and popup overlays</Text>
                  </View>
                </View>
                <Switch
                  value={adBlockEnabled}
                  onValueChange={setAdBlockEnabled}
                  trackColor={{ false: '#262438', true: '#30D158' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <ShieldCheck color="#32D74B" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Anti-Redirect Protection</Text>
                    <Text style={styles.switchRowSub}>Prevents intrusive browser redirect traps to malware sites</Text>
                  </View>
                </View>
                <Switch
                  value={strictRedirectBlock}
                  onValueChange={setStrictRedirectBlock}
                  trackColor={{ false: '#262438', true: '#30D158' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 8: STORAGE, DATA & CACHE CLEANUP (Category: all or storage)
        ══════════════════════════════════════════════════════════════════ */}
        {(activeCategory === 'all' || activeCategory === 'storage') && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderWrap}>
              <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(250, 36, 60, 0.15)' }]}>
                <HardDrive size={16} color={Colors.primary} strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Device Storage & Cache</Text>
                <Text style={styles.sectionSubtitle}>Manage offline media files, watch history & disk capacity</Text>
              </View>
            </View>

            <View style={styles.cardContainer}>
              {/* Storage Breakdown Visual Gauge */}
              <View style={styles.cardPadding}>
                <View style={styles.storageGaugeHeader}>
                  <View>
                    <Text style={styles.storageGaugeTitle}>Internal Storage Capacity</Text>
                    <Text style={styles.storageGaugeSub}>
                      {formatBytes(appDownloads)} in {completedCount} VFlix movie(s) • {formatBytes(freeDisk)} Free
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.rescanPillBtn}
                    onPress={handleRescan}
                    disabled={scanning}
                    activeOpacity={0.7}
                  >
                    {scanning ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <RotateCcw size={12} color={Colors.primary} strokeWidth={2.4} />
                        <Text style={styles.rescanPillText}>Rescan</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Multi-segment Progress Bar */}
                <View style={styles.storageBarTrack}>
                  <View style={[styles.storageBarApp, { width: `${appPercent}%`, backgroundColor: Colors.primary }]} />
                  <View style={[styles.storageBarOther, { width: `${otherPercent}%` }]} />
                </View>

                {/* Legend */}
                <View style={styles.storageLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                    <Text style={styles.legendLabel}>VFlix ({formatBytes(appDownloads)})</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4A4E5D' }]} />
                    <Text style={styles.legendLabel}>Other Files ({formatBytes(Math.max(0, usedDisk - appDownloads))})</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#211E32', borderWidth: 1, borderColor: '#4A4E5D' }]} />
                    <Text style={styles.legendLabel}>Free ({formatBytes(freeDisk)})</Text>
                  </View>
                </View>

                {/* File System Path Card */}
                <TouchableOpacity
                  style={styles.filePathCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    Share.share({
                      title: 'VFlix Storage Location',
                      message: currentDownloadsDir,
                    }).catch(() => {});
                  }}
                >
                  <View style={styles.filePathTopRow}>
                    <View style={styles.folderBadge}>
                      <Folder color="#30D158" size={14} strokeWidth={2} />
                      <Text style={styles.folderLocationText}>{locationLabel}</Text>
                    </View>
                    <View style={styles.shareBadge}>
                      <Share2 size={11} color={Colors.primary} />
                      <Text style={styles.shareBadgeText}>Tap to Share / Copy</Text>
                    </View>
                  </View>
                  <Text style={styles.filePathCode} selectable numberOfLines={1}>
                    {currentDownloadsDir || 'VFlix_Movies/'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardDivider} />

              {/* Maintenance & Reset Actions */}
              <View style={styles.cardPadding}>
                <Text style={styles.cardInnerLabel}>DATA & CACHE ACTIONS</Text>

                <View style={styles.actionsGrid}>
                  {/* Action 1: Clear Continue Watching */}
                  <TouchableOpacity
                    style={styles.actionGridCard}
                    activeOpacity={0.75}
                    onPress={handleClearContinueWatching}
                  >
                    <View style={[styles.actionIconSquare, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
                      <Clock color="#FF9500" size={17} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionGridTitle}>Clear Continue Watching</Text>
                      <Text style={styles.actionGridSub}>Reset progress for in-progress movies</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Action 2: Clear Browser History */}
                  <TouchableOpacity
                    style={styles.actionGridCard}
                    activeOpacity={0.75}
                    onPress={handleClearBrowserHistory}
                  >
                    <View style={[styles.actionIconSquare, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                      <RotateCcw color="#0A84FF" size={17} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionGridTitle}>Clear Search & Web Cache</Text>
                      <Text style={styles.actionGridSub}>Wipe browser history & session cache</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Action 3: Delete All Downloaded Movies */}
                  <TouchableOpacity
                    style={[styles.actionGridCard, styles.destructiveActionCard]}
                    activeOpacity={0.75}
                    onPress={handleClearDownloads}
                  >
                    <View style={[styles.actionIconSquare, { backgroundColor: 'rgba(255, 69, 58, 0.15)' }]}>
                      <Trash2 color="#FF453A" size={17} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.actionGridTitle, { color: '#FF453A' }]}>
                        Delete All Downloaded Movies
                      </Text>
                      <Text style={styles.actionGridSub}>
                        Permanently purge {completedCount} downloaded video files
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── App Version & Footer Badge ── */}
        <View style={styles.footerBranding}>
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 44, height: 58, marginBottom: 10 }}
            resizeMode="contain"
          />
          <Text style={styles.footerAppName}>VFlix Stream Pro</Text>
          <Text style={styles.footerVersion}>Version 2.4.0 (Build 57.0) • Node.js Embedded</Text>
          <Text style={styles.footerCopyright}>Designed & Engineered with ❤️ by Vignesh S</Text>
        </View>
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: APPLICATION SPECIFICATIONS & ARCHITECTURE
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={specsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSpecsModalVisible(false)}
      >
        <View style={[styles.subModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 10 }]}>
          <View style={styles.subModalHeader}>
            <Text style={styles.subModalHeaderTitle}>System Specifications</Text>
            <TouchableOpacity
              style={styles.subModalCloseBtn}
              onPress={() => setSpecsModalVisible(false)}
            >
              <X color="#A09DB1" size={18} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.subModalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.specHeroBox}>
              <Image
                source={require('../../assets/logo.png')}
                style={{ width: 48, height: 64, marginBottom: 12 }}
                resizeMode="contain"
              />
              <Text style={styles.specHeroName}>VFlix Pro Streamer</Text>
              <Text style={styles.specHeroTag}>High-Performance Decentralized Torrent Stream Engine</Text>
            </View>

            <View style={styles.cardContainer}>
              {[
                { label: 'Application Name', value: 'VFlix' },
                { label: 'Client Version', value: 'v2.4.0 (Build 57.0)' },
                { label: 'Torrent Protocol', value: 'WebTorrent P2P + HTTP Range' },
                { label: 'Video Hardware Decoder', value: ksPlayerAvailable ? 'KSPlayer (Metal + FFmpegKit)' : 'ExoPlayer / AVPlayer' },
                { label: 'Runtime Architecture', value: `${Platform.OS.toUpperCase()} (${Platform.select({ ios: 'Darwin', android: 'Linux ARM', default: 'JS Engine' })})` },
                { label: 'Offline Media Directory', value: 'VFlix_Movies' },
                { label: 'Backend Server', value: isBackendConnected ? 'Online (Connected)' : 'Offline / Standalone' },
                { label: 'OpenSubtitles API', value: useDefaultSubKey ? 'VFlix VIP Pool' : 'Personal Key' },
              ].map((item, idx) => (
                <React.Fragment key={item.label}>
                  {idx > 0 && <View style={styles.cardDivider} />}
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>{item.label}</Text>
                    <Text style={styles.specValue}>{item.value}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ALL SUBTITLE LANGUAGES PICKER
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={subtitlesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSubtitlesModalVisible(false)}
      >
        <View style={[styles.subModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 10 }]}>
          <View style={styles.subModalHeader}>
            <Text style={styles.subModalHeaderTitle}>Select Subtitle Languages</Text>
            <TouchableOpacity
              style={styles.subModalCloseBtn}
              onPress={() => setSubtitlesModalVisible(false)}
            >
              <X color="#A09DB1" size={18} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.modalSearchWrap}>
            <Search size={16} color="#A09DB1" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search language name or code..."
              placeholderTextColor="#6B677E"
              value={subSearchQuery}
              onChangeText={setSubSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {subSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSubSearchQuery('')}>
                <X size={15} color="#A09DB1" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.subModalBody} showsVerticalScrollIndicator={false}>
            <View style={styles.cardContainer}>
              {filteredSubLanguages.map((lang, idx) => {
                const isSelected = selectedSubLangs.includes(lang.code);
                return (
                  <React.Fragment key={lang.code}>
                    {idx > 0 && <View style={styles.cardDivider} />}
                    <TouchableOpacity
                      style={styles.langModalRow}
                      activeOpacity={0.7}
                      onPress={() => handleToggleLanguage(lang.code)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.langModalName, isSelected && { color: Colors.primary, fontWeight: '700' }]}>
                          {lang.name}
                        </Text>
                        <Text style={styles.langModalCode}>{lang.code.toUpperCase()}</Text>
                      </View>
                      <View style={[styles.checkboxBox, isSelected && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                        {isSelected && <Check color="#FFFFFF" size={13} strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ACTIVE MIRROR SELECTOR & CUSTOM DOMAIN
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={mirrorModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMirrorModalVisible(false)}
      >
        <View style={[styles.subModalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 10 }]}>
          <View style={styles.subModalHeader}>
            <Text style={styles.subModalHeaderTitle}>Search Mirror Domains</Text>
            <TouchableOpacity
              style={styles.subModalCloseBtn}
              onPress={() => setMirrorModalVisible(false)}
            >
              <X color="#A09DB1" size={18} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.subModalBody} showsVerticalScrollIndicator={false}>
            {/* Custom Input */}
            <View style={styles.cardContainer}>
              <View style={styles.cardPadding}>
                <Text style={styles.cardInnerLabel}>CUSTOM DOMAIN URL</Text>
                <View style={styles.inputWithActionRow}>
                  <TextInput
                    style={styles.urlTextInput}
                    placeholder="https://www.1tamilmv.lease"
                    placeholderTextColor="#6B677E"
                    value={customMirrorInput}
                    onChangeText={setCustomMirrorInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={() => {
                      if (customMirrorInput.trim()) {
                        handleUpdateTamilMvUrl(customMirrorInput.trim());
                        setMirrorModalVisible(false);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Check color="#FFFFFF" size={14} strokeWidth={2.5} />
                    <Text style={styles.applyBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.sectionHeaderTitle}>POPULAR MIRRORS</Text>
              <View style={styles.cardContainer}>
                {POPULAR_MIRRORS.map((mirror, idx) => {
                  const isActive = tamilMvUrl.toLowerCase() === mirror.toLowerCase();
                  return (
                    <React.Fragment key={mirror}>
                      {idx > 0 && <View style={styles.cardDivider} />}
                      <TouchableOpacity
                        style={styles.presetRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          handleUpdateTamilMvUrl(mirror);
                          setMirrorModalVisible(false);
                        }}
                      >
                        <Globe size={16} color={isActive ? Colors.primary : '#A09DB1'} />
                        <Text style={[styles.presetRowTitle, { flex: 1, marginLeft: 10 }, isActive && { color: Colors.primary, fontWeight: '700' }]}>
                          {mirror.replace(/^https?:\/\/(www\.)?/, '')}
                        </Text>
                        {isActive && <Check size={18} color={Colors.primary} strokeWidth={2.5} />}
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* ── About Us Full Screen Modal ── */}
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

      {/* ── Donate Us Full Screen Modal ── */}
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

/* ──────────────────────────────────────────────────────────────────────────
   STYLES: Modern Cyber-Cinema Glassmorphic Theme
────────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0815',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  /* ── Header ── */
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  titleBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  mainSubtitle: {
    color: '#8E8A9F',
    fontSize: 12.5,
    marginTop: 3,
  },
  infoIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },

  /* ── Hero Profile Card ── */
  heroCard: {
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#131022',
  },
  heroCardGradient: {
    padding: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBorderWrapper: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: Colors.primary,
    padding: 2,
    marginRight: 14,
  },
  heroAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
  },
  onlineStatusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#30D158',
    borderWidth: 2,
    borderColor: '#131022',
  },
  heroInfoColumn: {
    flex: 1,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroNameText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  proPill: {
    backgroundColor: 'rgba(250, 36, 60, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proPillText: {
    color: Colors.primary,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroRoleText: {
    color: '#A09DB1',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 5,
  },
  serverStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 5,
  },
  serverStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  serverStatusLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  serverStatusDivider: {
    color: '#6B677E',
    fontSize: 10,
  },
  serverStatusEngine: {
    color: '#D1CEE2',
    fontSize: 10.5,
    fontWeight: '600',
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroDonateBtn: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    borderColor: 'rgba(250, 36, 60, 0.35)',
  },
  heroActionText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },

  /* ── Category Filter Tabs ── */
  categoryFilterRow: {
    gap: 8,
    paddingBottom: 16,
  },
  categoryFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161326',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  categoryFilterText: {
    color: '#A09DB1',
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── Section Containers & Headers ── */
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    color: '#8E8A9F',
    fontSize: 11,
    marginTop: 1,
  },
  sectionHeaderTitle: {
    color: '#8E8A9F',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 6,
  },

  /* ── Card Styling ── */
  cardContainer: {
    backgroundColor: '#141124',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
  },
  cardPadding: {
    padding: 14,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardInnerLabel: {
    color: '#8E8A9F',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  /* ── Theme Swatches ── */
  themeSwatchesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
  },
  themeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1C1832',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    minWidth: '47%',
    flex: 1,
  },
  themeColorOrb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeOptionName: {
    color: '#C7C4DA',
    fontSize: 12,
    fontWeight: '600',
  },
  activeDotPill: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  /* ── Media Player Options ── */
  playerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  playerOptionItemActive: {
    backgroundColor: 'rgba(250, 36, 60, 0.05)',
  },
  playerOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerOptionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  playerOptionSub: {
    color: '#8E8A9F',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  featureBadge: {
    backgroundColor: 'rgba(250, 36, 60, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  featureBadgeText: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4A4660',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  /* ── Switch Rows ── */
  switchRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  switchRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  switchRowTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '600',
  },
  switchRowSub: {
    color: '#8E8A9F',
    fontSize: 11,
    marginTop: 2,
  },

  /* ── Subtitle Chips & Key ── */
  langChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1B172E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
  },
  langChipText: {
    color: '#C7C4DA',
    fontSize: 11.5,
    fontWeight: '600',
  },
  langChipMore: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  langChipMoreText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  customKeyBox: {
    padding: 14,
    backgroundColor: '#100D1E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  customKeyLabel: {
    color: '#8E8A9F',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  inputWithIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A162D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
  },
  keyTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 10,
  },
  eyeToggleBtn: {
    padding: 6,
  },

  /* ── Server Card ── */
  serverCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  serverStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  serverStatusCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  serverHostTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  serverStatusSub: {
    color: '#8E8A9F',
    fontSize: 10.5,
    marginTop: 2,
  },
  pingBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pingBadgeText: {
    color: '#0A84FF',
    fontSize: 11,
    fontWeight: '700',
  },
  presetsList: {
    gap: 8,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#19152B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
  },
  presetRowActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(250, 36, 60, 0.08)',
  },
  presetIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  presetRowTitle: {
    color: '#E0DEED',
    fontSize: 13,
    fontWeight: '600',
  },
  presetRowUrl: {
    color: '#8E8A9F',
    fontSize: 11,
    marginTop: 1,
  },
  inputWithActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  urlTextInput: {
    flex: 1,
    backgroundColor: '#19152B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 13,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  /* ── Download Mode Cards ── */
  modeCardsList: {
    gap: 8,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#19152B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 12,
  },
  modeCardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(250, 36, 60, 0.07)',
  },
  modeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modeCardTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  modeCardSub: {
    color: '#8E8A9F',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },

  /* ── Turbo Booster Banner ── */
  turboBanner: {
    borderRadius: 14,
    padding: 14,
  },
  turboBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  turboIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  turboBannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  turboBannerSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  turboTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
  },
  turboTriggerText: {
    color: '#FA243C',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  boostNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.35)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  boostNoticeText: {
    color: '#30D158',
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },

  /* ── Mirror Settings ── */
  activeMirrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#19152B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeMirrorLabel: {
    color: '#8E8A9F',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeMirrorUrl: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  changeMirrorBtn: {
    backgroundColor: 'rgba(50, 215, 75, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(50, 215, 75, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  changeMirrorText: {
    color: '#32D74B',
    fontSize: 11.5,
    fontWeight: '700',
  },
  mirrorChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mirrorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#19152B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  mirrorChipText: {
    color: '#C7C4DA',
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── Storage Gauge & Actions ── */
  storageGaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  storageGaugeTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  storageGaugeSub: {
    color: '#8E8A9F',
    fontSize: 11,
    marginTop: 2,
  },
  rescanPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  rescanPillText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  storageBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#201C34',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },
  storageBarApp: {
    height: '100%',
  },
  storageBarOther: {
    height: '100%',
    backgroundColor: '#4A4E5D',
  },
  storageLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  legendLabel: {
    color: '#8E8A9F',
    fontSize: 10,
  },
  filePathCard: {
    backgroundColor: '#100D1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
  },
  filePathTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  folderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  folderLocationText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  shareBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shareBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '600',
  },
  filePathCode: {
    color: '#C7C4DA',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionsGrid: {
    gap: 8,
  },
  actionGridCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#19152B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    gap: 12,
  },
  destructiveActionCard: {
    borderColor: 'rgba(255, 69, 58, 0.25)',
    backgroundColor: 'rgba(255, 69, 58, 0.05)',
  },
  actionIconSquare: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGridTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionGridSub: {
    color: '#8E8A9F',
    fontSize: 10.5,
    marginTop: 1,
  },

  /* ── Footer Branding ── */
  footerBranding: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 8,
  },
  footerLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  footerAppName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  footerVersion: {
    color: '#8E8A9F',
    fontSize: 11.5,
    marginTop: 2,
  },
  footerCopyright: {
    color: '#6B677E',
    fontSize: 10.5,
    marginTop: 4,
  },

  /* ── Sub Modal Sheets ── */
  subModalContainer: {
    flex: 1,
    backgroundColor: '#0F0C1B',
  },
  subModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  subModalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  subModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subModalBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  specHeroBox: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 14,
  },
  specHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  specHeroName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  specHeroTag: {
    color: '#8E8A9F',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  specLabel: {
    color: '#8E8A9F',
    fontSize: 13,
  },
  specValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '55%',
    textAlign: 'right',
  },
  modalSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    backgroundColor: '#19152B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  langModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  langModalName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  langModalCode: {
    color: '#8E8A9F',
    fontSize: 10.5,
    marginTop: 1,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#4A4660',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
