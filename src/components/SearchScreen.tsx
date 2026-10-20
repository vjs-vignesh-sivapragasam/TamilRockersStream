/**
 * SearchScreen — Unified Movie Finder & Web Browser
 * Features:
 * - 🎬 Instant Movie Search with TMDB ratings & release years
 * - 🌐 Integrated Web Browser with Ad Shield & Torrent/Magnet Sniffer
 * - ⚡ Smart URL Detection & Quick Web Launch
 * - 🔥 Trending Searches & Popular Web Shortcuts
 * - 🛡️ Built-in AdBlock & Pop-up Protection
 */

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
  Image,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import {
  Search,
  X,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Globe,
  Film,
  Star,
  Sparkles,
  Flame,
  Check,
  Compass,
  ExternalLink,
  Shield,
  ShieldCheck,
  Share2,
  SlidersHorizontal,
  Download,
  AlertCircle,
  Play,
} from 'lucide-react-native';
import { Colors, getTheme } from '../constants/theme';
import {
  tamilMvService,
  TamilMvMovieResult,
  MovieResolutionItem,
  POPULAR_MIRRORS,
  posterCache,
} from '../services/tamilMvService';
import { useDownloads } from '../context/DownloadContext';
import { myListService } from '../services/myListService';
import { MovieDetailSheet, sanitizeMovieTitle } from './HomeScreen';
import { useMovieMetadata } from '../services/movieDatabaseService';
import { INJECTED_AD_SHIELD_SCRIPT, isAdOrVulnerableUrl } from '../utils/adBlocker';
import { isTorrentUrl, extractInfoHashFromUrl } from '../utils/bencode';
import { BrowserToolbar } from './browser/BrowserToolbar';
import {
  FEED_CATEGORIES,
  FeedCategoryKey,
  xmlFeedService,
} from '../services/xmlFeedService';
import { OfflinePlayerModal } from './OfflinePlayerModal';
import { DownloadItem } from '../types/downloads';

export interface SearchScreenProps {
  onNavigateToTab?: (tab: any) => void;
  onOpenInBrowserTab?: (url: string) => void;
  pendingBrowserUrl?: string | null;
  onClearPendingUrl?: () => void;
  initialQuery?: string;
}

const INITIAL_BATCH_SIZE = 16;
const DEFAULT_BROWSER_HOME = 'https://www.google.co.in';

const INJECTED_TORRENT_INTERCEPTOR = `
  (function() {
    document.addEventListener('click', function(e) {
      var el = e.target;
      while (el && el.tagName !== 'A') {
        el = el.parentElement;
      }
      if (el && el.href) {
        var href = el.href;
        var lower = href.toLowerCase();
        if (lower.indexOf('.torrent') !== -1 || lower.indexOf('magnet:') === 0 || lower.indexOf('/api/stream/') !== -1) {
          e.preventDefault();
          e.stopPropagation();
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'TORRENT_DOWNLOAD',
              url: href,
              title: el.getAttribute('download') || el.innerText || el.title || ''
            }));
          }
          return false;
        }
      }
    }, true);
  })();
`;

/* ─────────────────────────── Search Card Item ─────────────────────────── */
interface SearchResultCardProps {
  item: TamilMvMovieResult;
  isSaved?: boolean;
  onToggleSave?: (posterUrl: string | null) => void;
  enqueuePosterFetch: (topicUrl: string, cb: (url: string | null) => void) => void;
  onPress: () => void;
}

