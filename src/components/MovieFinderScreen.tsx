import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Search,
  X,
  Globe,
  Download,
  Play,
  Copy,
  ExternalLink,
  Film,
  Sparkles,
  Check,
  AlertCircle,
  ChevronDown,
  Layers,
  Flame,
  Radio,
  Tv,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';
import {
  tamilMvService,
  TamilMvMovieResult,
  MovieResolutionItem,
  POPULAR_MIRRORS,
} from '../services/tamilMvService';
import { useDownloads } from '../context/DownloadContext';
import { OfflinePlayerModal } from './OfflinePlayerModal';
import { DownloadItem } from '../types/downloads';

interface MovieFinderScreenProps {
  onNavigateToTab?: (tab: any) => void;
}

// Global in-memory cache for 0ms instant tab switching
let globalCachedFinderState: {
  query: string;
  searchedQuery: string;
  results: TamilMvMovieResult[];
  hasSearched: boolean;
} = {
  query: '',
  searchedQuery: '',
  results: [],
  hasSearched: false,
};

const FINDER_CACHE_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}finder_cache_v3.json`
  : '';

// Helper for quality badge colors
const getQualityBadgeColor = (res: string) => {
  if (/4k|2160p/i.test(res)) return '#E50914';
  if (/1080p/i.test(res)) return '#007AFF';
  if (/720p/i.test(res)) return '#34C759';
  if (/250mb/i.test(res)) return '#AF52DE';
  return '#48484A';
};

// Pure Component for Resolution Row
interface ResolutionRowItemProps {
  resItem: MovieResolutionItem;
  movie: TamilMvMovieResult;
  isStreaming: boolean;
  onMovieDownload: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  onTorrentDownload: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  onStream: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  onCopy: (res: MovieResolutionItem) => void;
}

const ResolutionRowItem = React.memo<ResolutionRowItemProps>(
  ({ resItem, movie, isStreaming, onMovieDownload, onTorrentDownload, onStream, onCopy }) => {
    const badgeColor = getQualityBadgeColor(resItem.resolution);

    return (
      <View style={styles.resRow}>
        {/* Left: Quality Badge & Specs */}
        <View style={styles.resLeft}>
          <View style={[styles.qualityPill, { backgroundColor: badgeColor }]}>
            <Text style={styles.qualityPillText}>{resItem.resolution}</Text>
          </View>
          {resItem.size ? <Text style={styles.sizeText}>{resItem.size}</Text> : null}
          {resItem.audio ? <Text style={styles.codecText}>• {resItem.audio}</Text> : null}
        </View>

        {/* Right: 4 Clean Uniform Action Buttons (No text) */}
        <View style={styles.resRightActions}>
          {/* Action 1: Movie Download (Direct to Downloads Manager) */}
          <TouchableOpacity
            style={styles.actionIconBtnDownload}
            onPress={() => onMovieDownload(resItem, movie)}
            activeOpacity={0.7}
            accessibilityLabel="Movie Download"
          >
            <Download color="#FFFFFF" size={14} />
          </TouchableOpacity>

          {/* Action 2: Torrent Option */}
          <TouchableOpacity
            style={styles.actionIconBtnTorrent}
            onPress={() => onTorrentDownload(resItem, movie)}
            activeOpacity={0.7}
            accessibilityLabel="Torrent Download"
          >
            <Flame color="#FF9500" size={14} />
          </TouchableOpacity>

          {/* Action 3: Online Stream (In-App Player) */}
          <TouchableOpacity
            style={styles.actionIconBtnStream}
            onPress={() => onStream(resItem, movie)}
            activeOpacity={0.7}
            accessibilityLabel="Online Stream"
          >
            {isStreaming ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Play color="#FFFFFF" size={13} fill="#FFFFFF" />
            )}
          </TouchableOpacity>

          {/* Action 4: Copy Magnet / Link */}
          <TouchableOpacity
            style={styles.actionIconBtnCopy}
            onPress={() => onCopy(resItem)}
            activeOpacity={0.7}
            accessibilityLabel="Copy Link"
          >
            <Copy color="#8E8E93" size={14} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
);

// Pure Component for Movie Card
interface MovieCardItemProps {
  item: TamilMvMovieResult;
  streamingResId: string | null;
  onMovieDownload: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  onTorrentDownload: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  onStream: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  onCopy: (res: MovieResolutionItem) => void;
}

const MovieCardItem = React.memo<MovieCardItemProps>(
  ({ item, streamingResId, onMovieDownload, onTorrentDownload, onStream, onCopy }) => {
    return (
      <View style={styles.card}>
        {/* Card Header with Film Avatar & Movie Info */}
        <View style={styles.cardHeader}>
          <View style={styles.filmAvatar}>
            <Film color={Colors.netflixRed} size={18} />
          </View>

          <View style={styles.cardTitleGroup}>
            <Text style={styles.movieTitle} numberOfLines={1}>
              {item.movieTitle}
            </Text>
            <View style={styles.metaBadgeRow}>
              {item.year ? (
                <View style={styles.yearChip}>
                  <Text style={styles.yearChipText}>{item.year}</Text>
                </View>
              ) : null}
              {item.language ? (
                <View style={styles.langChip}>
                  <Text style={styles.langText}>{item.language}</Text>
                </View>
              ) : null}
              <Text style={styles.qualityCount}>
                • {item.resolutions.length} {item.resolutions.length === 1 ? 'quality' : 'qualities'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.openTopicBtn}
            onPress={() => Linking.openURL(item.topicUrl)}
            activeOpacity={0.7}
          >
            <ExternalLink color="#8E8E93" size={15} />
          </TouchableOpacity>
        </View>

        {/* Grouped Resolutions List */}
        <View style={styles.resolutionsList}>
          {item.resolutions.map((res) => (
            <ResolutionRowItem
              key={res.id}
              resItem={res}
              movie={item}
              isStreaming={streamingResId === res.id}
              onMovieDownload={onMovieDownload}
              onTorrentDownload={onTorrentDownload}
              onStream={onStream}
              onCopy={onCopy}
            />
          ))}
        </View>
      </View>
    );
  }
);

export const MovieFinderScreen: React.FC<MovieFinderScreenProps> = ({ onNavigateToTab }) => {
  const insets = useSafeAreaInsets();
  const { startDownload, backendUrl } = useDownloads();

  const [query, setQuery] = useState(globalCachedFinderState.query);
  const [loading, setLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState(globalCachedFinderState.searchedQuery);
  const [results, setResults] = useState<TamilMvMovieResult[]>(globalCachedFinderState.results);
  const [hasSearched, setHasSearched] = useState(globalCachedFinderState.hasSearched);

  // Pagination State (6 movies per page)
  const PAGE_SIZE = 6;
  const [currentPage, setCurrentPage] = useState(1);
  const flatListRef = useRef<FlatList>(null);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  const visibleResults = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return results.slice(start, start + PAGE_SIZE);
  }, [results, currentPage]);

  const handlePageChange = (newPage: number) => {
    const page = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(page);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // In-App Video Streaming Player State
  const [streamPlayerVisible, setStreamPlayerVisible] = useState(false);
  const [activeStreamItem, setActiveStreamItem] = useState<DownloadItem | null>(null);
  const [streamingResId, setStreamingResId] = useState<string | null>(null);

  // Configurable Mirror URL State
  const [currentBaseUrl, setCurrentBaseUrl] = useState(tamilMvService.getBaseUrl());
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(currentBaseUrl);

  // Scraper WebView State
  const [webViewSearchUrl, setWebViewSearchUrl] = useState('');
  const webViewRef = useRef<WebView>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Quick filter suggestions
  const suggestions = [
    'Recent Upload',
    '2026',
    '2025',
    '2024',
    'Leo',
    'Amaran',
    'GOAT',
    'Modha Rathri',
    'Vettaiyan',
    'Lover',
  ];

  // Restore persisted state from storage on first mount if cache is empty
  useEffect(() => {
    if (globalCachedFinderState.results.length === 0 && FINDER_CACHE_FILE) {
      FileSystem.readAsStringAsync(FINDER_CACHE_FILE)
        .then((content) => {
          try {
            const parsed = JSON.parse(content);
            if (parsed && Array.isArray(parsed.results) && parsed.results.length > 0) {
              setQuery(parsed.query || '');
              setSearchedQuery(parsed.searchedQuery || '');
              setResults(parsed.results);
              setHasSearched(Boolean(parsed.hasSearched));
              setCurrentPage(1);
              globalCachedFinderState = {
                query: parsed.query || '',
                searchedQuery: parsed.searchedQuery || '',
                results: parsed.results,
                hasSearched: Boolean(parsed.hasSearched),
              };
            }
          } catch {}
        })
        .catch(() => {});
    }
  }, []);

  // Sync state to memory cache & persistent file
  const updateFinderState = (
    newResults: TamilMvMovieResult[],
    newSearchedQuery: string,
    newHasSearched: boolean,
    newQuery?: string
  ) => {
    setResults(newResults);
    setSearchedQuery(newSearchedQuery);
    setHasSearched(newHasSearched);
    setCurrentPage(1);
    if (newQuery !== undefined) setQuery(newQuery);

    const newState = {
      query: newQuery !== undefined ? newQuery : query,
      searchedQuery: newSearchedQuery,
      results: newResults,
      hasSearched: newHasSearched,
    };
    globalCachedFinderState = newState;

    if (FINDER_CACHE_FILE) {
      FileSystem.writeAsStringAsync(FINDER_CACHE_FILE, JSON.stringify(newState)).catch(() => {});
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handlePerformSearch = async (searchTerm?: string) => {
    const term = (searchTerm ?? query).trim();
    if (!term) return;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    setLoading(true);
    setHasSearched(true);
    setSearchedQuery(term);
    setResults([]);
    setCurrentPage(1);

    const isRecent = /^recent/i.test(term);
    const searchUrl = isRecent
      ? `${currentBaseUrl}/`
      : `${currentBaseUrl}/index.php?/search/&q=${encodeURIComponent(term)}&type=forums_topic`;

    setWebViewSearchUrl(searchUrl);

    // Timeout safety fallback
    searchTimeoutRef.current = setTimeout(() => {
      setLoading(false);
    }, 12000);

    // Try direct fetch first
    try {
      const data = isRecent
        ? await tamilMvService.searchMovie('Tamil', currentBaseUrl)
        : await tamilMvService.searchMovie(term, currentBaseUrl);

      if (data && data.length > 0) {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        updateFinderState(data, term, true);
        setLoading(false);
        return;
      }
    } catch (err) {
      // Background WebView scraper will catch the result
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'SCRAPED_TOPICS' && Array.isArray(payload.items)) {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        const filterTerm = /^recent/i.test(searchedQuery) ? '' : searchedQuery;
        const parsed = tamilMvService.parseRawTopicItems(payload.items, filterTerm);
        updateFinderState(parsed, searchedQuery, true);
        setLoading(false);
      }
    } catch (e) {
      console.warn('WebView scrape error:', e);
    }
  };

  const handleSaveBaseUrl = (newUrl: string) => {
    tamilMvService.setBaseUrl(newUrl);
    const cleaned = tamilMvService.getBaseUrl();
    setCurrentBaseUrl(cleaned);
    setCustomUrlInput(cleaned);
    setUrlModalVisible(false);
  };

  // 1. Movie Direct Download (In-App Download Manager)
  const handleMovieDownload = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      let target = resItem.magnetUrl || resItem.torrentFileUrl;

      if (!target && resItem.topicUrl) {
        const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl);
        if (extracted.magnetUrl) {
          target = extracted.magnetUrl;
          resItem.magnetUrl = extracted.magnetUrl;
        } else if (extracted.torrentUrl) {
          target = extracted.torrentUrl;
          resItem.torrentFileUrl = extracted.torrentUrl;
        }
      }

      if (!target) target = resItem.topicUrl;

      try {
        const title = `${movie.movieTitle} (${resItem.resolution})`;
        await startDownload(target, title);
        Alert.alert('Download Started', `"${title}" has been added to your downloads queue!`, [
          { text: 'OK' },
          { text: 'View Downloads', onPress: () => onNavigateToTab?.('downloads') },
        ]);
      } catch (err: any) {
        Alert.alert('Download Error', err?.message || 'Failed to start movie download');
      }
    },
    [startDownload, onNavigateToTab]
  );

  // 2. Torrent Option (Save / Queue to Torrent Engine)
  const handleTorrentDownload = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      let magnet = resItem.magnetUrl;
      let torrentFile = resItem.torrentFileUrl;

      if (!magnet && !torrentFile && resItem.topicUrl) {
        const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl);
        if (extracted.magnetUrl) {
          magnet = extracted.magnetUrl;
          resItem.magnetUrl = extracted.magnetUrl;
        }
        if (extracted.torrentUrl) {
          torrentFile = extracted.torrentUrl;
          resItem.torrentFileUrl = extracted.torrentUrl;
        }
      }

      if (magnet) {
        Alert.alert(
          'Torrent Option',
          `Queue this torrent to background engine or open in external torrent app?`,
          [
            {
              text: 'Queue in App',
              onPress: async () => {
                try {
                  const title = `[Torrent] ${movie.movieTitle} (${resItem.resolution})`;
                  await startDownload(magnet, title);
                  Alert.alert('Torrent Queued', 'Torrent download queued in background engine.', [
                    { text: 'OK' },
                    { text: 'View Downloads', onPress: () => onNavigateToTab?.('downloads') },
                  ]);
                } catch (e: any) {
                  Alert.alert('Error', e?.message || 'Failed to queue torrent');
                }
              },
            },
            {
              text: 'Open Torrent App',
              onPress: () =>
                Linking.openURL(magnet).catch(() => Alert.alert('Notice', 'No torrent app installed.')),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else if (torrentFile) {
        Linking.openURL(torrentFile);
      } else {
        Linking.openURL(resItem.topicUrl);
      }
    },
    [startDownload, onNavigateToTab]
  );

  // 3. Online Stream (Plays directly inside built-in Video Player Modal)
  const handleStreamResolution = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      const title = `${movie.movieTitle} (${resItem.resolution})`;
      let magnet = resItem.magnetUrl;

      setStreamingResId(resItem.id);

      try {
        if (!magnet && resItem.topicUrl) {
          const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl);
          if (extracted.magnetUrl) {
            magnet = extracted.magnetUrl;
            resItem.magnetUrl = extracted.magnetUrl;
          }
        }

        if (magnet) {
          const liveStreamUrl = `${backendUrl}/api/stream/play?magnet=${encodeURIComponent(magnet)}`;
          const streamDownloadItem: DownloadItem = {
            id: `stream_${Date.now()}`,
            title,
            fileName: `${movie.movieTitle}_${resItem.resolution}.mp4`,
            fileUri: '',
            url: liveStreamUrl,
            status: 'completed',
            progress: 1,
            totalBytes: 0,
            downloadedBytes: 0,
            speed: 'Online Stream',
            isTorrent: false,
            createdAt: Date.now(),
          };

          setActiveStreamItem(streamDownloadItem);
          setStreamPlayerVisible(true);
        } else {
          Alert.alert(
            'Stream Unavailable',
            `Could not resolve a direct magnet stream for "${title}". You can check the forum post directly.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'View Forum Topic', onPress: () => Linking.openURL(resItem.topicUrl) },
            ]
          );
        }
      } catch (err: any) {
        Alert.alert('Stream Error', err?.message || 'Could not start stream');
      } finally {
        setStreamingResId(null);
      }
    },
    [backendUrl]
  );

  // 4. Copy Magnet / Link
  const handleCopyMagnet = useCallback(async (resItem: MovieResolutionItem) => {
    let link = resItem.magnetUrl || resItem.torrentFileUrl;
    if (!link && resItem.topicUrl) {
      const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl);
      if (extracted.magnetUrl) {
        link = extracted.magnetUrl;
        resItem.magnetUrl = extracted.magnetUrl;
      } else if (extracted.torrentUrl) {
        link = extracted.torrentUrl;
        resItem.torrentFileUrl = extracted.torrentUrl;
      } else {
        link = resItem.topicUrl;
      }
    }

    if (link) {
      try {
        await Share.share({ message: link, title: 'Movie Magnet Link' });
      } catch {}
    } else {
      Alert.alert('Link', 'Direct magnet link available on the topic page.');
    }
  }, []);

  const renderMovieCard = useCallback(
    ({ item }: { item: TamilMvMovieResult }) => {
      return (
        <MovieCardItem
          item={item}
          streamingResId={streamingResId}
          onMovieDownload={handleMovieDownload}
          onTorrentDownload={handleTorrentDownload}
          onStream={handleStreamResolution}
          onCopy={handleCopyMagnet}
        />
      );
    },
    [streamingResId, handleMovieDownload, handleTorrentDownload, handleStreamResolution, handleCopyMagnet]
  );

  const keyExtractor = useCallback((item: TamilMvMovieResult) => item.id, []);

  // Clean Pagination Bar Component
  const renderPaginationBar = () => {
    if (totalPages <= 1) return null;

    return (
      <View style={styles.paginationBar}>
        <TouchableOpacity
          style={[styles.pageNavBtn, currentPage === 1 && styles.pageNavBtnDisabled]}
          onPress={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          activeOpacity={0.7}
        >
          <ChevronLeft color={currentPage === 1 ? '#48484A' : '#FFFFFF'} size={15} />
          <Text style={[styles.pageNavBtnText, currentPage === 1 && styles.pageNavBtnTextDisabled]}>
            Prev
          </Text>
        </TouchableOpacity>

        <View style={styles.pageNumbersRow}>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
            .map((pageNum) => (
              <TouchableOpacity
                key={pageNum}
                style={[styles.pageNumPill, currentPage === pageNum && styles.pageNumPillActive]}
                onPress={() => handlePageChange(pageNum)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pageNumText, currentPage === pageNum && styles.pageNumTextActive]}>
                  {pageNum}
                </Text>
              </TouchableOpacity>
            ))}
        </View>

        <TouchableOpacity
          style={[styles.pageNavBtn, currentPage === totalPages && styles.pageNavBtnDisabled]}
          onPress={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          activeOpacity={0.7}
        >
          <Text style={[styles.pageNavBtnText, currentPage === totalPages && styles.pageNavBtnTextDisabled]}>
            Next
          </Text>
          <ChevronRight color={currentPage === totalPages ? '#48484A' : '#FFFFFF'} size={15} />
        </TouchableOpacity>
      </View>
    );
  };

  const INJECTED_SCRAPER_JS = `
    (function() {
      function sendResults() {
        try {
          var items = [];
          var links = document.querySelectorAll('a[href*="/forums/topic/"]');
          var seen = {};
          for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var href = a.href;
            var text = (a.innerText || a.textContent || '').trim();
            if (!href || !text || text.length < 3 || seen[href]) continue;
            if (/^\\d+$/.test(text) || text.toLowerCase() === 'next' || text.toLowerCase() === 'prev' || text.toLowerCase() === 'last') continue;
            seen[href] = true;
            items.push({ topicUrl: href, rawTitle: text });
          }
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SCRAPED_TOPICS',
              items: items
            }));
          }
        } catch(e) {}
      }

      if (document.readyState === 'complete') {
        setTimeout(sendResults, 500);
      } else {
        window.addEventListener('load', function() { setTimeout(sendResults, 700); });
      }
      setTimeout(sendResults, 2000);
    })();
    true;
  `;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      {/* 1. Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Finder</Text>
        </View>

        <TouchableOpacity
          style={styles.mirrorChip}
          onPress={() => setUrlModalVisible(true)}
          activeOpacity={0.75}
        >
          <Globe color="#34C759" size={12} />
          <Text style={styles.mirrorChipText} numberOfLines={1}>
            {currentBaseUrl.replace(/^https?:\/\/(www\.)?/, '')}
          </Text>
          <ChevronDown color="#8E8E93" size={12} />
        </TouchableOpacity>
      </View>

      {/* 2. Unified Search Input */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Search color="#8E8E93" size={16} />
          <TextInput
            style={styles.input}
            placeholder="Search movie title (e.g. Leo, Amaran)..."
            placeholderTextColor="#636366"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handlePerformSearch()}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <X color="#8E8E93" size={14} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.searchBtn, !query.trim() && styles.searchBtnDisabled]}
          onPress={() => handlePerformSearch()}
          disabled={!query.trim() || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.searchBtnText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 3. Filter / Suggestions Chips */}
      <View style={styles.suggestionsSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
          {suggestions.map((item) => {
            const isSelected = searchedQuery.toLowerCase() === item.toLowerCase();
            return (
              <TouchableOpacity
                key={item}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => {
                  setQuery(item);
                  handlePerformSearch(item);
                }}
                activeOpacity={0.7}
              >
                {item === 'Recent Upload' ? (
                  <Sparkles color={isSelected ? '#FFFFFF' : Colors.netflixRed} size={11} />
                ) : null}
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Main Body Content */}
      {loading ? (
        <View style={styles.stateCenter}>
          <ActivityIndicator size="small" color={Colors.netflixRed} />
          <Text style={styles.loadingText}>Searching {currentBaseUrl.replace(/^https?:\/\/(www\.)?/, '')}...</Text>
        </View>
      ) : hasSearched && results.length === 0 ? (
        /* Clean Not Found State */
        <View style={styles.stateCenter}>
          <AlertCircle color="#48484A" size={40} />
          <Text style={styles.notFoundTitle}>No Results Found</Text>
          <Text style={styles.notFoundSub}>
            No movies found for "{searchedQuery}". Try another title or switch mirror.
          </Text>
          <TouchableOpacity
            style={styles.switchMirrorBtn}
            onPress={() => setUrlModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.switchMirrorBtnText}>Switch Mirror Domain</Text>
          </TouchableOpacity>
        </View>
      ) : hasSearched && results.length > 0 ? (
        /* Results List with Pagination Header & Footer */
        <FlatList
          ref={flatListRef}
          data={visibleResults}
          keyExtractor={keyExtractor}
          renderItem={renderMovieCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={
            <View style={styles.listHeaderBox}>
              <View style={styles.listHeaderMetaRow}>
                <Text style={styles.resultsCount}>
                  Found {results.length} Movie{results.length === 1 ? '' : 's'}
                </Text>
                <Text style={styles.pageCount}>
                  Page {currentPage} of {totalPages}
                </Text>
              </View>
              {renderPaginationBar()}
            </View>
          }
          ListFooterComponent={renderPaginationBar}
        />
      ) : (
        /* Clean Idle State */
        <View style={styles.stateCenter}>
          <Layers color="#2C2C2E" size={44} />
          <Text style={styles.idleTitle}>Quick Movie & Quality Finder</Text>
          <Text style={styles.idleSub}>
            Type any movie name or select a year chip to list all download and stream qualities.
          </Text>
        </View>
      )}

      {/* 5. Clean Mirror Config Modal */}
      <Modal
        visible={urlModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUrlModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setUrlModalVisible(false)}
          />

          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Source Mirror Domain</Text>
              <TouchableOpacity onPress={() => setUrlModalVisible(false)}>
                <X color="#8E8E93" size={18} />
              </TouchableOpacity>
            </View>

            {/* Custom Input */}
            <View style={styles.modalInputRow}>
              <TextInput
                style={styles.modalInput}
                value={customUrlInput}
                onChangeText={setCustomUrlInput}
                placeholder="https://www.1tamilmv.lease"
                placeholderTextColor="#636366"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => handleSaveBaseUrl(customUrlInput)}
                activeOpacity={0.8}
              >
                <Check color="#FFFFFF" size={14} />
              </TouchableOpacity>
            </View>

            {/* Presets */}
            <Text style={styles.presetsLabel}>POPULAR MIRRORS</Text>
            <View style={styles.presetsContainer}>
              {POPULAR_MIRRORS.map((mirror) => {
                const isActive = currentBaseUrl.toLowerCase() === mirror.toLowerCase();
                return (
                  <TouchableOpacity
                    key={mirror}
                    style={[styles.presetRow, isActive && styles.presetRowActive]}
                    onPress={() => handleSaveBaseUrl(mirror)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetRowText, isActive && styles.presetRowTextActive]}>
                      {mirror.replace(/^https?:\/\//, '')}
                    </Text>
                    {isActive && <Check color={Colors.netflixRed} size={14} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Headless Scraper WebView */}
      {webViewSearchUrl ? (
        <View style={styles.offscreenWebView}>
          <WebView
            ref={webViewRef}
            source={{ uri: webViewSearchUrl }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            injectedJavaScript={INJECTED_SCRAPER_JS}
            onMessage={handleWebViewMessage}
          />
        </View>
      ) : null}

      {/* In-App Live Video Player Modal */}
      <OfflinePlayerModal
        visible={streamPlayerVisible}
        item={activeStreamItem}
        onClose={() => {
          setStreamPlayerVisible(false);
          setActiveStreamItem(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  mirrorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1C1C1E',
    borderWidth: 0.5,
    borderColor: '#2C2C2E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  mirrorChipText: {
    color: '#E5E5EA',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 130,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 2,
  },
  searchBtn: {
    backgroundColor: Colors.netflixRed,
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.4,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionsSection: {
    paddingVertical: 4,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161618',
    borderWidth: 0.5,
    borderColor: '#28282E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  chipActive: {
    backgroundColor: 'rgba(255, 0, 64, 0.15)',
    borderColor: Colors.netflixRed,
  },
  chipText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  listHeaderBox: {
    marginBottom: 10,
    gap: 8,
  },
  listHeaderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsCount: {
    color: '#E5E5EA',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  pageCount: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161618',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#242428',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 4,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#242428',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pageNavBtnDisabled: {
    opacity: 0.35,
    backgroundColor: '#18181A',
  },
  pageNavBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pageNavBtnTextDisabled: {
    color: '#636366',
  },
  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNumPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  pageNumPillActive: {
    backgroundColor: Colors.netflixRed,
  },
  pageNumText: {
    color: '#AEAEB2',
    fontSize: 11,
    fontWeight: '700',
  },
  pageNumTextActive: {
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#161618',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: '#242428',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#202024',
  },
  filmAvatar: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 0, 64, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 0, 64, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleGroup: {
    flex: 1,
    gap: 4,
  },
  movieTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yearChip: {
    backgroundColor: '#242428',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  yearChipText: {
    color: '#AEAEB2',
    fontSize: 10,
    fontWeight: '600',
  },
  langChip: {
    backgroundColor: 'rgba(255, 0, 64, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  langText: {
    color: Colors.netflixRed,
    fontSize: 10,
    fontWeight: '700',
  },
  qualityCount: {
    color: '#636366',
    fontSize: 11,
  },
  openTopicBtn: {
    padding: 6,
  },
  resolutionsList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 7,
  },
  resRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  resLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  qualityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qualityPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  sizeText: {
    color: '#E5E5EA',
    fontSize: 11,
    fontWeight: '600',
  },
  codecText: {
    color: '#636366',
    fontSize: 10,
  },
  resRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtnDownload: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: Colors.netflixRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBtnTorrent: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 149, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBtnStream: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBtnCopy: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#242428',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    gap: 8,
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 8,
  },
  notFoundTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  notFoundSub: {
    color: '#636366',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  switchMirrorBtn: {
    marginTop: 10,
    backgroundColor: '#1C1C1E',
    borderWidth: 0.5,
    borderColor: '#3A3A3C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  switchMirrorBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  idleTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  idleSub: {
    color: '#636366',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: '#2C2C2E',
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141416',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  modalInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
  },
  modalSaveBtn: {
    backgroundColor: Colors.netflixRed,
    padding: 6,
    borderRadius: 6,
  },
  presetsLabel: {
    color: '#636366',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  presetsContainer: {
    gap: 6,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161618',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  presetRowActive: {
    backgroundColor: 'rgba(255, 0, 64, 0.1)',
  },
  presetRowText: {
    color: '#AEAEB2',
    fontSize: 11,
    fontWeight: '500',
  },
  presetRowTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  offscreenWebView: {
    position: 'absolute',
    top: -2000,
    left: -2000,
    width: 320,
    height: 400,
    opacity: 0.01,
  },
});
