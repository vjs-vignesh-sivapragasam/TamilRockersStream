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
  RefreshControl,
  BackHandler,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
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
  ArrowUp,
} from 'lucide-react-native';
import { Colors } from '../constants/theme';
import {
  tamilMvService,
  TamilMvMovieResult,
  MovieResolutionItem,
  POPULAR_MIRRORS,
  posterCache,
} from '../services/tamilMvService';
import { useDownloads } from '../context/DownloadContext';
import { OfflinePlayerModal } from './OfflinePlayerModal';
import { DownloadItem } from '../types/downloads';

interface MovieFinderScreenProps {
  onNavigateToTab?: (tab: any) => void;
}

interface StreamModalData {
  movie: TamilMvMovieResult;
  resItem: MovieResolutionItem;
  magnet: string;
  title: string;
  streamUrl: string;
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
  ? `${FileSystem.documentDirectory}finder_cache_v4.json`
  : '';

// Helper for quality badge styling
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

// Helper to prioritize 1080p or 720p by default
const getInitialResolutionIndex = (resolutions: MovieResolutionItem[]): number => {
  if (!resolutions || resolutions.length === 0) return 0;

  // 1. First priority: 1080p
  const idx1080 = resolutions.findIndex((r) =>
    /\b1080p?\b/i.test(r.resolution) || /1080/i.test(r.resolution) || /1080/i.test(r.rawTitle || '')
  );
  if (idx1080 !== -1) return idx1080;

  // 2. Second priority: 720p
  const idx720 = resolutions.findIndex((r) =>
    /\b720p?\b/i.test(r.resolution) || /720/i.test(r.resolution) || /720/i.test(r.rawTitle || '')
  );
  if (idx720 !== -1) return idx720;

  // 3. Fallback to first available quality
  return 0;
};

// Pure Component for Movie Card with Dynamic Resolution Dropdown and 2-Line Action Buttons
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
    // Dynamic Resolution Dropdown State (Defaults to 1080p or 720p)
    const [selectedResIndex, setSelectedResIndex] = useState(() =>
      getInitialResolutionIndex(item.resolutions)
    );
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Lazy poster thumbnail state
    const [posterUrl, setPosterUrl] = useState<string | null>(() => {
      // Check module-level cache first for instant render (no flicker on tab switch)
      const cached = posterCache.get(item.topicUrl);
      return cached !== undefined ? cached : null;
    });
    const [posterLoading, setPosterLoading] = useState(() => !posterCache.has(item.topicUrl));

    // Lazy-load poster in background (only if not already cached)
    useEffect(() => {
      if (posterCache.has(item.topicUrl)) return; // already fetched
      let cancelled = false;
      setPosterLoading(true);
      tamilMvService.extractPosterFromTopic(item.topicUrl).then((url) => {
        if (cancelled) return;
        const result = url || null;
        posterCache.set(item.topicUrl, result);
        setPosterUrl(result);
        setPosterLoading(false);
      });
      return () => { cancelled = true; };
    }, [item.topicUrl]);

    // Keep default synced if resolutions change
    useEffect(() => {
      setSelectedResIndex(getInitialResolutionIndex(item.resolutions));
    }, [item.resolutions]);

    // Selected Resolution
    const selectedRes = item.resolutions[selectedResIndex] || item.resolutions[0];
    const isStreaming = selectedRes ? streamingResId === selectedRes.id : false;
    const badge = getQualityBadgeConfig(selectedRes?.resolution || '1080p');

    // Robust Title Sanitizer: Guarantees clean movie name even if scraped/cached data was irregular
    const cleanMovieName = useMemo(() => {
      const isBad = (name?: string) =>
        !name ||
        name.length < 2 ||
        /^(languages?|rips?)|^[-–—\s\d.+]+(?:gb|mb)?/i.test(name.trim());

      if (!isBad(item.movieTitle)) {
        return item.movieTitle;
      }

      // Recover from topicUrl
      const fallbackUrl = item.topicUrl || item.resolutions[0]?.topicUrl || '';
      if (fallbackUrl) {
        const parsed = tamilMvService.parseTitleMetadata(
          item.resolutions[0]?.rawTitle || item.movieTitle || '',
          fallbackUrl
        );
        if (!isBad(parsed.movieTitle)) {
          return parsed.movieTitle;
        }
      }

      return 'Tamil Movie';
    }, [item.movieTitle, item.topicUrl, item.resolutions]);

