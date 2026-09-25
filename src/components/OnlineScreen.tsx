import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Radio,
  Play,
  Tv,
  Globe,
  Copy,
  Trash2,
  Clock,
  Sparkles,
  Server,
  Check,
  AlertCircle,
  ExternalLink,
  X,
  RotateCcw,
  Film,
  Zap,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { useDownloads } from '../context/DownloadContext';
import { OfflinePlayerModal } from './OfflinePlayerModal';
import { DownloadItem } from '../types/downloads';

interface RecentStreamItem {
  id: string;
  title: string;
  magnet: string;
  streamUrl: string;
  infoHash: string;
  timestamp: number;
}

const SAMPLE_MAGNET =
  'magnet:?xt=urn:btih:08633ba338e908468a422ce88ac973790110504a&dn=www.1TamilMV.lease%20-%20Ramba%20Oorvasi%20Menaka%20%282026%29%20TRUE%20WEB-DL%20-%201080p%20-%20AVC%20-%20%5BTamil%20%2B%20Telugu%20%2B%20Malayalam%20%2B%20Kannada%5D.mkv&xl=7283132506&tr=udp%3A%2F%2Ftracker.dler.com%3A6969%2Fannounce&tr=http%3A%2F%2Ftracker.bt4g.com%3A2095%2Fannounce&tr=udp%3A%2F%2Ftracker-udp.gbitt.info%3A80%2Fannounce';

