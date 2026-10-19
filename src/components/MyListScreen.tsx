import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  TextInput,
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
  Search,
  LayoutGrid,
  LayoutList,
  SlidersHorizontal,
  Sparkles,
  ArrowUpDown,
  Check,
  Calendar,
  Layers,
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
import { MovieDetailSheet } from './HomeScreen';
import { useDownloads } from '../context/DownloadContext';
import { DownloadItem } from '../types/downloads';

const { width } = Dimensions.get('window');

const getQualityBadgeConfig = (res: string) => {
  if (/4k|2160p/i.test(res)) {
    return { bg: 'rgba(250, 36, 60, 0.22)', border: 'rgba(250, 36, 60, 0.55)', text: Colors.primary };
  }
  if (/1080p/i.test(res)) {
    return { bg: 'rgba(10, 132, 255, 0.22)', border: 'rgba(10, 132, 255, 0.55)', text: '#5AC8FA' };
  }
  if (/720p/i.test(res)) {
    return { bg: 'rgba(52, 199, 89, 0.22)', border: 'rgba(52, 199, 89, 0.55)', text: '#30D158' };
  }
  if (/250mb/i.test(res)) {
    return { bg: 'rgba(191, 90, 242, 0.22)', border: 'rgba(191, 90, 242, 0.55)', text: '#DA8FFF' };
  }
  return { bg: 'rgba(142, 142, 147, 0.2)', border: 'rgba(142, 142, 147, 0.4)', text: '#E5E5EA' };
};

