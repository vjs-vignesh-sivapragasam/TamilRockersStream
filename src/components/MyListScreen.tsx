import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  StatusBar,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bookmark,
  Trash2,
  Film,
  ArrowRight,
  Sparkles,
  Star,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '../constants/theme';
import { myListService, MyListItem } from '../services/myListService';
import {
  MovieResolutionItem,
  TamilMvMovieResult,
  tamilMvService,
  posterCache,
} from '../services/tamilMvService';
import { TabKey } from './BottomNavBar';
import { OfflinePlayerModal } from './OfflinePlayerModal';
import { MovieDetailSheet, sanitizeMovieTitle } from './HomeScreen';
import { useMovieMetadata } from '../services/movieDatabaseService';
import { useDownloads } from '../context/DownloadContext';
import { DownloadItem } from '../types/downloads';

interface MyListScreenProps {
  onNavigateToTab?: (tab: TabKey) => void;
  onOpenInBrowserTab?: (url: string) => void;
  onSelectMovie?: (movie: TamilMvMovieResult) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// MyListGridCard — 2-column card matching Home Screen (Poster, Title & Year)
// ─────────────────────────────────────────────────────────────────────────────
interface MyListGridCardProps {
  item: MyListItem;
  onPress: () => void;
  onLongPress: () => void;
}

const MyListGridCard = React.memo<MyListGridCardProps>(({ item, onPress, onLongPress }) => {
  const { width: screenWidth } = useWindowDimensions();
  const NUM_COLUMNS = 2;
  const cardWidth = Math.floor((screenWidth - 34) / NUM_COLUMNS);
  const posterHeight = Math.round(cardWidth * 1.48);

  const topicUrl = item.topicUrl || item.resolutions?.[0]?.topicUrl || '';
  const [posterUrl, setPosterUrl] = useState<string | null>(() => {
    if (item.posterUrl) return item.posterUrl;
    if (!topicUrl) return null;
    const cached = posterCache.get(topicUrl);
    return cached !== undefined ? cached : null;
  });
  const [posterLoading, setPosterLoading] = useState(
    () => Boolean(!item.posterUrl && topicUrl && !posterCache.has(topicUrl))
  );

  useEffect(() => {
    if (item.posterUrl) {
      setPosterUrl(item.posterUrl);
      setPosterLoading(false);
      return;
    }
    if (!topicUrl) return;
    if (posterCache.has(topicUrl)) {
      setPosterUrl(posterCache.get(topicUrl) ?? null);
      setPosterLoading(false);
      return;
    }
    setPosterLoading(true);
    tamilMvService
      .extractPosterFromTopic(topicUrl)
      .then((url) => {
        if (url) {
          posterCache.set(topicUrl, url);
          setPosterUrl(url);
        }
        setPosterLoading(false);
      })
      .catch(() => {
        setPosterLoading(false);
      });
  }, [item.posterUrl, topicUrl]);

  const cleanMovieName = useMemo(() => {
    return sanitizeMovieTitle(item.movieTitle) || 'Tamil Movie';
  }, [item.movieTitle]);

  // Fetch TMDB Rating, Year & High-Res Poster
  const { metadata } = useMovieMetadata(cleanMovieName, item.year);
  const displayRating = metadata?.rating || 0;
  const displayYear = metadata?.year || item.year || '';
  const effectivePoster = metadata?.posterUrl || posterUrl;

  return (
    <TouchableOpacity
      style={[styles.pgCard, { width: cardWidth }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.82}
    >
      {/* 1. Poster Wrapper */}
      <View style={[styles.pgPosterWrapper, { width: cardWidth, height: posterHeight }]}>
        {effectivePoster ? (
          <Image
            source={{ uri: effectivePoster }}
            style={styles.pgPosterImage}
            resizeMode="cover"
            onError={() => setPosterUrl(null)}
          />
        ) : posterLoading ? (
          <LinearGradient
            colors={['#1B182B', '#27223D', '#1B182B']}
            style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Film color="#574F7A" size={28} strokeWidth={1.5} />
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={['#8B5CF6', '#4C1D95']}
            style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Film color="rgba(255,255,255,0.4)" size={28} strokeWidth={1.5} />
          </LinearGradient>
        )}

        {/* Floating TMDB Rating Pill on Top-Left */}
        {displayRating > 0 ? (
          <View style={styles.pgFloatingRating}>
            <Star size={10} color="#FFD700" fill="#FFD700" />
            <Text style={styles.pgFloatingRatingText}>{displayRating.toFixed(1)}</Text>
          </View>
        ) : null}

        {/* Floating Year Pill on Top-Right */}
        {displayYear ? (
          <View style={styles.pgFloatingYear}>
            <Text style={styles.pgFloatingYearText}>{displayYear}</Text>
          </View>
        ) : null}
      </View>

      {/* 2. Movie Name & Year (Matches HomeScreen style) */}
      <View style={styles.pgTitleContainer}>
        <Text style={styles.pgTitle} numberOfLines={2}>
          {cleanMovieName}
        </Text>
        <View style={styles.pgMetaRow}>
          {displayRating > 0 ? (
            <View style={styles.pgInlineRating}>
              <Star size={10} color="#FFD700" fill="#FFD700" />
              <Text style={styles.pgInlineRatingText}>{displayRating.toFixed(1)}</Text>
            </View>
          ) : null}
          {displayYear ? <Text style={styles.pgMetaText}>{displayYear}</Text> : null}
          <Text style={styles.pgMetaText}>
            {item.language ? item.language.toUpperCase() : 'TAMIL'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MyListScreen Component
// ─────────────────────────────────────────────────────────────────────────────
export const MyListScreen: React.FC<MyListScreenProps> = ({
  onNavigateToTab,
  onOpenInBrowserTab,
  onSelectMovie,
}) => {
  const insets = useSafeAreaInsets();
  const { backendUrl, startDownload } = useDownloads();

  const [items, setItems] = useState<MyListItem[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<TamilMvMovieResult | null>(null);
  const [selectedPosterUrl, setSelectedPosterUrl] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [streamingResId, setStreamingResId] = useState<string | null>(null);

  // In-app Video Player state
  const [playerVisible, setPlayerVisible] = useState(false);
  const [streamItem, setStreamItem] = useState<DownloadItem | null>(null);

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
      `Are you sure you want to remove all ${items.length} saved movies from your list?`,
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

  const handleLongPress = useCallback((item: MyListItem) => {
    Alert.alert(
      'Remove from My List',
      `Remove "${item.movieTitle}" from your watchlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => myListService.remove(item.id),
        },
      ]
    );
  }, []);

  const handleStreamResolution = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      const title = `${movie.movieTitle} (${resItem.resolution})`;
      let magnet = resItem.magnetUrl;
      setStreamingResId(resItem.id);

      const launchPlayerWithMagnet = (resolvedMagnet: string) => {
        const cleanBackend = (backendUrl || 'https://vflix-backend.onrender.com')
          .trim()
          .replace(/\/+$/, '');
        // Silent non-blocking background pre-warm
        fetch(`${cleanBackend}/api/stream/warmup?magnet=${encodeURIComponent(resolvedMagnet)}`).catch(
          () => {}
        );

        const streamUrl = `${cleanBackend}/api/stream/play?magnet=${encodeURIComponent(resolvedMagnet)}`;
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
          speed: 'VFLEX Stream Engine',
          isTorrent: false,
          createdAt: Date.now(),
        };

        setStreamItem(streamDownloadItem);
        setPlayerVisible(true);
      };

      try {
        if (magnet) {
          launchPlayerWithMagnet(magnet);
          return;
        }

        if (!magnet && resItem.topicUrl) {
          const extracted = await tamilMvService.extractMagnetFromTopic(
            resItem.topicUrl,
            resItem.resolution
          );
          if (extracted.magnetUrl) {
            magnet = extracted.magnetUrl;
            resItem.magnetUrl = extracted.magnetUrl;
          }
        }

        if (magnet) {
          launchPlayerWithMagnet(magnet);
        } else {
          Alert.alert('Notice', 'Direct magnet stream unavailable for this resolution.');
        }
      } catch (err: any) {
        Alert.alert('Stream Error', err?.message || 'Could not start stream');
      } finally {
        setStreamingResId(null);
      }
    },
    [backendUrl]
  );

  const handleDownloadMovie = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      let target = resItem.magnetUrl || resItem.torrentFileUrl;
      if (!target && resItem.topicUrl) {
        const extracted = await tamilMvService.extractMagnetFromTopic(
          resItem.topicUrl,
          resItem.resolution
        );
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
        const poster =
          selectedPosterUrl ||
          (movie.topicUrl ? posterCache.get(movie.topicUrl) : null) ||
          undefined;
        await startDownload(target, title, poster || undefined);

        Alert.alert(
          'Download Started 📥',
          `"${title}" has been queued in In-App Downloads and is saving to internal storage.`,
          [
            { text: 'View Downloads', onPress: () => onNavigateToTab?.('downloads') },
            { text: 'OK', style: 'cancel' },
          ]
        );
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
        const extracted = await tamilMvService.extractMagnetFromTopic(
          resItem.topicUrl,
          resItem.resolution
        );
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
          const extracted = await tamilMvService.extractMagnetFromTopic(
            resItem.topicUrl,
            resItem.resolution
          );
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
            Alert.alert('External Player', 'VLC or compatible media player is recommended.');
          });
        });
      } else {
        Alert.alert('Notice', 'Magnet link unavailable for external playback.');
      }
    },
    [backendUrl]
  );

  const handleOpenDetail = async (item: MyListItem) => {
    const resolutions = item.resolutions || [];
    const posterUrl = item.posterUrl || null;

    const movie: TamilMvMovieResult = {
      id: item.id,
      movieTitle: item.movieTitle,
      topicTitle: item.movieTitle,
      topicUrl: item.topicUrl,
      year: item.year,
      language: item.language,
      resolutions,
      posterUrl: item.posterUrl || undefined,
    };

    setSelectedMovie(movie);
    setSelectedPosterUrl(posterUrl);
    setDetailModalVisible(true);

    if (onSelectMovie) {
      onSelectMovie(movie);
    }

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

  const enqueuePosterFetch = useCallback((topicUrl: string, cb: (url: string | null) => void) => {
    const cached = posterCache.get(topicUrl);
    if (cached !== undefined) {
      cb(cached);
      return;
    }
    tamilMvService
      .extractPosterFromTopic(topicUrl)
      .then((url) => {
        if (url) posterCache.set(topicUrl, url);
        cb(url || null);
      })
      .catch(() => cb(null));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0815" />

      {/* ── Ambient Radial Atmosphere Aura ── */}
      <LinearGradient
        colors={['rgba(250, 36, 60, 0.08)', 'rgba(20, 15, 38, 0.95)', '#0A0815']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
      />

      {/* ── Clean Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerBadge}>
            <Sparkles size={11} color={Colors.primary} />
            <Text style={styles.headerBadgeText}>YOUR PERSONAL WATCHLIST</Text>
          </View>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>My List</Text>
            {items.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{items.length}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Clear List Button */}
        {items.length > 0 && (
          <TouchableOpacity
            style={styles.clearIconButton}
            onPress={handleClearAll}
            activeOpacity={0.7}
          >
            <Trash2 color="#8E8A9F" size={17} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Poster Grid or Empty State ── */}
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyAura}>
            <View style={styles.emptyIconCircle}>
              <Bookmark color={Colors.primary} size={36} fill={Colors.primary} strokeWidth={1.5} />
            </View>
          </View>
          <Text style={styles.emptyTitle}>Your Watchlist is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Save films you want to stream later by tapping the bookmark icon on any movie poster or detail sheet.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => onNavigateToTab?.('home')}
            activeOpacity={0.85}
          >
            <Text style={styles.exploreBtnText}>Explore Trending Movies</Text>
            <ArrowRight color="#FFFFFF" size={15} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key="my-list-grid"
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MyListGridCard
              item={item}
              onPress={() => handleOpenDetail(item)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
          numColumns={2}
          columnWrapperStyle={styles.listGridColumnWrapper}
          contentContainerStyle={[styles.listGridContent, { paddingBottom: insets.bottom + 90 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Movie Detail Sheet (Luxury Cinema Look) ── */}
      <MovieDetailSheet
        visible={detailModalVisible}
        movie={selectedMovie}
        streamingResId={streamingResId}
        isSaved={
          selectedMovie
            ? myListService.isSaved(
                selectedMovie.id || selectedMovie.topicUrl || selectedMovie.movieTitle
              )
            : false
        }
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
        enqueuePosterFetch={enqueuePosterFetch}
        backendUrl={backendUrl}
      />

      {/* ── Video Player Modal ── */}
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

/* ──────────────────────────────────────────────────────────────────────────
   STYLES: Clean Home-Screen Poster Grid Theme
────────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0815',
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerLeft: {
    flex: 1,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 7,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  headerBadgeText: {
    color: Colors.primary,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: '#1E1B2E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  countBadgeText: {
    color: '#C7C4DA',
    fontSize: 12,
    fontWeight: '800',
  },
  clearIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#161326',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Poster Grid Layout (Matches Home Screen) ── */
  listGridContent: {
    paddingTop: 4,
    paddingBottom: 36,
  },
  listGridColumnWrapper: {
    gap: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  /* ── Poster Grid Card (Home Screen Style) ── */
  pgCard: {
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  pgPosterWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#19152B',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  pgPosterImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  pgShimmerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pgFloatingRating: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(10, 10, 14, 0.88)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 215, 0, 0.45)',
    zIndex: 2,
  },
  pgFloatingRatingText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  pgFloatingYear: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: 'rgba(10, 10, 14, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    zIndex: 2,
  },
  pgFloatingYearText: {
    color: '#E0E0E6',
    fontSize: 10,
    fontWeight: '700',
  },
  pgTitleContainer: {
    marginTop: 6,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  pgTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  pgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  pgInlineRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  pgInlineRatingText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
  },
  pgMetaText: {
    color: '#8A8A9E',
    fontSize: 11,
    fontWeight: '600',
  },

  /* ── Empty State ── */
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingBottom: 60,
    marginTop: 60,
  },
  emptyAura: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(250, 36, 60, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8E8A9F',
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
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 22,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