    return (
      <View style={styles.card}>
        {/* Card Layout: Poster Left + Content Right */}
        <View style={styles.cardInner}>
          {/* Movie Poster Thumbnail */}
          <View style={styles.posterWrap}>
            {posterUrl ? (
              <Image
                source={{ uri: posterUrl }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            ) : posterLoading ? (
              /* Shimmer placeholder while loading */
              <LinearGradient
                colors={['#1C1C1E', '#2C2C2E', '#1C1C1E']}
                style={styles.posterShimmer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Film color="#3A3A3C" size={28} strokeWidth={1.5} />
              </LinearGradient>
            ) : (
              /* No poster found — show gradient fallback with icon */
              <LinearGradient
                colors={[Colors.primary, '#8A0E1C']}
                style={styles.posterShimmer}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Film color="rgba(255,255,255,0.5)" size={28} strokeWidth={1.5} />
              </LinearGradient>
            )}
            {/* Language badge on poster */}
            {item.language ? (
              <View style={styles.posterLangBadge}>
                <Text style={styles.posterLangText}>{item.language.slice(0, 3).toUpperCase()}</Text>
              </View>
            ) : null}
          </View>

          {/* Right Content */}
          <View style={styles.cardContent}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleGroup}>
                <Text style={styles.movieTitle} numberOfLines={2}>
                  {cleanMovieName}
                </Text>
                <View style={styles.metaBadgeRow}>
                  {item.year ? (
                    <View style={styles.yearChip}>
                      <Text style={styles.yearChipText}>{item.year}</Text>
                    </View>
                  ) : null}
                  {selectedRes ? (
                    <View style={[styles.selectedQualityHeaderBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                      <Text style={[styles.selectedQualityHeaderBadgeText, { color: badge.text }]}>
                        {selectedRes.resolution}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.resCountChip}>
                    <Text style={styles.qualityCount}>
                      {item.resolutions.length} {item.resolutions.length === 1 ? 'quality' : 'qualities'}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.openTopicBtn}
                onPress={() => Linking.openURL(item.topicUrl)}
                activeOpacity={0.7}
                accessibilityLabel="Open Forum Post"
              >
                <ExternalLink color="#4B5563" size={13.5} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            {/* Dynamic Resolution Dropdown Selector */}
            {selectedRes ? (
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerOpen]}
                  onPress={() => setDropdownOpen((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <View style={styles.dropdownTriggerLeft}>
                    <View style={[styles.qualityPill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                      <Text style={[styles.qualityPillText, { color: badge.text }]}>
                        {selectedRes.resolution}
                      </Text>
                    </View>
                    <View style={styles.dropdownSpecs}>
                      {selectedRes.size ? <Text style={styles.dropdownSizeText}>{selectedRes.size}</Text> : null}
                      {selectedRes.audio ? (
                        <Text style={styles.dropdownAudioText} numberOfLines={1}>
                          {selectedRes.audio}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.dropdownTriggerRight}>
                    <Text style={styles.dropdownActionText}>
                      {item.resolutions.length > 1 ? (dropdownOpen ? 'Close' : 'Change Quality') : 'Quality'}
                    </Text>
                    {item.resolutions.length > 1 ? (
                      <ChevronDown
                        color="#9CA3AF"
                        size={15}
                        style={{ transform: [{ rotate: dropdownOpen ? '180deg' : '0deg' }] }}
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* Dropdown Options Menu */}
                {dropdownOpen && item.resolutions.length > 1 ? (
                  <View style={styles.dropdownMenu}>
                    {item.resolutions.map((resOption, idx) => {
                      const isSelected = idx === selectedResIndex;
                      const optBadge = getQualityBadgeConfig(resOption.resolution);
                      return (
                        <TouchableOpacity
                          key={resOption.id || `opt-${idx}`}
                          style={[styles.dropdownOption, isSelected && styles.dropdownOptionActive]}
                          onPress={() => {
                            setSelectedResIndex(idx);
                            setDropdownOpen(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.dropdownOptionLeft}>
                            <View style={[styles.qualityPill, { backgroundColor: optBadge.bg, borderColor: optBadge.border }]}>
                              <Text style={[styles.qualityPillText, { color: optBadge.text }]}>
                                {resOption.resolution}
                              </Text>
                            </View>
                            {resOption.size ? (
                              <Text style={styles.dropdownOptionSize}>{resOption.size}</Text>
                            ) : null}
                            {resOption.audio ? (
                              <Text style={styles.dropdownOptionAudio} numberOfLines={1}>
                                {resOption.audio}
                              </Text>
                            ) : null}
                          </View>
                          {isSelected ? <Check color="#34C759" size={15} strokeWidth={2.5} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* 4 Action Buttons */}
            {selectedRes ? (
              <View style={styles.cardActionsWrapper}>
                {/* Line 1: Download .torrent & Open in Torrent App */}
                <View style={styles.actionLineRow}>
                  <TouchableOpacity
                    onPress={() => onMovieDownload(selectedRes, item)}
                    activeOpacity={0.75}
                    style={[styles.actionBtnWithText, styles.btnDownloadLight]}
                    accessibilityLabel="Download .torrent file"
                  >
                    <Download color="#059669" size={14} strokeWidth={2.4} />
                    <Text style={[styles.actionBtnText, { color: '#047857' }]}>Download .torrent</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onTorrentDownload(selectedRes, item)}
                    activeOpacity={0.75}
                    style={[styles.actionBtnWithText, styles.btnTorrentRedirectLight]}
                    accessibilityLabel="Redirect to Torrent App"
                  >
                    <ExternalLink color="#EA580C" size={14} strokeWidth={2.4} />
                    <Text style={[styles.actionBtnText, { color: '#C2410C' }]}>Torrent App</Text>
                  </TouchableOpacity>
                </View>

                {/* Line 2: Copy Magnet & Play Stream */}
                <View style={styles.actionLineRow}>
                  <TouchableOpacity
                    onPress={() => onCopy(selectedRes)}
                    activeOpacity={0.75}
                    style={[styles.actionBtnWithText, styles.btnCopyLight]}
                    accessibilityLabel="Copy Magnet Link"
                  >
                    <Copy color="#4F46E5" size={14} strokeWidth={2.4} />
                    <Text style={[styles.actionBtnText, { color: '#4338CA' }]}>Copy Magnet</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onStream(selectedRes, item)}
                    activeOpacity={0.75}
                    style={[styles.actionBtnWithText, styles.btnPlayLight]}
                    accessibilityLabel="Play Stream"
                  >
                    {isStreaming ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Play color={Colors.primary} size={13} fill={Colors.primary} strokeWidth={1} />
                    )}
                    <Text style={[styles.actionBtnText, { color: Colors.primary }]} numberOfLines={1}>
                      Play {selectedRes ? selectedRes.resolution : 'Stream'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>
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

  // Lazy Loading Infinite Scroll State
  const INITIAL_BATCH_SIZE = 12;
  const BATCH_LOAD_STEP = 10;
  const [displayedCount, setDisplayedCount] = useState(INITIAL_BATCH_SIZE);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const visibleResults = useMemo(() => {
    return results.slice(0, displayedCount);
  }, [results, displayedCount]);

  const handleLoadMore = useCallback(() => {
    if (displayedCount < results.length) {
      setDisplayedCount((prev) => Math.min(prev + BATCH_LOAD_STEP, results.length));
    }
  }, [displayedCount, results.length]);

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(offsetY > 350);
  }, []);

  const handleScrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // In-App Video Streaming Player State
  const [streamPlayerVisible, setStreamPlayerVisible] = useState(false);
  const [activeStreamItem, setActiveStreamItem] = useState<DownloadItem | null>(null);
  const [streamingResId, setStreamingResId] = useState<string | null>(null);
  const [streamModalVisible, setStreamModalVisible] = useState(false);
  const [streamModalData, setStreamModalData] = useState<StreamModalData | null>(null);

  // Hardware Back Button handler for Stream Options Modal
  useEffect(() => {
    if (!streamModalVisible) return;

    const onBackPress = () => {
      setStreamModalVisible(false);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [streamModalVisible]);

  // Configurable Mirror URL State
  const [currentBaseUrl, setCurrentBaseUrl] = useState(tamilMvService.getBaseUrl());
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(currentBaseUrl);

  // Scraper WebView State
  const [webViewSearchUrl, setWebViewSearchUrl] = useState('');
  const webViewRef = useRef<WebView>(null);
  const searchTimeoutRef = useRef<any>(null);
  const activeSearchTermRef = useRef(globalCachedFinderState.searchedQuery || 'Recent Upload');

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

  // Restore persisted state from storage on first mount or auto-fetch Recent Upload
  useEffect(() => {
    if (globalCachedFinderState.results.length > 0) {
      setQuery(globalCachedFinderState.query);
      setSearchedQuery(globalCachedFinderState.searchedQuery);
      setResults(globalCachedFinderState.results);
      setHasSearched(globalCachedFinderState.hasSearched);
      return;
    }

    if (FINDER_CACHE_FILE) {
      FileSystem.readAsStringAsync(FINDER_CACHE_FILE)
        .then((content) => {
          try {
            const parsed = JSON.parse(content);
            if (parsed && Array.isArray(parsed.results) && parsed.results.length > 0) {
              setQuery(parsed.query || '');
              setSearchedQuery(parsed.searchedQuery || '');
              setResults(parsed.results);
              setHasSearched(Boolean(parsed.hasSearched));
              setDisplayedCount(INITIAL_BATCH_SIZE);
              globalCachedFinderState = {
                query: parsed.query || '',
                searchedQuery: parsed.searchedQuery || '',
                results: parsed.results,
                hasSearched: Boolean(parsed.hasSearched),
              };
              return;
            }
          } catch {}
          handlePerformSearch('Recent Upload');
        })
        .catch(() => {
          handlePerformSearch('Recent Upload');
        });
    } else {
      handlePerformSearch('Recent Upload');
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
    setDisplayedCount(INITIAL_BATCH_SIZE);
    setIsRefreshing(false);
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

    activeSearchTermRef.current = term;
    setLoading(true);
    setHasSearched(true);
    setSearchedQuery(term);
    setResults([]);
    setDisplayedCount(INITIAL_BATCH_SIZE);

    const isRecent = /^recent/i.test(term);
    const ts = Date.now();
    const searchUrl = isRecent
      ? `${currentBaseUrl}/?_t=${ts}`
      : `${currentBaseUrl}/index.php?/search/&q=${encodeURIComponent(term)}&type=forums_topic&_t=${ts}`;

    setWebViewSearchUrl(searchUrl);

    // Timeout safety fallback
    searchTimeoutRef.current = setTimeout(() => {
      setLoading(false);
    }, 15000);

    // Try direct fetch first
    try {
      const data = isRecent
        ? await tamilMvService.searchMovie('Recent Upload', currentBaseUrl)
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

  const handlePullToRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await handlePerformSearch(searchedQuery || 'Recent Upload');
    setIsRefreshing(false);
  }, [searchedQuery]);

  const handleWebViewMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'SCRAPED_TOPICS' && Array.isArray(payload.items)) {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        const currentTerm = activeSearchTermRef.current;
        const filterTerm = /^recent/i.test(currentTerm) ? '' : currentTerm;
        const parsed = tamilMvService.parseRawTopicItems(payload.items, filterTerm);
        updateFinderState(parsed, currentTerm, true);
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
          const finalMagnet = magnet;
          // Always use /api/stream/play?magnet= so the backend gets the full magnet
          // (includes all embedded trackers for faster peer discovery)
          const streamUrl = `${backendUrl}/api/stream/play?magnet=${encodeURIComponent(finalMagnet)}`;

          // Directly launch internal player — no intermediate modal
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
            speed: 'VFlix Internal Stream',
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

  const handleLaunchInternalPlayer = useCallback((data: StreamModalData) => {
    setStreamModalVisible(false);
    const streamDownloadItem: DownloadItem = {
      id: `stream_${Date.now()}`,
      title: data.title,
      fileName: `${data.movie.movieTitle}_${data.resItem.resolution}.mp4`,
      fileUri: '',
      url: data.streamUrl,
      status: 'completed',
      progress: 1,
      totalBytes: 0,
      downloadedBytes: 0,
      speed: 'VFlix Internal Stream',
      isTorrent: false,
      createdAt: Date.now(),
    };

    setActiveStreamItem(streamDownloadItem);
    setStreamPlayerVisible(true);
  }, []);

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

  // Lazy Load Footer Component
  const renderListFooter = useCallback(() => {
    if (results.length === 0) return null;

    if (displayedCount < results.length) {
      return (
        <View style={styles.lazyLoadFooter}>
          <ActivityIndicator size="small" color={Colors.netflixRed} />
          <Text style={styles.lazyLoadText}>
            Loading more movies ({visibleResults.length} / {results.length})...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.endOfListFooter}>
        <View style={styles.endOfListDivider} />
        <Text style={styles.endOfListText}>All {results.length} movies loaded</Text>
        <View style={styles.endOfListDivider} />
      </View>
    );
  }, [displayedCount, results.length, visibleResults.length]);

  const INJECTED_SCRAPER_JS = `
    (function() {
      function sendResults() {
        try {
          var topicMap = {};
          var links = document.querySelectorAll('a[href*="topic/"]');
          for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var rawHref = a.href || '';
            var cleanUrl = rawHref.split('#')[0].replace(/&.*$/, '').replace(/\\/page\\/\\d+\\/?$/, '/');
            if (!cleanUrl || cleanUrl.indexOf('topic/') === -1 || cleanUrl.indexOf('/topic/183-0') !== -1) continue;
            
            var titleAttr = (a.getAttribute('title') || '').replace(/<[^>]*>/g, '').trim();
            var innerText = (a.innerText || a.textContent || '').replace(/<[^>]*>/g, '').trim();
            
            var candidates = [titleAttr, innerText];
            for (var c = 0; c < candidates.length; c++) {
              var text = candidates[c];
              if (!text || text.length < 3) continue;
              var lower = text.toLowerCase();
              if (/^\\d+$/.test(text) || lower === 'next' || lower === 'prev' || lower === 'last' || lower === 'page') continue;
              
              if (!topicMap[cleanUrl] || text.length > topicMap[cleanUrl].length) {
                topicMap[cleanUrl] = text;
              }
            }
            if (!topicMap[cleanUrl] && innerText && innerText.length >= 3) {
              topicMap[cleanUrl] = innerText;
            }
          }
          
          var items = [];
          for (var url in topicMap) {
            if (topicMap.hasOwnProperty(url)) {
              items.push({ topicUrl: url, rawTitle: topicMap[url] });
            }
          }
          
          if (items.length > 0 && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SCRAPED_TOPICS',
              items: items
            }));
          }
        } catch(e) {}
      }

      sendResults();
      if (document.readyState === 'complete') {
        setTimeout(sendResults, 300);
      } else {
        window.addEventListener('load', function() { setTimeout(sendResults, 400); });
      }
      setTimeout(sendResults, 1000);
      setTimeout(sendResults, 2000);
      setTimeout(sendResults, 3500);
      setTimeout(sendResults, 5000);
    })();
    true;
  `;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      {/* 1. Modern Header with Glowing Accent & Live Mirror Chip */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <LinearGradient
              colors={[Colors.primary, '#8A0E1C']}
              style={styles.headerLogoBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Film color="#FFFFFF" size={16} strokeWidth={2.5} />
            </LinearGradient>
            <View>
              <Text style={styles.screenTitle}>Movie Finder</Text>
              <Text style={styles.screenSubtitle}>Search & Stream HD Torrents</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.mirrorChip}
          onPress={() => setUrlModalVisible(true)}
          activeOpacity={0.75}
        >
          <View style={styles.livePulseDot} />
          <Text style={styles.mirrorChipText} numberOfLines={1}>
            {currentBaseUrl.replace(/^https?:\/\/(www\.)?/, '')}
          </Text>
          <ChevronDown color="#FFFFFF" size={13} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* 2. Modern Glassmorphic Search Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Search color={Colors.primary} size={16} strokeWidth={2.5} />
          <TextInput
            style={styles.input}
            placeholder="Search movie title (e.g. Leo, Amaran)..."
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handlePerformSearch()}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <X color="#FFFFFF" size={15} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => handlePerformSearch()}
          disabled={!query.trim() || loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={!query.trim() ? ['#221C1E', '#181416'] : [Colors.primary, '#B51527']}
            style={[styles.searchBtn, !query.trim() && styles.searchBtnDisabled]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.searchBtnText}>Search</Text>
            )}
          </LinearGradient>
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
                onPress={() => {
                  setQuery(item);
                  handlePerformSearch(item);
                }}
                activeOpacity={0.7}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={[Colors.primary, '#8A0E1C']}
                    style={styles.chipActiveGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {item === 'Recent Upload' ? (
                      <Sparkles color="#FFFFFF" size={11} strokeWidth={2.5} />
                    ) : null}
                    <Text style={styles.chipTextActive}>{item}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.chip}>
                    {item === 'Recent Upload' ? (
                      <Sparkles color={Colors.netflixRed} size={11} strokeWidth={2.5} />
                    ) : null}
                    <Text style={styles.chipText}>{item}</Text>
                  </View>
                )}
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
          <AlertCircle color="#FF453A" size={44} strokeWidth={2.2} />
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
        /* Results List with Lazy Loading & Pull-to-Refresh */
        <FlatList
          ref={flatListRef}
          data={visibleResults}
          keyExtractor={keyExtractor}
          renderItem={renderMovieCard}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={35}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handlePullToRefresh}
              tintColor={Colors.netflixRed}
              colors={[Colors.netflixRed]}
              progressBackgroundColor="#16171D"
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeaderBox}>
              <View style={styles.listHeaderMetaRow}>
                <View style={styles.metaCountBadge}>
                  <Text style={styles.resultsCount}>
                    {results.length} Movies Available
                  </Text>
                </View>
                <View style={styles.loadedBadge}>
                  <Text style={styles.loadedBadgeText}>
                    Showing {visibleResults.length} of {results.length}
                  </Text>
                </View>
              </View>
            </View>
          }
          ListFooterComponent={renderListFooter}
        />
      ) : (
        /* Clean Idle State */
        <View style={styles.stateCenter}>
          <Layers color="#FF3B30" size={48} strokeWidth={2} />
          <Text style={styles.idleTitle}>Quick Movie & Quality Finder</Text>
          <Text style={styles.idleSub}>
            Type any movie name or select a year chip to list all download and stream qualities.
          </Text>
        </View>
      )}

      {/* Floating Scroll to Top Button */}
      {showScrollTop ? (
        <TouchableOpacity
          style={[styles.scrollTopBtn, { bottom: insets.bottom + 20 }]}
          onPress={handleScrollToTop}
          activeOpacity={0.85}
          accessibilityLabel="Scroll to top"
        >
          <LinearGradient
            colors={[Colors.primary, '#8A0E1C']}
            style={styles.scrollTopGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <ArrowUp color="#FFFFFF" size={19} strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>
      ) : null}

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
                <X color="#FFFFFF" size={18} strokeWidth={2.5} />
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

      {/* 6. Refactored Play Stream Selection Modal with Internal Player Default */}
      <Modal
        visible={streamModalVisible && !!streamModalData}
        transparent
        animationType="slide"
        onRequestClose={() => setStreamModalVisible(false)}
      >
        <View style={styles.streamModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setStreamModalVisible(false)}
          />

          <View style={[styles.streamModalSheet, { paddingBottom: Math.max(insets.bottom + 16, 26) }]}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.streamModalHeader}>
              <View style={styles.streamBadgeRow}>
                <View style={styles.streamResBadge}>
                  <Text style={styles.streamResBadgeText}>
                    {streamModalData?.resItem.resolution || '1080p'}
                  </Text>
                </View>

                {streamModalData?.resItem.size ? (
                  <View style={styles.streamSizeBadge}>
                    <Text style={styles.streamSizeBadgeText}>
                      {streamModalData.resItem.size}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.streamEngineBadge}>
                  <View style={styles.streamEngineDot} />
                  <Text style={styles.streamEngineText}>VFlix Engine</Text>
                </View>
              </View>

              <Text style={styles.streamModalTitle} numberOfLines={2}>
                {streamModalData?.movie.movieTitle}
              </Text>
              <Text style={styles.streamModalSubtitle}>
                Selected Quality: {streamModalData?.resItem.resolution || '1080p'} {streamModalData?.resItem.size ? `• ${streamModalData.resItem.size}` : ''}
              </Text>
            </View>

            {/* Options List */}
            <View style={styles.streamOptionsList}>
              {/* Option 1: DEFAULT - Internal In-App Player */}
              <TouchableOpacity
                style={styles.defaultStreamBtn}
                activeOpacity={0.85}
                onPress={() => streamModalData && handleLaunchInternalPlayer(streamModalData)}
              >
                <LinearGradient
                  colors={[Colors.primary, '#B51527']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.defaultStreamGradient}
                >
                  <View style={styles.defaultStreamIconWrap}>
                    <Play color="#FFFFFF" size={22} fill="#FFFFFF" />
                  </View>
                  <View style={styles.defaultStreamTextWrap}>
                    <View style={styles.defaultTitleRow}>
                      <Text style={styles.defaultStreamTitle}>
                        Play in Internal Player ({streamModalData?.resItem.resolution || '1080p'})
                      </Text>
                      <View style={styles.defaultTagPill}>
                        <Text style={styles.defaultTagText}>DEFAULT</Text>
                      </View>
                    </View>
                    <Text style={styles.defaultStreamSub}>
                      Stream {streamModalData?.resItem.resolution} {streamModalData?.resItem.size ? `(${streamModalData.resItem.size})` : ''} • Gestures, audio & subtitles
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Option 2: External Player (VLC / MX) */}
              <TouchableOpacity
                style={styles.secondaryStreamBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (!streamModalData) return;
                  setStreamModalVisible(false);
                  const target = streamModalData.streamUrl || streamModalData.magnet;
                  Linking.openURL(`vlc://${target}`).catch(() => {
                    Linking.openURL(target).catch(() => {
                      Alert.alert(
                        'VLC Not Detected',
                        'VLC for Android is recommended for direct hardware accelerated torrent playback.'
                      );
                    });
                  });
                }}
              >
                <View style={[styles.secondaryIconCircle, { backgroundColor: 'rgba(255, 140, 0, 0.15)' }]}>
                  <Tv color="#FF9800" size={19} />
                </View>
                <View style={styles.secondaryTextWrap}>
                  <Text style={styles.secondaryTitle}>Play in VLC / MX Player</Text>
                  <Text style={styles.secondarySub}>
                    Hardware accelerated playback in external media player
                  </Text>
                </View>
                <ExternalLink color="#666" size={15} />
              </TouchableOpacity>

              {/* Option 3: Webtor Cloud in Browser */}
              <TouchableOpacity
                style={styles.secondaryStreamBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (!streamModalData) return;
                  setStreamModalVisible(false);
                  const webtorUrl = `https://webtor.io/show?magnet=${encodeURIComponent(streamModalData.magnet)}`;
                  Linking.openURL(webtorUrl).catch((err) => {
                    Alert.alert('Error', 'Could not open browser: ' + err.message);
                  });
                }}
              >
                <View style={[styles.secondaryIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Globe color="#3B82F6" size={19} />
                </View>
                <View style={styles.secondaryTextWrap}>
                  <Text style={styles.secondaryTitle}>Stream in Browser (Webtor Cloud)</Text>
                  <Text style={styles.secondarySub}>
                    No local backend needed • Cloud proxy playback
                  </Text>
                </View>
                <ExternalLink color="#666" size={15} />
              </TouchableOpacity>

              {/* Option 4: Share / Copy Stream URL */}
              <TouchableOpacity
                style={styles.secondaryStreamBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (!streamModalData) return;
                  Share.share({
                    message: streamModalData.streamUrl,
                    title: `Stream URL: ${streamModalData.title}`,
                  }).catch(() => {});
                }}
              >
                <View style={[styles.secondaryIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}>
                  <Copy color="#AEAEB2" size={17} />
                </View>
                <View style={styles.secondaryTextWrap}>
                  <Text style={styles.secondaryTitle}>Share / Copy Stream Link</Text>
                  <Text style={styles.secondarySub}>
                    Direct HTTP Range URL for VLC, Kodi, or download tools
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.streamCancelBtn}
              activeOpacity={0.7}
              onPress={() => setStreamModalVisible(false)}
            >
              <Text style={styles.streamCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    color: '#8E8E93',
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
  mirrorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#16171D',
    borderWidth: 1,
    borderColor: '#262835',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  mirrorChipText: {
    color: '#E5E5EA',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 120,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16171D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262835',
    paddingHorizontal: 12,
    height: 42,
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
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.45,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  suggestionsSection: {
    paddingVertical: 6,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 7,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#14151A',
    borderWidth: 1,
    borderColor: '#242633',
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 16,
  },
  chipActiveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    borderRadius: 16,
  },
  chipText: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  listHeaderBox: {
    marginBottom: 12,
    gap: 8,
  },
  listHeaderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaCountBadge: {
    backgroundColor: '#16171D',
    borderWidth: 1,
    borderColor: '#262835',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultsCount: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  loadedBadge: {
    backgroundColor: 'rgba(250, 36, 60, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.28)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  loadedBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  lazyLoadFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  lazyLoadText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  endOfListFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  endOfListDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#222430',
  },
  endOfListText: {
    color: '#636366',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  scrollTopBtn: {
    position: 'absolute',
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    zIndex: 99,
  },
  scrollTopGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#14151A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222430',
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  // ── Poster thumbnail (left column, fixed width) ──
  posterWrap: {
    width: 86,
    minHeight: 150,
    backgroundColor: '#1C1C1E',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  },
  posterImage: {
    ...StyleSheet.absoluteFillObject,
  },
  posterShimmer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterLangBadge: {
    position: 'absolute',
    bottom: 6,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  posterLangText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // ── Right content column ──
  cardContent: {
    flex: 1,
    minWidth: 0,
    minHeight: 150,
    borderLeftWidth: 1,
    borderLeftColor: '#222430',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    paddingBottom: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1C24',
  },
  filmAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleGroup: {
    flex: 1,
    gap: 5,
  },
  movieTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  yearChip: {
    backgroundColor: '#1E202A',
    borderWidth: 1,
    borderColor: '#2B2E3C',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  yearChipText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '700',
  },
  langChip: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  langText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  selectedQualityHeaderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  selectedQualityHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  resCountChip: {
    backgroundColor: '#1A1C23',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  qualityCount: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '600',
  },
  openTopicBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#191B22',
    borderWidth: 1,
    borderColor: '#262938',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dropdownTriggerOpen: {
    borderColor: '#3B82F6',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  qualityPill: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  qualityPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  dropdownSpecs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropdownSizeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  dropdownAudioText: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '500',
    maxWidth: 110,
  },
  dropdownTriggerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dropdownActionText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  dropdownMenu: {
    backgroundColor: '#16171E',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#262938',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 0.5,
    borderBottomColor: '#20222D',
  },
  dropdownOptionActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  dropdownOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dropdownOptionSize: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dropdownOptionAudio: {
    color: '#8E8E93',
    fontSize: 10,
    maxWidth: 120,
  },
  cardActionsWrapper: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 7,
  },
  actionLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnWithText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 35,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  // 1. Download .torrent file: Clean Mint / Emerald Light Theme
  btnDownloadLight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  // 2. Redirect to torrent app: Warm Amber / Orange Light Theme
  btnTorrentRedirectLight: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  // 3. Copy Magnet / Link: Soft Indigo / Violet Light Theme
  btnCopyLight: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  // 4. Play Stream: Soft Rose / Crimson Light Theme
  btnPlayLight: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
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
    width: 360,
    height: 640,
    opacity: 0.01,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3C',
    alignSelf: 'center',
    marginBottom: 14,
  },
  streamModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  streamModalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#24262E',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  streamModalHeader: {
    marginBottom: 16,
  },
  streamBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  streamResBadge: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  streamResBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  streamSizeBadge: {
    backgroundColor: '#24262E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  streamSizeBadgeText: {
    color: '#E0E0E0',
    fontSize: 11,
    fontWeight: '600',
  },
  streamEngineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(70, 211, 105, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  streamEngineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#46D369',
  },
  streamEngineText: {
    color: '#46D369',
    fontSize: 10,
    fontWeight: '700',
  },
  streamModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  streamModalSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 4,
  },
  streamOptionsList: {
    gap: 10,
    marginBottom: 14,
  },
  defaultStreamBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  defaultStreamGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  defaultStreamIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultStreamTextWrap: {
    flex: 1,
  },
  defaultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  defaultStreamTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  defaultTagPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  defaultTagText: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  defaultStreamSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  secondaryStreamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#2A2C34',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  secondaryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryTextWrap: {
    flex: 1,
  },
  secondaryTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondarySub: {
    color: '#8E8E93',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 13,
  },
  streamCancelBtn: {
    backgroundColor: '#202127',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamCancelBtnText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '700',
  },
});
