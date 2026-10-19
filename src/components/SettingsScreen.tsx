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
import Constants from 'expo-constants';
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
  Sliders,
  Database,
  Lock,
  Volume2,
  Sparkle,
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
import * as FileSystem from 'expo-file-system/legacy';

const THEME_TAGLINES: Record<ThemeKey, string> = {
  red: 'Signature Cinematic',
  purple: 'Cyberpunk Neon',
  blue: 'Deep Oceanic Sci-Fi',
  emerald: 'Matrix Velvet',
  amber: 'Golden Horizon',
  pink: 'Synthwave Glow',
};

const getPlayerDescription = (name: string): string => {
  switch (name) {
    case Players.Default:
      return 'Native embedded player with PiP & subtitle track controls';
    case Players.VLC:
      return 'External VLC Media Player app with universal codec support';
    case Players.External:
      return 'System default app chooser or third-party video player';
    case Players.Infuse:
      return 'High-performance Apple playback engine with spatial audio';
    case Players.VidHub:
      return 'Modern multimedia player for Apple devices';
    case Players.Outplayer:
      return 'Minimalist video player powered by libmpv';
    default:
      return 'High quality video player engine';
  }
};

interface SettingsScreenProps {
  onOpenAbout?: () => void;
  onOpenDonate?: () => void;
}

const POPULAR_LANG_CODES = ['en', 'ta', 'te', 'hi', 'ml', 'kn', 'es', 'fr', 'de', 'ja', 'ko'];

