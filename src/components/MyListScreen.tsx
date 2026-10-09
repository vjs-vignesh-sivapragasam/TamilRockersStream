import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bookmark,
  Trash2,
  Film,
  Play,
  ArrowRight,
  HardDrive,
  Download,
  X,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/theme';
import { myListService, MyListItem } from '../services/myListService';
import { MovieResolutionItem, TamilMvMovieResult, tamilMvService, posterCache } from '../services/tamilMvService';
import { TabKey } from './BottomNavBar';
import { OfflinePlayerModal } from './OfflinePlayerModal';
import { MovieDetailSheet } from './MovieFinderScreen';
import { useDownloads } from '../context/DownloadContext';
import { DownloadItem } from '../types/downloads';
import { extractInfoHashFromUrl } from '../utils/bencode';

const getQualityBadgeConfig = (res: string) => {
  if (/4k|2160p/i.test(res)) {
    return { bg: 'rgba(250, 36, 60, 0.18)', border: 'rgba(250, 36, 60, 0.45)', text: Colors.primary };
  }
  if (/1080p/i.test(res)) {
    return { bg: 'rgba(10, 132, 255, 0.18)', border: 'rgba(10, 132, 255, 0.45)', text: '#5AC8FA' };
  }
  if (/720p/i.test(res)) {
    return { bg: 'rgba(52, 199, 89, 0.18)', border: 'rgba(52, 199, 89, 0.45)', text: '#30D158' };
  }
  if (/250mb/i.test(res)) {
    return { bg: 'rgba(191, 90, 242, 0.18)', border: 'rgba(191, 90, 242, 0.45)', text: '#DA8FFF' };
  }
  return { bg: 'rgba(142, 142, 147, 0.18)', border: 'rgba(142, 142, 147, 0.35)', text: '#E5E5EA' };
};

const { width } = Dimensions.get('window');

interface MyListScreenProps {
  onNavigateToTab?: (tab: TabKey) => void;
  onOpenInBrowserTab?: (url: string) => void;
  onSelectMovie?: (movie: TamilMvMovieResult) => void;
}