const HISTORY_CACHE_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}online_stream_history.json`
  : '';

export const OnlineScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { backendUrl, setBackendUrl } = useDownloads();

  const [magnetInput, setMagnetInput] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [history, setHistory] = useState<RecentStreamItem[]>([]);
  const [copiedText, setCopiedText] = useState(false);

  // Backend URL editor state
  const [isEditingBackend, setIsEditingBackend] = useState(false);
  const [backendInput, setBackendInput] = useState(backendUrl);

  // Player state
  const [playerVisible, setPlayerVisible] = useState(false);
  const [activeItem, setActiveItem] = useState<DownloadItem | null>(null);

  // Load history on mount
  useEffect(() => {
    (async () => {
      if (!HISTORY_CACHE_FILE) return;
      try {
        const info = await FileSystem.getInfoAsync(HISTORY_CACHE_FILE);
        if (info.exists) {
          const raw = await FileSystem.readAsStringAsync(HISTORY_CACHE_FILE);
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setHistory(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to load online stream history:', e);
      }
    })();
  }, []);

  // Save history helper
  const saveHistory = useCallback(async (newHistory: RecentStreamItem[]) => {
    setHistory(newHistory);
    if (!HISTORY_CACHE_FILE) return;
    try {
      await FileSystem.writeAsStringAsync(HISTORY_CACHE_FILE, JSON.stringify(newHistory));
    } catch (e) {
      console.warn('Failed to save online stream history:', e);
    }
  }, []);

  // Parse magnet details
  const parsedDetails = useMemo(() => {
    const raw = magnetInput.trim();
    if (!raw) return null;

    let infoHash = '';
    const hashMatch = raw.match(/urn:btih:([a-zA-Z0-9]{40}|[a-zA-Z0-9]{32})/i);
    if (hashMatch) {
      infoHash = hashMatch[1].toLowerCase();
    } else if (/^[a-fA-F0-9]{40}$/.test(raw)) {
      infoHash = raw.toLowerCase();
    }

    let displayName = '';
    const dnMatch = raw.match(/[?&]dn=([^&]+)/i);
    if (dnMatch) {
      try {
        displayName = decodeURIComponent(dnMatch[1].replace(/\+/g, ' '));
      } catch {
        displayName = dnMatch[1];
      }
    }

    const streamUrl = raw.startsWith('magnet:') || raw.includes('urn:btih:')
      ? `${backendUrl}/api/stream/play?magnet=${encodeURIComponent(raw)}`
      : `${backendUrl}/api/stream/${infoHash}`;

    return {
      isValid: Boolean(infoHash || raw.startsWith('magnet:')),
      infoHash,
      displayName: displayName || (infoHash ? `Stream ${infoHash.substring(0, 8)}` : 'Magnet Stream'),
      streamUrl,
    };
  }, [magnetInput, backendUrl]);

  // Background stream pre-warmer: initiates tracker query & DHT resolution in advance
  useEffect(() => {
    if (!parsedDetails?.isValid) return;
    const raw = magnetInput.trim();
    if (!raw) return;

    const timer = setTimeout(() => {
      fetch(`${backendUrl}/api/stream/warmup?magnet=${encodeURIComponent(raw)}`).catch(() => {});
    }, 400);

    return () => clearTimeout(timer);
  }, [magnetInput, parsedDetails, backendUrl]);

  // Launch Internal Video Player
  const handlePlayInternal = useCallback(
    (streamDetails?: { title: string; streamUrl: string; magnet: string; infoHash: string }) => {
      const details = streamDetails || {
        title: customTitle.trim() || parsedDetails?.displayName || 'Online Direct Stream',
        streamUrl: parsedDetails?.streamUrl || '',
        magnet: magnetInput.trim(),
        infoHash: parsedDetails?.infoHash || '',
      };

      if (!details.streamUrl) {
        Alert.alert('Invalid URL', 'Please paste a valid magnet link or infohash first.');
        return;
      }

      // Add to recent history
      const historyEntry: RecentStreamItem = {
        id: `stream_${Date.now()}`,
        title: details.title,
        magnet: details.magnet,
        streamUrl: details.streamUrl,
        infoHash: details.infoHash,
        timestamp: Date.now(),
      };

      const updated = [historyEntry, ...history.filter((h) => h.infoHash !== details.infoHash)].slice(0, 15);
      saveHistory(updated);

      const downloadItem: DownloadItem = {
        id: `online_${Date.now()}`,
        title: details.title,
        fileName: `${details.title}.mp4`,
        fileUri: '',
        url: details.streamUrl,
        status: 'completed',
        progress: 1,
        totalBytes: 0,
        downloadedBytes: 0,
        speed: 'Online Stream',
        isTorrent: false,
        createdAt: Date.now(),
      };

      setActiveItem(downloadItem);
      setPlayerVisible(true);
    },
    [customTitle, parsedDetails, magnetInput, history, saveHistory]
  );

  // Play in External VLC or MX Player
  const handlePlayExternal = useCallback((targetUrl: string) => {
    if (!targetUrl) return;
    const vlcUri = `vlc://${targetUrl}`;
    Linking.openURL(vlcUri).catch(() => {
      Linking.openURL(targetUrl).catch(() => {
        Alert.alert(
          'Player Not Found',
          'VLC or MX Player is recommended for direct hardware accelerated streaming.'
        );
      });
    });
  }, []);

  // Open Webtor Cloud Proxy
  const handleOpenWebtor = useCallback((magnet: string) => {
    if (!magnet) return;
    const webtorUrl = `https://webtor.io/show?magnet=${encodeURIComponent(magnet)}`;
    Linking.openURL(webtorUrl).catch((err) => {
      Alert.alert('Error', 'Could not open browser: ' + err.message);
    });
  }, []);

  // Share or Copy Stream URL
  const handleShareStreamUrl = useCallback((streamUrl: string, title: string) => {
    Share.share({
      message: streamUrl,
      title: `Stream URL: ${title}`,
    }).catch(() => {});
  }, []);

  // Delete history item
  const handleDeleteHistory = (id: string) => {
    const updated = history.filter((item) => item.id !== id);
    saveHistory(updated);
  };

  // Clear all history
  const handleClearAllHistory = () => {
    Alert.alert('Clear History', 'Are you sure you want to remove all tested stream history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => saveHistory([]) },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: insets.top + 8 }]}
    >
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}>
        {/* 1. Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <LinearGradient
              colors={[Colors.primary, '#8A0E1C']}
              style={styles.logoBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Radio color="#FFFFFF" size={18} strokeWidth={2.5} />
            </LinearGradient>
            <View>
              <View style={styles.titleWithDevRow}>
                <Text style={styles.screenTitle}>Online Streamer</Text>
                <View style={styles.devPill}>
                  <Text style={styles.devPillText}>DEV ONLY</Text>
                </View>
              </View>
              <Text style={styles.screenSubtitle}>Direct Magnet URL & Internal Player Tester</Text>
            </View>
          </View>
        </View>

        {/* 2. Backend Engine Status Card */}
        <View style={styles.backendCard}>
          <View style={styles.backendHeaderRow}>
            <View style={styles.backendLeftRow}>
              <View style={styles.statusDot} />
              <Text style={styles.backendLabel}>STREAM ENGINE BACKEND</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsEditingBackend((prev) => !prev)}
              activeOpacity={0.7}
              style={styles.editBackendBtn}
            >
              <Text style={styles.editBackendText}>{isEditingBackend ? 'Cancel' : 'Change IP'}</Text>
            </TouchableOpacity>
          </View>

          {isEditingBackend ? (
            <View style={styles.backendEditRow}>
              <TextInput
                style={styles.backendInput}
                value={backendInput}
                onChangeText={setBackendInput}
                placeholder="http://192.168.1.x:3000"
                placeholderTextColor={Colors.secondaryText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.saveBackendBtn}
                onPress={() => {
                  let cleaned = backendInput.trim().replace(/\/+$/, '');
                  if (!/^https?:\/\//i.test(cleaned)) {
                    cleaned = `http://${cleaned}`;
                  }
                  setBackendUrl(cleaned);
                  setBackendInput(cleaned);
                  setIsEditingBackend(false);
                }}
              >
                <Check color="#FFFFFF" size={16} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.backendUrlText} numberOfLines={1}>
              {backendUrl}
            </Text>
          )}

          <Text style={styles.backendDesc}>
            Converts torrent swarms into smooth HTTP Range video playback with timeline seeking and subtitles.
          </Text>
        </View>

        {/* 3. Magnet Input Card */}
        <View style={styles.inputCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>MAGNET URL / INFO HASH</Text>
            {magnetInput.length > 0 && (
              <TouchableOpacity onPress={() => setMagnetInput('')} style={styles.clearBtn}>
                <X color={Colors.secondaryText} size={15} />
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={styles.magnetTextInput}
            placeholder="Paste magnet:?xt=urn:btih:... or 40-char torrent hash here"
            placeholderTextColor={Colors.secondaryText}
            value={magnetInput}
            onChangeText={setMagnetInput}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Quick Action Chips */}
          <View style={styles.quickChipsRow}>
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => setMagnetInput(SAMPLE_MAGNET)}
              activeOpacity={0.7}
            >
              <Sparkles color={Colors.primary} size={13} strokeWidth={2.2} />
              <Text style={styles.quickChipText}>Use Sample Movie Magnet</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickChipSecondary}
              onPress={() => setCustomTitle((prev) => (prev ? '' : 'Live Development Test'))}
              activeOpacity={0.7}
            >
              <Film color="#8E8E93" size={13} />
              <Text style={styles.quickChipSecondaryText}>
                {customTitle ? 'Title Set' : 'Set Custom Title'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Optional Title Input */}
          {customTitle !== '' && (
            <TextInput
              style={styles.titleInput}
              placeholder="Display Movie Title (e.g. Leo 1080p)"
              placeholderTextColor={Colors.secondaryText}
              value={customTitle}
              onChangeText={setCustomTitle}
            />
          )}

          {/* Parsed Metadata Preview */}
          {parsedDetails && (
            <View style={styles.parsedBox}>
              <View style={styles.parsedRow}>
                <Text style={styles.parsedLabel}>Display Name:</Text>
                <Text style={styles.parsedVal} numberOfLines={1}>
                  {customTitle.trim() || parsedDetails.displayName}
                </Text>
              </View>
              {parsedDetails.infoHash ? (
                <View style={styles.parsedRow}>
                  <Text style={styles.parsedLabel}>InfoHash:</Text>
                  <Text style={styles.parsedHash} numberOfLines={1}>
                    {parsedDetails.infoHash}
                  </Text>
                </View>
              ) : null}
              <View style={styles.parsedRow}>
                <Text style={styles.parsedLabel}>Endpoint:</Text>
                <Text style={styles.parsedUrl} numberOfLines={1}>
                  {parsedDetails.streamUrl}
                </Text>
              </View>
            </View>
          )}

          {/* Primary Action: Play in Internal Player */}
          <TouchableOpacity
            style={[styles.primaryPlayBtn, !parsedDetails?.isValid && styles.btnDisabled]}
            disabled={!parsedDetails?.isValid}
            onPress={() => handlePlayInternal()}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={
                parsedDetails?.isValid
                  ? [Colors.primary, '#B51527']
                  : ['#221C1E', '#181416']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryPlayGradient}
            >
              <Play color="#FFFFFF" size={18} fill="#FFFFFF" />
              <Text style={styles.primaryPlayBtnText}>
                Play with Internal Offline Player
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary Actions Row */}
          {parsedDetails?.isValid && (
            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => handlePlayExternal(parsedDetails.streamUrl)}
                activeOpacity={0.7}
              >
                <Tv color="#FF9800" size={15} />
                <Text style={styles.secondaryActionText}>VLC / MX</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => handleOpenWebtor(magnetInput.trim())}
                activeOpacity={0.7}
              >
                <Globe color="#3B82F6" size={15} />
                <Text style={styles.secondaryActionText}>Webtor Cloud</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() =>
                  handleShareStreamUrl(
                    parsedDetails.streamUrl,
                    customTitle || parsedDetails.displayName
                  )
                }
                activeOpacity={0.7}
              >
                <Copy color="#AEAEB2" size={15} />
                <Text style={styles.secondaryActionText}>Share URL</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 4. Stream History Card */}
        <View style={styles.historyCard}>
          <View style={styles.historyHeaderRow}>
            <View style={styles.historyTitleLeft}>
              <Clock color={Colors.secondaryText} size={15} />
              <Text style={styles.historySectionTitle}>RECENT TEST STREAMS</Text>
              {history.length > 0 && (
                <View style={styles.historyCountBadge}>
                  <Text style={styles.historyCountText}>{history.length}</Text>
                </View>
              )}
            </View>
            {history.length > 0 && (
              <TouchableOpacity onPress={handleClearAllHistory} activeOpacity={0.7}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {history.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Zap color="#444444" size={28} />
              <Text style={styles.emptyHistoryTitle}>No Streams Tested Yet</Text>
              <Text style={styles.emptyHistorySubtitle}>
                Pasted magnets and test streams will appear here for fast 1-tap re-testing.
              </Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {history.map((item) => (
                <View key={item.id} style={styles.historyItem}>
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyItemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.historyItemSub} numberOfLines={1}>
                      Hash: {item.infoHash || 'Direct URL'} •{' '}
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  <View style={styles.historyActionsRow}>
                    <TouchableOpacity
                      style={styles.historyPlayBtn}
                      onPress={() =>
                        handlePlayInternal({
                          title: item.title,
                          streamUrl: item.streamUrl,
                          magnet: item.magnet,
                          infoHash: item.infoHash,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <Play color="#FFFFFF" size={13} fill="#FFFFFF" />
                      <Text style={styles.historyPlayText}>Play</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.historyDeleteBtn}
                      onPress={() => handleDeleteHistory(item.id)}
                      activeOpacity={0.7}
                    >
                      <Trash2 color="#8E8E93" size={14} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* In-App Offline Player Modal */}
      <OfflinePlayerModal
        visible={playerVisible}
        item={activeItem}
        onClose={() => {
          setPlayerVisible(false);
          setActiveItem(null);
        }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 14,
  },
  header: {
    paddingBottom: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWithDevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  devPill: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  devPillText: {
    color: Colors.primary,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  screenSubtitle: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  backendCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262835',
    padding: 14,
    gap: 8,
  },
  backendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backendLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34C759',
  },
  backendLabel: {
    color: Colors.secondaryText,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  editBackendBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#262835',
    borderRadius: 6,
  },
  editBackendText: {
    color: '#D1D5DB',
    fontSize: 10.5,
    fontWeight: '600',
  },
  backendUrlText: {
    color: '#34C759',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  backendEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backendInput: {
    flex: 1,
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#383B4B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 12,
  },
  saveBackendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backendDesc: {
    color: '#777777',
    fontSize: 10.5,
    lineHeight: 14,
  },
  inputCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262835',
    padding: 14,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: Colors.secondaryText,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearBtnText: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontWeight: '600',
  },
  magnetTextInput: {
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#262835',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 12,
    minHeight: 90,
  },
  quickChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  quickChipText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  quickChipSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#242633',
    borderWidth: 1,
    borderColor: '#323545',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  quickChipSecondaryText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '600',
  },
  titleInput: {
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#262835',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#FFFFFF',
    fontSize: 12,
  },
  parsedBox: {
    backgroundColor: '#14151C',
    borderWidth: 1,
    borderColor: '#222432',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  parsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  parsedLabel: {
    color: Colors.secondaryText,
    fontSize: 10,
    fontWeight: '700',
    width: 80,
  },
  parsedVal: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  parsedHash: {
    flex: 1,
    color: '#E5E5EA',
    fontSize: 10.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  parsedUrl: {
    flex: 1,
    color: Colors.primary,
    fontSize: 10.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  primaryPlayBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#20222D',
    borderWidth: 1,
    borderColor: '#2E3040',
    paddingVertical: 9,
    borderRadius: 8,
  },
  secondaryActionText: {
    color: '#D1D5DB',
    fontSize: 11,
    fontWeight: '700',
  },
  historyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262835',
    padding: 14,
    gap: 12,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historySectionTitle: {
    color: Colors.secondaryText,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  historyCountBadge: {
    backgroundColor: '#262835',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  historyCountText: {
    color: '#D1D5DB',
    fontSize: 9.5,
    fontWeight: '700',
  },
  clearAllText: {
    color: '#FF6B6B',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyHistoryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 6,
  },
  emptyHistoryTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyHistorySubtitle: {
    color: '#555555',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  historyList: {
    gap: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14151C',
    borderWidth: 1,
    borderColor: '#222432',
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  historyItemContent: {
    flex: 1,
    gap: 2,
  },
  historyItemTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  historyItemSub: {
    color: '#777777',
    fontSize: 10,
  },
  historyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  historyPlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  historyDeleteBtn: {
    padding: 6,
  },
});