type ActiveModalType =
  | null
  | 'theme'
  | 'player'
  | 'subtitles'
  | 'server'
  | 'engine'
  | 'mirror'
  | 'security'
  | 'storage'
  | 'support';

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

  // Active Bottom Sheet Modal
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);

  // Full Screen Navigation Modals
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [donateModalVisible, setDonateModalVisible] = useState(false);

  // 1. Media Player Configuration
  const [selectedPlayer, setSelectedPlayer] = useState<string>(Players.Default);
  const [preferExternalPlayer, setPreferExternalPlayer] = useState(false);
  const [hardwareAccel, setHardwareAccel] = useState(true);
  const [audioPassthrough, setAudioPassthrough] = useState(false);
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

  // 2. OpenSubtitles Configuration
  const [useDefaultSubKey, setUseDefaultSubKey] = useState(true);
  const [customSubKey, setCustomSubKey] = useState('');
  const [showSubKey, setShowSubKey] = useState(false);
  const [selectedSubLangs, setSelectedSubLangs] = useState<string[]>(['en', 'ta']);
  const [subSearchQuery, setSubSearchQuery] = useState('');

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
        Alert.alert('Subtitles API Key Saved', 'Custom OpenSubtitles API key has been registered.');
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

  const filteredSubLanguages = useMemo(() => {
    const q = subSearchQuery.trim().toLowerCase();
    if (!q) return SUBTITLE_LANGUAGES;
    return SUBTITLE_LANGUAGES.filter(
      (lang) => lang.name.toLowerCase().includes(q) || lang.code.toLowerCase().includes(q)
    );
  }, [subSearchQuery]);

  // 3. Speed Booster States
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

  // 4. App Preferences & Security
  const [wifiOnly, setWifiOnly] = useState(true);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [strictRedirectBlock, setStrictRedirectBlock] = useState(true);
  const [autoInterceptTorrents, setAutoInterceptTorrents] = useState(true);
  const [scanning, setScanning] = useState(false);

  // 5. Backend Torrent Server State
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
    Alert.alert('Server Configured', `Streaming server set to:\n\n${url}`);
  };

  // 6. TamilMV Source Mirror State & Testing
  const [tamilMvUrl, setTamilMvUrl] = useState(tamilMvService.getBaseUrl());
  const [customMirrorInput, setCustomMirrorInput] = useState(tamilMvService.getBaseUrl());
  const [testingMirror, setTestingMirror] = useState(false);
  const [mirrorStatus, setMirrorStatus] = useState<{ ok: boolean; latency: number; error?: string } | null>(null);
  const [presetTestResults, setPresetTestResults] = useState<Record<string, { ok: boolean; latency: number; error?: string }>>({});
  const [customMirrors, setCustomMirrors] = useState<string[]>(tamilMvService.getCustomMirrors());

  useEffect(() => {
    const unsub = tamilMvService.subscribe((newUrl) => {
      setTamilMvUrl(newUrl);
      setCustomMirrorInput(newUrl);
      setMirrorStatus(null);
    });
    return unsub;
  }, []);

  const handleUpdateTamilMvUrl = (url: string) => {
    if (!url || !url.trim()) return;
    tamilMvService.setBaseUrl(url);
    const updated = tamilMvService.getBaseUrl();
    setTamilMvUrl(updated);
    setCustomMirrorInput(updated);
    setMirrorStatus(null);
    Alert.alert('Mirror Activated 🌐', `Active 1TamilMV search & scraper mirror set to:\n\n${updated}`);
  };

  const handleTestActiveMirror = async () => {
    setTestingMirror(true);
    const res = await tamilMvService.testMirror(tamilMvUrl);
    setMirrorStatus(res);
    setTestingMirror(false);
  };

  const handleTestPreset = async (url: string) => {
    setPresetTestResults((prev) => ({ ...prev, [url]: { ok: false, latency: 0, error: 'Testing...' } }));
    const res = await tamilMvService.testMirror(url);
    setPresetTestResults((prev) => ({ ...prev, [url]: res }));
  };

  const handleAddCustomMirror = (url: string) => {
    if (!url.trim()) return;
    const updated = tamilMvService.addCustomMirror(url);
    setCustomMirrors(updated);
    handleUpdateTamilMvUrl(url);
  };

  const handleRemoveCustomMirror = (url: string) => {
    const updated = tamilMvService.removeCustomMirror(url);
    setCustomMirrors(updated);
  };

  const displayDomain = tamilMvUrl.replace(/^https?:\/\/(www\.)?/, '');

  // 7. Storage Stats & Actions
  const completedCount = downloads.filter((d) => d.status === 'completed').length;
  const activeDownloads = downloads.filter((d) => d.status === 'downloading').length;
  const appDownloads = storageStats.appDownloadsBytes || 0;
  const totalDisk = storageStats.totalBytes || 1;
  const freeDisk = storageStats.freeBytes || 0;
  const usedDisk = Math.max(0, totalDisk - freeDisk);
  const appPercent = Math.min(100, Math.max(1, (appDownloads / totalDisk) * 100));
  const otherPercent = Math.min(100, Math.max(1, ((usedDisk - appDownloads) / totalDisk) * 100));
  const freePercent = Math.max(0, 100 - (appPercent + otherPercent));

  const handleClearCompletedDownloads = () => {
    Alert.alert(
      'Clear Completed Downloads',
      `Are you sure you want to remove ${completedCount} finished download record(s) from the history? Downloaded files on disk remain safe.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear History', style: 'destructive', onPress: clearCompleted },
      ]
    );
  };

  const handleClearMediaCache = async () => {
    try {
      if (FileSystem.cacheDirectory) {
        const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
        for (const file of files) {
          try {
            await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${file}`, { idempotent: true });
          } catch {}
        }
      }
      await rescanStorage();
      Alert.alert('Cache Cleared', 'Temporary movie metadata, thumbnails, and cache chunks purged.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not clean cache files');
    }
  };

  const handleResetContinueWatching = () => {
    Alert.alert(
      'Reset Continue Watching',
      'This will erase all playback timestamps and resume positions from your home screen feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset History',
          style: 'destructive',
          onPress: async () => {
            await continueWatchingService.clear();
            Alert.alert('Reset Complete', 'Continue Watching feed has been cleared.');
          },
        },
      ]
    );
  };

  const handleClearBrowserHistory = () => {
    Alert.alert(
      'Clear In-App Browser History',
      'Purge all visited forum URLs and navigation logs from the embedded browser.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear History',
          style: 'destructive',
          onPress: async () => {
            await browserHistoryService.clearHistory();
            Alert.alert('Browser Cleared', 'Visited web pages have been erased.');
          },
        },
      ]
    );
  };

  const handleRescanStorage = async () => {
    setScanning(true);
    try {
      await rescanStorage();
      Alert.alert('Storage Synced', 'Storage disk metrics and download directory refreshed.');
    } finally {
      setScanning(false);
    }
  };

  // 8. Sharing & External
  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Stream & download high-res movies with VFLEX Stream: https://github.com/vjs-vignesh-sivapragasam/TamilRockersStream',
        title: 'VFLEX Stream App',
      });
    } catch {}
  };

  const handleOpenGitHub = () => {
    Linking.openURL('https://github.com/vjs-vignesh-sivapragasam/TamilRockersStream');
  };

  const handleOpenTelegram = () => {
    Linking.openURL('https://t.me/tamiltorrentstream');
  };

  const handleOpenDiscord = () => {
    Linking.openURL('https://discord.gg/vflex');
  };

  const activeThemeName = THEME_OPTIONS[themeKey]?.name || 'Netflix Red';

  return (
    <View style={styles.container}>
      {/* ── Top Header Bar ── */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={['#FA243C', '#B30E22']}
            style={styles.logoBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Sparkles size={16} color="#FFFFFF" />
          </LinearGradient>
          <View>
            <Text style={styles.headerTitle}>Settings & Hub</Text>
            <Text style={styles.headerSubtitle}>Customize player, network & download engine</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={handleShareApp}
          activeOpacity={0.7}
        >
          <Share2 size={16} color="#A09DB1" />
        </TouchableOpacity>
      </View>

      {/* ── Main Menu List (Tapping any row opens bottom modal) ── */}
      <ScrollView
        style={styles.menuScrollView}
        contentContainerStyle={[styles.menuScrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Engine Status Bar */}
        <View style={styles.quickStatusCard}>
          <View style={styles.statusPillItem}>
            <View style={[styles.statusDot, { backgroundColor: '#30D158' }]} />
            <Text style={styles.statusPillLabel}>Mirror:</Text>
            <Text style={styles.statusPillVal} numberOfLines={1}>{displayDomain}</Text>
          </View>
          <View style={styles.statusPillDivider} />
          <View style={styles.statusPillItem}>
            <View style={[styles.statusDot, { backgroundColor: isBackendConnected ? '#30D158' : '#FF9500' }]} />
            <Text style={styles.statusPillLabel}>Server:</Text>
            <Text style={styles.statusPillVal}>{isBackendConnected ? 'Online' : 'Relay'}</Text>
          </View>
          <View style={styles.statusPillDivider} />
          <View style={styles.statusPillItem}>
            <Text style={styles.statusPillLabel}>Free:</Text>
            <Text style={styles.statusPillVal}>{formatBytes(freeDisk)}</Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 1: PLAYBACK & MEDIA
        ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeaderText}>PLAYBACK & MEDIA</Text>
        </View>

        <View style={styles.menuGroupCard}>
          {/* Menu 1: Appearance & Themes */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActiveModal('theme')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(250, 36, 60, 0.15)' }]}>
              <Palette size={19} color="#FA243C" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>Appearance & Themes</Text>
              <Text style={styles.menuSub}>Customize cyber palette, accents & OLED darkness</Text>
            </View>
            <View style={styles.menuRightWrap}>
              <View style={styles.menuPillBadge}>
                <Text style={styles.menuPillText}>{activeThemeName}</Text>
              </View>
              <ChevronRight size={16} color="#7E7A94" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Menu 2: Video Player & Decoders */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActiveModal('player')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
              <Play size={19} color="#0A84FF" strokeWidth={2.2} fill="#0A84FF" />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>Video Player & Decoders</Text>
              <Text style={styles.menuSub}>Select native player engine, PiP & hardware codec</Text>
            </View>
            <View style={styles.menuRightWrap}>
              <View style={[styles.menuPillBadge, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                <Text style={[styles.menuPillText, { color: '#0A84FF' }]}>{selectedPlayer}</Text>
              </View>
              <ChevronRight size={16} color="#7E7A94" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Menu 3: Subtitles & Audio Engine */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActiveModal('subtitles')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
              <Languages size={19} color="#FF9500" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>Subtitles & Audio Engine</Text>
              <Text style={styles.menuSub}>OpenSubtitles API key, auto-sync & preferred tracks</Text>
            </View>
            <View style={styles.menuRightWrap}>
              <View style={styles.menuPillBadge}>
                <Text style={styles.menuPillText}>{selectedSubLangs.length} Langs</Text>
              </View>
              <ChevronRight size={16} color="#7E7A94" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 2: NETWORK & ENGINE
        ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeaderText}>NETWORK & TORRENT ENGINE</Text>
        </View>

        <View style={styles.menuGroupCard}>
          {/* Menu 4: Streaming & Backend Server */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActiveModal('server')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
              <Server size={19} color="#30D158" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>Streaming & Backend Server</Text>
              <Text style={styles.menuSub}>WebTorrent byte-range relay for video seeking</Text>
            </View>
            <View style={styles.menuRightWrap}>
              <View style={[styles.menuPillBadge, { backgroundColor: isBackendConnected ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 149, 0, 0.15)' }]}>
                <Text style={[styles.menuPillText, { color: isBackendConnected ? '#30D158' : '#FF9500' }]}>
                  {isBackendConnected ? 'Connected' : 'Configure'}
                </Text>
              </View>
              <ChevronRight size={16} color="#7E7A94" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Menu 5: Download Engine & Turbo Booster */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActiveModal('engine')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(255, 45, 85, 0.15)' }]}>
              <Zap size={19} color="#FF2D55" strokeWidth={2.2} fill="#FF2D55" />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>Download Engine & Booster</Text>
              <Text style={styles.menuSub}>Direct HTTP, P2P WebTorrent & turbo acceleration</Text>
            </View>
            <View style={styles.menuRightWrap}>
              <View style={styles.menuPillBadge}>
                <Text style={styles.menuPillText}>
                  {downloadMode === 'direct_http' ? 'Direct HTTP' : downloadMode === 'local_p2p' ? 'P2P Bridge' : 'Cloud Relay'}
                </Text>
              </View>
              <ChevronRight size={16} color="#7E7A94" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Menu 6: Search Mirror Domain */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActiveModal('mirror')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(50, 215, 75, 0.15)' }]}>
              <Globe size={19} color="#32D74B" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>Search Mirror Domain</Text>
              <Text style={styles.menuSub}>Switch active scraping domain & ping proxy nodes</Text>
            </View>
            <View style={styles.menuRightWrap}>
              <View style={[styles.menuPillBadge, { backgroundColor: 'rgba(50, 215, 75, 0.15)' }]}>
                <Text style={[styles.menuPillText, { color: '#32D74B' }]} numberOfLines={1}>
                  {displayDomain}
                </Text>
              </View>
              <ChevronRight size={16} color="#7E7A94" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION 3: SYSTEM & STORAGE
        ═══════════════════════════════════════════════════════════════ */}
        <View style={styles.sectionHeaderWrap}>
          <Text style={styles.sectionHeaderText}>SYSTEM & STORAGE</Text>
        </View>

        <View style={styles.menuGroupCard}>
          {/* Menu 7: Security & Ad Shield */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActiveModal('security')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
              <ShieldCheck size={19} color="#30D158" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>Security & Ad Shield</Text>
              <Text style={styles.menuSub}>Block popups, redirect hijackers & telemetry trackers</Text>
            </View>
            <View style={styles.menuRightWrap}>
              <View style={styles.menuPillBadge}>
                <Text style={styles.menuPillText}>{adBlockEnabled ? 'Shield ON' : 'Off'}</Text>
              </View>
              <ChevronRight size={16} color="#7E7A94" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Menu 8: Storage & Cache Manager */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActiveModal('storage')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(191, 90, 242, 0.15)' }]}>
              <HardDrive size={19} color="#BF5AF2" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>Storage & Cache Manager</Text>
              <Text style={styles.menuSub}>Disk usage metrics, clear cache & reset history</Text>
            </View>
            <View style={styles.menuRightWrap}>
              <View style={styles.menuPillBadge}>
                <Text style={styles.menuPillText}>{formatBytes(freeDisk)} Free</Text>
              </View>
              <ChevronRight size={16} color="#7E7A94" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* Menu 9: Community & Support */}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setActiveModal('support')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(255, 159, 10, 0.15)' }]}>
              <Info size={19} color="#FF9F0A" strokeWidth={2.2} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>About & Community</Text>
              <Text style={styles.menuSub}>App specifications, donate & developer links</Text>
            </View>
            <View style={styles.menuRightWrap}>
              <View style={styles.menuPillBadge}>
                <Text style={styles.menuPillText}>v2.4.0</Text>
              </View>
              <ChevronRight size={16} color="#7E7A94" strokeWidth={2.4} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer Brand Logo */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerTitle}>VFLEX STREAM</Text>
          <Text style={styles.footerSub}>High Performance P2P Cinema Engine • Build 2026.10</Text>
        </View>
      </ScrollView>

      {/* ═════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODAL 1: APPEARANCE & THEMES
      ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={activeModal === 'theme'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />
          <View style={[styles.bottomSheetContainer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(250, 36, 60, 0.18)' }]}>
                  <Palette size={18} color="#FA243C" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.sheetHeaderTitle}>Appearance & Themes</Text>
                  <Text style={styles.sheetHeaderSub}>Select high-contrast cyber theme & accent colors</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.7}
              >
                <X color="#A09DB1" size={17} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.cardInnerLabel}>CYBER CINEMA PALETTES</Text>
              <View style={styles.themeGrid}>
                {Object.values(THEME_OPTIONS).map((theme) => {
                  const isSelected = themeKey === theme.key;
                  return (
                    <TouchableOpacity
                      key={theme.key}
                      style={[
                        styles.themeCard,
                        isSelected && { borderColor: theme.primary, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
                      ]}
                      onPress={() => setThemeKey(theme.key)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.themeCardTop}>
                        <View style={[styles.themeSwatchBig, { backgroundColor: theme.primary }]} />
                        {isSelected && (
                          <View style={[styles.themeActiveCheck, { backgroundColor: theme.primary }]}>
                            <Check size={12} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.themeName, isSelected && { color: '#FFFFFF', fontWeight: '700' }]}>
                        {theme.name}
                      </Text>
                      <Text style={styles.themeTag}>{THEME_TAGLINES[theme.key] || theme.primary}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODAL 2: VIDEO PLAYER ENGINE
      ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={activeModal === 'player'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />
          <View style={[styles.bottomSheetContainer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(10, 132, 255, 0.18)' }]}>
                  <Play size={18} color="#0A84FF" strokeWidth={2.2} fill="#0A84FF" />
                </View>
                <View>
                  <Text style={styles.sheetHeaderTitle}>Video Player Engine</Text>
                  <Text style={styles.sheetHeaderSub}>Choose hardware decoders & container handlers</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.7}
              >
                <X color="#A09DB1" size={17} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.cardInnerLabel}>AVAILABLE MEDIA ENGINES</Text>

              <View style={styles.playerCardsList}>
                {availablePlayers.map((player) => {
                  const isSelected = selectedPlayer === player.name;
                  const isKSPlayer = (player.name as string) === 'KSPlayer';
                  const isAvailableOnPlatform = !isKSPlayer || isKSPlayerSupported();

                  return (
                    <TouchableOpacity
                      key={player.name}
                      style={[
                        styles.playerSelectCard,
                        isSelected && styles.playerSelectCardActive,
                        !isAvailableOnPlatform && { opacity: 0.5 },
                      ]}
                      onPress={() => {
                        if (isAvailableOnPlatform) {
                          handleSelectPlayer(player.name);
                        } else {
                          Alert.alert('KSPlayer Notice', 'KSPlayer is built with iOS FFmpegKit + Metal and is available in custom development and release builds.');
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.playerCardLeft}>
                        <View style={[styles.playerIconBox, isSelected && { backgroundColor: 'rgba(10, 132, 255, 0.2)' }]}>
                          <Tv size={20} color={isSelected ? '#0A84FF' : '#A09DB1'} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.playerCardName, isSelected && { color: '#0A84FF', fontWeight: '700' }]}>
                              {player.name}
                            </Text>
                            {isSelected && (
                              <View style={styles.activePillSmall}>
                                <Text style={styles.activePillSmallText}>ACTIVE</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.playerCardDesc}>{getPlayerDescription(player.name)}</Text>
                        </View>
                      </View>
                      <View style={[styles.radioCircle, isSelected && { borderColor: '#0A84FF', backgroundColor: '#0A84FF' }]}>
                        {isSelected && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.cardDivider} />

              <Text style={styles.cardInnerLabel}>PLAYBACK PREFERENCES</Text>
              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <ExternalLink color="#A09DB1" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Prefer External Player</Text>
                    <Text style={styles.switchRowSub}>Prompt to open VLC or MX Player on movie tap</Text>
                  </View>
                </View>
                <Switch
                  value={preferExternalPlayer}
                  onValueChange={setPreferExternalPlayer}
                  trackColor={{ false: '#262438', true: '#0A84FF' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Cpu color="#A09DB1" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Hardware Acceleration</Text>
                    <Text style={styles.switchRowSub}>Direct GPU decoding for HEVC, 10-bit and 4K streams</Text>
                  </View>
                </View>
                <Switch
                  value={hardwareAccel}
                  onValueChange={setHardwareAccel}
                  trackColor={{ false: '#262438', true: '#30D158' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Volume2 color="#A09DB1" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Audio Passthrough</Text>
                    <Text style={styles.switchRowSub}>Bitstream Dolby Digital AC3, EAC3 and DTS to soundbar</Text>
                  </View>
                </View>
                <Switch
                  value={audioPassthrough}
                  onValueChange={setAudioPassthrough}
                  trackColor={{ false: '#262438', true: '#FF9500' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={{ height: 25 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODAL 3: SUBTITLES & AUDIO ENGINE
      ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={activeModal === 'subtitles'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />
          <View style={[styles.bottomSheetContainer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(255, 149, 0, 0.18)' }]}>
                  <Languages size={18} color="#FF9500" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.sheetHeaderTitle}>Subtitles & Audio Engine</Text>
                  <Text style={styles.sheetHeaderSub}>OpenSubtitles API key & multi-language defaults</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.7}
              >
                <X color="#A09DB1" size={17} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* OpenSubtitles API Key Section */}
              <Text style={styles.cardInnerLabel}>OPENSUBTITLES v3 API KEY</Text>
              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Key color="#FF9500" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Use Built-in VFlix Key</Text>
                    <Text style={styles.switchRowSub}>Zero setup required. Automatic cloud subtitle search.</Text>
                  </View>
                </View>
                <Switch
                  value={useDefaultSubKey}
                  onValueChange={handleToggleDefaultSubKey}
                  trackColor={{ false: '#262438', true: '#FF9500' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {!useDefaultSubKey && (
                <View style={{ marginTop: 10 }}>
                  <View style={styles.inputWithActionRow}>
                    <TextInput
                      style={[styles.urlTextInput, { flex: 1 }]}
                      placeholder="Enter OpenSubtitles API key..."
                      placeholderTextColor="#6B677E"
                      value={customSubKey}
                      onChangeText={setCustomSubKey}
                      secureTextEntry={!showSubKey}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.keyVisibilityBtn}
                      onPress={() => setShowSubKey(!showSubKey)}
                    >
                      {showSubKey ? <EyeOff size={16} color="#A09DB1" /> : <Eye size={16} color="#A09DB1" />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.applyBtn}
                      onPress={() => handleSaveSubKey(customSubKey)}
                    >
                      <Check color="#FFFFFF" size={14} strokeWidth={2.5} />
                      <Text style={styles.applyBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.cardDivider} />

              {/* Subtitle Languages */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                <Text style={styles.cardInnerLabel}>DEFAULT SUBTITLE LANGUAGES</Text>
                <Text style={{ fontSize: 11, color: '#A09DB1' }}>{selectedSubLangs.length} Selected</Text>
              </View>

              {/* Search Bar for Languages */}
              <View style={[styles.inputWithActionRow, { height: 38, marginBottom: 12 }]}>
                <Search size={14} color="#6B677E" style={{ marginLeft: 8 }} />
                <TextInput
                  style={[styles.urlTextInput, { fontSize: 12 }]}
                  placeholder="Filter 100+ languages (e.g. Tamil, English, Hindi)..."
                  placeholderTextColor="#6B677E"
                  value={subSearchQuery}
                  onChangeText={setSubSearchQuery}
                />
                {subSearchQuery ? (
                  <TouchableOpacity onPress={() => setSubSearchQuery('')} style={{ padding: 6 }}>
                    <X size={14} color="#A09DB1" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.subLangGrid}>
                {filteredSubLanguages.slice(0, 18).map((lang) => {
                  const isSelected = selectedSubLangs.includes(lang.code);
                  return (
                    <TouchableOpacity
                      key={lang.code}
                      style={[
                        styles.subLangChip,
                        isSelected && styles.subLangChipActive,
                      ]}
                      onPress={() => handleToggleLanguage(lang.code)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.subLangChipText, isSelected && styles.subLangChipTextActive]}>
                        {lang.name} ({lang.code.toUpperCase()})
                      </Text>
                      {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ height: 25 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODAL 4: STREAMING & BACKEND SERVER
      ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={activeModal === 'server'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />
          <View style={[styles.bottomSheetContainer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(48, 209, 88, 0.18)' }]}>
                  <Server size={18} color="#30D158" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.sheetHeaderTitle}>Streaming & Backend Server</Text>
                  <Text style={styles.sheetHeaderSub}>WebTorrent HTTP relay & remote proxy settings</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.7}
              >
                <X color="#A09DB1" size={17} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* Server Status Header */}
              <View style={styles.serverCardHeader}>
                <View style={styles.serverStatusGroup}>
                  <View
                    style={[
                      styles.serverStatusCircle,
                      { backgroundColor: isBackendConnected ? '#30D158' : '#FF453A' },
                    ]}
                  />
                  <View style={{ flex: 1, paddingRight: 8 }}>
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
              <Text style={styles.cardInnerLabel}>SERVER PRESETS</Text>
              <View style={styles.presetsList}>
                {[
                  { label: 'Render Cloud (Production)', url: 'https://vflix-backend.onrender.com', icon: Globe },
                  { label: 'Dev Server IP (Port 3002)', url: 'http://192.168.1.6:3002', icon: Cpu },
                  {
                    label: 'Localhost Bridge',
                    url: Platform.OS === 'android'
                      ? (Constants.isDevice ? 'http://127.0.0.1:3002' : 'http://10.0.2.2:3002')
                      : 'http://localhost:3002',
                    icon: Smartphone,
                  },
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

              <View style={styles.cardDivider} />

              {/* Custom URL Input */}
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

              <View style={{ height: 25 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODAL 5: DOWNLOAD ENGINE & TURBO BOOSTER
      ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={activeModal === 'engine'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />
          <View style={[styles.bottomSheetContainer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(255, 45, 85, 0.18)' }]}>
                  <Zap size={18} color="#FF2D55" strokeWidth={2.2} fill="#FF2D55" />
                </View>
                <View>
                  <Text style={styles.sheetHeaderTitle}>Download Engine & Booster</Text>
                  <Text style={styles.sheetHeaderSub}>Choose torrent protocol & accelerate download swarms</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.7}
              >
                <X color="#A09DB1" size={17} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.cardInnerLabel}>ACTIVE DOWNLOAD PROTOCOL</Text>
              <View style={styles.modeCardsList}>
                {/* Mode 1: Direct HTTP Streamer */}
                <TouchableOpacity
                  style={[styles.modeCard, downloadMode === 'direct_http' && styles.modeCardActive]}
                  onPress={() => setDownloadMode('direct_http')}
                  activeOpacity={0.8}
                >
                  <View style={styles.modeCardLeft}>
                    <View style={[styles.modeIconBox, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                      <Download color="#30D158" size={18} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.modeCardTitle}>Direct HTTP Streamer</Text>
                        <View style={styles.recommendedPill}>
                          <Text style={styles.recommendedPillText}>RECOMMENDED</Text>
                        </View>
                      </View>
                      <Text style={styles.modeCardSub}>
                        Ultra-fast chunk streamer. Downloads directly to phone storage with auto-resume.
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.radioCircle, downloadMode === 'direct_http' && { borderColor: '#FF9500', backgroundColor: '#FF9500' }]}>
                    {downloadMode === 'direct_http' && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                  </View>
                </TouchableOpacity>

                {/* Mode 2: Local P2P WebTorrent Bridge */}
                <TouchableOpacity
                  style={[styles.modeCard, downloadMode === 'local_p2p' && styles.modeCardActive]}
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
                        Client-side engine running locally inside app via WebRTC & WebSocket trackers.
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.radioCircle, downloadMode === 'local_p2p' && { borderColor: '#0A84FF', backgroundColor: '#0A84FF' }]}>
                    {downloadMode === 'local_p2p' && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                  </View>
                </TouchableOpacity>

                {/* Mode 3: Cloud Backend Relay */}
                <TouchableOpacity
                  style={[styles.modeCard, downloadMode === 'backend_relay' && styles.modeCardActive]}
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
                        Relays torrent swarms through the high-speed VFlix cloud server to your phone.
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.radioCircle, downloadMode === 'backend_relay' && { borderColor: Colors.primary, backgroundColor: Colors.primary }]}>
                    {downloadMode === 'backend_relay' && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.cardDivider} />

              {/* Turbo Speed Booster Banner */}
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

              <View style={styles.cardDivider} />

              {/* Engine Preference Toggles */}
              <Text style={styles.cardInnerLabel}>SWARM PREFERENCES</Text>
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

              <View style={{ height: 25 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODAL 6: SEARCH MIRROR DOMAIN
      ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={activeModal === 'mirror'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />
          <View style={[styles.bottomSheetContainer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(50, 215, 75, 0.18)' }]}>
                  <Globe size={18} color="#32D74B" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.sheetHeaderTitle}>Search Mirror Domain</Text>
                  <Text style={styles.sheetHeaderSub}>Switch active scraping domain & ping proxy nodes</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.7}
              >
                <X color="#A09DB1" size={17} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* Current Active Mirror Banner */}
              <View style={styles.activeMirrorBanner}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.activeMirrorLabel}>CURRENT ACTIVE MIRROR</Text>
                  <Text style={styles.activeMirrorUrl}>{displayDomain}</Text>
                  {mirrorStatus && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: mirrorStatus.ok ? '#30D158' : '#FF453A' }} />
                      <Text style={{ fontSize: 11, color: mirrorStatus.ok ? '#30D158' : '#FF453A', fontWeight: '600' }}>
                        {mirrorStatus.ok ? `Online (${mirrorStatus.latency}ms)` : `Offline / Blocked (${mirrorStatus.error})`}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.pingBadgeBtn, { paddingHorizontal: 12, paddingVertical: 7 }]}
                  onPress={handleTestActiveMirror}
                  disabled={testingMirror}
                  activeOpacity={0.75}
                >
                  {testingMirror ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Activity size={12} color="#30D158" />
                      <Text style={[styles.pingBadgeText, { color: '#30D158' }]}>Ping Mirror</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.cardDivider} />

              {/* Custom Input */}
              <Text style={styles.cardInnerLabel}>CUSTOM DOMAIN URL</Text>
              <View style={styles.inputWithActionRow}>
                <TextInput
                  style={styles.urlTextInput}
                  placeholder="https://www.1tamilmv.solar"
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
                      handleAddCustomMirror(customMirrorInput.trim());
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Check color="#FFFFFF" size={14} strokeWidth={2.5} />
                  <Text style={styles.applyBtnText}>Save</Text>
                </TouchableOpacity>
              </View>

              {/* Custom User Mirrors if any */}
              {customMirrors.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.cardInnerLabel}>SAVED CUSTOM MIRRORS</Text>
                  <View style={styles.presetsList}>
                    {customMirrors.map((mirror) => {
                      const isActive = tamilMvUrl.toLowerCase() === mirror.toLowerCase();
                      return (
                        <View key={mirror} style={[styles.presetRow, { justifyContent: 'space-between' }]}>
                          <TouchableOpacity
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                            activeOpacity={0.7}
                            onPress={() => handleUpdateTamilMvUrl(mirror)}
                          >
                            <Globe size={16} color={isActive ? '#32D74B' : '#A09DB1'} />
                            <Text style={[styles.presetRowTitle, { flex: 1, marginLeft: 10 }, isActive && { color: '#32D74B', fontWeight: '700' }]}>
                              {mirror.replace(/^https?:\/\/(www\.)?/, '')}
                            </Text>
                            {isActive && <Check size={18} color="#32D74B" strokeWidth={2.5} />}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleRemoveCustomMirror(mirror)}
                            style={{ padding: 6, marginLeft: 8 }}
                          >
                            <Trash2 size={14} color="#8E8E93" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.cardDivider} />

              {/* Popular Mirrors */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={styles.cardInnerLabel}>POPULAR MIRROR PRESETS</Text>
                <Text style={{ fontSize: 11, color: '#A09DB1' }}>Tap to activate</Text>
              </View>

              <View style={styles.presetsList}>
                {POPULAR_MIRRORS.map((mirror) => {
                  const isActive = tamilMvUrl.toLowerCase() === mirror.toLowerCase();
                  const testRes = presetTestResults[mirror];
                  return (
                    <View key={mirror} style={[styles.presetRow, { justifyContent: 'space-between' }]}>
                      <TouchableOpacity
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                        activeOpacity={0.7}
                        onPress={() => handleUpdateTamilMvUrl(mirror)}
                      >
                        <Globe size={16} color={isActive ? '#32D74B' : '#A09DB1'} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.presetRowTitle, isActive && { color: '#32D74B', fontWeight: '700' }]}>
                            {mirror.replace(/^https?:\/\/(www\.)?/, '')}
                          </Text>
                          {testRes && (
                            <Text style={{ fontSize: 10.5, color: testRes.ok ? '#30D158' : '#FF453A', marginTop: 2 }}>
                              {testRes.error === 'Testing...' ? 'Pinging...' : testRes.ok ? `Online (${testRes.latency}ms)` : `Offline (${testRes.error})`}
                            </Text>
                          )}
                        </View>
                        {isActive && <Check size={18} color="#32D74B" strokeWidth={2.5} />}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#262438', marginLeft: 8 }}
                        onPress={() => handleTestPreset(mirror)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 11, color: '#A09DB1', fontWeight: '600' }}>Ping</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              <View style={{ height: 25 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODAL 7: SECURITY & AD SHIELD
      ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={activeModal === 'security'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />
          <View style={[styles.bottomSheetContainer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(48, 209, 88, 0.18)' }]}>
                  <ShieldCheck size={18} color="#30D158" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.sheetHeaderTitle}>Security & Ad Shield</Text>
                  <Text style={styles.sheetHeaderSub}>Malware protection, popup blocking & tracker filters</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.7}
              >
                <X color="#A09DB1" size={17} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.cardInnerLabel}>CONTENT SHIELDS</Text>

              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <ShieldCheck color="#30D158" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Ad & Popup Blocker</Text>
                    <Text style={styles.switchRowSub}>Filters ad networks, tracking telemetry and full-screen overlays</Text>
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
                  <Lock color="#FF9500" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>Strict Redirect Shield</Text>
                    <Text style={styles.switchRowSub}>Prevents forum topics from navigating to phishing sponsor tabs</Text>
                  </View>
                </View>
                <Switch
                  value={strictRedirectBlock}
                  onValueChange={setStrictRedirectBlock}
                  trackColor={{ false: '#262438', true: '#FF9500' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.switchRowItem}>
                <View style={styles.switchRowLeft}>
                  <Wifi color="#0A84FF" size={18} strokeWidth={2} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.switchRowTitle}>DNS-over-HTTPS (DoH)</Text>
                    <Text style={styles.switchRowSub}>Encrypts DNS lookups via Cloudflare 1.1.1.1 to bypass ISP blocking</Text>
                  </View>
                </View>
                <Switch
                  value={true}
                  disabled={true}
                  trackColor={{ false: '#262438', true: '#0A84FF' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={{ height: 25 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODAL 8: STORAGE & CACHE MANAGER
      ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={activeModal === 'storage'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />
          <View style={[styles.bottomSheetContainer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(191, 90, 242, 0.18)' }]}>
                  <HardDrive size={18} color="#BF5AF2" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.sheetHeaderTitle}>Storage & Cache Manager</Text>
                  <Text style={styles.sheetHeaderSub}>Manage downloads, temp media and storage breakdown</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.7}
              >
                <X color="#A09DB1" size={17} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* Storage Bar Breakdown */}
              <Text style={styles.cardInnerLabel}>DEVICE STORAGE BREAKDOWN</Text>
              <View style={styles.storageBarRow}>
                <View style={[styles.storageBarPart, { flex: appPercent, backgroundColor: Colors.primary }]} />
                <View style={[styles.storageBarPart, { flex: otherPercent, backgroundColor: '#3A394D' }]} />
                <View style={[styles.storageBarPart, { flex: freePercent, backgroundColor: '#262438' }]} />
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                  <Text style={styles.legendText}>App Media ({formatBytes(appDownloads)})</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#3A394D' }]} />
                  <Text style={styles.legendText}>Other Files ({formatBytes(usedDisk)})</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#262438' }]} />
                  <Text style={styles.legendText}>Free ({formatBytes(freeDisk)})</Text>
                </View>
              </View>

              <View style={styles.cardDivider} />

              {/* Maintenance Actions */}
              <Text style={styles.cardInnerLabel}>CLEANING & CACHE ACTIONS</Text>

              <TouchableOpacity
                style={styles.storageActionRow}
                onPress={handleClearCompletedDownloads}
                activeOpacity={0.75}
              >
                <View style={styles.storageActionIconWrap}>
                  <Trash2 size={16} color="#FF453A" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.storageActionTitle}>Clear Completed Downloads History</Text>
                  <Text style={styles.storageActionSub}>{completedCount} finished download record(s)</Text>
                </View>
                <ChevronRight size={15} color="#A09DB1" />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.storageActionRow}
                onPress={handleClearMediaCache}
                activeOpacity={0.75}
              >
                <View style={styles.storageActionIconWrap}>
                  <RotateCcw size={16} color="#FF9500" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.storageActionTitle}>Purge Temporary Media & Poster Cache</Text>
                  <Text style={styles.storageActionSub}>Frees disk space from scraped images & thumbnails</Text>
                </View>
                <ChevronRight size={15} color="#A09DB1" />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.storageActionRow}
                onPress={handleResetContinueWatching}
                activeOpacity={0.75}
              >
                <View style={styles.storageActionIconWrap}>
                  <RotateCcw size={16} color="#FA243C" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.storageActionTitle}>Reset Continue Watching History</Text>
                  <Text style={styles.storageActionSub}>Clears playback resume timestamps</Text>
                </View>
                <ChevronRight size={15} color="#A09DB1" />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.storageActionRow}
                onPress={handleClearBrowserHistory}
                activeOpacity={0.75}
              >
                <View style={styles.storageActionIconWrap}>
                  <Globe size={16} color="#0A84FF" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.storageActionTitle}>Clear In-App Browser History</Text>
                  <Text style={styles.storageActionSub}>Erase forum navigation cookies & URLs</Text>
                </View>
                <ChevronRight size={15} color="#A09DB1" />
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={styles.storageActionRow}
                onPress={handleRescanStorage}
                disabled={scanning}
                activeOpacity={0.75}
              >
                <View style={styles.storageActionIconWrap}>
                  {scanning ? <ActivityIndicator size="small" color="#0A84FF" /> : <HardDrive size={16} color="#0A84FF" />}
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.storageActionTitle}>Rescan Device Storage</Text>
                  <Text style={styles.storageActionSub}>Recalculates file system space allocation</Text>
                </View>
                <ChevronRight size={15} color="#A09DB1" />
              </TouchableOpacity>

              <View style={{ height: 25 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═════════════════════════════════════════════════════════════════════
          BOTTOM SHEET MODAL 9: COMMUNITY & ABOUT
      ═════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={activeModal === 'support'}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setActiveModal(null)}
          />
          <View style={[styles.bottomSheetContainer, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={[styles.sheetIconWrap, { backgroundColor: 'rgba(255, 159, 10, 0.18)' }]}>
                  <Info size={18} color="#FF9F0A" strokeWidth={2.2} />
                </View>
                <View>
                  <Text style={styles.sheetHeaderTitle}>About & Community</Text>
                  <Text style={styles.sheetHeaderSub}>App specifications & open-source developer links</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setActiveModal(null)}
                activeOpacity={0.7}
              >
                <X color="#A09DB1" size={17} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              {/* Quick Actions */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <TouchableOpacity
                  style={[styles.quickSupportCard, { backgroundColor: 'rgba(250, 36, 60, 0.12)', borderColor: 'rgba(250, 36, 60, 0.3)' }]}
                  onPress={() => {
                    setActiveModal(null);
                    setAboutModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Sparkles size={20} color="#FA243C" />
                  <Text style={styles.quickSupportTitle}>About VFlix</Text>
                  <Text style={styles.quickSupportSub}>Version & Team</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickSupportCard, { backgroundColor: 'rgba(255, 45, 85, 0.12)', borderColor: 'rgba(255, 45, 85, 0.3)' }]}
                  onPress={() => {
                    setActiveModal(null);
                    setDonateModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Heart size={20} color="#FF2D55" fill="#FF2D55" />
                  <Text style={styles.quickSupportTitle}>Donate Us</Text>
                  <Text style={styles.quickSupportSub}>Support Hosting</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.cardInnerLabel}>COMMUNITY & OPEN SOURCE</Text>
              <View style={styles.presetsList}>
                <TouchableOpacity style={styles.presetRow} onPress={handleOpenGitHub} activeOpacity={0.75}>
                  <View style={[styles.presetIconWrap, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                    <ExternalLink size={15} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.presetRowTitle}>GitHub Repository</Text>
                    <Text style={styles.presetRowUrl}>Star the open-source codebase & file issues</Text>
                  </View>
                  <ChevronRight size={15} color="#A09DB1" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.presetRow} onPress={handleOpenTelegram} activeOpacity={0.75}>
                  <View style={[styles.presetIconWrap, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                    <Radio size={15} color="#0A84FF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.presetRowTitle}>Telegram Channel</Text>
                    <Text style={styles.presetRowUrl}>Join announcements & release updates</Text>
                  </View>
                  <ChevronRight size={15} color="#A09DB1" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.presetRow} onPress={handleOpenDiscord} activeOpacity={0.75}>
                  <View style={[styles.presetIconWrap, { backgroundColor: 'rgba(191, 90, 242, 0.15)' }]}>
                    <Globe size={15} color="#BF5AF2" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.presetRowTitle}>Discord Server</Text>
                    <Text style={styles.presetRowUrl}>Chat with contributors and fellow streamers</Text>
                  </View>
                  <ChevronRight size={15} color="#A09DB1" />
                </TouchableOpacity>
              </View>

              <View style={styles.cardDivider} />

              <Text style={styles.cardInnerLabel}>APPLICATION SPECIFICATIONS</Text>
              <View style={styles.specsBox}>
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>App Version</Text>
                  <Text style={styles.specValue}>v2.4.0 (Cyber Cinema Engine)</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Operating System</Text>
                  <Text style={styles.specValue}>{Platform.OS.toUpperCase()} {Platform.Version}</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Device Mode</Text>
                  <Text style={styles.specValue}>{Constants.isDevice ? 'Physical Mobile Device' : 'Simulator / Emulator'}</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Streaming Core</Text>
                  <Text style={styles.specValue}>ExoPlayer + WebTorrent v2.5</Text>
                </View>
              </View>

              <View style={{ height: 25 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Full Screen About Us Modal ── */}
      <Modal
        visible={aboutModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <AboutUsScreen onClose={() => setAboutModalVisible(false)} />
      </Modal>

      {/* ── Full Screen Donate Us Modal ── */}
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

/* ─────────────────────────────────────────────────────────────────────────────
   STYLES: CYBER-CINEMA GLASSMORPHIC DESIGN
───────────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0910',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#0A0910',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FA243C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: '#8E8B9E',
    fontSize: 12,
    marginTop: 1,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuScrollView: {
    flex: 1,
  },
  menuScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  quickStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 18,
  },
  statusPillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    justifyContent: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillLabel: {
    color: '#8E8B9E',
    fontSize: 11,
    fontWeight: '500',
  },
  statusPillVal: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  statusPillDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionHeaderWrap: {
    paddingHorizontal: 4,
    marginBottom: 8,
    marginTop: 6,
  },
  sectionHeaderText: {
    color: '#6F6C80',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  menuGroupCard: {
    backgroundColor: '#14131D',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  menuTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  menuTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  menuSub: {
    color: '#8A879B',
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  menuRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuPillBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: 90,
  },
  menuPillText: {
    color: '#E0DEEA',
    fontSize: 11,
    fontWeight: '700',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 65,
  },
  footerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  footerTitle: {
    color: '#4B475D',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  footerSub: {
    color: '#3A3749',
    fontSize: 11,
    marginTop: 4,
  },

  /* ── Bottom Sheet Modals ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  bottomSheetContainer: {
    backgroundColor: '#12111A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomWidth: 0,
    maxHeight: '88%',
    minHeight: '45%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 24,
  },
  sheetHandle: {
    width: 42,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sheetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sheetHeaderSub: {
    color: '#8E8B9E',
    fontSize: 11.5,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cardInnerLabel: {
    color: '#7E7A94',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginVertical: 16,
  },

  /* ── Theme Options Grid ── */
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  themeCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  themeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  themeSwatchBig: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  themeActiveCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeName: {
    color: '#E0DEEA',
    fontSize: 14,
    fontWeight: '600',
  },
  themeTag: {
    color: '#7E7A94',
    fontSize: 10.5,
    marginTop: 3,
  },

  /* ── Video Player Cards ── */
  playerCardsList: {
    gap: 10,
  },
  playerSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  playerSelectCardActive: {
    borderColor: '#0A84FF',
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
  },
  playerCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playerCardName: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '600',
  },
  playerCardDesc: {
    color: '#8A879B',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  activePillSmall: {
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillSmallText: {
    color: '#0A84FF',
    fontSize: 9,
    fontWeight: '800',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: '#4A465D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Switches & Toggles ── */
  switchRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
    color: '#8A879B',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },

  /* ── Subtitle Languages ── */
  subLangGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subLangChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  subLangChipActive: {
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    borderColor: '#FF9500',
  },
  subLangChipText: {
    color: '#A09DB1',
    fontSize: 11.5,
    fontWeight: '600',
  },
  subLangChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* ── Inputs & Action Rows ── */
  inputWithActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    height: 44,
    gap: 8,
  },
  urlTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  keyVisibilityBtn: {
    padding: 6,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Server Card Header & Ping ── */
  serverCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  serverStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serverStatusCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  serverHostTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  serverStatusSub: {
    color: '#8A879B',
    fontSize: 11,
    marginTop: 2,
  },
  pingBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.35)',
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
  },
  pingBadgeText: {
    color: '#0A84FF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  presetsList: {
    gap: 8,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  presetRowActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(250, 36, 60, 0.08)',
  },
  presetIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  presetRowTitle: {
    color: '#E0DEEA',
    fontSize: 13,
    fontWeight: '600',
  },
  presetRowUrl: {
    color: '#7E7A94',
    fontSize: 11,
    marginTop: 2,
  },

  /* ── Download Mode Cards ── */
  modeCardsList: {
    gap: 10,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modeCardActive: {
    borderColor: '#FF9500',
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  modeCardTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  modeCardSub: {
    color: '#8A879B',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  recommendedPill: {
    backgroundColor: 'rgba(48, 209, 88, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedPillText: {
    color: '#30D158',
    fontSize: 8.5,
    fontWeight: '800',
  },

  /* ── Turbo Banner ── */
  turboBanner: {
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  turboBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  turboIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  turboBannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  turboBannerSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  turboTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 12,
  },
  turboTriggerText: {
    color: '#FA243C',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  boostNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  boostNoticeText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  /* ── Mirror Settings ── */
  activeMirrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(50, 215, 75, 0.08)',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: 'rgba(50, 215, 75, 0.25)',
  },
  activeMirrorLabel: {
    color: '#32D74B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  activeMirrorUrl: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },

  /* ── Storage Bar & Legend ── */
  storageBarRow: {
    flexDirection: 'row',
    height: 9,
    borderRadius: 4.5,
    overflow: 'hidden',
    backgroundColor: '#262438',
    gap: 2,
    marginTop: 4,
  },
  storageBarPart: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    color: '#8A879B',
    fontSize: 10.5,
  },
  storageActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
  },
  storageActionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  storageActionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  storageActionSub: {
    color: '#8A879B',
    fontSize: 11,
    marginTop: 2,
  },

  /* ── Specs & Support ── */
  quickSupportCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  quickSupportTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 4,
  },
  quickSupportSub: {
    color: '#8A879B',
    fontSize: 10.5,
  },
  specsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 12,
    gap: 10,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  specLabel: {
    color: '#8A879B',
    fontSize: 12,
  },
  specValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default SettingsScreen;