export const MyListScreen: React.FC<MyListScreenProps> = ({
  onNavigateToTab,
  onOpenInBrowserTab,
  onSelectMovie,
}) => {
  const insets = useSafeAreaInsets();
  const { backendUrl, testPing, startDownload, themeKey } = useDownloads();

  const [items, setItems] = useState<MyListItem[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<TamilMvMovieResult | null>(null);
  const [selectedPosterUrl, setSelectedPosterUrl] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [qualityModalVisible, setQualityModalVisible] = useState(false);
  const [qualityModalMode, setQualityModalMode] = useState<'play' | 'download' | null>(null);
  const [streamingResId, setStreamingResId] = useState<string | null>(null);

  // Player state
  const [playerVisible, setPlayerVisible] = useState(false);
  const [streamItem, setStreamItem] = useState<DownloadItem | null>(null);
  const [streamPlayerPosterUrl, setStreamPlayerPosterUrl] = useState<string | undefined>(undefined);
  const [streamPlayerInitialPos, setStreamPlayerInitialPos] = useState<number>(0);

  useEffect(() => {
    const unsub = myListService.subscribe((saved) => {
      setItems(saved);
    });
    return unsub;
  }, []);

  const handleClearAll = () => {
    if (items.length === 0) return;
    Alert.alert(
      'Clear My List',
      'Are you sure you want to remove all saved movies from your list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => myListService.clear(),
        },
      ]
    );
  };

  const handleRemoveItem = (id: string, title: string) => {
    myListService.remove(id);
  };

  const handleStreamResolution = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      const title = `${movie.movieTitle} (${resItem.resolution})`;
      let magnet = resItem.magnetUrl;
      setStreamingResId(resItem.id);

      try {
        const pingResult = await Promise.race([
          testPing(backendUrl),
          new Promise<{ ok: boolean; latency: number; message: string }>((resolve) =>
            setTimeout(() => resolve({ ok: false, latency: 3000, message: 'Server connection timed out' }), 3000)
          ),
        ]);

        if (!pingResult.ok) {
          setStreamingResId(null);
          Alert.alert(
            'Server is not reachable',
            `Unable to connect to the streaming server (${backendUrl}).\n\nPlease check if your streaming server is running.`,
            [
              { text: 'OK', style: 'cancel' },
              { text: 'Server Settings', onPress: () => onNavigateToTab?.('settings') },
            ]
          );
          return;
        }

        if (!magnet && resItem.topicUrl) {
          const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl, resItem.resolution);
          if (extracted.magnetUrl) {
            magnet = extracted.magnetUrl;
            resItem.magnetUrl = extracted.magnetUrl;
          }
        }

        if (magnet) {
          const streamUrl = `${backendUrl}/api/stream/play?magnet=${encodeURIComponent(magnet)}`;
          const streamDownloadItem: DownloadItem = {
            id: `stream_${Date.now()}`,
            title,
            fileName: `${movie.movieTitle}_${resItem.resolution}.mp4`,
            fileUri: '',
            url: streamUrl,
            status: 'completed',
            progress: 1,
            totalBytes: 0,
            downloadedBytes: 0,
            speed: 'VFLEX Internal Stream',
            isTorrent: false,
            createdAt: Date.now(),
          };

          const poster = selectedPosterUrl || (movie.topicUrl ? posterCache.get(movie.topicUrl) : null) || undefined;
          setStreamPlayerPosterUrl(poster || undefined);
          setStreamPlayerInitialPos(0);
          setStreamItem(streamDownloadItem);
          setPlayerVisible(true);
        } else {
          Alert.alert('Notice', 'Direct magnet stream unavailable for this resolution.');
        }
      } catch (err: any) {
        Alert.alert('Stream Error', err?.message || 'Could not start stream');
      } finally {
        setStreamingResId(null);
      }
    },
    [backendUrl, testPing, selectedPosterUrl, onNavigateToTab]
  );

  const handleDownloadMovie = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      let target = resItem.magnetUrl || resItem.torrentFileUrl;
      if (!target && resItem.topicUrl) {
        const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl, resItem.resolution);
        if (extracted.magnetUrl) {
          target = extracted.magnetUrl;
          resItem.magnetUrl = extracted.magnetUrl;
        }
      }
      if (!target) target = resItem.topicUrl;

      if (!target) {
        Alert.alert('Notice', 'Download link unavailable for this resolution.');
        return;
      }
      try {
        const title = `${movie.movieTitle} (${resItem.resolution})`;
        const poster = selectedPosterUrl || (movie.topicUrl ? posterCache.get(movie.topicUrl) : null) || undefined;
        await startDownload(target, title, poster || undefined);

        Alert.alert('Download Started 📥', `"${title}" has been added to In-App Downloads and is saving to internal storage.`, [
          { text: 'View Downloads', onPress: () => onNavigateToTab?.('downloads') },
          { text: 'OK', style: 'cancel' },
        ]);
      } catch (err: any) {
        Alert.alert('Download Error', err?.message || 'Failed to start movie download');
      }
    },
    [startDownload, onNavigateToTab, selectedPosterUrl]
  );

  const handleCopyMagnet = useCallback(async (resItem: MovieResolutionItem) => {
    let link = resItem.magnetUrl || resItem.torrentFileUrl;
    if (!link && resItem.topicUrl) {
      try {
        const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl, resItem.resolution);
        if (extracted.magnetUrl) {
          link = extracted.magnetUrl;
          resItem.magnetUrl = extracted.magnetUrl;
        }
      } catch {}
    }
    if (link) {
      try {
        await Clipboard.setStringAsync(link);
        Alert.alert('Magnet Copied! 📋', 'Magnet link copied to clipboard.');
      } catch {
        Alert.alert('Notice', 'Magnet link unavailable.');
      }
    } else {
      Alert.alert('Notice', 'Direct magnet link available on the topic page.');
    }
  }, []);

  const handleOpenExternalPlayer = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      let magnet = resItem.magnetUrl;
      if (!magnet && resItem.topicUrl) {
        try {
          const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl, resItem.resolution);
          if (extracted.magnetUrl) {
            magnet = extracted.magnetUrl;
            resItem.magnetUrl = extracted.magnetUrl;
          }
        } catch {}
      }
      if (magnet) {
        const streamUrl = `${backendUrl}/api/stream/play?magnet=${encodeURIComponent(magnet)}`;
        Linking.openURL(`vlc://${streamUrl}`).catch(() => {
          Linking.openURL(streamUrl).catch(() => {
            Alert.alert('External Player', 'VLC for Android or compatible media player is recommended.');
          });
        });
      } else {
        Alert.alert('Notice', 'Magnet link unavailable for external playback.');
      }
    },
    [backendUrl]
  );

  const handleOpenDetail = async (item: MyListItem) => {
    let resolutions = item.resolutions || [];
    let posterUrl = item.posterUrl || null;

    const movie: TamilMvMovieResult = {
      id: item.id,
      movieTitle: item.movieTitle,
      topicTitle: item.movieTitle,
      topicUrl: item.topicUrl,
      year: item.year,
      language: item.language,
      resolutions,
    };

    setSelectedMovie(movie);
    setSelectedPosterUrl(posterUrl);
    setDetailModalVisible(true);

    if (onSelectMovie) {
      onSelectMovie(movie);
    }

    // Dynamic resolution fetch if missing or empty
    if (resolutions.length === 0 && item.topicUrl) {
      try {
        const fetchedRes = await tamilMvService.extractResolutionsFromTopic(item.topicUrl);
        if (fetchedRes && fetchedRes.length > 0) {
          const updatedMovie = { ...movie, resolutions: fetchedRes };
          setSelectedMovie(updatedMovie);
        }
      } catch (err) {
        console.warn('Could not fetch resolutions for topic:', err);
      }
    }
  };

  const handleOpenQuality = (item: MyListItem, mode: 'play' | 'download') => {
    const movie: TamilMvMovieResult = {
      id: item.id,
      movieTitle: item.movieTitle,
      topicTitle: item.movieTitle,
      topicUrl: item.topicUrl,
      year: item.year,
      language: item.language,
      resolutions: item.resolutions || [],
    };
    setSelectedMovie(movie);
    setSelectedPosterUrl(item.posterUrl || null);
    setQualityModalMode(mode);
    setQualityModalVisible(true);
  };

  const cardWidth = Math.floor((width - 36) / 2);
  const cardHeight = Math.round(cardWidth * 1.5);

  const renderItem = ({ item }: { item: MyListItem }) => {
    const bestRes = item.resolutions && item.resolutions.length > 0 ? item.resolutions[0] : null;
    const badge = getQualityBadgeConfig(bestRes?.resolution || '');

    return (
      <TouchableOpacity
        style={[styles.card, { width: cardWidth, height: cardHeight }]}
        onPress={() => handleOpenDetail(item)}
        activeOpacity={0.88}
      >
        {/* Poster Image */}
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardShimmer]}>
            <Film color="#4E5166" size={28} strokeWidth={1.8} />
          </View>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(10, 11, 15, 0.45)', 'rgba(10, 11, 15, 0.95)']}
          style={styles.cardGradient}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 0, y: 1 }}
        >
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.movieTitle}
          </Text>

          {/* Quick Actions Row */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={styles.cardPlayBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenQuality(item, 'play');
              }}
              activeOpacity={0.8}
            >
              <Play color="#FFFFFF" size={13} fill="#FFFFFF" />
              <Text style={styles.cardPlayBtnText}>Play</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardDownloadBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenQuality(item, 'download');
              }}
              activeOpacity={0.8}
            >
              <Download color="#FFFFFF" size={13} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Remove Bookmark Button (Top Left) */}
        <TouchableOpacity
          style={styles.removeBookmarkBtn}
          onPress={(e) => {
            e.stopPropagation();
            handleRemoveItem(item.id, item.movieTitle);
          }}
          activeOpacity={0.75}
        >
          <Bookmark color={Colors.primary} size={15} fill={Colors.primary} strokeWidth={2} />
        </TouchableOpacity>

        {/* Quality Badge (Top Right) */}
        {bestRes?.resolution ? (
          <View style={[styles.cardQualityBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.cardQualityText, { color: badge.text }]}>
              {bestRes.resolution}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0C10" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconWrap}>
              <Bookmark color={Colors.primary} size={18} fill={Colors.primary} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.headerTitle}>My List</Text>
              <Text style={styles.headerSubtitle}>
                {items.length === 1 ? '1 Saved Title' : `${items.length} Saved Titles`}
              </Text>
            </View>
          </View>
        </View>

        {items.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearAll}
            activeOpacity={0.7}
          >
            <Trash2 color="#8E8E93" size={15} strokeWidth={2} />
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main List */}
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Bookmark color={Colors.primary} size={36} strokeWidth={2} />
          </View>
          <Text style={styles.emptyTitle}>Your List is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Save movies you want to watch later by tapping the bookmark icon on any movie card or detail sheet.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => onNavigateToTab?.('home')}
            activeOpacity={0.8}
          >
            <Text style={styles.exploreBtnText}>Explore Movies</Text>
            <ArrowRight color="#FFFFFF" size={15} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Movie Detailed Screen (Exact same as Home - detailed screen) */}
      <MovieDetailSheet
        visible={detailModalVisible}
        movie={selectedMovie}
        streamingResId={streamingResId}
        isSaved={selectedMovie ? myListService.isSaved(selectedMovie.id || selectedMovie.topicUrl || selectedMovie.movieTitle) : false}
        onToggleSave={() => {
          if (selectedMovie) {
            myListService.toggle(selectedMovie, selectedPosterUrl);
          }
        }}
        onClose={() => setDetailModalVisible(false)}
        onMovieDownload={handleDownloadMovie}
        onTorrentDownload={handleDownloadMovie}
        onStream={handleStreamResolution}
        onCopy={handleCopyMagnet}
        onOpenExternal={handleOpenExternalPlayer}
        enqueuePosterFetch={(topicUrl, cb) => {
          const cached = posterCache.get(topicUrl);
          if (cached !== undefined) cb(cached);
        }}
        backendUrl={backendUrl}
      />

      {/* Quality Picker Bottom Sheet Modal */}
      {qualityModalVisible && selectedMovie && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setQualityModalVisible(false)}
            activeOpacity={1}
          />
          <View style={[styles.qmSheet, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.qmHeader}>
              <View style={styles.qmHeaderLeft}>
                <View
                  style={[
                    styles.qmModeIconWrap,
                    qualityModalMode === 'play'
                      ? { backgroundColor: 'rgba(250, 36, 60, 0.15)' }
                      : { backgroundColor: 'rgba(52, 199, 89, 0.15)' },
                  ]}
                >
                  {qualityModalMode === 'play' ? (
                    <Play color={Colors.primary} size={16} fill={Colors.primary} />
                  ) : (
                    <Download color="#34C759" size={16} strokeWidth={2.4} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qmTitle} numberOfLines={1}>
                    {qualityModalMode === 'play' ? 'Select Quality to Stream' : 'Select Quality to Download'}
                  </Text>
                  <Text style={styles.qmSub} numberOfLines={1}>
                    {selectedMovie.movieTitle}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setQualityModalVisible(false)}
                style={styles.qmCloseBtn}
              >
                <X color="#8E8E93" size={18} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {selectedMovie.resolutions && selectedMovie.resolutions.length > 0 ? (
              selectedMovie.resolutions.map((res, idx) => {
                const qb = getQualityBadgeConfig(res.resolution);
                return (
                  <TouchableOpacity
                    key={res.id || `qm-res-${idx}`}
                    style={styles.qmOptionCard}
                    onPress={() => {
                      setQualityModalVisible(false);
                      if (qualityModalMode === 'play') {
                        handleStreamResolution(res, selectedMovie);
                      } else {
                        handleDownloadMovie(res, selectedMovie);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.qmCardLeft}>
                      <View style={[styles.qmQualityBadge, { backgroundColor: qb.bg, borderColor: qb.border }]}>
                        <Text style={[styles.qmQualityBadgeText, { color: qb.text }]}>
                          {res.resolution}
                        </Text>
                      </View>
                      {res.codec || res.audio ? (
                        <Text style={styles.qmCardMeta} numberOfLines={1}>
                          {[res.codec, res.audio].filter(Boolean).join(' • ')}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.qmCardRight}>
                      <View style={styles.qmSizeBadge}>
                        <HardDrive color="#30D158" size={12} strokeWidth={2.4} />
                        <Text style={styles.qmSizeBadgeText}>{res.size || 'Standard'}</Text>
                      </View>
                      <View
                        style={[
                          styles.qmActionCircle,
                          qualityModalMode === 'play'
                            ? { backgroundColor: 'rgba(250, 36, 60, 0.15)', borderColor: 'rgba(250, 36, 60, 0.35)' }
                            : { backgroundColor: 'rgba(52, 199, 89, 0.15)', borderColor: 'rgba(52, 199, 89, 0.35)' },
                        ]}
                      >
                        {qualityModalMode === 'play' ? (
                          <Play color={Colors.primary} size={13} fill={Colors.primary} />
                        ) : (
                          <Download color="#34C759" size={13} strokeWidth={2.2} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.qmEmptyText}>No resolutions available for this title.</Text>
            )}
          </View>
        </View>
      )}

      {/* Video Player Modal */}
      {playerVisible && streamItem && (
        <OfflinePlayerModal
          visible={playerVisible}
          item={streamItem}
          onClose={() => {
            setPlayerVisible(false);
            setStreamItem(null);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#16171D',
    borderWidth: 1,
    borderColor: '#262835',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  clearBtnText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#16171E',
    borderWidth: 1,
    borderColor: '#242634',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  cardImage: {
    ...StyleSheet.absoluteFill,
  },
  cardShimmer: {
    backgroundColor: '#16171D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 9,
    paddingBottom: 9,
    paddingTop: 32,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    marginBottom: 8,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardPlayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 5.5,
    borderRadius: 7,
  },
  cardPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardDownloadBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#262835',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBookmarkBtn: {
    position: 'absolute',
    top: 7,
    left: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardQualityBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  cardQualityText: {
    fontSize: 9,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingBottom: 60,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(250, 36, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 24,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  qmSheet: {
    backgroundColor: '#16171E',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#262835',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  qmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  qmHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qmModeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qmTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  qmSub: {
    color: '#8E8E93',
    fontSize: 11.5,
    marginTop: 1,
  },
  qmCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#20222C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qmOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1C24',
    borderWidth: 1,
    borderColor: '#2A2D3C',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  qmCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  qmQualityBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  qmQualityBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  qmCardMeta: {
    color: '#8E8E93',
    fontSize: 11,
    flex: 1,
  },
  qmCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qmSizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  qmSizeBadgeText: {
    color: '#34C759',
    fontSize: 10.5,
    fontWeight: '700',
  },
  qmActionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qmEmptyText: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
  detailBannerWrap: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 14,
  },
  detailBannerImage: {
    width: '100%',
    height: '100%',
  },
  detailBannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
  },
  detailCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  detailBodyHeader: {
    marginBottom: 14,
  },
  detailMovieTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  detailMatchScore: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '800',
  },
  detailMetaTag: {
    color: '#8E8E93',
    fontSize: 12,
  },
  detailHdBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  detailHdBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  detailPrimaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailPrimaryPlayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
  },
  detailPrimaryPlayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  detailPrimaryDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#262835',
    borderWidth: 1,
    borderColor: '#34384A',
    paddingVertical: 10,
    borderRadius: 8,
  },
  detailPrimaryDownloadText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  detailSectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 4,
  },
});
