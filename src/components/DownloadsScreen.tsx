import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Share,
  Platform,
  RefreshControl,
  Image,
  Linking,
  KeyboardAvoidingView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Download,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  HardDrive,
  Share2,
  Plus,
  X,
  ExternalLink,
  Film,
  RotateCcw,
  Folder,
  Radio,
  Upload,
  FileUp,
  Link2,
  FileCheck,
  Sparkles,
  Youtube,
  Instagram,
  Camera,
  Check,
  Layers,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/theme';
import { useDownloads } from '../context/DownloadContext';
import { DownloadItem } from '../types/downloads';
import {
  formatBytes,
  cleanTitleFromFilename,
  getPosterForFilename,
  getStorageLocationText,
  saveToGallery,
  parseSocialVideoUrl,
  ParsedMediaResult,
  ParsedMediaFormat,
} from '../services/downloadService';
import { OfflinePlayerModal } from './OfflinePlayerModal';

export const DownloadsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    downloads,
    activeDownloadsCount,
    storageStats,
    startDownload,
    pauseDownload,
    resumeDownload,
    deleteDownload,
    rescanStorage,
    importMovie,
    isBackendConnected,
    backendUrl,
  } = useDownloads();

  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addTab, setAddTab] = useState<'social' | 'link' | 'file'>('social');
  const [socialUrl, setSocialUrl] = useState('');
  const [parsingSocial, setParsingSocial] = useState(false);
  const [parsedMedia, setParsedMedia] = useState<ParsedMediaResult | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ParsedMediaFormat | null>(null);
  const [saveToGalleryToggle, setSaveToGalleryToggle] = useState(true);
  const [manualUrl, setManualUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualFilename, setManualFilename] = useState('');
  const [selectedTorrentFile, setSelectedTorrentFile] = useState<{
    uri: string;
    name: string;
    size: number;
  } | null>(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<DownloadItem | null>(null);

  const activeQueue = downloads.filter((d) => d.status !== 'completed');
  const completedList = downloads.filter((d) => d.status === 'completed');

  const handlePasteToSocial = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setSocialUrl(text.trim());
      }
    } catch {}
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) {
        setManualUrl(text.trim());
      }
    } catch {}
  };

  const handleParseSocialVideo = async () => {
    if (!socialUrl.trim()) {
      Alert.alert('URL Required', 'Please enter or paste a valid YouTube or Instagram URL.');
      return;
    }
    setParsingSocial(true);
    try {
      const result = await parseSocialVideoUrl(socialUrl.trim(), backendUrl);
      setParsedMedia(result);
      if (result.formats && result.formats.length > 0) {
        setSelectedFormat(result.formats[0]);
      }
    } catch (err: any) {
      Alert.alert('Parse Failed', 'Could not parse video details. Check URL or internet connection.');
    } finally {
      setParsingSocial(false);
    }
  };

  const handleStartSocialDownload = async () => {
    if (!socialUrl.trim()) {
      Alert.alert('URL Required', 'Please enter a valid YouTube or Instagram video link.');
      return;
    }

    const targetTitle = manualTitle.trim() || (parsedMedia ? parsedMedia.title : 'Social Video');
    const resolution = selectedFormat ? selectedFormat.resolution : '1080p';
    const formatId = selectedFormat ? selectedFormat.id : undefined;

    setParsingSocial(true);

    try {
      let fullDownloadUrl = '';

      // 1. Try local backend server if connected
      if (backendUrl) {
        try {
          const endpoint = `${backendUrl.replace(/\/+$/, '')}/api/media/download`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Bypass-Tunnel-Reminder': 'true',
            },
            body: JSON.stringify({
              url: socialUrl.trim(),
              resolution,
              title: targetTitle,
              formatId,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.downloadUrl) {
              fullDownloadUrl = `${backendUrl.replace(/\/+$/, '')}${data.downloadUrl}`;
            }
          }
        } catch (backendErr) {
          console.warn('[Social Download Backend Error]:', backendErr);
        }
      }

      // 2. Fallback to public Cobalt media API if server unavailable
      if (!fullDownloadUrl) {
        const cobaltApis = [
          'https://api.cobalt.tools/',
          'https://co.wuk.sh/api/json',
          'https://v2.cobalt.tools/api/json',
        ];

        for (const api of cobaltApis) {
          try {
            const res = await fetch(api, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: socialUrl.trim(),
                videoQuality: resolution === 'Audio MP3' ? 'audio' : resolution.replace('p', ''),
                downloadMode: resolution === 'Audio MP3' ? 'audio' : 'auto',
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data && (data.url || data.picker?.[0]?.url)) {
                fullDownloadUrl = data.url || data.picker[0].url;
                break;
              }
            }
          } catch (cErr) {
            console.warn('Cobalt API attempt failed:', cErr);
          }
        }
      }

      if (!fullDownloadUrl) {
        throw new Error('Could not resolve direct video download stream for this URL. Please verify link or check internet connection.');
      }

      const poster = parsedMedia?.thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&q=80';
      await startDownload(fullDownloadUrl, `${targetTitle} [${resolution}]`, poster);

      Alert.alert(
        'Downloading Video 🍿',
        `"${targetTitle}" (${resolution}) is downloading to your VFlix offline library!`,
        [{ text: 'OK' }]
      );

      setSocialUrl('');
      setParsedMedia(null);
      setSelectedFormat(null);
      setManualTitle('');
      setManualFilename('');
      setAddModalVisible(false);
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Failed to start video download.');
    } finally {
      setParsingSocial(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await rescanStorage();
    } catch {}
    setRefreshing(false);
  };

  const handleManualScanStorage = async () => {
    setRefreshing(true);
    try {
      const newFound = await rescanStorage();
      if (newFound > 0) {
        Alert.alert(
          'Movies Detected 🍿',
          `Discovered ${newFound} movie${newFound === 1 ? '' : 's'} in your internal storage VFlix folders! They are ready to play offline.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Storage Scan Complete 📁',
          'All movies in your VFlix internal storage folders are indexed and ready.\n\nTip: Move downloaded .mp4 or .mkv files into "Internal Storage/VFlix", or tap "Import Video" to pick from storage.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert('Scan Failed', err?.message || 'Could not complete storage scan.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleImportVideo = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'video/*',
          'application/octet-stream',
          'application/x-matroska',
        ],
        copyToCacheDirectory: false,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        const imported = await importMovie(file.uri, file.name);
        Alert.alert(
          'Movie Ready Offline 🍿',
          `"${imported.title || file.name}" was successfully added to your VFlix offline library!`,
          [
            { text: 'Done', style: 'cancel' },
            {
              text: 'Play Movie',
              style: 'default',
              onPress: () => handlePlayInNetflixPlayer(imported),
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Import Failed', err?.message || 'Could not import movie file.');
    }
  };

  const handleTogglePause = (item: DownloadItem) => {
    if (item.status === 'downloading') {
      pauseDownload(item.id);
    } else {
      resumeDownload(item.id);
    }
  };

  const handleDelete = (item: DownloadItem) => {
    Alert.alert(
      'Delete Download',
      `Are you sure you want to remove "${item.title || item.fileName}" from internal storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteDownload(item.id),
        },
      ]
    );
  };

  const handlePlayInNetflixPlayer = (item: DownloadItem) => {
    setSelectedMovie(item);
    setPlayerModalVisible(true);
  };

  const handlePlayInExternalPlayer = async (item: DownloadItem) => {
    const targetUri = item.fileUri || item.movieFileUri;
    const title = item.title || item.movieFileName || item.fileName;

    if (!targetUri) {
      Alert.alert('Error', 'File path is not available.');
      return;
    }

    try {
      let uriToLaunch = targetUri;
      if (
        Platform.OS === 'android' &&
        targetUri.startsWith('file://') &&
        typeof FileSystem.getContentUriAsync === 'function'
      ) {
        try {
          uriToLaunch = await FileSystem.getContentUriAsync(targetUri);
        } catch {}
      }

      const supported = await Linking.canOpenURL(uriToLaunch).catch(() => false);
      if (supported) {
        await Linking.openURL(uriToLaunch);
        return;
      }
    } catch {}

    // Fallback: System open-with sheet
    try {
      await Share.share({
        title,
        message: `Watch: ${title}`,
        url: targetUri,
      });
    } catch (err: any) {
      Alert.alert('External Player', `Could not launch external player: ${err?.message || ''}`);
    }
  };

  const handleShareFile = async (item: DownloadItem) => {
    const targetUri = item.fileUri || item.movieFileUri;
    if (targetUri) {
      try {
        await Share.share({
          title: item.title || item.fileName,
          url: targetUri,
          message: `Watch: ${item.title || item.fileName}`,
        });
      } catch (err) {
        console.warn('Share error:', err);
      }
    }
  };

  const handlePickTorrentFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*', 'application/x-bittorrent'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];

        let torrentDataUri = file.uri;
        try {
          const response = await fetch(file.uri);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            torrentDataUri = `data:application/x-bittorrent;base64,${base64}`;
          }
        } catch (fetchErr) {
          console.warn('Could not read torrent via fetch, using raw URI:', fetchErr);
        }

        setSelectedTorrentFile({
          uri: torrentDataUri,
          name: file.name,
          size: file.size || 0,
        });

        const cleanName = file.name.replace(/\.torrent$/i, '');
        if (!manualTitle) {
          setManualTitle(cleanTitleFromFilename(cleanName));
        }
      }
    } catch (err: any) {
      Alert.alert('File Picker', err?.message || 'Could not pick file');
    }
  };

  const handleClearAllDownloads = () => {
    if (downloads.length === 0) return;
    Alert.alert(
      'Clear All Downloads',
      `Are you sure you want to delete all ${downloads.length} items from your downloads list and local storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const copy = [...downloads];
            for (const item of copy) {
              await deleteDownload(item.id);
            }
          },
        },
      ]
    );
  };

  const handleAddDownload = async () => {
    let targetUrl = '';
    let targetTitle = manualTitle.trim();
    let customFile = manualFilename.trim();

    if (addTab === 'file') {
      if (!selectedTorrentFile) {
        Alert.alert('No File Selected', 'Please tap to select a .torrent file.');
        return;
      }
      targetUrl = selectedTorrentFile.uri;
      if (!targetTitle) {
        targetTitle = cleanTitleFromFilename(
          selectedTorrentFile.name.replace(/\.torrent$/i, '')
        );
      }
    } else {
      targetUrl = manualUrl.trim();
      if (!targetUrl) {
        Alert.alert(
          'Download Link Required',
          'Please enter or paste a valid download link (https://...) or magnet URL.'
        );
        return;
      }
      if (!targetTitle) {
        targetTitle = customFile || 'Downloaded Movie';
      }
    }

    try {
      await startDownload(targetUrl, targetTitle);
      setSelectedTorrentFile(null);
      setManualUrl('');
      setManualTitle('');
      setManualFilename('');
      setAddModalVisible(false);
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Failed to start download.');
    }
  };

  // Storage calculation
  const totalDisk = storageStats.totalBytes || 1;
  const freeDisk = storageStats.freeBytes || 0;
  const usedDisk = Math.max(0, totalDisk - freeDisk);
  const appDownloads = storageStats.appDownloadsBytes || 0;
  const appPercent = Math.min(100, Math.max(1, (appDownloads / totalDisk) * 100));
  const otherPercent = Math.min(100, Math.max(1, ((usedDisk - appDownloads) / totalDisk) * 100));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1015" />

      {/* Modern Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Downloads</Text>
          <View style={styles.serverBadgeRow}>
            <View
              style={[
                styles.serverPill,
                {
                  backgroundColor: isBackendConnected
                    ? 'rgba(70, 211, 105, 0.12)'
                    : 'rgba(250, 36, 60, 0.12)',
                  borderColor: isBackendConnected
                    ? 'rgba(70, 211, 105, 0.3)'
                    : 'rgba(250, 36, 60, 0.3)',
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isBackendConnected ? '#46D369' : Colors.netflixRed,
                  },
                ]}
              />
              <Text
                style={[
                  styles.serverStatusText,
                  { color: isBackendConnected ? '#46D369' : Colors.netflixRed },
                ]}
              >
                {isBackendConnected ? 'ENGINE ONLINE' : 'ENGINE OFFLINE'}
              </Text>
            </View>
            <Text style={styles.readyCountText}>
              • {completedList.length} ready offline
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.netflixRed}
            colors={[Colors.netflixRed]}
          />
        }
      >
        {/* High-End YouTube & Instagram Downloader Studio */}
        <View style={styles.socialStudioCard}>
          <LinearGradient
            colors={['#2A0A10', '#1C0D18', '#14141A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.socialStudioGradient}
          >
            {/* Header Title with Platform Badges */}
            <View style={styles.socialStudioHeader}>
              <View style={styles.socialIconsRow}>
                <View style={[styles.platformIconCircle, { backgroundColor: 'rgba(255, 0, 0, 0.2)', borderColor: 'rgba(255, 0, 0, 0.4)' }]}>
                  <Youtube color="#FF0000" size={18} />
                </View>
                <View style={[styles.platformIconCircle, { backgroundColor: 'rgba(225, 48, 108, 0.2)', borderColor: 'rgba(225, 48, 108, 0.4)' }]}>
                  <Instagram color="#E1306C" size={18} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.socialStudioTitle}>YouTube & Instagram Downloader</Text>
                <Text style={styles.socialStudioSubtitle}>
                  Save Shorts, Reels, 1080p HD Videos & MP3 Audio to Gallery
                </Text>
              </View>
            </View>

            {/* Smart URL Input Field */}
            <View style={styles.socialInputContainer}>
              <View style={styles.socialInputRow}>
                {socialUrl.toLowerCase().includes('instagram') ? (
                  <Instagram color="#E1306C" size={16} style={{ marginLeft: 10 }} />
                ) : (
                  <Youtube color="#FF0000" size={16} style={{ marginLeft: 10 }} />
                )}

                <TextInput
                  style={styles.socialTextInput}
                  placeholder="Paste YouTube or Instagram link here..."
                  placeholderTextColor="#666677"
                  value={socialUrl}
                  onChangeText={(text) => {
                    setSocialUrl(text);
                    if (parsedMedia) setParsedMedia(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {socialUrl.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSocialUrl('');
                      setParsedMedia(null);
                    }}
                    style={styles.inputClearBtn}
                  >
                    <X color="#777777" size={16} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handlePasteToSocial}
                    style={styles.pasteActionBtn}
                    activeOpacity={0.8}
                  >
                    <Sparkles color="#FFFFFF" size={12} />
                    <Text style={styles.pasteActionText}>Paste</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Parsed Results Box */}
            {parsedMedia && (
              <View style={styles.socialResultBox}>
                <View style={styles.socialResultHeader}>
                  <Image
                    source={{ uri: parsedMedia.thumbnail }}
                    style={styles.socialResultThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.socialResultMeta}>
                    <View style={styles.socialPlatformPill}>
                      {parsedMedia.platform === 'youtube' ? (
                        <>
                          <Youtube color="#FF0000" size={10} />
                          <Text style={styles.socialPlatformText}>YOUTUBE</Text>
                        </>
                      ) : (
                        <>
                          <Instagram color="#E1306C" size={10} />
                          <Text style={[styles.socialPlatformText, { color: '#E1306C' }]}>INSTAGRAM</Text>
                        </>
                      )}
                    </View>
                    <Text style={styles.socialResultTitle} numberOfLines={2}>
                      {parsedMedia.title}
                    </Text>
                  </View>
                </View>

                <Text style={styles.formatSelectLabel}>SELECT RESOLUTION QUALITY</Text>
                <View style={styles.formatCardGrid}>
                  {parsedMedia.formats.map((fmt) => {
                    const isSelected = selectedFormat?.id === fmt.id || selectedFormat?.resolution === fmt.resolution;
                    return (
                      <TouchableOpacity
                        key={fmt.id}
                        style={[styles.formatCard, isSelected && styles.formatCardSelected]}
                        onPress={() => setSelectedFormat(fmt)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.formatCardTitle, isSelected && styles.formatCardTitleSelected]}>
                            {fmt.label || fmt.resolution}
                          </Text>
                        </View>
                        {isSelected && <CheckCircle2 color={Colors.netflixRed} size={16} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Auto Export to Phone Gallery Toggle */}
                <TouchableOpacity
                  style={styles.socialGalleryRow}
                  onPress={() => setSaveToGalleryToggle((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.socialCheckbox, saveToGalleryToggle && styles.socialCheckboxChecked]}>
                    {saveToGalleryToggle && <Check color="#FFFFFF" size={12} strokeWidth={3} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.socialGalleryTitle}>Export Directly to Phone Gallery</Text>
                    <Text style={styles.socialGallerySub}>Auto saves video to your Camera Roll / Photos</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Action CTA Button */}
            <TouchableOpacity
              style={styles.socialCtaBtn}
              onPress={() => {
                if (!parsedMedia) {
                  handleParseSocialVideo();
                } else {
                  handleStartSocialDownload();
                }
              }}
              disabled={parsingSocial}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#FF0000', '#B51527']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.socialCtaGradient}
              >
                {parsingSocial ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Download color="#FFFFFF" size={16} strokeWidth={2.5} />
                )}
                <Text style={styles.socialCtaText}>
                  {parsingSocial
                    ? 'Fetching Resolutions...'
                    : parsedMedia
                    ? `Download Video (${selectedFormat?.resolution || '1080p'})`
                    : 'Parse Video & Select Resolution'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* 1. Active Downloads Queue */}
        {activeQueue.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Downloading Now ({activeQueue.length})
              </Text>
              <View style={styles.activePulseBadge}>
                <Radio color={Colors.netflixRed} size={12} />
                <Text style={styles.activePulseText}>LIVE</Text>
              </View>
            </View>

            <View style={styles.queueList}>
              {activeQueue.map((item) => {
                const percent = Math.min(100, Math.round(item.progress * 100));
                const isPaused = item.status === 'paused';
                const isError = item.status === 'error';
                const posterUri =
                  item.poster ||
                  getPosterForFilename(
                    item.movieFileName || item.fileName || item.title
                  );

                return (
                  <View key={item.id} style={styles.activeCard}>
                    <View style={styles.activeTopRow}>
                      <Image
                        source={{ uri: posterUri }}
                        style={styles.activeThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.activeMetaGroup}>
                        <Text style={styles.activeTitle} numberOfLines={1}>
                          {item.title || item.movieFileName || item.fileName}
                        </Text>
                        <Text style={styles.activeSubmeta}>
                          {formatBytes(item.downloadedBytes)} of{' '}
                          {formatBytes(item.totalBytes || 0)} • {percent}%
                        </Text>
                        <View style={styles.speedBadge}>
                          <Radio
                            color={isError ? '#FF453A' : Colors.netflixRed}
                            size={11}
                          />
                          <Text
                            style={[styles.speedText, isError && { color: '#FF453A' }]}
                            numberOfLines={1}
                          >
                            {isError
                              ? `ERROR: ${item.error || 'Connection failed'}`
                              : isPaused
                              ? 'PAUSED'
                              : `${item.speed || '0 KB/s'} (${item.peersCount || 0} peers)`}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.activeActions}>
                        <TouchableOpacity
                          style={[
                            styles.circleActionBtn,
                            isError && { backgroundColor: 'rgba(255, 69, 58, 0.2)' },
                          ]}
                          onPress={() => handleTogglePause(item)}
                          activeOpacity={0.7}
                        >
                          {isError ? (
                            <RotateCcw color="#FF453A" size={15} />
                          ) : isPaused ? (
                            <Play color="#FFFFFF" size={15} fill="#FFFFFF" />
                          ) : (
                            <Pause color="#FFFFFF" size={15} fill="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.circleActionBtn}
                          onPress={() => handleDelete(item)}
                          activeOpacity={0.7}
                        >
                          <Trash2 color="#8E8E93" size={15} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.activeProgressTrack}>
                      <View
                        style={[
                          styles.activeProgressFill,
                          {
                            width: `${percent}%`,
                            backgroundColor: isError
                              ? '#FF453A'
                              : isPaused
                              ? '#8E8E93'
                              : Colors.netflixRed,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 2. Completed Downloads List with Cards */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Downloaded Movies ({completedList.length})
            </Text>
            {downloads.length > 0 && (
              <TouchableOpacity
                style={styles.clearAllSectionBtn}
                onPress={handleClearAllDownloads}
                activeOpacity={0.78}
              >
                <Trash2 color="#FF453A" size={13} />
                <Text style={styles.clearAllSectionText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {completedList.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Film color={Colors.netflixRed} size={36} />
              </View>
              <Text style={styles.emptyTitle}>No Offline Movies Downloaded</Text>
              <Text style={styles.emptySubtitle}>
                Download movies and torrents from the Search or Browser, or move externally downloaded videos into your phone's "VFlix" internal storage folder to watch offline anytime.
              </Text>
              <View style={styles.emptyActionRow}>
                <TouchableOpacity
                  style={styles.emptyScanBtn}
                  onPress={handleManualScanStorage}
                  activeOpacity={0.82}
                >
                  <RotateCcw color="#FFFFFF" size={14} />
                  <Text style={styles.emptyScanBtnText}>Scan VFlix Folder</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.emptyImportBtn}
                  onPress={handleImportVideo}
                  activeOpacity={0.82}
                >
                  <Film color="#FFFFFF" size={14} />
                  <Text style={styles.emptyImportBtnText}>Import Video File</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.completedList}>
              {completedList.map((item) => {
                const posterUri =
                  item.poster ||
                  getPosterForFilename(
                    item.movieFileName || item.fileName || item.title
                  );
                const displayTitle =
                  item.title ||
                  cleanTitleFromFilename(item.movieFileName || item.fileName);
                const sizeText = formatBytes(item.downloadedBytes || item.totalBytes);

                return (
                  <View key={item.id} style={styles.movieCard}>
                    {/* Poster Thumbnail Container */}
                    <TouchableOpacity
                      style={styles.posterWrapper}
                      activeOpacity={0.85}
                      onPress={() => handlePlayInNetflixPlayer(item)}
                    >
                      <Image
                        source={{ uri: posterUri }}
                        style={styles.posterImage}
                        resizeMode="cover"
                      />

                      {/* Play overlay button */}
                      <View style={styles.playOverlay}>
                        <View style={styles.playCircle}>
                          <Play
                            color="#FFFFFF"
                            size={22}
                            fill="#FFFFFF"
                            style={{ marginLeft: 2 }}
                          />
                        </View>
                      </View>

                      {/* Badges */}
                      <View style={styles.cardBadges}>
                        <View style={styles.resBadge}>
                          <Text style={styles.resBadgeText}>
                            {item.resolution || '1080p'}
                          </Text>
                        </View>
                        <View style={styles.offlineBadge}>
                          <CheckCircle2 color="#46D369" size={10} />
                          <Text style={styles.offlineBadgeText}>OFFLINE</Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Information & Action Buttons */}
                    <View style={styles.movieDetails}>
                      <View style={{ gap: 2 }}>
                        <Text style={styles.movieTitle} numberOfLines={1}>
                          {displayTitle}
                        </Text>
                        <Text style={styles.movieFileName} numberOfLines={1}>
                          {item.movieFileName || item.fileName}
                        </Text>
                      </View>

                      <View style={styles.metaRow}>
                        <Text style={styles.metaSize}>{sizeText}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <View style={styles.storageLocationPill}>
                          <Folder color="#46D369" size={10} />
                          <Text style={styles.storageLocationText}>
                            {getStorageLocationText(item.fileUri || item.movieFileUri)}
                          </Text>
                        </View>
                      </View>

                      {/* Watch & External Player Buttons */}
                      <View style={styles.actionButtonsRow}>
                        {/* Netflix In-App Player */}
                        <TouchableOpacity
                          style={styles.playNetflixBtn}
                          onPress={() => handlePlayInNetflixPlayer(item)}
                          activeOpacity={0.85}
                        >
                          <Play color="#FFFFFF" size={13} fill="#FFFFFF" />
                          <Text style={styles.playNetflixText}>Watch</Text>
                        </TouchableOpacity>

                        {/* External Player (VLC / MX Player) */}
                        <TouchableOpacity
                          style={styles.externalPlayerBtn}
                          onPress={() => handlePlayInExternalPlayer(item)}
                          activeOpacity={0.8}
                        >
                          <ExternalLink color="#E5E5EA" size={12} />
                          <Text style={styles.externalPlayerText}>VLC / MX</Text>
                        </TouchableOpacity>

                        {/* Share */}
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleShareFile(item)}
                          activeOpacity={0.7}
                        >
                          <Share2 color="#8E8E93" size={15} />
                        </TouchableOpacity>

                        {/* Delete */}
                        <TouchableOpacity
                          style={styles.deleteIconBtn}
                          onPress={() => handleDelete(item)}
                          activeOpacity={0.7}
                        >
                          <Trash2 color="#FF453A" size={14} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modern Add Torrent Modal Sheet */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setAddModalVisible(false)}
          />

          <View style={[styles.modernModalSheet, { paddingBottom: insets.bottom + 18 }]}>
            {/* Top Sheet Drag Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={styles.sheetIconCircle}>
                  <Download color={Colors.netflixRed} size={20} />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>
                    {addTab === 'social'
                      ? 'Video Downloader'
                      : addTab === 'link'
                      ? 'Direct Link / Magnet'
                      : 'Torrent File Downloader'}
                  </Text>
                  <Text style={styles.sheetSubtitle}>
                    {addTab === 'social'
                      ? 'Download YouTube videos & Instagram Reels HD'
                      : addTab === 'link'
                      ? 'Download direct HTTP video links or magnet URLs'
                      : 'Save torrent files directly to internal storage'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setAddModalVisible(false)}
                activeOpacity={0.7}
              >
                <X color="#A0A0A0" size={18} />
              </TouchableOpacity>
            </View>

            {/* Segmented 3-Tab Switcher */}
            <View style={styles.modernTabSwitcher}>
              {/* Tab 1: YouTube & Instagram */}
              <TouchableOpacity
                style={[styles.modernTabItem, addTab === 'social' && styles.modernTabItemActive]}
                onPress={() => setAddTab('social')}
                activeOpacity={0.8}
              >
                <Youtube color={addTab === 'social' ? '#FFFFFF' : '#FF0000'} size={14} />
                <Text
                  style={[
                    styles.modernTabItemText,
                    addTab === 'social' && styles.modernTabItemTextActive,
                  ]}
                  numberOfLines={1}
                >
                  YouTube / Insta
                </Text>
              </TouchableOpacity>

              {/* Tab 2: HTTP Direct / Magnet */}
              <TouchableOpacity
                style={[styles.modernTabItem, addTab === 'link' && styles.modernTabItemActive]}
                onPress={() => setAddTab('link')}
                activeOpacity={0.8}
              >
                <Link2 color={addTab === 'link' ? '#FFFFFF' : '#888888'} size={14} />
                <Text
                  style={[
                    styles.modernTabItemText,
                    addTab === 'link' && styles.modernTabItemTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Direct / Magnet
                </Text>
              </TouchableOpacity>

              {/* Tab 3: Upload .torrent */}
              <TouchableOpacity
                style={[styles.modernTabItem, addTab === 'file' && styles.modernTabItemActive]}
                onPress={() => setAddTab('file')}
                activeOpacity={0.8}
              >
                <FileUp color={addTab === 'file' ? '#FFFFFF' : '#888888'} size={14} />
                <Text
                  style={[
                    styles.modernTabItemText,
                    addTab === 'file' && styles.modernTabItemTextActive,
                  ]}
                  numberOfLines={1}
                >
                  Torrent File
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: YOUTUBE & INSTAGRAM DOWNLOADER */}
            {addTab === 'social' && (
              <View style={styles.tabContentGroup}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>YOUTUBE OR INSTAGRAM VIDEO LINK</Text>
                  <View style={styles.inputContainer}>
                    <Youtube color="#FF0000" size={16} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputModern}
                      placeholder="Paste https://youtube.com/watch... or Instagram Reel"
                      placeholderTextColor="#555555"
                      value={socialUrl}
                      onChangeText={(text) => {
                        setSocialUrl(text);
                        if (parsedMedia) setParsedMedia(null);
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {socialUrl.length > 0 ? (
                      <TouchableOpacity
                        onPress={() => {
                          setSocialUrl('');
                          setParsedMedia(null);
                        }}
                        style={styles.inputClearBtn}
                      >
                        <X color="#777777" size={15} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={handlePasteToSocial}
                        style={styles.pasteInlineBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.pasteInlineText}>Paste</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {parsedMedia && (
                  <View style={styles.parsedCard}>
                    <View style={styles.parsedHeaderRow}>
                      <Image
                        source={{ uri: parsedMedia.thumbnail }}
                        style={styles.parsedThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.parsedMeta}>
                        <View style={styles.platformBadge}>
                          {parsedMedia.platform === 'youtube' ? (
                            <>
                              <Youtube color="#FF0000" size={11} />
                              <Text style={styles.platformBadgeText}>YOUTUBE VIDEO</Text>
                            </>
                          ) : parsedMedia.platform === 'instagram' ? (
                            <>
                              <Instagram color="#E1306C" size={11} />
                              <Text style={[styles.platformBadgeText, { color: '#E1306C' }]}>INSTAGRAM REEL</Text>
                            </>
                          ) : (
                            <>
                              <Film color="#46D369" size={11} />
                              <Text style={[styles.platformBadgeText, { color: '#46D369' }]}>DIRECT VIDEO</Text>
                            </>
                          )}
                        </View>
                        <Text style={styles.parsedTitle} numberOfLines={2}>
                          {parsedMedia.title}
                        </Text>
                        {parsedMedia.author ? (
                          <Text style={styles.parsedAuthor}>{parsedMedia.author}</Text>
                        ) : null}
                      </View>
                    </View>

                    <Text style={styles.resolutionHeader}>SELECT VIDEO RESOLUTION / QUALITY</Text>
                    <View style={styles.resolutionGrid}>
                      {parsedMedia.formats.map((fmt) => {
                        const isSelected = selectedFormat?.id === fmt.id || selectedFormat?.resolution === fmt.resolution;
                        return (
                          <TouchableOpacity
                            key={fmt.id}
                            style={[styles.resChip, isSelected && styles.resChipActive]}
                            onPress={() => setSelectedFormat(fmt)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.resChipText, isSelected && styles.resChipTextActive]}>
                              {fmt.label || fmt.resolution}
                            </Text>
                            {isSelected && <Check color="#FFFFFF" size={11} strokeWidth={2.5} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={styles.galleryToggleRow}
                      onPress={() => setSaveToGalleryToggle((prev) => !prev)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.checkboxSquare, saveToGalleryToggle && styles.checkboxActive]}>
                        {saveToGalleryToggle && <Check color="#FFFFFF" size={11} strokeWidth={3} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.galleryToggleTitle}>Save directly to Phone Gallery</Text>
                        <Text style={styles.galleryToggleSub}>Auto-exports video to Camera Roll / Photos App</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: MAGNET / LINK / DIRECT HTTP */}
            {addTab === 'link' && (
              <View style={styles.tabContentGroup}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>DIRECT HTTP MOVIE LINK / MAGNET URL</Text>
                  <View style={styles.inputContainer}>
                    <Link2 color="#777777" size={16} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputModern}
                      placeholder="https://.../movie.mp4 or magnet:?xt=urn:..."
                      placeholderTextColor="#555555"
                      value={manualUrl}
                      onChangeText={setManualUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {manualUrl.length > 0 ? (
                      <TouchableOpacity
                        onPress={() => setManualUrl('')}
                        style={styles.inputClearBtn}
                      >
                        <X color="#777777" size={15} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={handlePasteFromClipboard}
                        style={styles.pasteInlineBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.pasteInlineText}>Paste</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Title Input */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>MOVIE TITLE (OPTIONAL)</Text>
                  <View style={styles.inputContainer}>
                    <Film color="#777777" size={16} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputModern}
                      placeholder="E.g. Inception (2010) 1080p"
                      placeholderTextColor="#555555"
                      value={manualTitle}
                      onChangeText={setManualTitle}
                    />
                  </View>
                </View>

                {/* Custom File Name Input */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>CUSTOM SAVE FILE NAME (OPTIONAL)</Text>
                  <View style={styles.inputContainer}>
                    <Folder color="#777777" size={16} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputModern}
                      placeholder="E.g. Inception_1080p.mp4"
                      placeholderTextColor="#555555"
                      value={manualFilename}
                      onChangeText={setManualFilename}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* TAB 3: FILE UPLOAD */}
            {addTab === 'file' && (
              <View style={styles.tabContentGroup}>
                <TouchableOpacity
                  style={[
                    styles.modernUploadZone,
                    selectedTorrentFile && styles.modernUploadZoneSelected,
                  ]}
                  onPress={handlePickTorrentFile}
                  activeOpacity={0.85}
                >
                  {selectedTorrentFile ? (
                    <View style={styles.selectedFileBox}>
                      <View style={styles.selectedFileHeader}>
                        <View style={styles.selectedIconCircle}>
                          <FileCheck color="#46D369" size={24} />
                        </View>
                        <View style={styles.selectedFileInfo}>
                          <Text style={styles.selectedFileName} numberOfLines={1}>
                            {selectedTorrentFile.name}
                          </Text>
                          <View style={styles.selectedMetaRow}>
                            <View style={styles.sizeBadge}>
                              <Text style={styles.sizeBadgeText}>
                                {formatBytes(selectedTorrentFile.size)}
                              </Text>
                            </View>
                            <View style={styles.readyBadge}>
                              <CheckCircle2 color="#46D369" size={11} />
                              <Text style={styles.readyBadgeText}>Torrent Ready</Text>
                            </View>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.changeFileBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            setSelectedTorrentFile(null);
                          }}
                          activeOpacity={0.7}
                        >
                          <X color="#888888" size={18} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.emptyUploadContent}>
                      <View style={styles.emptyUploadIcon}>
                        <Upload color={Colors.netflixRed} size={24} />
                      </View>
                      <Text style={styles.emptyUploadTitle}>Tap to Browse .torrent File</Text>
                      <Text style={styles.emptyUploadSubtitle}>
                        Select torrent file downloaded from browser or Telegram
                      </Text>
                      <View style={styles.browseActionPill}>
                        <Text style={styles.browseActionText}>Browse Storage</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Title Input */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>MOVIE TITLE (OPTIONAL)</Text>
                  <View style={styles.inputContainer}>
                    <Film color="#777777" size={16} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputModern}
                      placeholder="E.g. Leo (2023) 1080p WebRip"
                      placeholderTextColor="#555555"
                      value={manualTitle}
                      onChangeText={setManualTitle}
                    />
                  </View>
                </View>

                {/* Custom File Name Input */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>CUSTOM SAVE FILE NAME (OPTIONAL)</Text>
                  <View style={styles.inputContainer}>
                    <Folder color="#777777" size={16} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputModern}
                      placeholder="E.g. Leo_2023_1080p.mkv"
                      placeholderTextColor="#555555"
                      value={manualFilename}
                      onChangeText={setManualFilename}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Storage Info Banner */}
            <View style={styles.storageInfoBanner}>
              <Folder color="#46D369" size={15} />
              <Text style={styles.storageInfoText} numberOfLines={1}>
                Target: Internal Storage/VFlix
              </Text>
              <Text style={styles.storageFreeText}>
                {formatBytes(freeDisk)} Free
              </Text>
            </View>

            {/* Submit Action Button */}
            <TouchableOpacity
              style={styles.submitButtonTouchable}
              onPress={() => {
                if (addTab === 'social') {
                  if (!parsedMedia) {
                    handleParseSocialVideo();
                  } else {
                    handleStartSocialDownload();
                  }
                } else if (addTab === 'file' && !selectedTorrentFile) {
                  handlePickTorrentFile();
                } else {
                  handleAddDownload();
                }
              }}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={addTab === 'social' ? ['#FF0000', '#B51527'] : [Colors.netflixRed, '#B51527']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Download color="#FFFFFF" size={18} strokeWidth={2.2} />
                <Text style={styles.submitButtonText}>
                  {addTab === 'social'
                    ? parsedMedia
                      ? `Start Downloading Video (${selectedFormat?.resolution || '1080p'})`
                      : 'Parse Video & Select Resolution'
                    : addTab === 'file'
                    ? selectedTorrentFile
                      ? 'Start Downloading Movie'
                      : 'Browse & Pick .torrent File'
                    : manualUrl.trim()
                    ? 'Start Downloading Movie'
                    : 'Paste Magnet Link or Direct HTTP Link'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Offline Video Player Modal */}
      <OfflinePlayerModal
        visible={playerModalVisible}
        item={selectedMovie}
        onClose={() => setPlayerModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1015',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1C24',
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  serverBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  serverStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  readyCountText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearAllSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 69, 58, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.35)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  clearAllSectionText: {
    color: '#FF453A',
    fontSize: 11,
    fontWeight: '700',
  },
  clearAllHeaderBtnText: {
    color: '#FF453A',
    fontSize: 12,
    fontWeight: '700',
  },
  importHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E202A',
    borderWidth: 1,
    borderColor: '#2D303E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  importHeaderBtnText: {
    color: '#E5E5EA',
    fontSize: 12,
    fontWeight: '700',
  },
  addIconHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  addIconHeaderGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  storageCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#232632',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  storageIconWrapper: {
    width: 36,
    height: 36,
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
    fontSize: 14,
    fontWeight: '700',
  },
  storageStatsText: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 1,
  },
  storageBarTrack: {
    height: 8,
    backgroundColor: '#1E202B',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 12,
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
    paddingTop: 2,
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
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '500',
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#232632',
    gap: 8,
  },
  folderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  folderIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(70, 211, 105, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderTextWrapper: {
    flex: 1,
    gap: 1,
  },
  folderPathText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  folderSubText: {
    color: '#8E8E93',
    fontSize: 10,
  },
  folderActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  importQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E202B',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D303E',
  },
  importQuickText: {
    color: '#DDDDDD',
    fontSize: 10,
    fontWeight: '600',
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
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  activePulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activePulseText: {
    color: Colors.netflixRed,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  queueList: {
    gap: 12,
  },
  activeCard: {
    backgroundColor: '#181A20',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#262934',
  },
  activeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeThumbnail: {
    width: 52,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#121318',
  },
  activeMetaGroup: {
    flex: 1,
    gap: 3,
  },
  activeTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  activeSubmeta: {
    color: '#8E8E93',
    fontSize: 11,
  },
  speedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  speedText: {
    color: Colors.netflixRed,
    fontSize: 10,
    fontWeight: '700',
  },
  activeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#252834',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeProgressTrack: {
    height: 4,
    backgroundColor: '#252834',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  activeProgressFill: {
    height: '100%',
  },
  emptyState: {
    backgroundColor: '#181A20',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#262934',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyScanBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#252834',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#343848',
  },
  emptyImportBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  completedList: {
    gap: 14,
  },
  movieCard: {
    flexDirection: 'row',
    backgroundColor: '#181A20',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262934',
    padding: 10,
    alignItems: 'center',
  },
  posterWrapper: {
    width: 82,
    height: 114,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#121318',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(250, 36, 60, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadges: {
    position: 'absolute',
    top: 6,
    left: 6,
    gap: 4,
  },
  resBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  offlineBadgeText: {
    color: '#46D369',
    fontSize: 8,
    fontWeight: '800',
  },
  movieDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
    gap: 6,
  },
  movieTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  movieFileName: {
    color: '#8E8E93',
    fontSize: 10.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaSize: {
    color: '#46D369',
    fontSize: 10.5,
    fontWeight: '700',
  },
  metaDot: {
    color: '#444444',
  },
  storageLocationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  storageLocationText: {
    color: '#46D369',
    fontSize: 9.5,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  playNetflixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  playNetflixText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700',
  },
  externalPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#252834',
    borderWidth: 1,
    borderColor: '#343848',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
  },
  externalPlayerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#222530',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasteInlineBtn: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
    marginRight: 6,
  },
  pasteInlineText: {
    color: Colors.netflixRed,
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modernModalSheet: {
    backgroundColor: '#181A20',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: '#262934',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#343848',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sheetIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sheetSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 1,
  },
  sheetCloseBtn: {
    padding: 6,
  },
  modernTabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#12141A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  modernTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  modernTabItemActive: {
    backgroundColor: Colors.netflixRed,
  },
  modernTabItemText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  modernTabItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabContentGroup: {
    gap: 14,
    marginBottom: 16,
  },
  modernUploadZone: {
    backgroundColor: '#12141A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2A2D3A',
    borderStyle: 'dashed',
    padding: 16,
  },
  modernUploadZoneSelected: {
    borderColor: '#46D369',
    borderStyle: 'solid',
    backgroundColor: 'rgba(70, 211, 105, 0.05)',
  },
  emptyUploadContent: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  emptyUploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  emptyUploadTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyUploadSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    textAlign: 'center',
  },
  browseActionPill: {
    marginTop: 6,
    backgroundColor: 'rgba(250, 36, 60, 0.18)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
  },
  browseActionText: {
    color: '#FF6B6B',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedFileBox: {
    width: '100%',
  },
  selectedFileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(70, 211, 105, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedFileInfo: {
    flex: 1,
    gap: 4,
  },
  selectedFileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeBadge: {
    backgroundColor: '#252834',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sizeBadgeText: {
    color: '#CCCCCC',
    fontSize: 10,
    fontWeight: '600',
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readyBadgeText: {
    color: '#46D369',
    fontSize: 10,
    fontWeight: '700',
  },
  changeFileBtn: {
    padding: 6,
    backgroundColor: '#252834',
    borderRadius: 14,
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2D3A',
    paddingHorizontal: 12,
  },
  inputLeadingIcon: {
    marginRight: 8,
  },
  textInputModern: {
    flex: 1,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 13,
  },
  inputClearBtn: {
    padding: 4,
  },
  storageInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(70, 211, 105, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(70, 211, 105, 0.25)',
    marginBottom: 16,
  },
  storageInfoText: {
    color: '#D0D0D0',
    fontSize: 11,
    flex: 1,
  },
  storageFreeText: {
    color: '#46D369',
    fontSize: 11,
    fontWeight: '700',
  },
  submitButtonTouchable: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  galleryIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  parseBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  parseBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  parseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  parsedCard: {
    backgroundColor: '#12141A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2D3A',
    gap: 12,
  },
  parsedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  parsedThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#1C1F2B',
  },
  parsedMeta: {
    flex: 1,
    gap: 3,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  platformBadgeText: {
    color: '#FF0000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  parsedTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  parsedAuthor: {
    color: '#8E8E93',
    fontSize: 11,
  },
  resolutionHeader: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  resolutionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1C1F2B',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D303E',
  },
  resChipActive: {
    backgroundColor: 'rgba(250, 36, 60, 0.2)',
    borderColor: Colors.netflixRed,
  },
  resChipText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  resChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  galleryToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.25)',
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#343848',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#181A20',
  },
  checkboxActive: {
    backgroundColor: '#30D158',
    borderColor: '#30D158',
  },
  galleryToggleTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  galleryToggleSub: {
    color: '#8E8E93',
    fontSize: 10,
  },
  hubSection: {
    marginBottom: 20,
  },
  hubSectionTitle: {
    color: '#8E8E93',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingLeft: 2,
  },
  hubGrid: {
    gap: 10,
  },
  hubGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hubCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262934',
  },
  hubCardDisabled: {
    opacity: 0.85,
  },
  hubCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 9,
  },
  hubIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubCardInfo: {
    flex: 1,
    gap: 2,
    overflow: 'hidden',
  },
  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  hubCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  hubBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  hubBadgeText: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  hubCardSubtitle: {
    color: '#8E8E93',
    fontSize: 10,
    lineHeight: 13,
  },
  socialStudioCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2D3A',
  },
  socialStudioGradient: {
    padding: 16,
    gap: 14,
  },
  socialStudioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  socialIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  platformIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialStudioTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  socialStudioSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  socialInputContainer: {
    gap: 8,
  },
  socialInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12141C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3042',
    paddingRight: 6,
  },
  socialTextInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  pasteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  pasteActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  socialResultBox: {
    backgroundColor: '#12141C',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2D3042',
    gap: 12,
  },
  socialResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  socialResultThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#1C1F2B',
  },
  socialResultMeta: {
    flex: 1,
    gap: 4,
  },
  socialPlatformPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialPlatformText: {
    color: '#FF0000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  socialResultTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  formatSelectLabel: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  formatCardGrid: {
    gap: 8,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181B26',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2A2E3D',
  },
  formatCardSelected: {
    borderColor: Colors.netflixRed,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
  },
  formatCardTitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  formatCardTitleSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  formatCardSub: {
    color: '#666677',
    fontSize: 10,
    marginTop: 2,
  },
  socialGalleryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.25)',
  },
  socialCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#343848',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#181A20',
  },
  socialCheckboxChecked: {
    backgroundColor: '#30D158',
    borderColor: '#30D158',
  },
  socialGalleryTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  socialGallerySub: {
    color: '#8E8E93',
    fontSize: 10,
  },
  socialCtaBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  socialCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  socialCtaText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
