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
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Search,
  X,
  ArrowLeft,
  Download,
  Play,
  Film,
  RotateCcw,
  Sparkles,
  Flame,
  Check,
  AlertCircle,
  ChevronDown,
  Bookmark,
  Clock,
  CheckCircle2,
  SlidersHorizontal,
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
import { DownloadItem } from '../types/downloads';
import { myListService } from '../services/myListService';
import { MovieDetailSheet, sanitizeMovieTitle } from './MovieFinderScreen';

interface SearchScreenProps {
  onNavigateToTab?: (tab: any) => void;
  onOpenInBrowserTab?: (url: string) => void;
  initialQuery?: string;
}

const INITIAL_BATCH_SIZE = 16;

const TRENDING_TAGS = [
  'Photographer (2026)',
  'Amaran',
  'GOAT',
  'Leo',
  'Tamil 1080p',
  'Malayalam HQ',
  '4K Movies',
  'Action Movies',
];

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

const getInitialResolutionIndex = (resolutions: MovieResolutionItem[]): number => {
  if (!resolutions || resolutions.length === 0) return 0;
  const idx1080 = resolutions.findIndex((r) =>
    /\b1080p?\b/i.test(r.resolution) || /1080/i.test(r.resolution) || /1080/i.test(r.rawTitle || '')
  );
  if (idx1080 !== -1) return idx1080;
  const idx720 = resolutions.findIndex((r) =>
    /\b720p?\b/i.test(r.resolution) || /720/i.test(r.resolution) || /720/i.test(r.rawTitle || '')
  );
  if (idx720 !== -1) return idx720;
  return 0;
};

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
  isSaved,
  onToggleSave,
  enqueuePosterFetch,
  onPress,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.floor((screenWidth - 36) / 2);
  const cardHeight = Math.round(cardWidth * 1.5);

  const topicUrl = item.topicUrl || item.resolutions?.[0]?.topicUrl || '';
  const [posterUrl, setPosterUrl] = useState<string | null>(() => {
    if (!topicUrl) return null;
    const cached = posterCache.get(topicUrl);
    return cached !== undefined ? cached : null;
  });
  const [posterLoading, setPosterLoading] = useState(() => Boolean(topicUrl && !posterCache.has(topicUrl)));

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

  const bestRes = useMemo(() => {
    if (!item.resolutions || item.resolutions.length === 0) return null;
    const idx = getInitialResolutionIndex(item.resolutions);
    return item.resolutions[idx] || item.resolutions[0];
  }, [item.resolutions]);

  const badge = getQualityBadgeConfig(bestRes?.resolution || '');

  const cleanMovieName = useMemo(() => {
    const isBad = (name?: string) =>
      !name ||
      name.length < 2 ||
      /^(languages?|rips?)|^[-–—\s\d.+]+(?:gb|mb)?/i.test(name.trim()) ||
      /^(view\s+(?:the\s+)?topic|go\s+to\s+topic)/i.test(name.trim());

    const sanitizedItemTitle = sanitizeMovieTitle(item.movieTitle);
    if (!isBad(sanitizedItemTitle)) return sanitizedItemTitle;

    const fallbackUrl = item.topicUrl || item.resolutions?.[0]?.topicUrl || '';
    if (fallbackUrl) {
      const parsed = tamilMvService.parseTitleMetadata(
        item.resolutions?.[0]?.rawTitle || item.movieTitle || '',
        fallbackUrl
      );
      const sanitizedParsedTitle = sanitizeMovieTitle(parsed.movieTitle);
      if (!isBad(sanitizedParsedTitle)) return sanitizedParsedTitle;
    }
    return 'Tamil Movie';
  }, [item.movieTitle, item.topicUrl, item.resolutions]);

  return (
    <TouchableOpacity
      style={[styles.card, { width: cardWidth, height: cardHeight }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setPosterUrl(null)}
        />
      ) : posterLoading ? (
        <LinearGradient
          colors={['#181920', '#252834', '#181920']}
          style={[StyleSheet.absoluteFill, styles.shimmerCenter]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Film color="#3A3E4E" size={32} strokeWidth={1.5} />
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={[Colors.primary, '#660814']}
          style={[StyleSheet.absoluteFill, styles.shimmerCenter]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Film color="rgba(255,255,255,0.4)" size={32} strokeWidth={1.5} />
        </LinearGradient>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(10,10,14,0.45)', 'rgba(10,10,14,0.96)']}
        style={styles.gradientOverlay}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 0, y: 1 }}
      >
        <Text style={styles.cardTitle} numberOfLines={2}>
          {cleanMovieName}
        </Text>
      </LinearGradient>

      {item.year ? (
        <View style={styles.yearBadge}>
          <Text style={styles.yearText}>{item.year}</Text>
        </View>
      ) : null}

      {item.language ? (
        <View style={[styles.langBadge, { left: item.year ? 46 : 7 }]}>
          <Text style={styles.langText}>{item.language.slice(0, 3).toUpperCase()}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

/* ─────────────────────────── SearchScreen Component ─────────────────────────── */
export const SearchScreen: React.FC<SearchScreenProps> = ({
  onNavigateToTab,
  onOpenInBrowserTab,
  initialQuery = '',
}) => {
  const insets = useSafeAreaInsets();
  const { startDownload, themeKey } = useDownloads();

  const [query, setQuery] = useState(initialQuery);
  const [searchedQuery, setSearchedQuery] = useState(initialQuery);
  const [results, setResults] = useState<TamilMvMovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));
  const [displayedCount, setDisplayedCount] = useState(INITIAL_BATCH_SIZE);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['All']);

  // Detail Modal State
  const [detailMovie, setDetailMovie] = useState<TamilMvMovieResult | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [streamingResId, setStreamingResId] = useState<string | null>(null);

  // Saved MyList items
  const [savedMovieIds, setSavedMovieIds] = useState<Set<string>>(() => myListService.getSavedSet());

  // Base Mirror URL State
  const [currentBaseUrl, setCurrentBaseUrl] = useState(tamilMvService.getBaseUrl());
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(currentBaseUrl);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<any>(null);
  const activeSearchTermRef = useRef(initialQuery);

  // WebView Scraper State
  const [webViewSearchUrl, setWebViewSearchUrl] = useState('');
  const webViewRef = useRef<WebView>(null);

  // Poster WebView Queue State
  const [posterWebViewUrl, setPosterWebViewUrl] = useState('');
  const posterQueueRef = useRef<string[]>([]);
  const posterProcessingRef = useRef(false);
  const posterTimeoutRef = useRef<any>(null);
  const activeFetchesRef = useRef<Set<string>>(new Set());
  const posterCallbacksRef = useRef<Map<string, (url: string | null) => void>>(new Map());

  useEffect(() => {
    const unsub = myListService.subscribe(() => {
      setSavedMovieIds(myListService.getSavedSet());
    });
    return () => unsub();
  }, []);

  const isMovieSaved = useCallback(
    (movie: TamilMvMovieResult): boolean => {
      const id = (movie.id || '').toLowerCase();
      const topic = (movie.topicUrl || '').toLowerCase();
      const title = (movie.movieTitle || '').toLowerCase();
      return (
        (!!id && savedMovieIds.has(id)) ||
        (!!topic && savedMovieIds.has(topic)) ||
        (!!title && savedMovieIds.has(title)) ||
        myListService.isSaved(movie.id || movie.topicUrl || movie.movieTitle)
      );
    },
    [savedMovieIds]
  );

  const handleToggleSaveMovie = useCallback(
    (movie: TamilMvMovieResult, posterUrl?: string | null) => {
      const resolvedPoster =
        posterUrl ||
        (movie.topicUrl ? posterCache.get(movie.topicUrl) : null) ||
        (movie.resolutions?.[0]?.topicUrl ? posterCache.get(movie.resolutions[0].topicUrl) : null) ||
        null;
      myListService.toggle(movie, resolvedPoster);
    },
    []
  );

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
        .then((posterUrl) => {
          activeFetchesRef.current.delete(topicUrl);
          if (posterUrl) {
            posterCache.set(topicUrl, posterUrl);
            const cb = posterCallbacksRef.current.get(topicUrl);
            if (cb) {
              cb(posterUrl);
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

  const handlePerformSearch = useCallback(
    async (searchTerm?: string) => {
      const term = (searchTerm ?? query).trim();
      if (!term) return;

      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

      activeSearchTermRef.current = term;
      setLoading(true);
      setHasSearched(true);
      setSearchedQuery(term);
      setResults([]);
      setDisplayedCount(INITIAL_BATCH_SIZE);

      const ts = Date.now();
      const searchUrl = `${currentBaseUrl}/index.php?/search/&q=${encodeURIComponent(term)}&type=forums_topic&_t=${ts}`;

      setWebViewSearchUrl(searchUrl);

      searchTimeoutRef.current = setTimeout(() => {
        setLoading(false);
      }, 15000);

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
        // WebView scraper will handle result
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

  const handleToggleLanguage = (lang: string) => {
    if (lang === 'All') {
      setSelectedLanguages(['All']);
      return;
    }
    setSelectedLanguages((prev) => {
      const isSelected = prev.includes(lang);
      if (isSelected) {
        const next = prev.filter((l) => l !== lang);
        return next.length === 0 ? ['All'] : next;
      } else {
        const next = prev.filter((l) => l !== 'All');
        return [...next, lang];
      }
    });
  };

  const isLangActive = (lang: string) => {
    if (lang === 'All') return selectedLanguages.includes('All');
    return selectedLanguages.includes(lang);
  };

  const filteredResults = useMemo(() => {
    if (selectedLanguages.includes('All') || selectedLanguages.length === 0) {
      return results;
    }
    return results.filter((item) => {
      const itemLang = (item.language || '').toLowerCase();
      const itemTitle = (item.movieTitle || '').toLowerCase();
      return selectedLanguages.some((selected) => {
        const selLower = selected.toLowerCase();
        return itemLang.includes(selLower) || itemTitle.includes(selLower);
      });
    });
  }, [results, selectedLanguages]);

  const visibleResults = useMemo(() => {
    return filteredResults.slice(0, displayedCount);
  }, [filteredResults, displayedCount]);

  const handleLoadMore = useCallback(() => {
    if (displayedCount < filteredResults.length) {
      setDisplayedCount((prev) => prev + INITIAL_BATCH_SIZE);
    }
  }, [displayedCount, filteredResults.length]);

  const handleWebViewMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'SCRAPED_TOPICS' && Array.isArray(payload.items)) {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        const currentTerm = activeSearchTermRef.current;
        const parsed = tamilMvService.parseRawTopicItems(payload.items, currentTerm);
        const sanitized = parsed.map((r) => ({
          ...r,
          movieTitle: sanitizeMovieTitle(r.movieTitle),
        }));
        setResults(sanitized);
        setLoading(false);
      }
    } catch (e) {
      console.warn('WebView scrape error:', e);
    }
  };

  const handlePosterWebViewMessage = useCallback((event: any) => {
    try {
      if (posterTimeoutRef.current) clearTimeout(posterTimeoutRef.current);
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'POSTER_RESULT') {
        const { topicUrl, posterUrl: url } = payload;
        const result: string | null = url || null;
        posterCache.set(topicUrl, result);
        const cb = posterCallbacksRef.current.get(topicUrl);
        if (cb) {
          cb(result);
          posterCallbacksRef.current.delete(topicUrl);
        }
        posterQueueRef.current = posterQueueRef.current.filter((u) => u !== topicUrl);
        posterProcessingRef.current = false;
        if (posterQueueRef.current.length > 0) {
          const nextUrl = posterQueueRef.current[0];
          posterProcessingRef.current = true;
          setPosterWebViewUrl(nextUrl);
        } else {
          setPosterWebViewUrl('');
        }
      }
    } catch (e) {
      if (posterTimeoutRef.current) clearTimeout(posterTimeoutRef.current);
      posterProcessingRef.current = false;
      if (posterQueueRef.current.length > 0) {
        posterQueueRef.current.shift();
        if (posterQueueRef.current.length > 0) {
          posterProcessingRef.current = true;
          setPosterWebViewUrl(posterQueueRef.current[0]);
        } else {
          setPosterWebViewUrl('');
        }
      }
    }
  }, []);

  const handleMovieDownload = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      let target = resItem.magnetUrl || resItem.torrentFileUrl;
      if (!target && resItem.topicUrl) {
        const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl, resItem.resolution);
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
        const poster = posterCache.get(movie.topicUrl) || posterCache.get(movie.id) || undefined;
        await startDownload(target, title, poster);

        Alert.alert('Download Started 📥', `"${title}" has been added to In-App Downloads.`, [
          { text: 'View Downloads', onPress: () => onNavigateToTab?.('downloads') },
          { text: 'OK', style: 'cancel' },
        ]);
      } catch (err: any) {
        Alert.alert('Download Error', err?.message || 'Failed to start movie download');
      }
    },
    [startDownload, onNavigateToTab]
  );

  const handleTorrentDownload = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      let magnet = resItem.magnetUrl;
      let torrentFile = resItem.torrentFileUrl;

      if (!magnet && !torrentFile && resItem.topicUrl) {
        const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl, resItem.resolution);
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
          'Queue this torrent to background engine or open in external torrent app?',
          [
            {
              text: 'Queue in App',
              onPress: async () => {
                try {
                  const title = `${movie.movieTitle} (${resItem.resolution})`;
                  const poster = posterCache.get(movie.topicUrl) || posterCache.get(movie.id) || undefined;
                  await startDownload(magnet, title, poster);
                  Alert.alert('Torrent Queued', 'Torrent download queued in background engine.');
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
    [startDownload]
  );

  const renderMovieCard = useCallback(
    ({ item }: { item: TamilMvMovieResult }) => (
      <SearchResultCard
        item={item}
        isSaved={isMovieSaved(item)}
        onToggleSave={(posterUrl) => handleToggleSaveMovie(item, posterUrl)}
        enqueuePosterFetch={enqueuePosterFetch}
        onPress={() => {
          setDetailMovie(item);
          setDetailVisible(true);
        }}
      />
    ),
    [isMovieSaved, handleToggleSaveMovie, enqueuePosterFetch]
  );

  const keyExtractor = useCallback((item: TamilMvMovieResult, index: number) => {
    return item.id || item.topicUrl || `search_res_${index}`;
  }, []);

  const SCRAPER_JS = `
    (function() {
      function sendResults() {
        try {
          var links = document.querySelectorAll('a[href*="/topic/"]');
          var topicMap = {};
          for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute('href');
            var text = (links[i].innerText || links[i].textContent || '').trim();
            if (!href) continue;
            var cleanUrl = href.split('?')[0];
            if (!topicMap[cleanUrl] && text.length > 3) {
              topicMap[cleanUrl] = text;
            }
          }
          var items = [];
          for (var url in topicMap) {
            items.push({ topicUrl: url, rawTitle: topicMap[url] });
          }
          if (items.length > 0 && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SCRAPED_TOPICS',
              items: items
            }));
          }
        } catch(e) {}
      }
      sendResults();
      setTimeout(sendResults, 1000);
      setTimeout(sendResults, 2500);
    })();
    true;
  `;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Search color={Colors.primary} size={20} strokeWidth={2.5} />
          <Text style={styles.headerTitle}>Search Movies & Torrents</Text>
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
          <ChevronDown color="#9E9EA7" size={12} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Glassmorphic Search Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Search color="#8E8E93" size={16} strokeWidth={2.5} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search movie title (e.g. Leo, Amaran, GOAT)..."
            placeholderTextColor="#8E8E93"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handlePerformSearch()}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={handleClearSearch}
              style={styles.clearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
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

      {/* Multi-Language Filter Chips Bar */}
      <View style={styles.langFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langFilterScroll}
        >
          {['All', 'Tamil', 'English', 'Telugu', 'Hindi', 'Malayalam', 'Kannada'].map((lang) => {
            const active = isLangActive(lang);
            return (
              <TouchableOpacity
                key={lang}
                style={[styles.langChip, active && styles.langChipActive]}
                onPress={() => handleToggleLanguage(lang)}
                activeOpacity={0.75}
              >
                {active && lang !== 'All' ? (
                  <Check color="#FFFFFF" size={12} strokeWidth={3} style={{ marginRight: 4 }} />
                ) : null}
                <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                  {lang}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Body */}
      {loading ? (
        <View style={styles.stateCenter}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Searching {currentBaseUrl.replace(/^https?:\/\/(www\.)?/, '')}...</Text>
        </View>
      ) : !hasSearched && !query.trim() ? (
        /* Empty / Trending Search State */
        <ScrollView contentContainerStyle={styles.trendingContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.trendingHeaderRow}>
            <Flame color={Colors.primary} size={18} strokeWidth={2.5} />
            <Text style={styles.trendingTitle}>Trending Search Topics</Text>
          </View>
          <View style={styles.tagsGrid}>
            {TRENDING_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.tagChip}
                onPress={() => {
                  setQuery(tag);
                  handlePerformSearch(tag);
                }}
                activeOpacity={0.75}
              >
                <Sparkles color="#FFD700" size={12} strokeWidth={2} style={{ marginRight: 6 }} />
                <Text style={styles.tagChipText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : hasSearched && results.length === 0 ? (
        <View style={styles.stateCenter}>
          <AlertCircle color="#FF453A" size={44} strokeWidth={2.2} />
          <Text style={styles.notFoundTitle}>No Results Found</Text>
          <Text style={styles.notFoundSub}>
            No movies found for "{searchedQuery}". Try another keyword or switch mirror.
          </Text>
          <View style={styles.notFoundActionsRow}>
            <TouchableOpacity
              style={styles.backHomeBtnPrimary}
              onPress={handleClearSearch}
              activeOpacity={0.8}
            >
              <RotateCcw color="#FFFFFF" size={13} strokeWidth={2.4} style={{ marginRight: 6 }} />
              <Text style={styles.backHomeBtnPrimaryText}>Clear Search</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.switchMirrorBtn}
              onPress={() => setUrlModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.switchMirrorBtnText}>Switch Mirror</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={visibleResults}
          keyExtractor={keyExtractor}
          renderItem={renderMovieCard}
          numColumns={3}
          columnWrapperStyle={styles.listGridColumnWrapper}
          contentContainerStyle={[styles.listGridContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
        />
      )}

      {/* Headless WebView Scraper for Search */}
      {Boolean(webViewSearchUrl) && (
        <View style={styles.hiddenWebViewContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: webViewSearchUrl }}
            injectedJavaScript={SCRAPER_JS}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36"
          />
        </View>
      )}

      {/* Headless WebView for Poster Extractor */}
      {Boolean(posterWebViewUrl) && (
        <View style={styles.hiddenWebViewContainer}>
          <WebView
            source={{ uri: posterWebViewUrl }}
            onMessage={handlePosterWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </View>
      )}

      {/* Full Screen Netflix Movie Detail Sheet */}
      <MovieDetailSheet
        visible={detailVisible}
        movie={detailMovie}
        streamingResId={streamingResId}
        isSaved={detailMovie ? isMovieSaved(detailMovie) : false}
        onToggleSave={() => detailMovie && handleToggleSaveMovie(detailMovie)}
        onClose={() => setDetailVisible(false)}
        onMovieDownload={handleMovieDownload}
        onTorrentDownload={handleTorrentDownload}
        onStream={() => {}}
        onCopy={() => {}}
        onOpenExternal={() => {}}
        enqueuePosterFetch={enqueuePosterFetch}
      />

      {/* Mirror Switch Modal */}
      <Modal
        visible={urlModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUrlModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select TamilMV Mirror</Text>
            <Text style={styles.modalSub}>Choose a working mirror domain if search is blocked.</Text>

            <ScrollView style={styles.mirrorList}>
              {POPULAR_MIRRORS.map((mirror) => (
                <TouchableOpacity
                  key={mirror}
                  style={[styles.mirrorItem, currentBaseUrl === mirror && styles.mirrorItemActive]}
                  onPress={() => {
                    setCurrentBaseUrl(mirror);
                    tamilMvService.setBaseUrl(mirror);
                    setUrlModalVisible(false);
                    if (searchedQuery) handlePerformSearch(searchedQuery);
                  }}
                >
                  <Text style={[styles.mirrorItemText, currentBaseUrl === mirror && styles.mirrorItemTextActive]}>
                    {mirror}
                  </Text>
                  {currentBaseUrl === mirror && <Check color={Colors.primary} size={16} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setUrlModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  mirrorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E1F26',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#30D158',
  },
  mirrorChipText: {
    color: '#A0A0AB',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 120,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    marginVertical: 6,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1D24',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
    marginLeft: 8,
  },
  clearBtn: {
    padding: 4,
  },
  searchBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.6,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  langFilterContainer: {
    marginVertical: 4,
    paddingBottom: 4,
  },
  langFilterScroll: {
    paddingHorizontal: 14,
    gap: 6,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1B22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  langChipActive: {
    backgroundColor: 'rgba(250, 36, 60, 0.2)',
    borderColor: Colors.primary,
  },
  langChipText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  langChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stateCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    gap: 12,
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
  },
  trendingContainer: {
    padding: 16,
  },
  trendingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  trendingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1D26',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagChipText: {
    color: '#E1E1E6',
    fontSize: 12.5,
    fontWeight: '600',
  },
  notFoundTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  notFoundSub: {
    color: '#8E8E93',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  notFoundActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  backHomeBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backHomeBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  switchMirrorBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  switchMirrorBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  listGridContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  listGridColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#181920',
    position: 'relative',
  },
  shimmerCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end',
    padding: 8,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  qualityBadgeInline: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.8,
  },
  qualityText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
  },
  yearBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  yearText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  langBadge: {
    position: 'absolute',
    top: 7,
    backgroundColor: 'rgba(250, 36, 60, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
  },
  langText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  cardBookmarkBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    padding: 5,
    borderRadius: 12,
  },
  hiddenWebViewContainer: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    bottom: -100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E1F26',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxHeight: '70%',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  modalSub: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  mirrorList: {
    maxHeight: 250,
  },
  mirrorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2D38',
  },
  mirrorItemActive: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
  },
  mirrorItemText: {
    color: '#D1D1D6',
    fontSize: 13.5,
    fontWeight: '500',
  },
  mirrorItemTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modalCloseBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#2A2B36',
    borderRadius: 8,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
