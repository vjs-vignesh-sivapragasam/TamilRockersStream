import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  RefreshControl,
  Image,
  Dimensions,
  Linking,
  Platform,
  Share,
  Alert,
  Modal,
} from 'react-native';
import {
  Download,
  Play,
  ArrowRight,
  X,
  ExternalLink,
  CheckCircle2,
  HardDrive,
  Folder,
  RotateCcw,
  Film,
  Trash2,
  Share2,
  Heart,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors } from '../constants/theme';
import { useDownloads } from '../context/DownloadContext';
import { DownloadItem } from '../types/downloads';
import { TabKey } from './BottomNavBar';
import {
  formatBytes,
  cleanTitleFromFilename,
  getPosterForFilename,
} from '../services/downloadService';
import { OfflinePlayerModal } from './OfflinePlayerModal';
import { AboutUsScreen } from './AboutUsScreen';
import { DonateUsScreen } from './DonateUsScreen';

const { width } = Dimensions.get('window');

interface HomeScreenProps {
  onNavigateToTab: (tab: TabKey) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToTab }) => {
  const { downloads, startDownload, deleteDownload, rescanStorage, storageStats } = useDownloads();
  const scrollViewRef = useRef<ScrollView>(null);

  // Filter ONLY real completed downloads
  const completedDownloads = downloads.filter((item) => item.status === 'completed');

  const [offlineItem, setOfflineItem] = useState<DownloadItem | null>(null);
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [donateModalVisible, setDonateModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toastInfo, setToastInfo] = useState<{ title: string } | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await rescanStorage();
    } catch {}
    setRefreshing(false);
  };

  const handlePlayDownloadedMovie = (item: DownloadItem) => {
    setOfflineItem(item);
    setOfflineModalVisible(true);
  };

  const handlePlayExternal = async (item: DownloadItem) => {
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

  const handleDeleteItem = (item: DownloadItem) => {
    Alert.alert(
      'Delete Download',
      `Delete "${item.title || item.fileName}" from internal storage?`,
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

  const handleStartSampleDownload = async (url: string, title: string) => {
    await startDownload(url, title);
    setToastInfo({ title });
    setTimeout(() => {
      setToastInfo(null);
    }, 5000);
  };

  // Top featured movie for hero banner if at least 1 movie downloaded
  const heroMovie = completedDownloads.length > 0 ? completedDownloads[0] : null;
  const heroPoster = heroMovie
    ? heroMovie.poster || getPosterForFilename(heroMovie.movieFileName || heroMovie.fileName || heroMovie.title)
    : '';
  const heroTitle = heroMovie
    ? heroMovie.title || cleanTitleFromFilename(heroMovie.movieFileName || heroMovie.fileName)
    : '';
  const heroSize = heroMovie ? formatBytes(heroMovie.downloadedBytes || heroMovie.totalBytes) : '';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#141414" translucent />

      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View style={styles.logoRow}>
          <Text style={styles.vLogo}>V</Text>
          <Text style={styles.appTitle}>FLIX</Text>
        </View>

        <View style={styles.topRightActions}>
          {/* Donate Us Quick Button */}
          <TouchableOpacity
            style={styles.donateHeaderBtn}
            onPress={() => setDonateModalVisible(true)}
            activeOpacity={0.75}
          >
            <Heart color="#FFFFFF" fill={Colors.netflixRed} size={14} />
            <Text style={styles.donateHeaderBtnText}>Donate</Text>
          </TouchableOpacity>

          {/* Vignesh S Developer Profile Avatar */}
          <TouchableOpacity
            style={styles.devAvatarBtn}
            onPress={() => setAboutModalVisible(true)}
            activeOpacity={0.75}
          >
            <Image
              source={require('../../assets/vignesh.jpg')}
              style={styles.devAvatarMini}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rescanHeaderBtn}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <RotateCcw color="#FFFFFF" size={16} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.netflixRed}
            colors={[Colors.netflixRed]}
          />
        }
      >
        {/* If user has downloaded movies, show them prominently */}
        {completedDownloads.length > 0 ? (
          <View>
            {/* 1. Featured Hero Banner for Latest Downloaded Movie */}
            {heroMovie && (
              <View style={styles.heroContainer}>
                <Image
                  source={{ uri: heroPoster }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />

                {/* Dark Vignette Overlay */}
                <View style={styles.heroGradient}>
                  <View style={styles.heroBadgesRow}>
                    <View style={styles.heroOfflineBadge}>
                      <CheckCircle2 color="#46D369" size={12} />
                      <Text style={styles.heroOfflineText}>OFFLINE READY</Text>
                    </View>
                    <View style={styles.heroResBadge}>
                      <Text style={styles.heroResText}>{heroMovie.resolution || '1080p'}</Text>
                    </View>
                    <View style={styles.heroSizeBadge}>
                      <Text style={styles.heroSizeText}>{heroSize}</Text>
                    </View>
                  </View>

                  <Text style={styles.heroTitle} numberOfLines={2}>
                    {heroTitle}
                  </Text>
                  <Text style={styles.heroFileName} numberOfLines={1}>
                    {heroMovie.movieFileName || heroMovie.fileName}
                  </Text>

                  {/* Dual Play Action Buttons */}
                  <View style={styles.heroActionsRow}>
                    {/* Watch in Netflix Player */}
                    <TouchableOpacity
                      style={styles.heroPlayBtn}
                      onPress={() => handlePlayDownloadedMovie(heroMovie)}
                      activeOpacity={0.85}
                    >
                      <Play color="#000000" size={18} fill="#000000" />
                      <Text style={styles.heroPlayText}>Play Movie</Text>
                    </TouchableOpacity>

                    {/* External Player (VLC / MX Player) */}
                    <TouchableOpacity
                      style={styles.heroExternalBtn}
                      onPress={() => handlePlayExternal(heroMovie)}
                      activeOpacity={0.8}
                    >
                      <ExternalLink color="#FFFFFF" size={16} />
                      <Text style={styles.heroExternalText}>VLC / MX</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* 2. Downloaded Movies Grid List */}
            <View style={styles.moviesSection}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionTitle}>
                    My Downloaded Movies ({completedDownloads.length})
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Stored in Internal Storage / VFlix_Movies
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.manageBtn}
                  onPress={() => onNavigateToTab('downloads')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.manageBtnText}>Manage</Text>
                  <ArrowRight color={Colors.netflixRed} size={14} />
                </TouchableOpacity>
              </View>

              <View style={styles.movieCardsList}>
                {completedDownloads.map((item) => {
                  const poster =
                    item.poster ||
                    getPosterForFilename(
                      item.movieFileName || item.fileName || item.title
                    );
                  const title =
                    item.title ||
                    cleanTitleFromFilename(item.movieFileName || item.fileName);
                  const size = formatBytes(item.downloadedBytes || item.totalBytes);

                  return (
                    <View key={item.id} style={styles.movieCard}>
                      {/* Poster Thumbnail */}
                      <TouchableOpacity
                        style={styles.cardPosterWrapper}
                        onPress={() => handlePlayDownloadedMovie(item)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: poster }}
                          style={styles.cardPosterImage}
                          resizeMode="cover"
                        />
                        <View style={styles.cardPlayOverlay}>
                          <View style={styles.cardPlayCircle}>
                            <Play color="#FFFFFF" size={22} fill="#FFFFFF" style={{ marginLeft: 2 }} />
                          </View>
                        </View>
                        <View style={styles.cardBadgeOffline}>
                          <CheckCircle2 color="#46D369" size={10} />
                          <Text style={styles.cardBadgeText}>OFFLINE</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Movie Information & Actions */}
                      <View style={styles.cardDetails}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {title}
                        </Text>
                        <Text style={styles.cardFileName} numberOfLines={1}>
                          {item.movieFileName || item.fileName}
                        </Text>

                        <View style={styles.cardMetaRow}>
                          <Text style={styles.cardSizeText}>{size}</Text>
                          <Text style={styles.cardDot}>•</Text>
                          <Text style={styles.cardResText}>{item.resolution || '1080p'}</Text>
                        </View>

                        {/* Watch and External Player buttons */}
                        <View style={styles.cardActionsRow}>
                          <TouchableOpacity
                            style={styles.cardPlayBtn}
                            onPress={() => handlePlayDownloadedMovie(item)}
                            activeOpacity={0.85}
                          >
                            <Play color="#FFFFFF" size={13} fill="#FFFFFF" />
                            <Text style={styles.cardPlayBtnText}>Watch</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.cardExternalBtn}
                            onPress={() => handlePlayExternal(item)}
                            activeOpacity={0.8}
                          >
                            <ExternalLink color="#FFFFFF" size={12} />
                            <Text style={styles.cardExternalBtnText}>VLC/MX</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.cardDeleteBtn}
                            onPress={() => handleDeleteItem(item)}
                            activeOpacity={0.7}
                          >
                            <Trash2 color="#888888" size={15} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ) : (
          /* Empty State when no movies are downloaded yet */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Film color={Colors.netflixRed} size={48} />
            </View>
            <Text style={styles.emptyTitle}>No Downloaded Movies</Text>
            <Text style={styles.emptySubtitle}>
              Your Home screen displays your downloaded movies. Download torrents from the Browser to watch offline without internet anytime.
            </Text>

            <TouchableOpacity
              style={styles.goToBrowserBtn}
              onPress={() => onNavigateToTab('browser')}
              activeOpacity={0.85}
            >
              <Download color="#FFFFFF" size={18} />
              <Text style={styles.goToBrowserText}>Browse & Download Movies</Text>
            </TouchableOpacity>

            {/* Quick 1-tap Sample Movie Download */}
            <View style={styles.sampleSection}>
              <Text style={styles.sampleHeading}>OR DOWNLOAD POPULAR OPEN MOVIE</Text>

              <TouchableOpacity
                style={styles.sampleCard}
                onPress={() =>
                  handleStartSampleDownload(
                    'magnet:?xt=urn:btih:673144559b1da83f26d51f369329266ceef6bd12&dn=www.1TamilMV.meme%20-%20Photographer%20%282026%29%20Tamil%C2%A0HQ%20HDRip%20-%20x264%20-%20AAC%20-%20250MB%20-%20ESub.mkv&xl=251057547&tr=udp%3A%2F%2Ftracker.dler.com%3A6969%2Fannounce&tr=http%3A%2F%2Ftracker.bt4g.com%3A2095%2Fannounce&tr=udp%3A%2F%2Ftracker-udp.gbitt.info%3A80%2Fannounce&tr=http%3A%2F%2Fipv4announce.sktorrent.eu%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce&tr=http%3A%2F%2Ftracker.mywaifu.best%3A6969%2Fannounce&tr=udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce&tr=udp%3A%2F%2Fevan.im%3A6969%2Fannounce&tr=https%3A%2F%2Ftracker.leechshield.link%3A443%2Fannounce&tr=http%3A%2F%2Ftracker.dhitechnical.com%3A6969%2Fannounce&tr=https%3A%2F%2Ftorrents.tmtime.dev%3A443%2Fannounce&tr=udp%3A%2F%2Ftorrentclub.online%3A1984%2Fannounce&tr=udp%3A%2F%2Ftracker.wildkat.net%3A6969%2Fannounce&tr=http%3A%2F%2Fbt1.archive.org%3A6969%2Fannounce',
                    'Photographer (2026) Tamil HQ'
                  )
                }
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.sampleTitle}>Photographer (2026) Tamil HQ</Text>
                  <Text style={styles.sampleSize}>250 MB • Live Swarm Active</Text>
                </View>
                <View style={styles.sampleDownloadBtn}>
                  <Download color="#FFFFFF" size={14} />
                  <Text style={styles.sampleDownloadText}>Download</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sampleCard}
                onPress={() =>
                  handleStartSampleDownload(
                    'https://webtorrent.io/torrents/sintel.torrent',
                    'Sintel (Animation Sci-Fi)'
                  )
                }
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.sampleTitle}>Sintel (Animation Sci-Fi)</Text>
                  <Text style={styles.sampleSize}>129 MB • 1080p MP4</Text>
                </View>
                <View style={styles.sampleDownloadBtn}>
                  <Download color="#FFFFFF" size={14} />
                  <Text style={styles.sampleDownloadText}>Download</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sampleCard}
                onPress={() =>
                  handleStartSampleDownload(
                    'https://webtorrent.io/torrents/big-buck-bunny.torrent',
                    'Big Buck Bunny (Blender 4K)'
                  )
                }
                activeOpacity={0.75}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.sampleTitle}>Big Buck Bunny (Blender 4K)</Text>
                  <Text style={styles.sampleSize}>276 MB • 1080p MP4</Text>
                </View>
                <View style={styles.sampleDownloadBtn}>
                  <Download color="#FFFFFF" size={14} />
                  <Text style={styles.sampleDownloadText}>Download</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Torrent Download Toast Banner */}
      {toastInfo && (
        <View style={styles.toastContainer}>
          <View style={styles.toastCard}>
            <View style={styles.toastIconBox}>
              <Download color="#FFFFFF" size={18} />
            </View>
            <View style={styles.toastTextGroup}>
              <Text style={styles.toastTitle}>Movie Download Started</Text>
              <Text style={styles.toastSubtitle} numberOfLines={1}>
                {toastInfo.title}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.toastActionBtn}
              onPress={() => {
                setToastInfo(null);
                onNavigateToTab('downloads');
              }}
            >
              <Text style={styles.toastActionText}>View</Text>
              <ArrowRight color="#FFFFFF" size={14} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setToastInfo(null)}
              style={styles.toastCloseBtn}
            >
              <X color="#888888" size={16} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Netflix Offline Video Player Modal */}
      <OfflinePlayerModal
        visible={offlineModalVisible}
        item={offlineItem}
        onClose={() => setOfflineModalVisible(false)}
      />

      {/* About Us Developer Screen Modal */}
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

      {/* Donate Us Support Screen Modal */}
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
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 12,
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderBottomWidth: 0.5,
    borderBottomColor: '#262626',
    zIndex: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vLogo: {
    color: Colors.netflixRed,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginLeft: -4,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  donateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(250, 36, 60, 0.18)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.45)',
  },
  donateHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  devAvatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.8,
    borderColor: Colors.netflixRed,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  devAvatarMini: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(70, 211, 105, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(70, 211, 105, 0.3)',
  },
  offlinePillText: {
    color: '#46D369',
    fontSize: 11,
    fontWeight: '700',
  },
  rescanHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 50,
  },
  heroContainer: {
    width,
    height: 380,
    position: 'relative',
    backgroundColor: '#000000',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(20, 20, 20, 0.65)',
    justifyContent: 'flex-end',
    padding: 20,
    paddingBottom: 24,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  heroOfflineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  heroOfflineText: {
    color: '#46D369',
    fontSize: 9,
    fontWeight: '800',
  },
  heroResBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  heroResText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  heroSizeBadge: {
    backgroundColor: 'rgba(250, 36, 60, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  heroSizeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroFileName: {
    color: '#BBBBBB',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroPlayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 6,
  },
  heroPlayText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  heroExternalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(40, 40, 40, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#444444',
  },
  heroExternalText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  moviesSection: {
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  manageBtnText: {
    color: Colors.netflixRed,
    fontSize: 12,
    fontWeight: '700',
  },
  movieCardsList: {
    gap: 12,
  },
  movieCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    height: 140,
  },
  cardPosterWrapper: {
    width: 105,
    height: '100%',
    position: 'relative',
    backgroundColor: '#101010',
  },
  cardPosterImage: {
    width: '100%',
    height: '100%',
  },
  cardPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardPlayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(250, 36, 60, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBadgeOffline: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  cardBadgeText: {
    color: '#46D369',
    fontSize: 8,
    fontWeight: '800',
  },
  cardDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardFileName: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: -2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardSizeText: {
    color: '#46D369',
    fontSize: 11,
    fontWeight: '700',
  },
  cardDot: {
    color: '#555555',
  },
  cardResText: {
    color: '#AAAAAA',
    fontSize: 11,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  cardPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardExternalBtn: {
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
  cardExternalBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  cardDeleteBtn: {
    padding: 6,
  },
  emptyContainer: {
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.3)',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 26,
  },
  goToBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 24,
    marginBottom: 36,
  },
  goToBrowserText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sampleSection: {
    width: '100%',
    gap: 10,
  },
  sampleHeading: {
    color: '#777777',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 12,
  },
  sampleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sampleSize: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  sampleDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  sampleDownloadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 14,
    right: 14,
    zIndex: 999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202020',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#383838',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    gap: 10,
  },
  toastIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.netflixRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastTextGroup: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  toastSubtitle: {
    color: '#AAAAAA',
    fontSize: 11,
  },
  toastActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  toastActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  toastCloseBtn: {
    padding: 4,
  },
});