interface MyListScreenProps {
  onNavigateToTab?: (tab: TabKey) => void;
  onOpenInBrowserTab?: (url: string) => void;
  onSelectMovie?: (movie: TamilMvMovieResult) => void;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'recent' | 'title' | 'year' | 'quality';

export const MyListScreen: React.FC<MyListScreenProps> = ({
  onNavigateToTab,
  onOpenInBrowserTab,
  onSelectMovie,
}) => {
  const insets = useSafeAreaInsets();
  const { backendUrl, startDownload, themeKey } = useDownloads();

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

  // UI state: Search, View Mode, Filter & Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeFilter, setActiveFilter] = useState<'all' | '4k' | '1080p' | '720p'>('all');
  const [activeSort, setActiveSort] = useState<SortOption>('recent');

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

  const handleRemoveItem = (id: string, title: string) => {
    myListService.remove(id);
  };

  // Filtered & Sorted items
  const processedItems = useMemo(() => {
    let result = [...items];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.movieTitle.toLowerCase().includes(q) ||
          item.year?.toLowerCase().includes(q) ||
          item.language?.toLowerCase().includes(q)
      );
    }

    // Quality filter
    if (activeFilter === '4k') {
      result = result.filter((item) =>
        item.resolutions?.some((r) => /4k|2160p/i.test(r.resolution))
      );
    } else if (activeFilter === '1080p') {
      result = result.filter((item) =>
        item.resolutions?.some((r) => /1080p/i.test(r.resolution))
      );
    } else if (activeFilter === '720p') {
      result = result.filter((item) =>
        item.resolutions?.some((r) => /720p/i.test(r.resolution))
      );
    }

    // Sorting
    if (activeSort === 'title') {
      result.sort((a, b) => a.movieTitle.localeCompare(b.movieTitle));
    } else if (activeSort === 'year') {
      result.sort((a, b) => (b.year || '0').localeCompare(a.year || '0'));
    } else if (activeSort === 'quality') {
      result.sort((a, b) => {
        const aHas4k = a.resolutions?.some((r) => /4k|2160p/i.test(r.resolution)) ? 1 : 0;
        const bHas4k = b.resolutions?.some((r) => /4k|2160p/i.test(r.resolution)) ? 1 : 0;
        return bHas4k - aHas4k;
      });
    } else {
      // Recent (default)
      result.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }

    return result;
  }, [items, searchQuery, activeFilter, activeSort]);

  const fourKCount = useMemo(() => {
    return items.filter((item) =>
      item.resolutions?.some((r) => /4k|2160p/i.test(r.resolution))
    ).length;
  }, [items]);

  const handleStreamResolution = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      const title = `${movie.movieTitle} (${resItem.resolution})`;
      let magnet = resItem.magnetUrl;
      setStreamingResId(resItem.id);

      const launchPlayerWithMagnet = (resolvedMagnet: string) => {
        const cleanBackend = (backendUrl || 'https://vflix-backend.onrender.com').trim().replace(/\/+$/, '');
        // Silent non-blocking background pre-warm
        fetch(`${cleanBackend}/api/stream/warmup?magnet=${encodeURIComponent(resolvedMagnet)}`).catch(() => {});

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
        // Fast launch if magnet is already known (immediate playback with zero delay)
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

  // Layout sizing
  const gridCardWidth = Math.floor((width - 44) / 3);
  const gridCardHeight = Math.round(gridCardWidth * 1.5);

  /* ── 3-Column Poster Grid Item ── */
  const renderGridItem = ({ item }: { item: MyListItem }) => {
    const bestRes = item.resolutions && item.resolutions.length > 0 ? item.resolutions[0] : null;
    const badge = getQualityBadgeConfig(bestRes?.resolution || '');

    return (
      <TouchableOpacity
        style={[styles.gridCard, { width: gridCardWidth, height: gridCardHeight }]}
        onPress={() => handleOpenDetail(item)}
        activeOpacity={0.88}
      >
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, styles.cardShimmer]}>
            <Film color="#4E5166" size={24} strokeWidth={1.8} />
          </View>
        )}

        {/* Ambient Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(10, 8, 21, 0.4)', 'rgba(10, 8, 21, 0.95)']}
          style={styles.gridGradient}
          start={{ x: 0, y: 0.4 }}
          end={{ x: 0, y: 1 }}
        >
          <Text style={styles.gridCardTitle} numberOfLines={2}>
            {item.movieTitle}
          </Text>
          {item.year && <Text style={styles.gridCardYear}>{item.year}</Text>}
        </LinearGradient>

        {/* Top-Left Bookmark Ribbon Remove */}
        <TouchableOpacity
          style={styles.gridBookmarkBadge}
          onPress={(e) => {
            e.stopPropagation();
            handleRemoveItem(item.id, item.movieTitle);
          }}
          activeOpacity={0.75}
        >
          <Bookmark color={Colors.primary} size={13} fill={Colors.primary} strokeWidth={2} />
        </TouchableOpacity>

        {/* Top-Right Quality Tag */}
        {bestRes?.resolution ? (
          <View
            style={[
              styles.gridQualityBadge,
              { backgroundColor: badge.bg, borderColor: badge.border },
            ]}
          >
            <Text style={[styles.gridQualityText, { color: badge.text }]}>
              {bestRes.resolution.replace(/p$/i, '')}
            </Text>
          </View>
        ) : null}

        {/* Quick Play Trigger Circle */}
        <TouchableOpacity
          style={styles.gridQuickPlay}
          onPress={(e) => {
            e.stopPropagation();
            handleOpenQuality(item, 'play');
          }}
          activeOpacity={0.8}
        >
          <Play color="#FFFFFF" size={12} fill="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  /* ── Detailed List Row Item ── */
  const renderListItem = ({ item }: { item: MyListItem }) => {
    const bestRes = item.resolutions && item.resolutions.length > 0 ? item.resolutions[0] : null;
    const badge = getQualityBadgeConfig(bestRes?.resolution || '');
    const resCount = item.resolutions?.length || 0;

    return (
      <TouchableOpacity
        style={styles.listCard}
        onPress={() => handleOpenDetail(item)}
        activeOpacity={0.85}
      >
        {/* Poster Thumbnail */}
        <View style={styles.listPosterWrap}>
          {item.posterUrl ? (
            <Image source={{ uri: item.posterUrl }} style={styles.listPoster} resizeMode="cover" />
          ) : (
            <View style={[styles.listPoster, styles.cardShimmer]}>
              <Film color="#4E5166" size={20} strokeWidth={1.8} />
            </View>
          )}
          {bestRes?.resolution && (
            <View
              style={[
                styles.listQualityPill,
                { backgroundColor: badge.bg, borderColor: badge.border },
              ]}
            >
              <Text style={[styles.listQualityPillText, { color: badge.text }]}>
                {bestRes.resolution}
              </Text>
            </View>
          )}
        </View>

        {/* Info Column */}
        <View style={styles.listInfoColumn}>
          <Text style={styles.listTitle} numberOfLines={2}>
            {item.movieTitle}
          </Text>

          <View style={styles.listMetaRow}>
            {item.year && (
              <View style={styles.metaBadge}>
                <Calendar size={10} color="#8E8A9F" />
                <Text style={styles.metaBadgeText}>{item.year}</Text>
              </View>
            )}
            {item.language && (
              <View style={styles.metaBadge}>
                <Text style={styles.metaBadgeText}>{item.language}</Text>
              </View>
            )}
            {resCount > 0 && (
              <View style={styles.metaBadge}>
                <Layers size={10} color="#8E8A9F" />
                <Text style={styles.metaBadgeText}>{resCount} Swarm{resCount > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>

          {/* Action Row */}
          <View style={styles.listActionsRow}>
            <TouchableOpacity
              style={styles.listPlayBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenQuality(item, 'play');
              }}
              activeOpacity={0.8}
            >
              <Play color="#FFFFFF" size={12} fill="#FFFFFF" />
              <Text style={styles.listPlayBtnText}>Stream</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.listDownloadBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleOpenQuality(item, 'download');
              }}
              activeOpacity={0.8}
            >
              <Download color="#FFFFFF" size={13} strokeWidth={2.2} />
              <Text style={styles.listDownloadBtnText}>Download</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.listRemoveBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleRemoveItem(item.id, item.movieTitle);
              }}
              activeOpacity={0.75}
            >
              <Trash2 color="#8E8A9F" size={14} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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

      {/* ── Header Row ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerBadge}>
            <Sparkles size={11} color={Colors.primary} />
            <Text style={styles.headerBadgeText}>YOUR PERSONAL WATCHLIST</Text>
          </View>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>My List</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{items.length}</Text>
            </View>
            {fourKCount > 0 && (
              <View style={styles.fourKBadge}>
                <Text style={styles.fourKBadgeText}>{fourKCount} in 4K UHD</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right Header Actions */}
        <View style={styles.headerRightActions}>
          {/* View Toggle */}
          <View style={styles.viewToggleWrap}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.75}
            >
              <LayoutGrid size={15} color={viewMode === 'grid' ? '#FFFFFF' : '#8E8A9F'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.75}
            >
              <LayoutList size={15} color={viewMode === 'list' ? '#FFFFFF' : '#8E8A9F'} />
            </TouchableOpacity>
          </View>

          {/* Clear List Button */}
          {items.length > 0 && (
            <TouchableOpacity
              style={styles.clearIconButton}
              onPress={handleClearAll}
              activeOpacity={0.7}
            >
              <Trash2 color="#8E8A9F" size={16} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Interactive Search Bar ── */}
      {items.length > 0 && (
        <View style={styles.searchBarWrap}>
          <Search size={15} color="#8E8A9F" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search saved movies, years, audio..."
            placeholderTextColor="#6B677E"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={15} color="#8E8A9F" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Filter & Sort Chips ── */}
      {items.length > 0 && (
        <View style={styles.filterSection}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsScroll}
            data={[
              { id: 'all', label: 'All Titles' },
              { id: '4k', label: '4K Ultra HD' },
              { id: '1080p', label: '1080p Full HD' },
              { id: '720p', label: '720p HD' },
            ]}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isActive = activeFilter === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    isActive && { backgroundColor: Colors.primary, borderColor: Colors.primary },
                  ]}
                  onPress={() => setActiveFilter(item.id as any)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterChipText, isActive && { color: '#FFFFFF', fontWeight: '800' }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Sort Switcher */}
          <TouchableOpacity
            style={styles.sortToggleBtn}
            onPress={() => {
              const order: SortOption[] = ['recent', 'title', 'year', 'quality'];
              const nextIdx = (order.indexOf(activeSort) + 1) % order.length;
              setActiveSort(order[nextIdx]);
            }}
            activeOpacity={0.75}
          >
            <ArrowUpDown size={12} color="#A09DB1" />
            <Text style={styles.sortToggleText}>
              {activeSort === 'recent'
                ? 'Recent'
                : activeSort === 'title'
                ? 'A-Z'
                : activeSort === 'year'
                ? 'Year'
                : '4K First'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Main List or Empty State ── */}
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
      ) : processedItems.length === 0 ? (
        <View style={styles.noResultsContainer}>
          <Film size={32} color="#6B677E" />
          <Text style={styles.noResultsTitle}>No Movies Found</Text>
          <Text style={styles.noResultsSubtitle}>
            No saved titles match "{searchQuery}" with the selected filter.
          </Text>
          <TouchableOpacity
            style={styles.resetFilterBtn}
            onPress={() => {
              setSearchQuery('');
              setActiveFilter('all');
            }}
          >
            <Text style={styles.resetFilterText}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          key="my-list-grid"
          data={processedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderGridItem}
          numColumns={3}
          columnWrapperStyle={styles.gridColumnWrapper}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          key="my-list-vertical"
          data={processedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Movie Detail Sheet ── */}
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
        enqueuePosterFetch={(topicUrl, cb) => {
          const cached = posterCache.get(topicUrl);
          if (cached !== undefined) cb(cached);
        }}
        backendUrl={backendUrl}
      />

      {/* ── Quality Picker Bottom Sheet Modal ── */}
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
                    {qualityModalMode === 'play'
                      ? 'Select Quality to Stream'
                      : 'Select Quality to Download'}
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
                      <View
                        style={[
                          styles.qmQualityBadge,
                          { backgroundColor: qb.bg, borderColor: qb.border },
                        ]}
                      >
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
                            ? {
                                backgroundColor: 'rgba(250, 36, 60, 0.15)',
                                borderColor: 'rgba(250, 36, 60, 0.35)',
                              }
                            : {
                                backgroundColor: 'rgba(52, 199, 89, 0.15)',
                                borderColor: 'rgba(52, 199, 89, 0.35)',
                              },
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
   STYLES: Modern Cyber-Cinema Glassmorphic Theme
────────────────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0815',
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
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
    flexWrap: 'wrap',
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
  fourKBadge: {
    backgroundColor: 'rgba(250, 36, 60, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.4)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  fourKBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  viewToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#161326',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 3,
    gap: 2,
  },
  viewToggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  clearIconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#161326',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Search Bar ── */
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161326',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },

  /* ── Filter & Sort ── */
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterPillsScroll: {
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 12,
    backgroundColor: '#161326',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipText: {
    color: '#A09DB1',
    fontSize: 11.5,
    fontWeight: '600',
  },
  sortToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161326',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 5.5,
  },
  sortToggleText: {
    color: '#C7C4DA',
    fontSize: 11,
    fontWeight: '700',
  },

  /* ── Grid View ── */
  listContent: {
    paddingTop: 4,
    paddingHorizontal: 16,
  },
  gridColumnWrapper: {
    gap: 8,
    marginBottom: 10,
  },
  gridCard: {
    borderRadius: 14,
    backgroundColor: '#161326',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    ...StyleSheet.absoluteFill,
  },
  cardShimmer: {
    backgroundColor: '#161326',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 28,
  },
  gridCardTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  gridCardYear: {
    color: '#A09DB1',
    fontSize: 9.5,
    fontWeight: '500',
    marginTop: 2,
  },
  gridBookmarkBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridQualityBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
  },
  gridQualityText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  gridQuickPlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── List View ── */
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#141124',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
    marginBottom: 10,
    padding: 10,
    gap: 12,
  },
  listPosterWrap: {
    width: 80,
    height: 114,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E1B2E',
  },
  listPoster: {
    width: '100%',
    height: '100%',
  },
  listQualityPill: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 1,
    alignItems: 'center',
  },
  listQualityPillText: {
    fontSize: 8.5,
    fontWeight: '900',
  },
  listInfoColumn: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  listTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginVertical: 4,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaBadgeText: {
    color: '#8E8A9F',
    fontSize: 10.5,
    fontWeight: '600',
  },
  listActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  listPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  listPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  listDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  listDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  listRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },

  /* ── Empty & No Results ── */
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
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  noResultsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 4,
  },
  noResultsSubtitle: {
    color: '#8E8A9F',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  resetFilterBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  resetFilterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Quality Picker Bottom Sheet ── */
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  qmSheet: {
    backgroundColor: '#141124',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qmTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  qmSub: {
    color: '#8E8A9F',
    fontSize: 11.5,
    marginTop: 1,
  },
  qmCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F1B33',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qmOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#19152B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
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
    color: '#8E8A9F',
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
    color: '#8E8A9F',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 20,
  },
});