const SearchResultCard = React.memo<SearchResultCardProps>(({
  item,
  enqueuePosterFetch,
  onPress,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((screenWidth - 36) / 2);
  const posterHeight = Math.round(cardWidth * 1.48);

  const topicUrl = item.topicUrl || item.resolutions?.[0]?.topicUrl || '';
  const [posterUrl, setPosterUrl] = useState<string | null>(() => {
    if (item.posterUrl) return item.posterUrl;
    if (!topicUrl) return null;
    const cached = posterCache.get(topicUrl);
    return cached !== undefined ? cached : null;
  });
  const [posterLoading, setPosterLoading] = useState(() => Boolean(!item.posterUrl && topicUrl && !posterCache.has(topicUrl)));

  useEffect(() => {
    if (!topicUrl) return;
    if (posterCache.has(topicUrl)) {
      setPosterUrl(posterCache.get(topicUrl) ?? null);
      setPosterLoading(false);
      return;
    }
    setPosterLoading(true);
    enqueuePosterFetch(topicUrl, (url) => {
      setPosterUrl(url);
      setPosterLoading(false);
    });
  }, [topicUrl, enqueuePosterFetch]);

  const cleanMovieName = useMemo(() => {
    return sanitizeMovieTitle(item.movieTitle) || 'Tamil Movie';
  }, [item.movieTitle]);

  // Fetch TMDB metadata (Rating, Year, HD Poster)
  const { themeKey } = useDownloads();
  const theme = getTheme(themeKey);
  const { metadata } = useMovieMetadata(cleanMovieName, item.year);
  const displayRating = metadata?.rating || item.rating || 0;
  const displayYear = metadata?.year || item.year || '';
  const effectivePoster = metadata?.posterUrl || posterUrl;

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={[styles.posterWrapper, { width: cardWidth, height: posterHeight }]}>
        {effectivePoster ? (
          <Image
            source={{ uri: effectivePoster }}
            style={styles.posterImage}
            resizeMode="cover"
            onError={() => setPosterUrl(null)}
          />
        ) : posterLoading ? (
          <LinearGradient
            colors={['#181920', '#252834', '#181920']}
            style={[StyleSheet.absoluteFill, styles.shimmerCenter]}
          >
            <Film color="#3A3E4E" size={30} strokeWidth={1.5} />
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={[theme.primary, theme.dark]}
            style={[StyleSheet.absoluteFill, styles.shimmerCenter]}
          >
            <Film color="rgba(255,255,255,0.4)" size={30} strokeWidth={1.5} />
          </LinearGradient>
        )}

        {/* Floating TMDB Rating Badge */}
        {displayRating > 0 ? (
          <View style={styles.floatingRatingBadge}>
            <Star size={10} color="#FFD700" fill="#FFD700" />
            <Text style={styles.floatingRatingText}>{displayRating.toFixed(1)}</Text>
          </View>
        ) : null}

        {/* Floating Release Year Badge */}
        {displayYear ? (
          <View style={styles.floatingYearBadge}>
            <Text style={styles.floatingYearText}>{displayYear}</Text>
          </View>
        ) : null}
      </View>

      {/* Title & Metadata */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {cleanMovieName}
        </Text>
        <View style={styles.cardMetaRow}>
          {displayRating > 0 ? (
            <View style={styles.inlineRatingRow}>
              <Star size={10} color="#FFD700" fill="#FFD700" />
              <Text style={styles.inlineRatingText}>{displayRating.toFixed(1)}</Text>
            </View>
          ) : null}
          {displayYear ? <Text style={styles.metaSubText}>{displayYear}</Text> : null}
          <Text style={styles.metaSubText}>
            {item.language ? item.language.toUpperCase() : 'TAMIL'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

/* ─────────────────────────── SearchScreen Component ─────────────────────────── */
export const SearchScreen: React.FC<SearchScreenProps> = ({
  onNavigateToTab,
  pendingBrowserUrl,
  onClearPendingUrl,
  initialQuery = '',
}) => {
  const insets = useSafeAreaInsets();
  const { startDownload, themeKey, backendUrl } = useDownloads();
  const theme = getTheme(themeKey);

  // Mode: 'movies' for native Movie Finder / 'browser' for Web Browser
  const [activeMode, setActiveMode] = useState<'movies' | 'browser'>('movies');

  // Movie Search State
  const [query, setQuery] = useState(initialQuery);
  const [searchedQuery, setSearchedQuery] = useState(initialQuery);
  const [results, setResults] = useState<TamilMvMovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));

  // XML Feed Categories State
  const [selectedCategory, setSelectedCategory] = useState<FeedCategoryKey>('tamil');
  const [categoryMovies, setCategoryMovies] = useState<TamilMvMovieResult[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedRefreshing, setFeedRefreshing] = useState(false);

  // Movie Detail Modal
  const [detailMovie, setDetailMovie] = useState<TamilMvMovieResult | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [streamingResId, setStreamingResId] = useState<string | null>(null);

  // Stream Options Modal
  const [streamModalVisible, setStreamModalVisible] = useState(false);
  const [streamModalData, setStreamModalData] = useState<{
    magnet: string;
    movie: TamilMvMovieResult;
    resItem: MovieResolutionItem;
  } | null>(null);

  // In-App Player Modal
  const [streamPlayerVisible, setStreamPlayerVisible] = useState(false);
  const [activeStreamItem, setActiveStreamItem] = useState<DownloadItem | null>(null);
  const [streamPlayerInitialPos, setStreamPlayerInitialPos] = useState(0);
  const [streamPlayerPosterUrl, setStreamPlayerPosterUrl] = useState<string | undefined>(undefined);

  // Base Mirror URL State
  const [currentBaseUrl, setCurrentBaseUrl] = useState(tamilMvService.getBaseUrl());
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(currentBaseUrl);

  // Web Browser State
  const [browserUrl, setBrowserUrl] = useState(DEFAULT_BROWSER_HOME);
  const [browserInput, setBrowserInput] = useState(DEFAULT_BROWSER_HOME);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserProgress, setBrowserProgress] = useState(0);
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [blockedCount, setBlockedCount] = useState(0);
  const browserWebViewRef = useRef<WebView>(null);

  // Hidden scraper WebView
  const [webViewSearchUrl, setWebViewSearchUrl] = useState('');
  const scraperWebViewRef = useRef<WebView>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Poster Queue
  const [posterWebViewUrl, setPosterWebViewUrl] = useState('');
  const posterQueueRef = useRef<string[]>([]);
  const posterProcessingRef = useRef(false);
  const posterTimeoutRef = useRef<any>(null);
  const activeFetchesRef = useRef<Set<string>>(new Set());
  const posterCallbacksRef = useRef<Map<string, (url: string | null) => void>>(new Map());

  // Listen for incoming pending browser URLs (e.g. from Home Screen or Movie Detail sheet)
  useEffect(() => {
    if (pendingBrowserUrl) {
      setBrowserUrl(pendingBrowserUrl);
      setBrowserInput(pendingBrowserUrl);
      setActiveMode('browser');
      onClearPendingUrl?.();
    }
  }, [pendingBrowserUrl, onClearPendingUrl]);

  // Keep currentBaseUrl in sync whenever mirror changes globally
  useEffect(() => {
    const unsub = tamilMvService.subscribe((newUrl) => {
      setCurrentBaseUrl(newUrl);
      setCustomUrlInput(newUrl);
    });
    return unsub;
  }, []);

  // Check if current search query looks like a web address or magnet URL
  const isQueryUrl = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return (
      q.startsWith('http://') ||
      q.startsWith('https://') ||
      q.startsWith('magnet:') ||
      (/\.[a-z]{2,}(\/.*)?$/i.test(q) && !q.includes(' ')) ||
      q.includes('1tamilmv') ||
      q.includes('tamilblasters') ||
      q.includes('torrentgalaxy')
    );
  }, [query]);

  // Poster queue processor
  const processPosterQueue = useCallback(() => {
    if (posterProcessingRef.current) return;
    if (posterQueueRef.current.length === 0) {
      setPosterWebViewUrl('');
      return;
    }
    const nextUrl = posterQueueRef.current[0];
    posterProcessingRef.current = true;
    setPosterWebViewUrl(nextUrl);

    if (posterTimeoutRef.current) clearTimeout(posterTimeoutRef.current);
    posterTimeoutRef.current = setTimeout(() => {
      posterProcessingRef.current = false;
      const timedOutUrl = posterQueueRef.current.shift();
      if (timedOutUrl) {
        posterCache.set(timedOutUrl, null);
        const cb = posterCallbacksRef.current.get(timedOutUrl);
        if (cb) {
          cb(null);
          posterCallbacksRef.current.delete(timedOutUrl);
        }
      }
      if (posterQueueRef.current.length > 0) {
        posterProcessingRef.current = true;
        setPosterWebViewUrl(posterQueueRef.current[0]);
      } else {
        setPosterWebViewUrl('');
      }
    }, 7000);
  }, []);

  const enqueuePosterFetch = useCallback(
    (topicUrl: string, callback: (url: string | null) => void) => {
      if (!topicUrl) {
        callback(null);
        return;
      }
      if (posterCache.has(topicUrl)) {
        callback(posterCache.get(topicUrl) ?? null);
        return;
      }

      const existing = posterCallbacksRef.current.get(topicUrl);
      posterCallbacksRef.current.set(topicUrl, (url) => {
        if (existing) existing(url);
        callback(url);
      });

      if (activeFetchesRef.current.has(topicUrl)) return;
      activeFetchesRef.current.add(topicUrl);

      tamilMvService
        .extractPosterFromTopic(topicUrl)
        .then((pUrl) => {
          activeFetchesRef.current.delete(topicUrl);
          if (pUrl) {
            posterCache.set(topicUrl, pUrl);
            const cb = posterCallbacksRef.current.get(topicUrl);
            if (cb) {
              cb(pUrl);
              posterCallbacksRef.current.delete(topicUrl);
            }
          } else {
            if (!posterQueueRef.current.includes(topicUrl)) {
              posterQueueRef.current.push(topicUrl);
              processPosterQueue();
            }
          }
        })
        .catch(() => {
          activeFetchesRef.current.delete(topicUrl);
          if (!posterQueueRef.current.includes(topicUrl)) {
            posterQueueRef.current.push(topicUrl);
            processPosterQueue();
          }
        });
    },
    [processPosterQueue]
  );

  // Search logic
  const handlePerformSearch = useCallback(
    async (searchTerm?: string) => {
      const term = (searchTerm ?? query).trim();
      if (!term) return;

      // If the user typed a URL, route directly into browser
      if (
        term.startsWith('http://') ||
        term.startsWith('https://') ||
        term.startsWith('magnet:') ||
        (/\.[a-z]{2,}(\/.*)?$/i.test(term) && !term.includes(' '))
      ) {
        handleOpenUrlInBrowser(term);
        return;
      }

      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      setLoading(true);
      setHasSearched(true);
      setSearchedQuery(term);
      setResults([]);

      const ts = Date.now();
      const searchUrl = `${currentBaseUrl}/index.php?/search/&q=${encodeURIComponent(term)}&type=forums_topic&_t=${ts}`;
      setWebViewSearchUrl(searchUrl);

      searchTimeoutRef.current = setTimeout(() => {
        setLoading(false);
      }, 14000);

      try {
        const data = await tamilMvService.searchMovie(term, currentBaseUrl);
        if (data && data.length > 0) {
          if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
          const sanitized = data.map((r) => ({
            ...r,
            movieTitle: sanitizeMovieTitle(r.movieTitle),
          }));
          setResults(sanitized);
          setLoading(false);
          return;
        }
      } catch (err) {
        // Scraper will resolve
      }
    },
    [query, currentBaseUrl]
  );

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setSearchedQuery('');
    setHasSearched(false);
    setResults([]);
  }, []);

  // Web Browser navigation helper
  const handleOpenUrlInBrowser = (targetUrl: string) => {
    let clean = targetUrl.trim();
    if (!clean) return;

    if (!clean.startsWith('http://') && !clean.startsWith('https://') && !clean.startsWith('magnet:')) {
      if (clean.includes('.') && !clean.includes(' ')) {
        clean = 'https://' + clean;
      } else {
        clean = `https://www.google.com/search?q=${encodeURIComponent(clean)}`;
      }
    }

    setBrowserUrl(clean);
    setBrowserInput(clean);
    setActiveMode('browser');
  };

  // Browser download interceptor
  const handleDownloadTorrent = async (url: string, title?: string) => {
    try {
      const name = title || 'Torrent Media';
      await startDownload(url, name);
      Alert.alert('Download Started', `"${name}" added to Downloads!`, [
        { text: 'View Downloads', onPress: () => onNavigateToTab?.('downloads') },
        { text: 'OK' },
      ]);
    } catch (err: any) {
      Alert.alert('Download Error', err?.message || 'Could not start download');
    }
  };

  // Browser request filter
  const shouldStartLoadWithRequest = (request: any): boolean => {
    const reqUrl = (request.url || '').toLowerCase();
    if (isTorrentUrl(reqUrl) || reqUrl.startsWith('magnet:') || reqUrl.includes('/api/stream/')) {
      handleDownloadTorrent(request.url, request.title);
      return false;
    }

    if (adBlockEnabled) {
      const check = isAdOrVulnerableUrl(reqUrl);
      if (check.isBlocked) {
        setBlockedCount((c) => c + 1);
        return false;
      }
    }
    return true;
  };

  const handleShareBrowserUrl = async () => {
    if (browserUrl) {
      try {
        await Share.share({ url: browserUrl, message: browserUrl });
      } catch {}
    }
  };

  // Category Feed Loader
  const loadCategoryFeed = useCallback(async (catKey: FeedCategoryKey, isRefresh = false) => {
    if (isRefresh) {
      setFeedRefreshing(true);
    } else {
      setFeedLoading(true);
    }

    try {
      const data = await xmlFeedService.fetchCategory(catKey, isRefresh);
      setCategoryMovies(data);
    } catch (err: any) {
      console.warn('[SearchScreen] Error loading category feed:', err?.message || err);
    } finally {
      setFeedLoading(false);
      setFeedRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCategoryFeed(selectedCategory);
  }, [selectedCategory, loadCategoryFeed]);

  const handleSelectCategory = (catKey: FeedCategoryKey) => {
    setSelectedCategory(catKey);
    if (hasSearched) {
      setHasSearched(false);
      setQuery('');
      setSearchedQuery('');
      setResults([]);
    }
  };

  const currentCategoryConfig = useMemo(() => {
    return FEED_CATEGORIES.find((c) => c.key === selectedCategory) || FEED_CATEGORIES[0];
  }, [selectedCategory]);

  // Live-filter category movies if user typed in the box without submitting search
  const displayedCategoryMovies = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categoryMovies;
    return categoryMovies.filter(
      (m) => m.movieTitle.toLowerCase().includes(q) || (m.year && m.year.includes(q))
    );
  }, [categoryMovies, query]);

  const handleMoviePress = (movie: TamilMvMovieResult) => {
    setDetailMovie(movie);
    setDetailVisible(true);
  };

  const handleStreamResolution = (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
    setDetailVisible(false);
    const magnet = resItem.magnetUrl;
    if (!magnet) {
      Alert.alert('Notice', 'No magnet link available for this resolution.');
      return;
    }
    setStreamModalData({ magnet, movie, resItem });
    setStreamModalVisible(true);
  };

  const handleLaunchInternalPlayer = (data: {
    magnet: string;
    movie: TamilMvMovieResult;
    resItem: MovieResolutionItem;
  }) => {
    setStreamModalVisible(false);
    const cleanBackend = (backendUrl || 'https://vflix-backend.onrender.com').trim().replace(/\/+$/, '');
    const streamUrl = `${cleanBackend}/api/stream/${encodeURIComponent(data.magnet)}`;
    const title = `${data.movie.movieTitle} (${data.resItem.resolution})`;
    const activeItem: DownloadItem = {
      id: `stream_${Date.now()}`,
      title,
      fileName: `${data.movie.movieTitle}_${data.resItem.resolution}.mp4`,
      url: streamUrl,
      fileUri: streamUrl,
      status: 'completed',
      progress: 1,
      downloadedBytes: 0,
      totalBytes: 0,
      speed: 'VFlix Internal Stream',
      isTorrent: false,
      poster: data.movie.posterUrl || undefined,
      createdAt: Date.now(),
    };
    setActiveStreamItem(activeItem);
    setStreamPlayerInitialPos(0);
    setStreamPlayerPosterUrl(data.movie.posterUrl);
    setStreamPlayerVisible(true);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ──────────────────────── SEARCH OR BROWSER ──────────────────────── */}
      {activeMode === 'movies' ? (
        <View style={styles.flex1}>
          {/* Main Search Input Capsule */}
          <View style={styles.searchBarWrapper}>
            <View style={styles.searchBarCapsule}>
              <Search color={theme.primary} size={18} style={{ marginLeft: 4 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search movies, torrents, or enter web URL..."
                placeholderTextColor="#787B8E"
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => handlePerformSearch()}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 ? (
                <TouchableOpacity onPress={handleClearSearch} style={styles.iconBtn}>
                  <X color="#8A8D9B" size={16} />
                </TouchableOpacity>
              ) : null}

              {/* Quick Jump to Browser with current query */}
              <TouchableOpacity
                onPress={() => handleOpenUrlInBrowser(query || DEFAULT_BROWSER_HOME)}
                style={[styles.browserShortcutPill, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder }]}
                activeOpacity={0.7}
              >
                <Globe color={theme.primary} size={14} />
                <Text style={[styles.browserShortcutText, { color: theme.primary }]}>Web</Text>
              </TouchableOpacity>
            </View>

            {/* Smart URL Detection Banner */}
            {isQueryUrl ? (
              <TouchableOpacity
                style={styles.urlDetectedBanner}
                onPress={() => handleOpenUrlInBrowser(query)}
                activeOpacity={0.85}
              >
                <Globe color="#30D158" size={14} />
                <Text style={styles.urlDetectedText} numberOfLines={1}>
                  Open <Text style={{ color: '#FFF', fontWeight: '700' }}>{query}</Text> in Web Browser ➜
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* XML Feed Category Filters (Tamil Movies, Hollywood, HDTV, Web Series, 4K Movies) */}
          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {FEED_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key && !hasSearched;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.filterChip,
                      isActive && [styles.filterChipActive, { backgroundColor: theme.primary, borderColor: theme.primary }],
                    ]}
                    onPress={() => handleSelectCategory(cat.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Results Grid or Category Feed Grid */}
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.stateTitle}>Searching 1TamilMV & TMDB...</Text>
              <Text style={styles.stateSubtitle}>Finding verified releases and metadata</Text>
            </View>
          ) : hasSearched && results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item, index) => item.id || `search-${index}`}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContainer}
              renderItem={({ item }) => (
                <SearchResultCard
                  item={item}
                  enqueuePosterFetch={enqueuePosterFetch}
                  onPress={() => handleMoviePress(item)}
                />
              )}
            />
          ) : hasSearched && results.length === 0 ? (
            <View style={styles.centerState}>
              <AlertCircle color="#8A8D9B" size={44} />
              <Text style={styles.stateTitle}>No releases found</Text>
              <Text style={styles.stateSubtitle}>We couldn't find torrents for "{searchedQuery}"</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={styles.backToFeedBtn}
                  onPress={handleClearSearch}
                  activeOpacity={0.8}
                >
                  <Text style={styles.backToFeedText}>Back to Feeds</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.searchWebFallbackBtn, { backgroundColor: theme.primary }]}
                  onPress={() =>
                    handleOpenUrlInBrowser(
                      `https://www.google.com/search?q=${encodeURIComponent(searchedQuery + ' movie download')}`
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Globe color="#FFF" size={15} />
                  <Text style={styles.searchWebFallbackText}>Search Web</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : feedLoading && categoryMovies.length === 0 ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.stateTitle}>Loading {currentCategoryConfig.label}...</Text>
              <Text style={styles.stateSubtitle}>Fetching latest releases, posters & magnets</Text>
            </View>
          ) : (
            <View style={styles.flex1}>
              {/* Category Header Row */}
              <View style={styles.feedHeaderRow}>
                <View style={styles.feedHeaderLeft}>
                  <Text style={styles.feedHeaderTitle}>
                    {currentCategoryConfig.label}
                  </Text>
                  <View style={styles.feedCountBadge}>
                    <Text style={styles.feedCountText}>
                      {displayedCategoryMovies.length} releases
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() => loadCategoryFeed(selectedCategory, true)}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={13} color="#8A8D9B" />
                  <Text style={styles.refreshBtnText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={displayedCategoryMovies}
                keyExtractor={(item, index) => item.id || `feed-${selectedCategory}-${index}`}
                numColumns={2}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={styles.gridContainer}
                refreshControl={
                  <RefreshControl
                    refreshing={feedRefreshing}
                    onRefresh={() => loadCategoryFeed(selectedCategory, true)}
                    tintColor={theme.primary}
                    colors={[theme.primary]}
                  />
                }
                renderItem={({ item }) => (
                  <SearchResultCard
                    item={item}
                    enqueuePosterFetch={enqueuePosterFetch}
                    onPress={() => handleMoviePress(item)}
                  />
                )}
                ListEmptyComponent={
                  <View style={styles.centerState}>
                    <Film color="#8A8D9B" size={40} />
                    <Text style={styles.stateTitle}>No movies found</Text>
                    <Text style={styles.stateSubtitle}>Try refreshing or check another category</Text>
                    <TouchableOpacity
                      style={[styles.backToFeedBtn, { marginTop: 14 }]}
                      onPress={() => loadCategoryFeed(selectedCategory, true)}
                    >
                      <Text style={styles.backToFeedText}>Reload Feed</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            </View>
          )}
        </View>
      ) : (
        /* ──────────────────────── WEB BROWSER VIEW ──────────────────────── */
        <View style={styles.flex1}>
          {/* Browser Address Bar */}
          <View style={styles.browserAddressBar}>
            {/* Back to Search Button */}
            <TouchableOpacity
              style={[styles.exitBrowserBtn, { backgroundColor: theme.primary }]}
              onPress={() => setActiveMode('movies')}
              activeOpacity={0.8}
            >
              <ArrowLeft color="#FFF" size={15} />
              <Text style={styles.exitBrowserText}>Search</Text>
            </TouchableOpacity>

            <View style={styles.browserInputCapsule}>
              <Globe color="#8A8D9B" size={16} />
              <TextInput
                style={styles.browserTextInput}
                value={browserInput}
                onChangeText={setBrowserInput}
                onSubmitEditing={() => handleOpenUrlInBrowser(browserInput)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                selectTextOnFocus
              />
              {browserLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <TouchableOpacity onPress={() => browserWebViewRef.current?.reload()} style={styles.iconBtn}>
                  <RotateCcw color="#8A8D9B" size={14} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Browser Status Sub-bar */}
          <View style={styles.browserSubBar}>
            <View style={styles.shieldPill}>
              <ShieldCheck color="#30D158" size={12} />
              <Text style={styles.shieldText}>Ad-Shield Active {blockedCount > 0 ? `(${blockedCount} blocked)` : ''}</Text>
            </View>
            <TouchableOpacity onPress={handleShareBrowserUrl} style={styles.browserSubBtn}>
              <Share2 color="#8A8D9B" size={14} />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          {browserLoading ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(browserProgress * 100, 15)}%`, backgroundColor: theme.primary }]} />
            </View>
          ) : null}

          {/* Full Integrated WebView */}
          <WebView
            ref={browserWebViewRef}
            source={{ uri: browserUrl }}
            style={styles.flex1}
            injectedJavaScript={`${INJECTED_TORRENT_INTERCEPTOR}\n${adBlockEnabled ? INJECTED_AD_SHIELD_SCRIPT : ''}`}
            onNavigationStateChange={(nav) => {
              setCanGoBack(nav.canGoBack);
              setCanGoForward(nav.canGoForward);
              setBrowserLoading(nav.loading);
              if (nav.url) setBrowserInput(nav.url);
            }}
            onLoadProgress={({ nativeEvent }) => setBrowserProgress(nativeEvent.progress)}
            onShouldStartLoadWithRequest={shouldStartLoadWithRequest}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'TORRENT_DOWNLOAD' && msg.url) {
                  handleDownloadTorrent(msg.url, msg.title);
                }
              } catch {}
            }}
            allowsBackForwardNavigationGestures
            javaScriptEnabled
            domStorageEnabled
          />

          {/* Browser Bottom Toolbar */}
          <BrowserToolbar
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onGoBack={() => browserWebViewRef.current?.goBack()}
            onGoForward={() => browserWebViewRef.current?.goForward()}
          />
        </View>
      )}

      {/* Hidden 1TamilMV Scraper WebView */}
      {webViewSearchUrl ? (
        <View style={styles.hiddenScraper}>
          <WebView
            ref={scraperWebViewRef}
            source={{ uri: webViewSearchUrl }}
            onMessage={(e) => {
              try {
                const data = JSON.parse(e.nativeEvent.data);
                if (data && data.length > 0) {
                  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                  setResults(data);
                  setLoading(false);
                  setWebViewSearchUrl('');
                }
              } catch {}
            }}
          />
        </View>
      ) : null}

      {/* Movie Detail Bottom Sheet */}
      {detailVisible && detailMovie && (
        <MovieDetailSheet
          visible={detailVisible}
          movie={detailMovie}
          streamingResId={streamingResId}
          onClose={() => setDetailVisible(false)}
          enqueuePosterFetch={enqueuePosterFetch}
          onMovieDownload={(res, movie) => {
            if (res.magnetUrl) {
              startDownload(res.magnetUrl, res.rawTitle || movie.movieTitle, movie.posterUrl);
              Alert.alert('Download Started', `"${res.rawTitle || movie.movieTitle}" added to Downloads!`);
            }
          }}
          onTorrentDownload={(res, movie) => {
            if (res.torrentFileUrl) {
              startDownload(res.torrentFileUrl, res.rawTitle || movie.movieTitle, movie.posterUrl);
              Alert.alert('Download Started', 'Torrent file added to Downloads!');
            }
          }}
          onStream={(res, movie) => {
            handleStreamResolution(res, movie);
          }}
          onCopy={(res) => {
            if (res.magnetUrl) {
              Clipboard.setStringAsync(res.magnetUrl);
              Alert.alert('Copied', 'Magnet URL copied to clipboard!');
            }
          }}
          onOpenExternal={(res) => {
            if (res.magnetUrl) Linking.openURL(res.magnetUrl).catch(() => {});
          }}
        />
      )}

      {/* Stream Options Modal */}
      <Modal
        visible={streamModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStreamModalVisible(false)}
      >
        <View style={styles.streamModalOverlay}>
          <View style={styles.streamModalCard}>
            <View style={styles.streamModalHeader}>
              <View style={[styles.streamEnginePill, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder }]}>
                <View style={[styles.streamEngineDot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.streamEngineText, { color: theme.primary }]}>VFlix Stream Engine</Text>
              </View>
              <Text style={styles.streamModalTitle} numberOfLines={2}>
                {streamModalData?.movie.movieTitle}
              </Text>
              <Text style={styles.streamModalSubtitle}>
                Quality: {streamModalData?.resItem.resolution || '1080p'} {streamModalData?.resItem.size ? `• ${streamModalData.resItem.size}` : ''}
              </Text>
            </View>

            <View style={styles.streamOptionsList}>
              {/* Option 1: Play in Internal Player */}
              <TouchableOpacity
                style={styles.defaultStreamBtn}
                activeOpacity={0.85}
                onPress={() => streamModalData && handleLaunchInternalPlayer(streamModalData)}
              >
                <LinearGradient
                  colors={[theme.primary, theme.dark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.defaultStreamGradient}
                >
                  <View style={styles.defaultStreamIconWrap}>
                    <Play color="#FFFFFF" size={20} fill="#FFFFFF" />
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
                      Stream with subtitles, gesture controls & background audio
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Option 2: Webtor Cloud in Browser */}
              <TouchableOpacity
                style={styles.secondaryStreamBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (!streamModalData) return;
                  setStreamModalVisible(false);
                  const webtorUrl = `https://webtor.io/show?magnet=${encodeURIComponent(streamModalData.magnet)}`;
                  handleOpenUrlInBrowser(webtorUrl);
                }}
              >
                <View style={[styles.secondaryIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Globe color="#3B82F6" size={18} />
                </View>
                <View style={styles.secondaryTextWrap}>
                  <Text style={styles.secondaryTitle}>Stream in Browser (Webtor Cloud)</Text>
                  <Text style={styles.secondarySub}>Direct cloud proxy playback in Web Browser</Text>
                </View>
                <ExternalLink color="#666" size={14} />
              </TouchableOpacity>

              {/* Option 3: External App */}
              <TouchableOpacity
                style={styles.secondaryStreamBtn}
                activeOpacity={0.7}
                onPress={() => {
                  if (!streamModalData) return;
                  setStreamModalVisible(false);
                  Linking.openURL(streamModalData.magnet).catch(() => {
                    Alert.alert('Notice', 'No compatible video player or torrent app found.');
                  });
                }}
              >
                <View style={[styles.secondaryIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Download color="#10B981" size={18} />
                </View>
                <View style={styles.secondaryTextWrap}>
                  <Text style={styles.secondaryTitle}>Open in External Player / App</Text>
                  <Text style={styles.secondarySub}>Play in VLC, MX Player, or torrent client</Text>
                </View>
                <ExternalLink color="#666" size={14} />
              </TouchableOpacity>
            </View>

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
        initialPositionSec={streamPlayerInitialPos}
        posterUrl={streamPlayerPosterUrl}
        onClose={() => {
          setStreamPlayerVisible(false);
          setActiveStreamItem(null);
          setStreamPlayerInitialPos(0);
          setStreamPlayerPosterUrl(undefined);
        }}
      />
    </View>
  );
};

/* ─────────────────────────── Styles ─────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#090A0E',
  },
  flex1: {
    flex: 1,
  },

  /* Search Bar */
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  searchBarCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15161F',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#262938',
    paddingHorizontal: 10,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    paddingHorizontal: 8,
  },
  iconBtn: {
    padding: 6,
  },
  browserShortcutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(229, 9, 20, 0.35)',
  },
  browserShortcutText: {
    color: '#E50914',
    fontSize: 11,
    fontWeight: '800',
  },

  /* URL Detected Banner */
  urlDetectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#12231A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1D4E31',
  },
  urlDetectedText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Filters */
  filterBar: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#161720',
    borderWidth: 1,
    borderColor: '#262838',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    color: '#8A8D9B',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },

  /* Results Grid */
  gridContainer: {
    padding: 12,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#12131A',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#20222E',
  },
  posterWrapper: {
    position: 'relative',
    backgroundColor: '#181920',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  shimmerCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingRatingBadge: {
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
  },
  floatingRatingText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
  },
  floatingYearBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: 'rgba(10, 10, 14, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  floatingYearText: {
    color: '#E0E0E6',
    fontSize: 10,
    fontWeight: '700',
  },
  cardInfo: {
    padding: 9,
    gap: 4,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  inlineRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
  },
  inlineRatingText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
  },
  metaSubText: {
    color: '#8A8D9B',
    fontSize: 11,
    fontWeight: '600',
  },

  /* Category Feed Header */
  feedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  feedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  feedCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  feedCountText: {
    color: '#A0A3B5',
    fontSize: 11,
    fontWeight: '600',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#161822',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262A3B',
  },
  refreshBtnText: {
    color: '#8A8D9B',
    fontSize: 11,
    fontWeight: '600',
  },
  backToFeedBtn: {
    backgroundColor: '#1C1F2E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2C3247',
    alignItems: 'center',
  },
  backToFeedText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Stream Options Modal */
  streamModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  streamModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#161822',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2E40',
  },
  streamModalHeader: {
    marginBottom: 16,
  },
  streamEnginePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  streamEngineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E50914',
  },
  streamEngineText: {
    color: '#E50914',
    fontSize: 11,
    fontWeight: '700',
  },
  streamModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  streamModalSubtitle: {
    color: '#8A8D9B',
    fontSize: 12,
  },
  streamOptionsList: {
    gap: 10,
    marginBottom: 16,
  },
  defaultStreamBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  defaultStreamGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  defaultStreamIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultStreamTextWrap: {
    flex: 1,
  },
  defaultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  defaultStreamTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  defaultTagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  defaultStreamSub: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    marginTop: 2,
  },
  secondaryStreamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1E212E',
    gap: 10,
    borderWidth: 1,
    borderColor: '#2D3246',
  },
  secondaryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    color: '#8A8D9B',
    fontSize: 11,
    marginTop: 1,
  },
  streamCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  streamCancelBtnText: {
    color: '#8A8D9B',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Center Status */
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 8,
  },
  stateTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  stateSubtitle: {
    color: '#8A8D9B',
    fontSize: 12,
    textAlign: 'center',
  },
  searchWebFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  searchWebFallbackText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Browser Mode Styles */
  browserAddressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#101117',
    borderBottomWidth: 1,
    borderBottomColor: '#1E202C',
  },
  browserInputCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191B24',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#292C3C',
    paddingHorizontal: 10,
    height: 38,
  },
  browserTextInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    paddingHorizontal: 8,
  },
  exitBrowserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exitBrowserText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  browserSubBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: '#0C0D12',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  shieldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  shieldText: {
    color: '#30D158',
    fontSize: 10,
    fontWeight: '600',
  },
  browserSubBtn: {
    padding: 4,
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: '#1E202C',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  hiddenScraper: {
    width: 0,
    height: 0,
    opacity: 0,
    position: 'absolute',
  },
});

export default SearchScreen;
