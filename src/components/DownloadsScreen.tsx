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
  FileCode,
  Share2,
  Plus,
  X,
  ExternalLink,
  Film,
  RotateCcw,
  Folder,
  Radio,
  Clock,
  Upload,
  FileUp,
  Link2,
  FileCheck,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Colors } from '../constants/theme';
import { useDownloads } from '../context/DownloadContext';
import { DownloadItem } from '../types/downloads';
import {
  formatBytes,
  cleanTitleFromFilename,
  getPosterForFilename,
} from '../services/downloadService';
import { torrentEngine } from '../services/torrentEngine';
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
  } = useDownloads();

  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addTab, setAddTab] = useState<'file' | 'link'>('file');
  const [manualUrl, setManualUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [selectedTorrentFile, setSelectedTorrentFile] = useState<{
    uri: string;
    name: string;
    size: number;
  } | null>(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<DownloadItem | null>(null);

  const activeQueue = downloads.filter((d) => d.status !== 'completed');
  const completedList = downloads.filter((d) => d.status === 'completed');

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
          'Movies Detected',
          `Discovered ${newFound} movie${newFound === 1 ? '' : 's'} in your internal storage VFlix folders! They are ready to play offline.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Storage Scan Complete',
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
          'Movie Ready Offline',
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

        // On Android, ExpoFileSystem (readAsStringAsync / copyAsync) cannot access
        // the DocumentPicker sandbox path even with copyToCacheDirectory:true.
        // Solution: read the file immediately via fetch() — which CAN access
        // file:// URIs returned by DocumentPicker on Android — and convert the
        // content to a base64 data: URI so downstream code needs no file I/O.
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


  const handleAddDownload = async () => {
    let targetUrl = '';
    let targetTitle = manualTitle.trim();

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
          'Magnet / URL Required',
          'Please enter or paste a valid magnet: link or .torrent URL.'
        );
        return;
      }
      if (!targetTitle) {
        targetTitle = 'Torrent Movie';
      }
    }

    try {
      await startDownload(targetUrl, targetTitle);
      setSelectedTorrentFile(null);
      setManualUrl('');
      setManualTitle('');
      setAddModalVisible(false);
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Failed to start download.');
    }
  };

  // Stream Modal State
  const [streamModalVisible, setStreamModalVisible] = useState(false);
  const [streamTab, setStreamTab] = useState<'file' | 'link'>('link');
  const [streamUrl, setStreamUrl] = useState('');
  const [streamFile, setStreamFile] = useState<{ uri: string; name: string; size: number } | null>(null);

  const handlePickStreamFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*', 'application/x-bittorrent'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setStreamFile({
          uri: res.assets[0].uri,
          name: res.assets[0].name,
          size: res.assets[0].size || 0,
        });
      }
    } catch {}
  };

  const handleStreamOnline = async () => {
    let webtorLink = '';

    if (streamTab === 'link') {
      const target = streamUrl.trim();
      if (!target) {
        Alert.alert('Error', 'Please paste a valid magnet link.');
        return;
      }
      if (target.startsWith('magnet:')) {
        webtorLink = `https://webtor.io/show?magnet=${encodeURIComponent(target)}`;
      } else {
        Alert.alert('Error', 'Only magnet links are supported here. Use the File tab for .torrent files.');
        return;
      }
    } else {
      // Stream via File: Use the torrent engine temporarily to extract the infoHash
      if (!streamFile) {
        handlePickStreamFile();
        return;
      }

      try {
        const response = await fetch(streamFile.uri);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const dataUri = `data:application/x-bittorrent;base64,${btoa(binary)}`;

        // We use a promise to wait for the metadata event from the engine
        const getMagnet = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            unsubscribe();
            reject(new Error('Timed out reading .torrent file'));
          }, 8000);

          const unsubscribe = torrentEngine.subscribe((event) => {
            if (event.id === 'stream_extract' && event.type === 'metadata') {
              clearTimeout(timeout);
              unsubscribe();
              torrentEngine.removeTorrent('stream_extract');
              const magnet = `magnet:?xt=urn:btih:${event.data.infoHash}&dn=${encodeURIComponent(event.data.name || streamFile.name)}`;
              resolve(magnet);
            }
            if (event.id === 'stream_extract' && event.type === 'error') {
              clearTimeout(timeout);
              unsubscribe();
              torrentEngine.removeTorrent('stream_extract');
              reject(new Error(event.data || 'Failed to read torrent'));
            }
          });

          torrentEngine.addTorrent('stream_extract', dataUri);
        });

        const generatedMagnet = await getMagnet;
        webtorLink = `https://webtor.io/show?magnet=${encodeURIComponent(generatedMagnet)}`;
      } catch (err: any) {
        Alert.alert('Extraction Failed', err.message);
        return;
      }
    }

    setStreamModalVisible(false);
    setStreamUrl('');
    setStreamFile(null);

    Linking.openURL(webtorLink).catch((err) => {
      Alert.alert('Error', 'Could not launch browser: ' + err.message);
    });
  };

  // Storage calculation
  const totalDisk = storageStats.totalBytes || 1;
  const freeDisk = storageStats.freeBytes || 0;
  const usedDisk = Math.max(0, totalDisk - freeDisk);
  const appDownloads = storageStats.appDownloadsBytes || 0;
  const appPercent = Math.min(100, Math.max(1, (appDownloads / totalDisk) * 100));
  const otherPercent = Math.min(100, Math.max(1, ((usedDisk - appDownloads) / totalDisk) * 100));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>Downloads</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={{ 
              flexDirection: 'row', alignItems: 'center', gap: 4, 
              backgroundColor: isBackendConnected ? 'rgba(70,211,105,0.15)' : 'rgba(229,9,20,0.15)',
              paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8
            }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isBackendConnected ? '#46D369' : Colors.netflixRed }} />
              <Text style={{ fontSize: 9, color: isBackendConnected ? '#46D369' : Colors.netflixRed, fontWeight: '800' }}>
                {isBackendConnected ? 'SERVER ON' : 'SERVER OFF'}
              </Text>
            </View>
            <Text style={[styles.headerSubtitle, { marginTop: 0, flex: 1 }]} numberOfLines={1}>
              • {completedList.length} ready offline
            </Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.importHeaderBtn}
            onPress={handleImportVideo}
            activeOpacity={0.8}
          >
            <Film color="#FFFFFF" size={14} />
            <Text style={styles.importHeaderBtnText}>Import</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.streamOnlineBtn}
            onPress={() => setStreamModalVisible(true)}
            activeOpacity={0.8}
          >
            <Play color="#FFFFFF" size={12} fill="#FFFFFF" />
            <Text style={styles.addBtnText}>Stream</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.8}
          >
            <Plus color="#FFFFFF" size={15} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
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
        {/* Real Device Storage Card */}
        <View style={styles.storageCard}>
          <View style={styles.storageHeader}>
            <HardDrive color={Colors.textSecondary} size={16} />
            <Text style={styles.storageTitle}>Device Storage</Text>
            <Text style={styles.storageStats}>
              {formatBytes(appDownloads)} downloaded • {formatBytes(freeDisk)} free
            </Text>
          </View>

          <View style={styles.storageBarTrack}>
            <View style={[styles.storageBarApp, { width: `${appPercent}%` }]} />
            <View style={[styles.storageBarOther, { width: `${otherPercent}%` }]} />
          </View>

          <View style={styles.storageLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.netflixRed }]} />
              <Text style={styles.legendText}>App ({formatBytes(appDownloads)})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#555555' }]} />
              <Text style={styles.legendText}>Used ({formatBytes(usedDisk)})</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#222222' }]} />
              <Text style={styles.legendText}>Free ({formatBytes(freeDisk)})</Text>
            </View>
          </View>

          {/* Internal Storage Folder Banner */}
          <View style={styles.folderRow}>
            <View style={styles.folderLeft}>
              <Folder color="#46D369" size={17} />
              <View style={styles.folderTextWrapper}>
                <Text style={styles.folderPathText}>Internal Storage / VFlix</Text>
                <Text style={styles.folderSubText}>
                  Move external movies here to auto-display in the app
                </Text>
              </View>
            </View>
            <View style={styles.folderActionsRight}>
              <TouchableOpacity
                style={styles.importQuickBtn}
                onPress={handleImportVideo}
                activeOpacity={0.7}
              >
                <Upload color="#CCCCCC" size={12} />
                <Text style={styles.importQuickText}>Import</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rescanStorageBtn}
                onPress={handleManualScanStorage}
                activeOpacity={0.7}
              >
                <RotateCcw color={Colors.netflixRed} size={12} />
                <Text style={styles.rescanStorageText}>Scan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 1. Active Downloads Queue */}
        {activeQueue.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Downloading Now ({activeQueue.length})
            </Text>

            <View style={styles.queueList}>
              {activeQueue.map((item) => {
                const percent = Math.min(100, Math.round(item.progress * 100));
                const isPaused = item.status === 'paused';
                const posterUri = getPosterForFilename(item.movieFileName || item.fileName);

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
                          {formatBytes(item.downloadedBytes)} of {formatBytes(item.totalBytes || 0)} • {percent}%
                        </Text>
                        <View style={styles.speedBadge}>
                          <Radio color={Colors.netflixRed} size={11} />
                          <Text style={styles.speedText}>
                            {isPaused ? 'PAUSED' : `${item.speed || '0 KB/s'} (${item.peersCount || 0} peers)`}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.activeActions}>
                        <TouchableOpacity
                          style={styles.circleActionBtn}
                          onPress={() => handleTogglePause(item)}
                          activeOpacity={0.7}
                        >
                          {isPaused ? (
                            <Play color="#FFFFFF" size={16} fill="#FFFFFF" />
                          ) : (
                            <Pause color="#FFFFFF" size={16} fill="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.circleActionBtn}
                          onPress={() => handleDelete(item)}
                          activeOpacity={0.7}
                        >
                          <Trash2 color="#888888" size={16} />
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
                            backgroundColor: isPaused ? '#888888' : Colors.netflixRed,
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

        {/* 2. Completed Downloads List with Rich Thumbnails & Netflix Views */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Downloaded Movies ({completedList.length})
          </Text>

          {completedList.length === 0 ? (
            <View style={styles.emptyState}>
              <Film color="#444444" size={48} />
              <Text style={styles.emptyTitle}>No Movies Downloaded Yet</Text>
              <Text style={styles.emptySubtitle}>
                Download movies and torrents from the Browser, or move externally downloaded movies into your phone's "VFlix" internal storage folder to watch offline anytime.
              </Text>
              <View style={styles.emptyActionRow}>
                <TouchableOpacity
                  style={styles.emptyScanBtn}
                  onPress={handleManualScanStorage}
                  activeOpacity={0.8}
                >
                  <RotateCcw color="#FFFFFF" size={14} />
                  <Text style={styles.emptyScanBtnText}>Scan VFlix Folder</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.emptyImportBtn}
                  onPress={handleImportVideo}
                  activeOpacity={0.8}
                >
                  <Film color="#FFFFFF" size={14} />
                  <Text style={styles.emptyImportBtnText}>Import Video File</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.completedList}>
              {completedList.map((item) => {
                const posterUri = getPosterForFilename(
                  item.movieFileName || item.fileName || item.title
                );
                const displayTitle =
                  item.title ||
                  cleanTitleFromFilename(item.movieFileName || item.fileName);
                const sizeText = formatBytes(item.downloadedBytes || item.totalBytes);

                return (
                  <View key={item.id} style={styles.movieCard}>
                    {/* Poster Thumbnail Container with Netflix Play Touch */}
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
                          <Play color="#FFFFFF" size={24} fill="#FFFFFF" style={{ marginLeft: 2 }} />
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
                          <CheckCircle2 color="#46D369" size={11} />
                          <Text style={styles.offlineBadgeText}>OFFLINE</Text>
                        </View>
                      </View>
                    </TouchableOpacity>

                    {/* Information & Action Buttons */}
                    <View style={styles.movieDetails}>
                      <Text style={styles.movieTitle} numberOfLines={1}>
                        {displayTitle}
                      </Text>
                      <Text style={styles.movieFileName} numberOfLines={1}>
                        {item.movieFileName || item.fileName}
                      </Text>

                      <View style={styles.metaRow}>
                        <Text style={styles.metaSize}>{sizeText}</Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Text style={styles.metaDate}>Ready to watch</Text>
                      </View>

                      {/* Netflix Watch & External Player Buttons */}
                      <View style={styles.actionButtonsRow}>
                        {/* Netflix In-App Player */}
                        <TouchableOpacity
                          style={styles.playNetflixBtn}
                          onPress={() => handlePlayInNetflixPlayer(item)}
                          activeOpacity={0.85}
                        >
                          <Play color="#FFFFFF" size={14} fill="#FFFFFF" />
                          <Text style={styles.playNetflixText}>Watch</Text>
                        </TouchableOpacity>

                        {/* External Player (VLC / MX Player) */}
                        <TouchableOpacity
                          style={styles.externalPlayerBtn}
                          onPress={() => handlePlayInExternalPlayer(item)}
                          activeOpacity={0.8}
                        >
                          <ExternalLink color="#FFFFFF" size={13} />
                          <Text style={styles.externalPlayerText}>VLC / MX</Text>
                        </TouchableOpacity>

                        {/* Share */}
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleShareFile(item)}
                          activeOpacity={0.7}
                        >
                          <Share2 color="#AAAAAA" size={16} />
                        </TouchableOpacity>

                        {/* Delete */}
                        <TouchableOpacity
                          style={styles.iconActionBtn}
                          onPress={() => handleDelete(item)}
                          activeOpacity={0.7}
                        >
                          <Trash2 color="#888888" size={16} />
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

      {/* Modern Add Torrent Modal */}
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

          <View style={[styles.modernModalSheet, { paddingBottom: insets.bottom + 20 }]}>
            {/* Top Sheet Drag Indicator */}
            <View style={styles.sheetHandle} />

            {/* Modern Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={styles.sheetIconCircle}>
                  <Download color={Colors.netflixRed} size={20} />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Add Torrent</Text>
                  <Text style={styles.sheetSubtitle}>
                    Stream & save movies directly to internal storage
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

            {/* Modern Segmented Tab Switcher */}
            <View style={styles.modernTabSwitcher}>
              <TouchableOpacity
                style={[styles.modernTabItem, addTab === 'file' && styles.modernTabItemActive]}
                onPress={() => setAddTab('file')}
                activeOpacity={0.8}
              >
                <FileUp
                  color={addTab === 'file' ? '#FFFFFF' : '#888888'}
                  size={16}
                />
                <Text
                  style={[
                    styles.modernTabItemText,
                    addTab === 'file' && styles.modernTabItemTextActive,
                  ]}
                >
                  Upload .torrent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modernTabItem, addTab === 'link' && styles.modernTabItemActive]}
                onPress={() => setAddTab('link')}
                activeOpacity={0.8}
              >
                <Link2
                  color={addTab === 'link' ? '#FFFFFF' : '#888888'}
                  size={16}
                />
                <Text
                  style={[
                    styles.modernTabItemText,
                    addTab === 'link' && styles.modernTabItemTextActive,
                  ]}
                >
                  Magnet / URL
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: FILE UPLOAD */}
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
                        <Upload color={Colors.netflixRed} size={26} />
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

                {/* Optional Title Field */}
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
              </View>
            )}

            {/* TAB 2: MAGNET / LINK */}
            {addTab === 'link' && (
              <View style={styles.tabContentGroup}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>TORRENT URL OR MAGNET LINK</Text>
                  <View style={styles.inputContainer}>
                    <Link2 color="#777777" size={16} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputModern}
                      placeholder="Paste magnet:?xt=urn:... or .torrent URL"
                      placeholderTextColor="#555555"
                      value={manualUrl}
                      onChangeText={setManualUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {manualUrl.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setManualUrl('')}
                        style={styles.inputClearBtn}
                      >
                        <X color="#777777" size={15} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Optional Title Field */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>MOVIE TITLE (OPTIONAL)</Text>
                  <View style={styles.inputContainer}>
                    <Film color="#777777" size={16} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputModern}
                      placeholder="E.g. Inception 2010 1080p"
                      placeholderTextColor="#555555"
                      value={manualTitle}
                      onChangeText={setManualTitle}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* Internal Storage Location Info Pill */}
            <View style={styles.storageInfoBanner}>
              <Folder color="#46D369" size={15} />
              <Text style={styles.storageInfoText} numberOfLines={1}>
                Target: Internal Storage/VFlix
              </Text>
              <Text style={styles.storageFreeText}>
                {formatBytes(freeDisk)} Free
              </Text>
            </View>

            {/* Gradient Action Button */}
            <TouchableOpacity
              style={styles.submitButtonTouchable}
              onPress={() => {
                if (addTab === 'file' && !selectedTorrentFile) {
                  handlePickTorrentFile();
                } else {
                  handleAddDownload();
                }
              }}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#E50914', '#B20710']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Download color="#FFFFFF" size={18} />
                <Text style={styles.submitButtonText}>
                  {addTab === 'file'
                    ? selectedTorrentFile
                      ? 'Start Downloading Movie'
                      : 'Browse & Pick .torrent File'
                    : manualUrl.trim()
                    ? 'Start Downloading Movie'
                    : 'Paste Magnet Link to Download'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Stream Online Modal */}
      <Modal
        visible={streamModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStreamModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity
            style={styles.modalBackdropDismiss}
            activeOpacity={1}
            onPress={() => setStreamModalVisible(false)}
          />

          <View style={[styles.modernModalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={styles.sheetIconCircle}>
                  <Play color={Colors.netflixRed} size={20} fill={Colors.netflixRed} />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Stream Online</Text>
                  <Text style={styles.sheetSubtitle}>
                    Watch instantly via Webtor cloud proxy
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setStreamModalVisible(false)}
                activeOpacity={0.7}
              >
                <X color="#A0A0A0" size={18} />
              </TouchableOpacity>
            </View>

            <View style={styles.modernTabSwitcher}>
              <TouchableOpacity
                style={[styles.modernTabItem, streamTab === 'file' && styles.modernTabItemActive]}
                onPress={() => setStreamTab('file')}
                activeOpacity={0.8}
              >
                <FileUp color={streamTab === 'file' ? '#FFFFFF' : '#888888'} size={16} />
                <Text style={[styles.modernTabItemText, streamTab === 'file' && styles.modernTabItemTextActive]}>
                  Upload .torrent
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modernTabItem, streamTab === 'link' && styles.modernTabItemActive]}
                onPress={() => setStreamTab('link')}
                activeOpacity={0.8}
              >
                <Link2 color={streamTab === 'link' ? '#FFFFFF' : '#888888'} size={16} />
                <Text style={[styles.modernTabItemText, streamTab === 'link' && styles.modernTabItemTextActive]}>
                  Magnet Link
                </Text>
              </TouchableOpacity>
            </View>

            {streamTab === 'link' ? (
              <View style={styles.tabContentGroup}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>MAGNET LINK</Text>
                  <View style={styles.inputContainer}>
                    <Link2 color="#777777" size={16} style={styles.inputLeadingIcon} />
                    <TextInput
                      style={styles.textInputModern}
                      placeholder="Paste magnet:?xt=urn:..."
                      placeholderTextColor="#555555"
                      value={streamUrl}
                      onChangeText={setStreamUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {streamUrl.length > 0 && (
                      <TouchableOpacity onPress={() => setStreamUrl('')} style={styles.inputClearBtn}>
                        <X color="#777777" size={15} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.tabContentGroup}>
                <TouchableOpacity
                  style={[styles.modernUploadZone, streamFile && styles.modernUploadZoneSelected]}
                  onPress={handlePickStreamFile}
                  activeOpacity={0.85}
                >
                  {streamFile ? (
                    <View style={styles.selectedFileBox}>
                      <View style={styles.selectedFileHeader}>
                        <View style={styles.selectedIconCircle}>
                          <FileCheck color="#46D369" size={24} />
                        </View>
                        <View style={styles.selectedFileInfo}>
                          <Text style={styles.selectedFileName} numberOfLines={1}>
                            {streamFile.name}
                          </Text>
                          <View style={styles.selectedMetaRow}>
                            <View style={styles.sizeBadge}>
                              <Text style={styles.sizeBadgeText}>{formatBytes(streamFile.size)}</Text>
                            </View>
                            <View style={styles.readyBadge}>
                              <CheckCircle2 color="#46D369" size={11} />
                              <Text style={styles.readyBadgeText}>Ready to Stream</Text>
                            </View>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.changeFileBtn}
                          onPress={(e) => { e.stopPropagation(); setStreamFile(null); }}
                          activeOpacity={0.7}
                        >
                          <X color="#888888" size={18} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.emptyUploadContent}>
                      <View style={styles.emptyUploadIcon}>
                        <Upload color={Colors.netflixRed} size={26} />
                      </View>
                      <Text style={styles.emptyUploadTitle}>Tap to Browse .torrent File</Text>
                      <Text style={styles.emptyUploadSubtitle}>
                        Select a torrent file to extract and stream instantly
                      </Text>
                      <View style={styles.browseActionPill}>
                        <Text style={styles.browseActionText}>Browse Storage</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.submitButtonTouchable}
              onPress={handleStreamOnline}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#E50914', '#B20710']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                <Play color="#FFFFFF" size={18} fill="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {streamTab === 'file'
                    ? (streamFile ? 'Extract & Stream Movie' : 'Select File to Stream')
                    : (streamUrl.trim() ? 'Stream Movie Now' : 'Paste Link to Stream')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Netflix Offline Video Player Modal */}
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
    backgroundColor: '#141414',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  streamOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  storageCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  storageTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  storageStats: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  storageBarTrack: {
    height: 7,
    backgroundColor: '#2A2A2A',
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },
  storageBarApp: {
    backgroundColor: Colors.netflixRed,
    height: '100%',
  },
  storageBarOther: {
    backgroundColor: '#555555',
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
    color: Colors.textSecondary,
    fontSize: 10,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2C',
    gap: 8,
  },
  folderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  folderPathText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
  },
  rescanStorageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  rescanStorageText: {
    color: Colors.netflixRed,
    fontSize: 10,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  queueList: {
    gap: 10,
  },
  activeCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  activeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeThumbnail: {
    width: 50,
    height: 65,
    borderRadius: 6,
    backgroundColor: '#141414',
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
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeProgressTrack: {
    height: 4,
    backgroundColor: '#2A2A2A',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  activeProgressFill: {
    height: '100%',
  },
  emptyState: {
    backgroundColor: '#1C1C1C',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  completedList: {
    gap: 14,
  },
  movieCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    height: 145,
  },
  posterWrapper: {
    width: 105,
    height: '100%',
    position: 'relative',
    backgroundColor: '#141414',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  offlineBadgeText: {
    color: '#46D369',
    fontSize: 8,
    fontWeight: '800',
  },
  movieDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  movieTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  movieFileName: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: -2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaSize: {
    color: '#46D369',
    fontSize: 11,
    fontWeight: '700',
  },
  metaDot: {
    color: '#555555',
  },
  metaDate: {
    color: '#AAAAAA',
    fontSize: 11,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  playNetflixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  playNetflixText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  externalPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2A2A2A',
    borderWidth: 0.5,
    borderColor: '#444444',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  externalPlayerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  iconActionBtn: {
    padding: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  modalBackdropDismiss: {
    flex: 1,
  },
  modernModalSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: '#2C2C2C',
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
    backgroundColor: '#3E3E3E',
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
    borderRadius: 20,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.3)',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sheetSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#383838',
  },
  modernTabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#262626',
  },
  modernTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    borderRadius: 10,
  },
  modernTabItemActive: {
    backgroundColor: '#262626',
    borderWidth: 0.5,
    borderColor: 'rgba(229, 9, 20, 0.5)',
  },
  modernTabItemText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '700',
  },
  modernTabItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  tabContentGroup: {
    gap: 14,
    marginBottom: 14,
  },
  modernUploadZone: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#2E2E2E',
    borderStyle: 'dashed',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernUploadZoneSelected: {
    borderColor: '#46D369',
    borderStyle: 'solid',
    backgroundColor: 'rgba(70, 211, 105, 0.06)',
  },
  emptyUploadContent: {
    alignItems: 'center',
    gap: 6,
  },
  emptyUploadIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyUploadTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyUploadSubtitle: {
    color: '#888888',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  browseActionPill: {
    marginTop: 8,
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.4)',
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
    backgroundColor: '#262626',
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
    backgroundColor: '#262626',
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
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
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
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 0.5,
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
  headerTitleGroup: {
    flex: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: '#383838',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  importHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  folderTextWrapper: {
    flex: 1,
    gap: 1,
  },
  folderSubText: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '500',
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
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#3A3A3A',
  },
  importQuickText: {
    color: '#DDDDDD',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
    borderRadius: 8,
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
    backgroundColor: '#282828',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  emptyImportBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
