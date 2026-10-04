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
  Dimensions,
  useWindowDimensions,
  Animated,
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
  Globe,
  Download,
  DownloadCloud,
  Play,
  Copy,
  ExternalLink,
  Film,
  Clapperboard,
  RotateCcw,
  Sparkles,
  Flame,
  Check,
  AlertCircle,
  ChevronDown,
  Layers,
  Radio,
  Tv,
  ArrowUp,
  HardDrive,
  Bookmark,
  BookmarkCheck,
  PlayCircle,
  Clock,
  CheckCircle2,
  Info,
  Star,
  User,
  Calendar,
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
import { continueWatchingService, ContinueWatchingItem } from '../services/continueWatchingService';
import { myListService } from '../services/myListService';
import { extractInfoHashFromUrl } from '../utils/bencode';
import { formatBytes, cleanTitleFromFilename, getPosterForFilename } from '../services/downloadService';
import { fetchMovieDatabaseMetadata, RealMovieMetadata } from '../services/movieDatabaseService';

interface MovieFinderScreenProps {
  onNavigateToTab?: (tab: any) => void;
  onOpenInBrowserTab?: (url: string) => void;
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
  ? `${FileSystem.documentDirectory}finder_cache_v5.json`
  : '';

// Helper to strip IPS forum boilerplate like "View the topic '...'", "View the topic: ...", etc.
export const sanitizeMovieTitle = (title?: string): string => {
  if (!title) return '';
  return title
    .replace(/^(?:view\s+(?:the\s+)?topic|go\s+to\s+(?:the\s+)?topic)[\s:'"‘“\-]*/i, '')
    .replace(/^view\s+the\s+topic\s*/i, '')
    .replace(/['"’”]+$/g, '')
    .replace(/^['"‘“]+/g, '')
    .trim();
};

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

// Helper to format remaining duration for continue watching
const formatRemainingTime = (currentTime: number, duration: number): string => {
  const remSec = Math.max(0, duration - currentTime);
  const remMin = Math.round(remSec / 60);
  if (remMin >= 60) {
    const hrs = Math.floor(remMin / 60);
    const mins = remMin % 60;
    return mins > 0 ? `${hrs}h ${mins}m left` : `${hrs}h left`;
  }
  if (remMin > 0) {
    return `${remMin}m left`;
  }
  return `${Math.round(remSec)}s left`;
};

// ─────────────────────────────────────────────────────────────────────────────
// ContinueWatchingCard — horizontal card displaying in-progress watched movies
// ─────────────────────────────────────────────────────────────────────────────
interface ContinueWatchingCardProps {
  item: ContinueWatchingItem;
  onResume: () => void;
  onRemove: () => void;
}

const ContinueWatchingCard = React.memo<ContinueWatchingCardProps>(({ item, onResume, onRemove }) => {
  const remainingText = formatRemainingTime(item.currentTime, item.duration);
  const progressPercent = Math.min(Math.max(Math.round(item.progress * 100), 5), 100);

  return (
    <TouchableOpacity
      style={styles.cwCard}
      onPress={onResume}
      activeOpacity={0.82}
    >
      {/* Poster Image */}
      {item.posterUrl ? (
        <Image
          source={{ uri: item.posterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#181920', '#252834', '#181920']}
          style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
        >
          <Film color="#3A3E4E" size={28} strokeWidth={1.5} />
        </LinearGradient>
      )}

      {/* Dark gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(10,10,14,0.6)', 'rgba(10,10,14,0.95)']}
        style={styles.cwGradientOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Dismiss / Remove Button ("×") on Top-Right */}
      <TouchableOpacity
        style={styles.cwDismissBtn}
        onPress={(e) => {
          e.stopPropagation?.();
          onRemove();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <X color="#FFFFFF" size={13} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* Center Play Icon Overlay */}
      <View style={styles.cwCenterPlay} pointerEvents="none">
        <View style={styles.cwPlayCircle}>
          <Play color="#FFFFFF" size={16} fill="#FFFFFF" style={{ marginLeft: 2 }} />
        </View>
      </View>

      {/* Bottom Info: Title, Remaining, Progress Bar */}
      <View style={styles.cwBottomInfo} pointerEvents="none">
        <Text style={styles.cwTitle} numberOfLines={1}>
          {item.movieTitle}
        </Text>
        <View style={styles.cwMetaRow}>
          <Clock color="#8E8E93" size={10} strokeWidth={2} />
          <Text style={styles.cwRemainingText}>{remainingText}</Text>
          {item.resolution ? (
            <Text style={styles.cwResText}>• {item.resolution}</Text>
          ) : null}
        </View>

        {/* Progress Bar */}
        <View style={styles.cwProgressBarBg}>
          <View style={[styles.cwProgressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PosterGridCard — compact 2-column poster card for the grid layout
// ─────────────────────────────────────────────────────────────────────────────
interface PosterGridCardProps {
  item: TamilMvMovieResult;
  isSaved?: boolean;
  onToggleSave?: (posterUrl: string | null) => void;
  enqueuePosterFetch: (topicUrl: string, cb: (url: string | null) => void) => void;
  onPress: () => void;
}

const PosterGridCard = React.memo<PosterGridCardProps>(({ item, isSaved, onToggleSave, enqueuePosterFetch, onPress }) => {
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

  // Determine best quality badge label
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
      style={[styles.pgCard, { width: cardWidth, height: cardHeight }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Poster Image */}
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => {
            setPosterUrl(null);
          }}
        />
      ) : posterLoading ? (
        <LinearGradient
          colors={['#181920', '#252834', '#181920']}
          style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Film color="#3A3E4E" size={32} strokeWidth={1.5} />
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={[Colors.primary, '#660814']}
          style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Film color="rgba(255,255,255,0.4)" size={32} strokeWidth={1.5} />
        </LinearGradient>
      )}

      {/* Bottom gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(10,10,14,0.45)', 'rgba(10,10,14,0.96)']}
        style={styles.pgGradientOverlay}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 0, y: 1 }}
      >
        {bestRes ? (
          <View style={styles.pgCardBadgeRow}>
            <View style={[styles.pgQualityBadgeInline, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              <Text style={[styles.pgQualityText, { color: badge.text }]}>{bestRes.resolution}</Text>
            </View>
          </View>
        ) : null}
        <Text style={styles.pgTitle} numberOfLines={2}>
          {cleanMovieName}
        </Text>
      </LinearGradient>

      {/* Year badge — top-left */}
      {item.year ? (
        <View style={styles.pgYearBadge}>
          <Text style={styles.pgYearText}>{item.year}</Text>
        </View>
      ) : null}

      {/* Language badge — top-left next to year */}
      {item.language ? (
        <View style={[styles.pgLangBadge, { left: item.year ? 46 : 7, right: undefined }]}>
          <Text style={styles.pgLangText}>{item.language.slice(0, 3).toUpperCase()}</Text>
        </View>
      ) : null}

      {/* Bookmark button — top-right */}
      <TouchableOpacity
        style={styles.cardBookmarkBtn}
        onPress={(e) => {
          e.stopPropagation?.();
          onToggleSave?.(posterUrl);
        }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        activeOpacity={0.7}
      >
        <Bookmark
          color={isSaved ? Colors.primary : '#FFFFFF'}
          size={13}
          fill={isSaved ? Colors.primary : 'transparent'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TopReleaseCard — horizontal carousel card for "Top Release for this week"
// ─────────────────────────────────────────────────────────────────────────────
interface TopReleaseCardProps {
  item: TamilMvMovieResult;
  rank: number;
  isSaved?: boolean;
  onToggleSave?: (posterUrl: string | null) => void;
  enqueuePosterFetch: (topicUrl: string, cb: (url: string | null) => void) => void;
  onPress: () => void;
}

const TopReleaseCard = React.memo<TopReleaseCardProps>(({ item, rank, isSaved, onToggleSave, enqueuePosterFetch, onPress }) => {
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
      style={styles.trCard}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Poster Image */}
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
          style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Film color="#3A3E4E" size={26} strokeWidth={1.5} />
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={[Colors.primary, '#660814']}
          style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Film color="rgba(255,255,255,0.4)" size={26} strokeWidth={1.5} />
        </LinearGradient>
      )}

      {/* Bottom gradient overlay with Title */}
      <LinearGradient
        colors={['transparent', 'rgba(10,10,14,0.45)', 'rgba(10,10,14,0.96)']}
        style={styles.trGradientOverlay}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 0, y: 1 }}
      >
        {bestRes ? (
          <View style={styles.trCardBadgeRow}>
            <View style={[styles.trQualityBadgeInline, { backgroundColor: badge.bg, borderColor: badge.border }]}>
              <Text style={[styles.trQualityText, { color: badge.text }]}>{bestRes.resolution}</Text>
            </View>
          </View>
        ) : null}
        <Text style={styles.trTitle} numberOfLines={2}>
          {cleanMovieName}
        </Text>
      </LinearGradient>

      {/* Top-Left: Rank Badge (#1, #2, ...) */}
      <View style={styles.trRankBadge}>
        <LinearGradient
          colors={rank <= 3 ? [Colors.primary, '#850E1B'] : ['#2C2D38', '#181920']}
          style={styles.trRankGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.trRankText}>#{rank}</Text>
        </LinearGradient>
      </View>

      {/* Top-Left: Language badge next to rank */}
      {item.language ? (
        <View style={[styles.trLangBadge, { left: 38, right: undefined }]}>
          <Text style={styles.pgLangText}>{item.language.slice(0, 3).toUpperCase()}</Text>
        </View>
      ) : null}

      {/* Top-Right: Bookmark button */}
      <TouchableOpacity
        style={styles.cardBookmarkBtn}
        onPress={(e) => {
          e.stopPropagation?.();
          onToggleSave?.(posterUrl);
        }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        activeOpacity={0.7}
      >
        <Bookmark
          color={isSaved ? Colors.primary : '#FFFFFF'}
          size={13}
          fill={isSaved ? Colors.primary : 'transparent'}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DownloadedMovieCard — horizontal card displaying offline downloaded movies
// ─────────────────────────────────────────────────────────────────────────────
interface DownloadedMovieCardProps {
  item: DownloadItem;
  onPlay: () => void;
}

const DownloadedMovieCard = React.memo<DownloadedMovieCardProps>(({ item, onPlay }) => {
  const cleanTitle = useMemo(() => cleanTitleFromFilename(item.fileName || item.title), [item.fileName, item.title]);
  const posterUrl = useMemo(() => item.poster || getPosterForFilename(item.fileName || item.title), [item.poster, item.fileName, item.title]);
  const sizeText = useMemo(() => formatBytes(item.totalBytes || item.downloadedBytes || 0), [item.totalBytes, item.downloadedBytes]);

  return (
    <TouchableOpacity
      style={styles.dlCard}
      onPress={onPlay}
      activeOpacity={0.82}
    >
      {/* Poster Image */}
      {posterUrl ? (
        <Image
          source={{ uri: posterUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#181920', '#252834', '#181920']}
          style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
        >
          <Film color="#3A3E4E" size={28} strokeWidth={1.5} />
        </LinearGradient>
      )}

      {/* Dark gradient overlay */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(10,10,14,0.6)', 'rgba(10,10,14,0.95)']}
        style={styles.cwGradientOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {/* Top Left: Size badge */}
      <View style={styles.dlSizeBadge}>
        <Text style={styles.dlSizeBadgeText}>{sizeText}</Text>
      </View>

      {/* Top Right: Offline Ready Badge */}
      <View style={styles.dlOfflineBadge}>
        <CheckCircle2 color="#30D158" size={10} strokeWidth={2.5} />
        <Text style={styles.dlOfflineBadgeText}>OFFLINE</Text>
      </View>

      {/* Center Play Icon Overlay */}
      <View style={styles.cwCenterPlay} pointerEvents="none">
        <View style={styles.cwPlayCircle}>
          <Play color="#FFFFFF" size={16} fill="#FFFFFF" style={{ marginLeft: 2 }} />
        </View>
      </View>

      {/* Bottom Info: Title */}
      <View style={styles.cwBottomInfo} pointerEvents="none">
        <Text style={styles.cwTitle} numberOfLines={1}>
          {cleanTitle}
        </Text>
        <Text style={{ fontSize: 10, color: '#30D158', fontWeight: '600', marginTop: 2 }}>
          Downloaded • Ready
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HeroFeaturedMovieCard — large Netflix-style hero movie card for featured release
// ─────────────────────────────────────────────────────────────────────────────
interface HeroFeaturedMovieCardProps {
  movie: TamilMvMovieResult;
  slideNumber?: number;
  totalSlides?: number;
  isSaved?: boolean;
  onToggleSave?: (posterUrl: string | null) => void;
  enqueuePosterFetch: (topicUrl: string, cb: (url: string | null) => void) => void;
  onPress: () => void;
}

const HeroFeaturedMovieCard = React.memo<HeroFeaturedMovieCardProps>(({
  movie,
  slideNumber,
  totalSlides,
  isSaved,
  onToggleSave,
  enqueuePosterFetch,
  onPress,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = screenWidth;
  const cardHeight = Math.round(screenWidth * 1.30) + Math.round(insets.top * 0.5);

  const topicUrl = movie.topicUrl || movie.resolutions?.[0]?.topicUrl || '';
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
    if (!movie.resolutions || movie.resolutions.length === 0) return null;
    const idx = getInitialResolutionIndex(movie.resolutions);
    return movie.resolutions[idx] || movie.resolutions[0];
  }, [movie.resolutions]);

  const badge = getQualityBadgeConfig(bestRes?.resolution || '');

  const cleanMovieName = useMemo(() => {
    const sanitizedItemTitle = sanitizeMovieTitle(movie.movieTitle);
    if (sanitizedItemTitle) return sanitizedItemTitle;
    return 'Featured Release';
  }, [movie.movieTitle]);

  return (
    <TouchableOpacity
      style={[styles.heroCardContainer, { width: cardWidth, height: cardHeight }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Background Poster Image */}
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
          style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
        >
          <Film color="#3A3E4E" size={40} strokeWidth={1.5} />
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={[Colors.primary, '#660814']}
          style={[StyleSheet.absoluteFill, styles.pgShimmerCenter]}
        >
          <Film color="rgba(255,255,255,0.4)" size={40} strokeWidth={1.5} />
        </LinearGradient>
      )}

      {/* Dark gradient overlay matching MovieDetailSheet overlay feel */}
      <LinearGradient
        colors={['rgba(9,9,12,0.88)', 'rgba(9,9,12,0.35)', 'transparent', 'rgba(9,9,12,0.85)', '#09090C']}
        locations={[0, 0.16, 0.45, 0.8, 1]}
        style={styles.heroGradientOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        {/* Top Header Row (positioned under top overlay header) */}
        <View style={[styles.heroHeaderRow, { marginTop: insets.top + 46 }]}>
          <View style={styles.heroBadge}>
            <Sparkles color="#FFD700" size={13} strokeWidth={2.5} />
            <Text style={styles.heroBadgeText}>
              {totalSlides && totalSlides > 1 ? `FEATURED (${slideNumber}/${totalSlides})` : 'FEATURED RELEASE'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.heroBookmarkBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleSave?.(posterUrl);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Bookmark
              color={isSaved ? Colors.primary : '#FFFFFF'}
              size={16}
              fill={isSaved ? Colors.primary : 'transparent'}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom Content Area */}
        <View style={styles.heroBottomContent}>
          {/* Centered Slideshow Dots Indicator before movie title */}
          {totalSlides && totalSlides > 1 ? (
            <View style={styles.heroDotsCenterRow}>
              {Array.from({ length: totalSlides }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.slideshowDot,
                    i === (slideNumber ? slideNumber - 1 : 0)
                      ? styles.slideshowDotActive
                      : styles.slideshowDotInactive,
                  ]}
                />
              ))}
            </View>
          ) : null}

          <Text style={styles.heroTitle} numberOfLines={2}>
            {cleanMovieName}
          </Text>

          {/* Meta badges */}
          <View style={styles.heroMetaRow}>
            {movie.year ? (
              <View style={styles.heroMetaBadge}>
                <Text style={styles.heroMetaBadgeText}>{movie.year}</Text>
              </View>
            ) : null}

            {movie.language ? (
              <View style={[styles.heroMetaBadge, { backgroundColor: 'rgba(250,36,60,0.2)', borderColor: 'rgba(250,36,60,0.5)' }]}>
                <Text style={[styles.heroMetaBadgeText, { color: Colors.primary }]}>
                  {movie.language.toUpperCase()}
                </Text>
              </View>
            ) : null}

            {bestRes ? (
              <View style={[styles.heroMetaBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                <Text style={[styles.heroMetaBadgeText, { color: badge.text }]}>
                  {bestRes.resolution}
                </Text>
              </View>
            ) : null}
          </View>

          {/* CTA Action Button */}
          <TouchableOpacity
            style={styles.heroCtaBtn}
            onPress={onPress}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.primary, '#B51527']}
              style={styles.heroCtaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Play color="#FFFFFF" size={16} fill="#FFFFFF" />
              <Text style={styles.heroCtaText}>View Movie & Stream</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// HeroFeaturedSlideshow — horizontal manual/auto slideshow for top 4 featured movies
// ─────────────────────────────────────────────────────────────────────────────
interface HeroFeaturedSlideshowProps {
  movies: TamilMvMovieResult[];
  isMovieSaved: (movie: TamilMvMovieResult) => boolean;
  onToggleSaveMovie: (movie: TamilMvMovieResult, posterUrl?: string | null) => void;
  enqueuePosterFetch: (topicUrl: string, cb: (url: string | null) => void) => void;
  onSelectMovie: (movie: TamilMvMovieResult) => void;
}

const HeroFeaturedSlideshow = React.memo<HeroFeaturedSlideshowProps>(({
  movies,
  isMovieSaved,
  onToggleSaveMovie,
  enqueuePosterFetch,
  onSelectMovie,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<any>(null);

  // Auto-play slideshow (swipes every 4.5 seconds)
  useEffect(() => {
    if (!movies || movies.length <= 1) return;

    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const nextIndex = (prev + 1) % movies.length;
        scrollRef.current?.scrollTo({ x: nextIndex * screenWidth, animated: true });
        return nextIndex;
      });
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [movies, screenWidth]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    if (index >= 0 && index < movies.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  if (!movies || movies.length === 0) return null;

  return (
    <View style={styles.slideshowWrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
      >
        {movies.map((movie, index) => (
          <View key={movie.id || movie.topicUrl || index} style={{ width: screenWidth }}>
            <HeroFeaturedMovieCard
              movie={movie}
              slideNumber={index + 1}
              totalSlides={movies.length}
              isSaved={isMovieSaved(movie)}
              onToggleSave={(posterUrl) => onToggleSaveMovie(movie, posterUrl)}
              enqueuePosterFetch={enqueuePosterFetch}
              onPress={() => onSelectMovie(movie)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MovieDetailSheet — full-screen bottom-sheet style Netflix detail modal
// ─────────────────────────────────────────────────────────────────────────────
export interface MovieDetailSheetProps {
  visible: boolean;
  movie: TamilMvMovieResult | null;
  streamingResId: string | null;
  isSaved?: boolean;
  onToggleSave?: () => void;
  onClose: () => void;
  onMovieDownload: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  onTorrentDownload: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  onStream: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  onCopy: (res: MovieResolutionItem) => void;
  onOpenExternal: (res: MovieResolutionItem, movie: TamilMvMovieResult) => void;
  enqueuePosterFetch: (topicUrl: string, cb: (url: string | null) => void) => void;
  backendUrl?: string;
}

export const MovieDetailSheet = React.memo<MovieDetailSheetProps>(
  ({
    visible,
    movie,
    streamingResId,
    isSaved,
    onToggleSave,
    onClose,
    onMovieDownload,
    onTorrentDownload,
    onStream,
    onCopy,
    onOpenExternal,
    enqueuePosterFetch,
    backendUrl,
  }) => {
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();
    const [selectedResIndex, setSelectedResIndex] = useState(0);
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const [posterLoading, setPosterLoading] = useState(true);
    const [resolutionsList, setResolutionsList] = useState<MovieResolutionItem[]>(() => movie?.resolutions || []);
    const [resolutionsLoading, setResolutionsLoading] = useState(false);
    const [qualityModalMode, setQualityModalMode] = useState<'play' | 'download' | null>(null);
    const [playDestination, setPlayDestination] = useState<'internal' | 'browser'>('internal');
    const [downloadDestination, setDownloadDestination] = useState<'internal' | 'torrent_app'>('internal');
    const [copyingMagnet, setCopyingMagnet] = useState(false);

    const topicUrl = movie?.topicUrl || movie?.resolutions?.[0]?.topicUrl || '';

    // Hardware back press handler for quality selection popup
    useEffect(() => {
      if (!qualityModalMode) return;
      const onBack = () => {
        setQualityModalMode(null);
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [qualityModalMode]);

    // Reset / fetch poster and resolutions whenever movie changes
    useEffect(() => {
      if (!movie) return;
      setQualityModalMode(null);
      setResolutionsList(movie.resolutions || []);
      setSelectedResIndex(getInitialResolutionIndex(movie.resolutions));

      // Check cache first
      if (topicUrl && posterCache.has(topicUrl)) {
        setPosterUrl(posterCache.get(topicUrl) ?? null);
        setPosterLoading(false);
      } else {
        setPosterLoading(Boolean(topicUrl));
        setPosterUrl(null);
        if (topicUrl) {
          enqueuePosterFetch(topicUrl, (url) => {
            setPosterUrl(url);
            setPosterLoading(false);
          });
        }
      }

      // Fetch all resolutions directly from topic page in background
      if (topicUrl) {
        setResolutionsLoading(true);
        tamilMvService
          .extractResolutionsFromTopic(topicUrl)
          .then((fetched) => {
            setResolutionsLoading(false);
            if (fetched && fetched.length > 0) {
              setResolutionsList(fetched);
              movie.resolutions = fetched;
            }
          })
          .catch(() => {
            setResolutionsLoading(false);
          });
      }
    }, [topicUrl, movie]);

    const resolutions = resolutionsList.length > 0 ? resolutionsList : (movie?.resolutions || []);
    const selectedRes = resolutions[selectedResIndex] || resolutions[0];
    const badge = getQualityBadgeConfig(selectedRes?.resolution || '');
    const isStreaming = selectedRes ? streamingResId === selectedRes.id : false;

    const [dbMetadata, setDbMetadata] = useState<RealMovieMetadata | null>(null);
    const [dbLoading, setDbLoading] = useState(false);

    const cleanTitle = (() => {
      if (!movie) return 'Tamil Movie';
      const isBad = (name?: string) =>
        !name ||
        name.length < 2 ||
        /^(languages?|rips?)|^[-–—\s\d.+]+(?:gb|mb)?/i.test(name.trim()) ||
        /^(view\s+(?:the\s+)?topic|go\s+to\s+topic)/i.test(name.trim());

      const sanitized = sanitizeMovieTitle(movie.movieTitle);
      if (!isBad(sanitized)) return sanitized;

      const fallbackUrl = movie.topicUrl || movie.resolutions?.[0]?.topicUrl || '';
      if (fallbackUrl) {
        const parsed = tamilMvService.parseTitleMetadata(
          movie.resolutions?.[0]?.rawTitle || movie.movieTitle || '',
          fallbackUrl
        );
        const parsedSanitized = sanitizeMovieTitle(parsed.movieTitle);
        if (!isBad(parsedSanitized)) return parsedSanitized;
      }
      return 'Tamil Movie';
    })();

    useEffect(() => {
      if (!movie) return;
      setDbMetadata(null);
      setDbLoading(true);

      const targetSearchTitle = cleanTitle !== 'Tamil Movie' ? cleanTitle : movie.movieTitle;
      fetchMovieDatabaseMetadata(targetSearchTitle, movie.year)
        .then((meta) => {
          setDbMetadata(meta);
          setDbLoading(false);
        })
        .catch(() => {
          setDbLoading(false);
        });
    }, [cleanTitle, movie]);

    const effectivePoster = posterUrl || dbMetadata?.backdropUrl || dbMetadata?.posterUrl;
    const displayTitle = dbMetadata?.title || cleanTitle;

    const handleQuickOpenBrowser = useCallback(() => {
      const url = topicUrl || movie?.topicUrl || resolutions[selectedResIndex]?.topicUrl;
      if (url) {
        Linking.openURL(url).catch((err) => {
          Alert.alert('Browser Error', 'Could not open movie page: ' + err.message);
        });
      } else {
        Alert.alert('Notice', 'Movie page URL is not available.');
      }
    }, [topicUrl, movie, resolutions, selectedResIndex]);

    const handleQuickCopyMagnet = useCallback(
      async (targetResolution?: MovieResolutionItem) => {
        const targetRes = targetResolution || selectedRes;
        let magnet = targetRes?.magnetUrl;
        const resTopic = targetRes?.topicUrl || topicUrl;

        if (!magnet && resTopic) {
          setCopyingMagnet(true);
          try {
            const extracted = await tamilMvService.extractMagnetFromTopic(
              resTopic,
              targetRes?.resolution
            );
            if (extracted.magnetUrl) {
              magnet = extracted.magnetUrl;
              if (targetRes) targetRes.magnetUrl = extracted.magnetUrl;
            }
          } catch {}
          setCopyingMagnet(false);
        }

        if (magnet) {
          try {
            await Clipboard.setStringAsync(magnet);
            Alert.alert(
              'Magnet URL Copied! 📋',
              `Magnet link for ${targetRes?.resolution || 'movie'} (${targetRes?.size || 'standard'}) copied to your clipboard.\n\nYou can paste it directly into your browser or torrent client.`
            );
          } catch {
            await Share.share({ message: magnet, title: `${cleanTitle} Magnet Link` });
          }
        } else {
          Alert.alert(
            'Magnet Not Found',
            'Could not extract direct magnet link from topic. Would you like to view the movie page in your browser?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Movie Page', onPress: handleQuickOpenBrowser },
            ]
          );
        }
      },
      [selectedRes, topicUrl, cleanTitle, handleQuickOpenBrowser]
    );

    const handleQuickCopyStreamUrl = useCallback(
      async (targetResolution?: MovieResolutionItem) => {
        const targetRes = targetResolution || selectedRes;
        let magnet = targetRes?.magnetUrl;
        const resTopic = targetRes?.topicUrl || topicUrl;

        if (!magnet && resTopic) {
          setCopyingMagnet(true);
          try {
            const extracted = await tamilMvService.extractMagnetFromTopic(
              resTopic,
              targetRes?.resolution
            );
            if (extracted.magnetUrl) {
              magnet = extracted.magnetUrl;
              if (targetRes) targetRes.magnetUrl = extracted.magnetUrl;
            }
          } catch {}
          setCopyingMagnet(false);
        }

        if (magnet) {
          const cleanBackend = (backendUrl || 'https://vflix-backend.onrender.com').trim().replace(/\/+$/, '');
          // 1. Silent background pre-warm to register trackers on backend
          fetch(`${cleanBackend}/api/stream/warmup?magnet=${encodeURIComponent(magnet)}`).catch(() => {});

          // 2. Generate clean HTTP hashcode stream URL
          const infoHash = extractInfoHashFromUrl(magnet);
          const playUrl = infoHash
            ? `${cleanBackend}/api/stream/${infoHash}`
            : `${cleanBackend}/api/stream/play?magnet=${encodeURIComponent(magnet)}`;

          try {
            await Clipboard.setStringAsync(playUrl);
            Alert.alert(
              'Stream URL Copied! 🎬',
              `Video playing URL copied to clipboard:\n\n${playUrl}`
            );
          } catch {
            await Share.share({ message: playUrl, title: `${cleanTitle} Stream URL` });
          }
        } else {
          Alert.alert(
            'Magnet Not Found',
            'Could not extract direct magnet link from topic.'
          );
        }
      },
      [selectedRes, topicUrl, backendUrl, cleanTitle]
    );

    const handleQuickCopyDownloadUrl = useCallback(
      async (targetResolution?: MovieResolutionItem) => {
        const targetRes = targetResolution || selectedRes;
        let magnet = targetRes?.magnetUrl;
        const resTopic = targetRes?.topicUrl || topicUrl;

        if (!magnet && resTopic) {
          setCopyingMagnet(true);
          try {
            const extracted = await tamilMvService.extractMagnetFromTopic(
              resTopic,
              targetRes?.resolution
            );
            if (extracted.magnetUrl) {
              magnet = extracted.magnetUrl;
              if (targetRes) targetRes.magnetUrl = extracted.magnetUrl;
            }
          } catch {}
          setCopyingMagnet(false);
        }

        if (magnet) {
          const cleanBackend = (backendUrl || 'https://vflix-backend.onrender.com').trim().replace(/\/+$/, '');
          // 1. Silent background pre-warm to register trackers on backend
          fetch(`${cleanBackend}/api/stream/warmup?magnet=${encodeURIComponent(magnet)}`).catch(() => {});

          // 2. Generate clean HTTP hashcode download URL
          const infoHash = extractInfoHashFromUrl(magnet);
          const downloadUrl = infoHash
            ? `${cleanBackend}/api/stream/${infoHash}?raw=1&dl=1`
            : `${cleanBackend}/api/stream/play?magnet=${encodeURIComponent(magnet)}&dl=1`;

          try {
            await Clipboard.setStringAsync(downloadUrl);
            Alert.alert(
              'Download URL Copied! 📥',
              `Video downloading URL copied to clipboard:\n\n${downloadUrl}`
            );
          } catch {
            await Share.share({ message: downloadUrl, title: `${cleanTitle} Download URL` });
          }
        } else {
          Alert.alert(
            'Magnet Not Found',
            'Could not extract direct magnet link from topic.'
          );
        }
      },
      [selectedRes, topicUrl, backendUrl, cleanTitle]
    );

    const handleStreamInBrowser = useCallback(
      async (res: MovieResolutionItem) => {
        let magnet = res.magnetUrl;
        const resTopic = res.topicUrl || topicUrl;

        if (!magnet && resTopic) {
          try {
            const extracted = await tamilMvService.extractMagnetFromTopic(resTopic, res.resolution);
            if (extracted.magnetUrl) {
              magnet = extracted.magnetUrl;
              res.magnetUrl = extracted.magnetUrl;
            }
          } catch {}
        }

        if (magnet) {
          // Extract 40-character hex or 32-character base32 infoHash from magnet link
          const hashMatch = magnet.match(/urn:btih:([a-fA-F0-9]{40}|[a-zA-Z2-7]{32})/i);
          const infoHash = hashMatch ? hashMatch[1].toLowerCase() : null;
          const baseUrl = (backendUrl || '').replace(/\/+$/, '');

          if (infoHash) {
            // Pre-warm the torrent in backend engine so it immediately connects to peers
            fetch(`${baseUrl}/api/stream/warmup?magnet=${encodeURIComponent(magnet)}`).catch(() => {});

            // Direct stream URL in format: http://localhost:3002/api/stream/<infoHash>
            const streamUrl = `${baseUrl}/api/stream/${infoHash}`;
            Linking.openURL(streamUrl).catch((err) => {
              Alert.alert('Browser Error', 'Could not open browser for streaming: ' + err.message);
            });
          } else {
            const streamUrl = `${baseUrl}/api/stream/play?magnet=${encodeURIComponent(magnet)}`;
            Linking.openURL(streamUrl).catch((err) => {
              Alert.alert('Browser Error', 'Could not open browser for streaming: ' + err.message);
            });
          }
        } else if (resTopic) {
          Linking.openURL(resTopic);
        } else {
          Alert.alert('Notice', 'Stream link unavailable.');
        }
      },
      [topicUrl, backendUrl]
    );

    const handleOpenBitTorrentApp = useCallback(
      async (res: MovieResolutionItem) => {
        let magnet = res.magnetUrl;
        const resTopic = res.topicUrl || topicUrl;

        if (!magnet && resTopic) {
          try {
            const extracted = await tamilMvService.extractMagnetFromTopic(resTopic, res.resolution);
            if (extracted.magnetUrl) {
              magnet = extracted.magnetUrl;
              res.magnetUrl = extracted.magnetUrl;
            }
          } catch {}
        }

        if (magnet) {
          try {
            const canOpen = await Linking.canOpenURL(magnet).catch(() => false);
            if (canOpen) {
              await Linking.openURL(magnet);
            } else {
              await Linking.openURL(magnet);
            }
          } catch {
            Alert.alert(
              'BitTorrent App Required',
              `Could not launch an external BitTorrent app on this device for ${res.resolution}.\n\nPlease install a client like Flud, µTorrent, or LibreTorrent, or copy the magnet link to your clipboard.`,
              [
                {
                  text: 'Copy Magnet',
                  onPress: async () => {
                    await Clipboard.setStringAsync(magnet!);
                    Alert.alert('Copied', 'Magnet URL copied to clipboard!');
                  },
                },
                {
                  text: 'Get Flud App',
                  onPress: () => {
                    Linking.openURL('market://details?id=com.delphicoder.flud').catch(() => {
                      Linking.openURL('https://play.google.com/store/apps/details?id=com.delphicoder.flud');
                    });
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }
        } else {
          Alert.alert('Notice', 'Magnet link unavailable for BitTorrent app.');
        }
      },
      [topicUrl]
    );

    const HERO_HEIGHT = Math.round(screenWidth * 1.18);

    if (!visible || !movie) return null;

    return (
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={styles.dsContainer}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* ── 1. Hero Poster Image View ── */}
            <View style={[styles.dsHeroHeader, { height: HERO_HEIGHT }]}>
              {/* Background poster */}
              {effectivePoster ? (
                <Image
                  source={{ uri: effectivePoster }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  onError={() => setPosterUrl(null)}
                />
              ) : posterLoading || dbLoading ? (
                <LinearGradient colors={['#181920', '#252834', '#181920']} style={StyleSheet.absoluteFill} />
              ) : (
                <LinearGradient colors={[Colors.primary, '#660814']} style={StyleSheet.absoluteFill} />
              )}

              {/* Dark gradient fade into background */}
              <LinearGradient
                colors={['rgba(9,9,12,0.35)', 'transparent', 'rgba(9,9,12,0.85)', '#09090C']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              />

              {/* Bookmark button in header */}
              <TouchableOpacity
                style={[styles.dsHeaderBookmarkBtn, { top: insets.top + 10 }]}
                onPress={onToggleSave}
                activeOpacity={0.8}
              >
                <Bookmark
                  color={isSaved ? Colors.primary : '#FFFFFF'}
                  size={19}
                  fill={isSaved ? Colors.primary : 'transparent'}
                />
              </TouchableOpacity>

              {/* Close button in header */}
              <TouchableOpacity
                style={[styles.dsCloseBtn, { top: insets.top + 10 }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <X color="#FFFFFF" size={20} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* ── 2. All Buttons & Controls Body (AFTER Image View) ── */}
            <View style={styles.dsHeroContent}>
              {/* Title */}
              <Text style={styles.dsHeroTitle} numberOfLines={3}>{displayTitle}</Text>

              {dbMetadata?.tagline ? (
                <Text style={styles.dsTaglineText}>"{dbMetadata.tagline}"</Text>
              ) : null}

              {/* Meta badges row */}
              <View style={styles.dsBadgeRow}>
                {dbMetadata ? (
                  <Text style={styles.dsMatchText}>{dbMetadata.matchScore}% Match</Text>
                ) : null}

                {dbMetadata?.rating ? (
                  <View style={styles.dsRatingBadge}>
                    <Star color="#FFD700" size={11} fill="#FFD700" />
                    <Text style={styles.dsRatingText}>{dbMetadata.rating.toFixed(1)}</Text>
                  </View>
                ) : null}

                <View style={styles.dsMetaBadge}>
                  <Text style={styles.dsMetaBadgeText}>{dbMetadata?.year || movie.year}</Text>
                </View>

                {dbMetadata?.contentRating ? (
                  <View style={styles.dsMetaBadge}>
                    <Text style={styles.dsMetaBadgeText}>{dbMetadata.contentRating}</Text>
                  </View>
                ) : null}

                {dbMetadata?.runtime ? (
                  <View style={styles.dsMetaBadge}>
                    <Text style={styles.dsMetaBadgeText}>{dbMetadata.runtime}</Text>
                  </View>
                ) : null}

                {movie.language ? (
                  <View style={[styles.dsMetaBadge, { borderColor: 'rgba(250,36,60,0.4)', backgroundColor: 'rgba(250,36,60,0.12)' }]}>
                    <Text style={[styles.dsMetaBadgeText, { color: Colors.primary }]}>
                      {movie.language.toUpperCase()}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.dsMetaBadge}>
                  <Text style={styles.dsMetaBadgeText}>
                    {resolutions.length} {resolutions.length === 1 ? 'Quality' : 'Qualities'}
                  </Text>
                </View>
              </View>

              {/* Primary CTA Buttons — Play and Download */}
              <View style={styles.dsCtaRow}>
                {/* Play button */}
                <TouchableOpacity
                  style={styles.dsPlayBtn}
                  activeOpacity={0.85}
                  onPress={() => setQualityModalMode('play')}
                >
                  <LinearGradient
                    colors={[Colors.primary, '#B51527']}
                    style={styles.dsPlayGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {streamingResId ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Play color="#FFFFFF" size={19} fill="#FFFFFF" />
                    )}
                    <Text style={styles.dsPlayBtnText}>Play</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Download button */}
                <TouchableOpacity
                  style={styles.dsDownloadBtn}
                  activeOpacity={0.85}
                  onPress={() => setQualityModalMode('download')}
                >
                  <Download color="#FFFFFF" size={19} strokeWidth={2.2} />
                  <Text style={styles.dsDownloadBtnText}>Download</Text>
                </TouchableOpacity>
              </View>

              {/* Secondary Action: My List toggle */}
              <TouchableOpacity
                style={[styles.dsMyListBtn, isSaved && styles.dsMyListBtnActive]}
                activeOpacity={0.8}
                onPress={onToggleSave}
              >
                {isSaved ? (
                  <BookmarkCheck color={Colors.primary} size={17} fill={Colors.primary} />
                ) : (
                  <Bookmark color="#FFFFFF" size={17} />
                )}
                <Text style={[styles.dsMyListBtnText, isSaved && { color: Colors.primary }]}>
                  {isSaved ? 'In My List' : 'Add to My List'}
                </Text>
              </TouchableOpacity>

              {/* Quick Actions: Copy Magnet, Movie Page, Copy Play URL, Copy Download URL */}
              <View style={styles.dsQuickActionsRow}>
                <TouchableOpacity
                  style={styles.dsQuickActionBtn}
                  activeOpacity={0.8}
                  onPress={() => handleQuickCopyMagnet()}
                >
                  {copyingMagnet ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Copy color="#FFFFFF" size={14} />
                  )}
                  <Text style={styles.dsQuickActionBtnText}>Copy Magnet</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dsQuickActionBtn}
                  activeOpacity={0.8}
                  onPress={handleQuickOpenBrowser}
                >
                  <Globe color="#FFFFFF" size={14} />
                  <Text style={styles.dsQuickActionBtnText}>Movie Page</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.dsQuickActionsRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={styles.dsQuickActionBtn}
                  activeOpacity={0.8}
                  onPress={() => handleQuickCopyStreamUrl()}
                >
                  <PlayCircle color="#FFFFFF" size={14} />
                  <Text style={styles.dsQuickActionBtnText}>Copy Play URL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dsQuickActionBtn}
                  activeOpacity={0.8}
                  onPress={() => handleQuickCopyDownloadUrl()}
                >
                  <DownloadCloud color="#FFFFFF" size={14} />
                  <Text style={styles.dsQuickActionBtnText}>Copy Download URL</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Movie Info Section ── */}
            <View style={styles.dsInfoSection}>
              {/* Real Movie Database Synopsis / Overview */}
              {dbMetadata?.synopsis ? (
                <View style={styles.dsSectionBlock}>
                  <View style={styles.dsDbHeaderRow}>
                    <Sparkles color="#FFD700" size={14} strokeWidth={2.5} />
                    <Text style={styles.dsDbHeaderText}>
                      Movie Database Overview ({dbMetadata.source.toUpperCase()})
                    </Text>
                  </View>
                  <Text style={styles.dsSynopsisText}>{dbMetadata.synopsis}</Text>

                  {dbMetadata.director || (dbMetadata.cast && dbMetadata.cast.length > 0) ? (
                    <View style={{ marginTop: 10, gap: 4 }}>
                      {dbMetadata.director ? (
                        <Text style={styles.dsMetaLineText}>
                          <Text style={styles.dsMetaLabel}>Director: </Text>
                          <Text style={styles.dsMetaValue}>{dbMetadata.director}</Text>
                        </Text>
                      ) : null}
                      {dbMetadata.cast && dbMetadata.cast.length > 0 ? (
                        <Text style={styles.dsMetaLineText}>
                          <Text style={styles.dsMetaLabel}>Starring: </Text>
                          <Text style={styles.dsMetaValue}>{dbMetadata.cast.join(', ')}</Text>
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {dbMetadata.genres && dbMetadata.genres.length > 0 ? (
                    <View style={styles.dsGenresRow}>
                      {dbMetadata.genres.map((genre) => (
                        <View key={genre} style={styles.dsGenreChip}>
                          <Text style={styles.dsGenreText}>{genre}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : dbLoading ? (
                <View style={styles.dsSectionBlock}>
                  <ActivityIndicator size="small" color={Colors.netflixRed} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
                </View>
              ) : null}

              {/* Release Rip Title */}
              {selectedRes?.rawTitle ? (
                <View style={styles.dsSectionBlock}>
                  <Text style={styles.dsSectionTitle}>Rip / Release Name</Text>
                  <View style={styles.dsRawTitleCard}>
                    <Film color="#8E8E93" size={14} strokeWidth={1.8} />
                    <Text style={styles.dsRawTitleText} numberOfLines={3}>
                      {selectedRes.rawTitle}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Streaming info */}
              <View style={styles.dsStreamingInfo}>
                <View style={styles.dsStreamingDot} />
                <Text style={styles.dsStreamingText}>Streaming via VFlix Engine • Direct P2P</Text>
              </View>
            </View>
          </ScrollView>

          {/* Quality & File Size Selection Popup for Play / Download */}
          <Modal
            visible={qualityModalMode !== null}
            transparent
            animationType="slide"
            onRequestClose={() => setQualityModalMode(null)}
          >
            <View style={styles.qmOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => setQualityModalMode(null)}
              />

              <View style={[styles.qmSheet, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
                {/* Handle */}
                <View style={styles.qmHandle} />

                {/* Header */}
                <View style={styles.qmHeader}>
                  <View style={styles.qmHeaderLeft}>
                    <View
                      style={[
                        styles.qmIconBadge,
                        qualityModalMode === 'play'
                          ? { backgroundColor: 'rgba(250, 36, 60, 0.15)' }
                          : { backgroundColor: 'rgba(52, 199, 89, 0.15)' },
                      ]}
                    >
                      {qualityModalMode === 'play' ? (
                        playDestination === 'internal' ? (
                          <Play color={Colors.primary} size={18} fill={Colors.primary} />
                        ) : (
                          <Globe color={Colors.primary} size={18} />
                        )
                      ) : downloadDestination === 'internal' ? (
                        <Download color="#30D158" size={18} strokeWidth={2.2} />
                      ) : (
                        <ExternalLink color="#30D158" size={18} strokeWidth={2.2} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.qmTitle}>
                        {qualityModalMode === 'play'
                          ? playDestination === 'internal'
                            ? 'Select Playback Quality'
                            : 'Watch in Web Browser'
                          : downloadDestination === 'internal'
                          ? 'Select Download Quality'
                          : 'Open in BitTorrent App'}
                      </Text>
                      <Text style={styles.qmSubtitle} numberOfLines={1}>
                        {qualityModalMode === 'play'
                          ? playDestination === 'internal'
                            ? `In-App VFlix Player • ${resolutions.length} ${resolutions.length === 1 ? 'quality' : 'qualities'}`
                            : `Instant browser stream • ${resolutions.length} ${resolutions.length === 1 ? 'quality' : 'qualities'}`
                          : downloadDestination === 'internal'
                          ? `Internal storage • ${resolutions.length} ${resolutions.length === 1 ? 'quality' : 'qualities'}`
                          : `Redirect to external torrent app • ${resolutions.length} ${resolutions.length === 1 ? 'quality' : 'qualities'}`}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.qmCloseBtn}
                    onPress={() => setQualityModalMode(null)}
                    activeOpacity={0.7}
                  >
                    <X color="#8E8E93" size={18} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>

                {/* Destination Selector Tabs */}
                <View style={styles.qmDestinationSelector}>
                  {qualityModalMode === 'play' ? (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.qmDestinationTab,
                          playDestination === 'internal' && styles.qmDestinationTabActivePlay,
                        ]}
                        onPress={() => setPlayDestination('internal')}
                        activeOpacity={0.8}
                      >
                        <Play
                          color={playDestination === 'internal' ? '#FFFFFF' : '#8E8E93'}
                          size={13}
                          fill={playDestination === 'internal' ? '#FFFFFF' : 'none'}
                        />
                        <Text
                          style={[
                            styles.qmDestinationTabText,
                            playDestination === 'internal' && styles.qmDestinationTabTextActive,
                          ]}
                        >
                          Internal Player
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.qmDestinationTab,
                          playDestination === 'browser' && styles.qmDestinationTabActivePlay,
                        ]}
                        onPress={() => setPlayDestination('browser')}
                        activeOpacity={0.8}
                      >
                        <Globe
                          color={playDestination === 'browser' ? '#FFFFFF' : '#8E8E93'}
                          size={13}
                        />
                        <Text
                          style={[
                            styles.qmDestinationTabText,
                            playDestination === 'browser' && styles.qmDestinationTabTextActive,
                          ]}
                        >
                          Watch in Browser
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.qmDestinationTab,
                          downloadDestination === 'internal' && styles.qmDestinationTabActiveDownload,
                        ]}
                        onPress={() => setDownloadDestination('internal')}
                        activeOpacity={0.8}
                      >
                        <Download
                          color={downloadDestination === 'internal' ? '#FFFFFF' : '#8E8E93'}
                          size={13}
                        />
                        <Text
                          style={[
                            styles.qmDestinationTabText,
                            downloadDestination === 'internal' && styles.qmDestinationTabTextActive,
                          ]}
                        >
                          In-App Download
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.qmDestinationTab,
                          downloadDestination === 'torrent_app' && styles.qmDestinationTabActiveDownload,
                        ]}
                        onPress={() => setDownloadDestination('torrent_app')}
                        activeOpacity={0.8}
                      >
                        <ExternalLink
                          color={downloadDestination === 'torrent_app' ? '#FFFFFF' : '#8E8E93'}
                          size={13}
                        />
                        <Text
                          style={[
                            styles.qmDestinationTabText,
                            downloadDestination === 'torrent_app' && styles.qmDestinationTabTextActive,
                          ]}
                        >
                          BitTorrent App
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Quality Options */}
                {resolutionsLoading && resolutions.length === 0 ? (
                  <View style={styles.qmLoadingContainer}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                    <Text style={styles.qmLoadingText}>Fetching qualities & sizes...</Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.qmScroll}
                    contentContainerStyle={styles.qmScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {resolutions.map((res, idx) => {
                      const qb = getQualityBadgeConfig(res.resolution);
                      const isThisStreaming = streamingResId === res.id;

                      return (
                        <TouchableOpacity
                          key={res.id || `qm-res-${idx}`}
                          style={styles.qmOptionCard}
                          onPress={() => {
                            const mode = qualityModalMode;
                            setQualityModalMode(null);
                            setSelectedResIndex(idx);
                            if (mode === 'play') {
                              if (playDestination === 'browser') {
                                handleStreamInBrowser(res);
                              } else {
                                onStream(res, movie);
                              }
                            } else if (mode === 'download') {
                              if (downloadDestination === 'torrent_app') {
                                handleOpenBitTorrentApp(res);
                              } else {
                                onMovieDownload(res, movie);
                              }
                            }
                          }}
                          activeOpacity={0.75}
                        >
                          {/* Quality Badge & Details */}
                          <View style={styles.qmCardLeft}>
                            <View style={[styles.qmQualityBadge, { backgroundColor: qb.bg, borderColor: qb.border }]}>
                              <Text style={[styles.qmQualityBadgeText, { color: qb.text }]}>
                                {res.resolution}
                              </Text>
                            </View>
                            {(res.codec || res.audio || (res.rawTitle && res.rawTitle !== res.resolution)) ? (
                              <Text style={styles.qmCardMeta} numberOfLines={1}>
                                {[res.codec, res.audio].filter(Boolean).join(' • ') || res.rawTitle}
                              </Text>
                            ) : null}
                          </View>

                          {/* Right: File Size & Action Icon */}
                          <View style={styles.qmCardRight}>
                            <View style={styles.qmSizeBadge}>
                              <HardDrive color="#30D158" size={12.5} strokeWidth={2.4} />
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
                              {isThisStreaming ? (
                                <ActivityIndicator size="small" color={Colors.primary} />
                              ) : qualityModalMode === 'play' ? (
                                playDestination === 'internal' ? (
                                  <Play color={Colors.primary} size={13} fill={Colors.primary} />
                                ) : (
                                  <Globe color={Colors.primary} size={13} />
                                )
                              ) : downloadDestination === 'internal' ? (
                                <Download color="#30D158" size={13} strokeWidth={2.2} />
                              ) : (
                                <ExternalLink color="#30D158" size={13} strokeWidth={2.2} />
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </Modal>
    );
  }
);


export const MovieFinderScreen: React.FC<MovieFinderScreenProps> = ({ onNavigateToTab, onOpenInBrowserTab }) => {
  const insets = useSafeAreaInsets();
  const { downloads, isBackendConnected, startDownload, backendUrl, testPing } = useDownloads();

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

  const isHomeFeed = !searchedQuery || /^recent/i.test(searchedQuery);

  // Multi-Language Filter State (default: ['All'])
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['All']);

  const handleToggleLanguage = useCallback((lang: string) => {
    if (lang === 'All') {
      setSelectedLanguages(['All']);
      return;
    }

    setSelectedLanguages((prev) => {
      const withoutAll = prev.filter((l) => l !== 'All');
      if (withoutAll.includes(lang)) {
        const next = withoutAll.filter((l) => l !== lang);
        return next.length === 0 ? ['All'] : next;
      } else {
        return [...withoutAll, lang];
      }
    });
  }, []);

  const isLangActive = useCallback(
    (lang: string) => {
      if (lang === 'All') return selectedLanguages.includes('All') || selectedLanguages.length === 0;
      return selectedLanguages.includes(lang);
    },
    [selectedLanguages]
  );

  const filteredResults = useMemo(() => {
    if (selectedLanguages.length === 0 || selectedLanguages.includes('All')) {
      return results;
    }

    return results.filter((m) => {
      const movieLang = (m.language || '').toLowerCase().trim();
      const titleAndRaw = `${m.movieTitle} ${m.resolutions?.[0]?.rawTitle || ''} ${m.topicUrl || ''}`.toLowerCase();

      return selectedLanguages.some((lang) => {
        const l = lang.toLowerCase();
        if (movieLang === l) return true;
        const regex = new RegExp(`\\b${l}\\b`, 'i');
        return regex.test(titleAndRaw);
      });
    });
  }, [results, selectedLanguages]);

  const completedDownloads = useMemo(() => {
    return downloads.filter((d) => d.status === 'completed');
  }, [downloads]);

  const featuredMovies = useMemo(() => {
    if (!isHomeFeed || filteredResults.length === 0) return [];
    return filteredResults.slice(0, Math.min(4, filteredResults.length));
  }, [filteredResults, isHomeFeed]);

  const topReleases = useMemo(() => {
    if (!isHomeFeed || filteredResults.length === 0) return [];
    const pool = featuredMovies.length > 0 ? filteredResults.slice(featuredMovies.length) : filteredResults;
    const count = pool.length > 10 ? 8 : Math.min(pool.length, 5);
    return pool.slice(0, count);
  }, [filteredResults, isHomeFeed, featuredMovies]);

  const recentlyAdded = useMemo(() => {
    if (!isHomeFeed) return filteredResults;
    const startIdx = featuredMovies.length > 0 ? featuredMovies.length + topReleases.length : topReleases.length;
    const remaining = filteredResults.slice(startIdx);
    return remaining.length > 0
      ? remaining
      : (featuredMovies.length > 0 ? filteredResults.slice(featuredMovies.length) : filteredResults);
  }, [filteredResults, topReleases, featuredMovies, isHomeFeed]);

  const visibleRecentlyAdded = useMemo(() => {
    return recentlyAdded.slice(0, displayedCount);
  }, [recentlyAdded, displayedCount]);

  const handleLoadMore = useCallback(() => {
    if (displayedCount < recentlyAdded.length) {
      setDisplayedCount((prev) => Math.min(prev + BATCH_LOAD_STEP, recentlyAdded.length));
    }
  }, [displayedCount, recentlyAdded.length]);

  // Scroll-Hide Animated Header State & Logic
  const headerAnim = useRef(new Animated.Value(0)).current;
  const isHeaderVisible = useRef(true);
  const lastOffsetY = useRef(0);

  const handleScroll = useCallback((event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(offsetY > 350);

    const diff = offsetY - lastOffsetY.current;

    if (offsetY <= 20) {
      if (!isHeaderVisible.current) {
        isHeaderVisible.current = true;
        Animated.timing(headerAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    } else if (diff > 10 && offsetY > 60) {
      if (isHeaderVisible.current) {
        isHeaderVisible.current = false;
        Animated.timing(headerAnim, {
          toValue: -140,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    } else if (diff < -10) {
      if (!isHeaderVisible.current) {
        isHeaderVisible.current = true;
        Animated.timing(headerAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }

    lastOffsetY.current = offsetY;
  }, [headerAnim]);

  const handleScrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    if (!isHeaderVisible.current) {
      isHeaderVisible.current = true;
      Animated.timing(headerAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [headerAnim]);

  // In-App Video Streaming Player State
  const [streamPlayerVisible, setStreamPlayerVisible] = useState(false);
  const [activeStreamItem, setActiveStreamItem] = useState<DownloadItem | null>(null);
  const [streamPlayerInitialPos, setStreamPlayerInitialPos] = useState<number>(0);
  const [streamPlayerPosterUrl, setStreamPlayerPosterUrl] = useState<string | undefined>(undefined);
  const [streamingResId, setStreamingResId] = useState<string | null>(null);
  const [streamModalVisible, setStreamModalVisible] = useState(false);
  const [streamModalData, setStreamModalData] = useState<StreamModalData | null>(null);

  // Continue Watching & My List State
  const [continueWatchingList, setContinueWatchingList] = useState<ContinueWatchingItem[]>([]);
  const [savedMovieIds, setSavedMovieIds] = useState<Set<string>>(new Set());

  // Subscribe to Continue Watching and My List store changes
  useEffect(() => {
    const unsubCW = continueWatchingService.subscribe((items) => {
      setContinueWatchingList(items);
    });

    const unsubMyList = myListService.subscribe((items) => {
      const set = new Set<string>();
      items.forEach((item) => {
        if (item.id) set.add(item.id.toLowerCase());
        if (item.topicUrl) set.add(item.topicUrl.toLowerCase());
        if (item.movieTitle) set.add(item.movieTitle.toLowerCase());
      });
      setSavedMovieIds(set);
    });

    return () => {
      unsubCW();
      unsubMyList();
    };
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

  const handleResumeContinueWatching = useCallback((cwItem: ContinueWatchingItem) => {
    const resumeDownloadItem: DownloadItem = {
      id: cwItem.id,
      title: cwItem.movieTitle,
      fileName: `${cwItem.movieTitle}.mp4`,
      fileUri: cwItem.fileUri || '',
      url: cwItem.streamUrl || '',
      status: 'completed',
      progress: cwItem.progress,
      totalBytes: 0,
      downloadedBytes: 0,
      speed: 'VFlix Resume',
      isTorrent: false,
      createdAt: Date.now(),
    };

    setActiveStreamItem(resumeDownloadItem);
    setStreamPlayerInitialPos(cwItem.currentTime);
    setStreamPlayerPosterUrl(cwItem.posterUrl || undefined);
    setStreamPlayerVisible(true);
  }, []);

  // Netflix Detail Modal State
  const [detailMovie, setDetailMovie] = useState<TamilMvMovieResult | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Configurable Mirror URL State
  const [currentBaseUrl, setCurrentBaseUrl] = useState(tamilMvService.getBaseUrl());
  const [urlModalVisible, setUrlModalVisible] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(currentBaseUrl);

  const handleClearSearchRef = useRef<() => void>(() => {});

  // Hardware Back Button handler for Modals & Search Mode
  useEffect(() => {
    if (!streamModalVisible && !detailVisible && !urlModalVisible && isHomeFeed) return;

    const onBackPress = () => {
      if (streamModalVisible) {
        setStreamModalVisible(false);
        return true;
      }
      if (detailVisible) {
        setDetailVisible(false);
        return true;
      }
      if (urlModalVisible) {
        setUrlModalVisible(false);
        return true;
      }
      if (!isHomeFeed) {
        handleClearSearchRef.current();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [streamModalVisible, detailVisible, urlModalVisible, isHomeFeed]);

  // Scraper WebView State
  const [webViewSearchUrl, setWebViewSearchUrl] = useState('');
  const webViewRef = useRef<WebView>(null);
  const searchTimeoutRef = useRef<any>(null);
  const activeSearchTermRef = useRef(globalCachedFinderState.searchedQuery || 'Recent Upload');

  // Poster WebView Queue & Direct HTTP Fetch — extracts poster images with fast direct fetch & WebView fallback
  const [posterWebViewUrl, setPosterWebViewUrl] = useState('');
  const posterQueueRef = useRef<string[]>([]);
  const posterProcessingRef = useRef(false);
  const posterTimeoutRef = useRef<any>(null);
  const activeFetchesRef = useRef<Set<string>>(new Set());
  // Callback registry: topicUrl → resolve function so MovieCardItem can be notified
  const posterCallbacksRef = useRef<Map<string, (url: string | null) => void>>(new Map());

  const processPosterQueue = useCallback(() => {
    if (posterProcessingRef.current) return;
    if (posterQueueRef.current.length === 0) {
      setPosterWebViewUrl('');
      return;
    }
    const nextUrl = posterQueueRef.current[0];
    posterProcessingRef.current = true;
    setPosterWebViewUrl(nextUrl);

    // Watchdog timeout: if headless WebView gets stuck, advance to prevent blocking
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

      // Chain callbacks if already waiting for this URL
      const existing = posterCallbacksRef.current.get(topicUrl);
      posterCallbacksRef.current.set(topicUrl, (url) => {
        if (existing) existing(url);
        callback(url);
      });

      if (activeFetchesRef.current.has(topicUrl)) return;
      activeFetchesRef.current.add(topicUrl);

      // Fast direct HTTP fetch first (~200ms)
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
            // Direct fetch didn't find an image, try headless WebView fallback
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

  // Restore persisted state from storage on first mount or auto-fetch Recent Upload
  useEffect(() => {
    if (globalCachedFinderState.results.length > 0) {
      const isHome = !globalCachedFinderState.searchedQuery || /^recent/i.test(globalCachedFinderState.searchedQuery);
      if (isHome) {
        const sanitizedMem = globalCachedFinderState.results.map((r) => ({
          ...r,
          movieTitle: sanitizeMovieTitle(r.movieTitle),
        }));
        setQuery(globalCachedFinderState.query);
        setSearchedQuery(globalCachedFinderState.searchedQuery);
        setResults(sanitizedMem);
        setHasSearched(globalCachedFinderState.hasSearched);
        return;
      }
    }

    if (FINDER_CACHE_FILE) {
      FileSystem.readAsStringAsync(FINDER_CACHE_FILE)
        .then((content) => {
          try {
            const parsed = JSON.parse(content);
            const isCachedHomeFeed = !parsed.searchedQuery || /^recent/i.test(parsed.searchedQuery);
            if (isCachedHomeFeed && parsed && Array.isArray(parsed.results) && parsed.results.length > 0) {
              const sanitizedDisk = parsed.results.map((r: TamilMvMovieResult) => ({
                ...r,
                movieTitle: sanitizeMovieTitle(r.movieTitle),
              }));
              setQuery(parsed.query || '');
              setSearchedQuery(parsed.searchedQuery || 'Recent Upload');
              setResults(sanitizedDisk);
              setHasSearched(Boolean(parsed.hasSearched));
              setDisplayedCount(INITIAL_BATCH_SIZE);
              globalCachedFinderState = {
                query: parsed.query || '',
                searchedQuery: parsed.searchedQuery || 'Recent Upload',
                results: sanitizedDisk,
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
    const cleanedResults = newResults.map((r) => ({
      ...r,
      movieTitle: sanitizeMovieTitle(r.movieTitle),
    }));
    setResults(cleanedResults);
    setSearchedQuery(newSearchedQuery);
    setHasSearched(newHasSearched);
    setDisplayedCount(INITIAL_BATCH_SIZE);
    setIsRefreshing(false);
    if (newQuery !== undefined) setQuery(newQuery);

    const newState = {
      query: newQuery !== undefined ? newQuery : query,
      searchedQuery: newSearchedQuery,
      results: cleanedResults,
      hasSearched: newHasSearched,
    };
    globalCachedFinderState = newState;

    if (FINDER_CACHE_FILE) {
      // Only persist home feed to disk so reopening app always lands on normal mode
      const isHome = !newSearchedQuery || /^recent/i.test(newSearchedQuery);
      if (isHome) {
        FileSystem.writeAsStringAsync(FINDER_CACHE_FILE, JSON.stringify(newState)).catch(() => {});
      }
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

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
    },
    [query, currentBaseUrl]
  );

  const handleClearSearch = useCallback(async () => {
    setQuery('');
    setSearchedQuery('');
    setHasSearched(false);
    activeSearchTermRef.current = 'Recent Upload';
    globalCachedFinderState = {
      query: '',
      searchedQuery: '',
      results: [],
      hasSearched: false,
    };
    await handlePerformSearch('Recent Upload');
  }, [handlePerformSearch]);

  useEffect(() => {
    handleClearSearchRef.current = handleClearSearch;
  }, [handleClearSearch]);

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

  const handlePosterWebViewMessage = useCallback((event: any) => {
    try {
      if (posterTimeoutRef.current) clearTimeout(posterTimeoutRef.current);
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'POSTER_RESULT') {
        const { topicUrl, posterUrl: url } = payload;
        const result: string | null = url || null;
        // Store in global cache
        posterCache.set(topicUrl, result);
        // Fire the waiting callback so MovieCardItem re-renders
        const cb = posterCallbacksRef.current.get(topicUrl);
        if (cb) {
          cb(result);
          posterCallbacksRef.current.delete(topicUrl);
        }
        // Advance queue
        posterQueueRef.current = posterQueueRef.current.filter((u) => u !== topicUrl);
        posterProcessingRef.current = false;
        // Process next in queue
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
      // Advance queue on error so we don't get stuck
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

        Alert.alert('Download Started 📥', `"${title}" has been added to In-App Downloads and is saving to internal storage.`, [
          { text: 'View Downloads', onPress: () => onNavigateToTab?.('downloads') },
          { text: 'OK', style: 'cancel' },
        ]);
      } catch (err: any) {
        Alert.alert('Download Error', err?.message || 'Failed to start movie download');
      }
    },
    [startDownload, onNavigateToTab, posterCache]
  );

  // 2. Torrent Option (Save / Queue to Torrent Engine)
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
          `Queue this torrent to background engine or open in external torrent app?`,
          [
            {
              text: 'Queue in App',
              onPress: async () => {
                try {
                  const title = `${movie.movieTitle} (${resItem.resolution})`;
                  const poster = posterCache.get(movie.topicUrl) || posterCache.get(movie.id) || undefined;
                  await startDownload(magnet, title, poster);
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
        // Fast backend server reachability pre-check
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
            `Unable to connect to the streaming server.\n\nServer: ${backendUrl}\n\nPlease check if your streaming server is running or configure the server URL in Settings.`,
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
          } else if (extracted.torrentUrl) {
            magnet = extracted.torrentUrl;
            resItem.magnetUrl = extracted.torrentUrl;
          }
        }

        if (!magnet && movie.movieTitle) {
          try {
            const searchResults = await tamilMvService.searchMovie(movie.movieTitle);
            if (searchResults && searchResults.length > 0) {
              const matchedMovie = searchResults.find(
                (m: TamilMvMovieResult) => m.movieTitle.toLowerCase() === movie.movieTitle.toLowerCase()
              ) || searchResults[0];
              const matchedRes = matchedMovie.resolutions.find(
                (r: MovieResolutionItem) => r.resolution === resItem.resolution
              ) || matchedMovie.resolutions[0];
              if (matchedRes && (matchedRes.magnetUrl || matchedRes.torrentFileUrl)) {
                magnet = matchedRes.magnetUrl || matchedRes.torrentFileUrl;
                resItem.magnetUrl = magnet;
              }
            }
          } catch (searchErr) {
            console.warn('Fallback magnet search failed:', searchErr);
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

          const topic = movie.topicUrl || resItem.topicUrl || '';
          const poster = (topic && posterCache.get(topic)) || null;
          setStreamPlayerPosterUrl(poster || undefined);
          setStreamPlayerInitialPos(0);
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
    [backendUrl, testPing, onNavigateToTab]
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

    const topic = data.movie.topicUrl || data.resItem.topicUrl || '';
    const poster = (topic && posterCache.get(topic)) || null;
    setStreamPlayerPosterUrl(poster || undefined);
    setStreamPlayerInitialPos(0);
    setActiveStreamItem(streamDownloadItem);
    setStreamPlayerVisible(true);
  }, []);

  const handleOpenExternalPlayer = useCallback(
    async (resItem: MovieResolutionItem, movie: TamilMvMovieResult) => {
      let magnet = resItem.magnetUrl;
      if (!magnet && resItem.topicUrl) {
        const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl, resItem.resolution);
        if (extracted.magnetUrl) {
          magnet = extracted.magnetUrl;
          resItem.magnetUrl = extracted.magnetUrl;
        }
      }
      if (magnet) {
        const streamUrl = `${backendUrl}/api/stream/play?magnet=${encodeURIComponent(magnet)}`;
        const target = streamUrl || magnet;
        Linking.openURL(`vlc://${target}`).catch(() => {
          Linking.openURL(target).catch(() => {
            Alert.alert(
              'External Player',
              'VLC for Android or compatible media player is recommended for playback.'
            );
          });
        });
      } else {
        Alert.alert('Notice', 'Direct magnet link unavailable for external playback.');
      }
    },
    [backendUrl]
  );

  // 4. Copy Magnet / Link
  const handleCopyMagnet = useCallback(async (resItem: MovieResolutionItem) => {
    let link = resItem.magnetUrl || resItem.torrentFileUrl;
    if (!link && resItem.topicUrl) {
      const extracted = await tamilMvService.extractMagnetFromTopic(resItem.topicUrl, resItem.resolution);
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
        await Clipboard.setStringAsync(link);
        Alert.alert('Magnet Copied! 📋', 'Magnet URL copied to clipboard.');
      } catch {
        await Share.share({ message: link, title: 'Movie Magnet Link' });
      }
    } else {
      Alert.alert('Link', 'Direct magnet link available on the topic page.');
    }
  }, []);

  const renderMovieCard = useCallback(
    ({ item }: { item: TamilMvMovieResult }) => {
      const saved = isMovieSaved(item);
      return (
        <PosterGridCard
          item={item}
          isSaved={saved}
          onToggleSave={(p) => handleToggleSaveMovie(item, p)}
          enqueuePosterFetch={enqueuePosterFetch}
          onPress={() => {
            setDetailMovie(item);
            setDetailVisible(true);
          }}
        />
      );
    },
    [enqueuePosterFetch, isMovieSaved, handleToggleSaveMovie, setDetailMovie, setDetailVisible]
  );

  const keyExtractor = useCallback((item: TamilMvMovieResult) => item.id, []);

  // Lazy Load Footer Component
  const renderListFooter = useCallback(() => {
    if (recentlyAdded.length === 0) return null;

    if (displayedCount < recentlyAdded.length) {
      return (
        <View style={styles.lazyLoadFooter}>
          <ActivityIndicator size="small" color={Colors.netflixRed} />
          <Text style={styles.lazyLoadText}>
            Loading more movies ({visibleRecentlyAdded.length} / {recentlyAdded.length})...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.endOfListFooter}>
        <View style={styles.endOfListDivider} />
        <Text style={styles.endOfListText}>All {recentlyAdded.length} movies loaded</Text>
        <View style={styles.endOfListDivider} />
      </View>
    );
  }, [displayedCount, recentlyAdded.length, visibleRecentlyAdded.length]);

  const INJECTED_SCRAPER_JS = `
    (function() {
      function sendResults() {
        try {
          var topicMap = {};
          var links = document.querySelectorAll('a[href*="topic/"]');
          for (var i = 0; i < links.length; i++) {
            var a = links[i];
            var rawHref = a.href || '';
            var cleanText = function(str) {
              if (!str) return '';
              return str
                .replace(/<[^>]*>/g, '')
                .replace(/^(?:view\\s+(?:the\\s+)?topic|go\\s+to\\s+(?:the\\s+)?topic)[\\s:'"‘“\\-]*/i, '')
                .replace(/['"’”]+$/g, '')
                .replace(/^['"‘“]+/g, '')
                .trim();
            };

            var titleAttr = cleanText(a.getAttribute('title') || '');
            var innerText = cleanText(a.innerText || a.textContent || '');
            
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

  // Injected into each IPS forum topic page to extract the exact movie poster
  const POSTER_EXTRACTOR_JS = `
    (function() {
      var _sent = false;

      function sendResult(posterUrl) {
        if (_sent) return;
        _sent = true;
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'POSTER_RESULT',
            topicUrl: window.location.href,
            posterUrl: posterUrl || null
          }));
        }
      }

      function isGoodSrc(src) {
        if (!src || src.length < 8) return false;
        if (/data:image/i.test(src)) return false;
        if (/\\.(gif|svg|ico)(\\?|$)/i.test(src)) return false;
        // Exclude profile avatars, emoticons, forum UI images
        if (/(photo\\/member|profile_photo|avatars?\\/|emoticons?\\/|emoji\\/|smilies?\\/|ranks?\\/|badges?\\/|awards?\\/|reaction|monthly_202[0-9].*\\/profile|uploads\\/profile|torrborder|uTorrent|defaultPhoto|theme_images)/i.test(src)) return false;
        var isImgExt = /\\.(jpg|jpeg|png|webp)(\\?|$)/i.test(src) || /format=(jpg|jpeg|png|webp)/i.test(src);
        var isKnownHost = /(twimg\\.com|pixelbb\\.com|postimg|ibb\\.co|imgur|imghippo|imagebam|turboimagehost)/i.test(src);
        return isImgExt || isKnownHost;
      }

      function resolveUrl(src) {
        if (!src) return null;
        src = src.trim();
        if (src.startsWith('//')) return 'https:' + src;
        if (src.startsWith('/')) return window.location.origin + src;
        if (src.startsWith('http')) return src;
        return null;
      }

      function getBestPosterFromImgs(imgs) {
        var best = null;
        var bestScore = 0;

        for (var i = 0; i < imgs.length; i++) {
          var img = imgs[i];
          // Support lazy-loaded images via data-src, data-lazy-src, data-original
          var src = img.getAttribute('src') || 
                    img.getAttribute('data-src') || 
                    img.getAttribute('data-lazy-src') || 
                    img.getAttribute('data-original') || 
                    img.getAttribute('data-srcset') || '';

          // For srcset, extract the first URL
          if (!src && img.srcset) {
            src = img.srcset.split(',')[0].trim().split(' ')[0];
          }

          if (!isGoodSrc(src)) continue;

          var absUrl = resolveUrl(src);
          if (!absUrl) continue;

          // Score by natural dimensions (actual downloaded size beats rendered size)
          var w = img.naturalWidth || img.width || 0;
          var h = img.naturalHeight || img.height || 0;

          // Skip tiny images (icons, badges) — posters are always > 100×100
          if (w > 0 && h > 0 && (w < 80 || h < 80)) continue;

          var score = w * h;

          // Bonus: IPS forum post attachments, uploads paths, and known hosts are very likely the movie poster
          if (/(uploads\\/monthly|uploads\\/attach|filebase|content_images|postimg|ibb\\.co|imgur|imghippo|i\\.ibb|twimg\\.com|pixelbb\\.com)/i.test(absUrl)) {
            score += 500000;
          }

          if (score > bestScore || (!best && absUrl)) {
            bestScore = score;
            best = absUrl;
          }
        }
        return best;
      }

      function extractPoster() {
        try {
          // ── Step 1: IPS-specific first post content selectors (most precise) ──
          // IPS Community Suite uses these selectors for the first post body:
          var IPS_SELECTORS = [
            '.ipsComment:first-of-type [data-role="commentContent"]',
            '.ipsComment:first-of-type .ipsRichText',
            '.ipsComment:first-of-type .ipsType_richText',
            'article:first-of-type [data-role="commentContent"]',
            '[data-role="commentContent"]:first-of-type',
            '.cPost_contentWrap .ipsRichText',
            '.ipsRichText',
            '.ipsType_richText',
            '[data-role="commentContent"]',
          ];

          var postBody = null;
          for (var si = 0; si < IPS_SELECTORS.length; si++) {
            postBody = document.querySelector(IPS_SELECTORS[si]);
            if (postBody) break;
          }

          if (postBody) {
            var imgs = postBody.querySelectorAll('img');
            if (imgs.length > 0) {
              var poster = getBestPosterFromImgs(imgs);
              if (poster) { sendResult(poster); return; }
            }
          }

          // ── Step 2: og:image meta tag (IPS sets this to first post image) ──
          var ogMeta = document.querySelector('meta[property="og:image"], meta[name="og:image"]');
          if (ogMeta) {
            var ogContent = (ogMeta.getAttribute('content') || '').trim();
            if (isGoodSrc(ogContent)) {
              var abs = resolveUrl(ogContent);
              if (abs) { sendResult(abs); return; }
            }
          }

          // ── Step 3: Wider search — all imgs, pick the largest ──
          var allImgs = document.querySelectorAll('article img, .ipsPad img, main img, #ipsLayout_mainArea img');
          if (!allImgs.length) allImgs = document.querySelectorAll('img');
          var best = getBestPosterFromImgs(allImgs);
          sendResult(best);

        } catch(e) {
          sendResult(null);
        }
      }

      // Run at multiple intervals to handle lazy-loading and slow renders
      if (document.readyState === 'complete') {
        setTimeout(extractPoster, 300);
      } else {
        window.addEventListener('load', function() { setTimeout(extractPoster, 500); });
      }
      // Retry after images may have lazily loaded
      setTimeout(extractPoster, 1500);
      setTimeout(extractPoster, 4000);
    })();
    true;
  `;



  return (
    <View style={styles.container}>
      {/* 1. Premium VFlix Home Header (Overlaid at Top, Hides on Scroll) */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 6,
            transform: [{ translateY: headerAnim }],
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.headerBrandRow}
            activeOpacity={0.8}
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          >
            <Image
              source={require('../../assets/adaptive-icon.png')}
              style={styles.netflixVLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerSearchBtn}
            onPress={() => onNavigateToTab?.('search')}
            activeOpacity={0.75}
          >
            <Search color="#FFFFFF" size={18} strokeWidth={2.4} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mirrorChip}
            onPress={() => setUrlModalVisible(true)}
            activeOpacity={0.75}
          >
            <View style={styles.livePulseDot} />
            <Text style={styles.mirrorChipText} numberOfLines={1} ellipsizeMode="tail">
              {currentBaseUrl.replace(/^https?:\/\/(www\.)?/, '')}
            </Text>
            <ChevronDown color="#9E9EA7" size={12} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* 3. Main Body Content */}
      {loading ? (
        <View style={[styles.stateCenter, { paddingTop: insets.top + 60 }]}>
          <ActivityIndicator size="small" color={Colors.netflixRed} />
          <Text style={styles.loadingText}>Searching {currentBaseUrl.replace(/^https?:\/\/(www\.)?/, '')}...</Text>
        </View>
      ) : hasSearched && results.length === 0 ? (
        /* Clean Not Found State */
        <View style={[styles.stateCenter, { paddingTop: insets.top + 60 }]}>
          <AlertCircle color="#FF453A" size={44} strokeWidth={2.2} />
          <Text style={styles.notFoundTitle}>No Results Found</Text>
          <Text style={styles.notFoundSub}>
            No movies found for "{searchedQuery}". Try another title or return to home.
          </Text>
          <View style={styles.notFoundActionsRow}>
            <TouchableOpacity
              style={styles.backHomeBtnPrimary}
              onPress={handleClearSearch}
              activeOpacity={0.8}
            >
              <RotateCcw color="#FFFFFF" size={13} strokeWidth={2.4} style={{ marginRight: 6 }} />
              <Text style={styles.backHomeBtnPrimaryText}>Back to Home</Text>
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
      ) : hasSearched && filteredResults.length === 0 ? (
        /* Filtered Out By Language State */
        <View style={[styles.stateCenter, { paddingTop: insets.top + 60 }]}>
          <Film color="#8E8E93" size={44} strokeWidth={1.8} />
          <Text style={styles.notFoundTitle}>No {selectedLanguages.join(', ')} Movies</Text>
          <Text style={styles.notFoundSub}>
            No movies match the selected language filter in the current feed.
          </Text>
          <View style={styles.notFoundActionsRow}>
            <TouchableOpacity
              style={styles.backHomeBtnPrimary}
              onPress={() => setSelectedLanguages(['All'])}
              activeOpacity={0.8}
            >
              <Text style={styles.backHomeBtnPrimaryText}>Show All Languages</Text>
            </TouchableOpacity>
            {!isHomeFeed && (
              <TouchableOpacity
                style={styles.switchMirrorBtn}
                onPress={handleClearSearch}
                activeOpacity={0.8}
              >
                <Text style={styles.switchMirrorBtnText}>Back to Home</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : hasSearched && filteredResults.length > 0 ? (
        /* Results List with Lazy Loading & Pull-to-Refresh */
        <FlatList
          ref={flatListRef}
          data={visibleRecentlyAdded}
          keyExtractor={keyExtractor}
          renderItem={renderMovieCard}
          numColumns={2}
          columnWrapperStyle={styles.listGridColumnWrapper}
          contentContainerStyle={[
            styles.listGridContent,
            {
              paddingTop: isHomeFeed ? 0 : insets.top + 54,
              paddingBottom: insets.bottom + 100,
            },
          ]}
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
              {/* Featured Slideshow for the First 4 Movies */}
              {isHomeFeed && featuredMovies.length > 0 && (
                <View style={styles.heroSectionWrap}>
                  <HeroFeaturedSlideshow
                    movies={featuredMovies}
                    isMovieSaved={isMovieSaved}
                    onToggleSaveMovie={handleToggleSaveMovie}
                    enqueuePosterFetch={enqueuePosterFetch}
                    onSelectMovie={(movie) => {
                      setDetailMovie(movie);
                      setDetailVisible(true);
                    }}
                  />
                </View>
              )}

              {/* Section: Downloaded Movies (Offline Ready) */}
              {isHomeFeed && completedDownloads.length > 0 && (
                <View style={styles.downloadedSectionWrap}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                        <DownloadCloud color="#30D158" size={16} strokeWidth={2.4} />
                      </View>
                      <Text style={styles.sectionTitle}>Downloaded Movies</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.dlBadge}
                      onPress={() => onNavigateToTab?.('downloads')}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dlBadgeText}>{completedDownloads.length} Offline • See All</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dlScroll}
                  >
                    {completedDownloads.map((item) => (
                      <DownloadedMovieCard
                        key={item.id}
                        item={item}
                        onPlay={() => {
                          setActiveStreamItem(item);
                          setStreamPlayerInitialPos(0);
                          setStreamPlayerPosterUrl(item.poster || undefined);
                          setStreamPlayerVisible(true);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Section 0: Continue Watching (Only on default home feed when items exist) */}
              {isHomeFeed && continueWatchingList.length > 0 && (
                <View style={styles.continueWatchingSectionWrap}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={styles.sectionIconWrap}>
                        <PlayCircle color={Colors.primary} size={16} strokeWidth={2.4} />
                      </View>
                      <Text style={styles.sectionTitle}>Continue Watching</Text>
                    </View>
                    <View style={styles.cwBadge}>
                      <Text style={styles.cwBadgeText}>{continueWatchingList.length} Active</Text>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.cwScroll}
                  >
                    {continueWatchingList.map((item) => (
                      <ContinueWatchingCard
                        key={item.id}
                        item={item}
                        onResume={() => handleResumeContinueWatching(item)}
                        onRemove={() => continueWatchingService.remove(item.id)}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Section 1: Top Release for this week (Only on default home feed) */}
              {isHomeFeed && topReleases.length > 0 && (
                <View style={styles.topReleaseSectionWrap}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <View style={styles.sectionIconWrap}>
                        <Flame color={Colors.primary} size={16} strokeWidth={2.4} />
                      </View>
                      <Text style={styles.sectionTitle}>Top Release for this week</Text>
                    </View>
                    <View style={styles.topReleaseBadge}>
                      <Text style={styles.topReleaseBadgeText}>{topReleases.length} Hot</Text>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.topReleaseScroll}
                  >
                    {topReleases.map((item, index) => (
                      <TopReleaseCard
                        key={item.id || `tr-${index}`}
                        item={item}
                        rank={index + 1}
                        isSaved={isMovieSaved(item)}
                        onToggleSave={(p) => handleToggleSaveMovie(item, p)}
                        enqueuePosterFetch={enqueuePosterFetch}
                        onPress={() => {
                          setDetailMovie(item);
                          setDetailVisible(true);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Section 2: Recently added / Search Results */}
              <View style={[styles.sectionHeader, isHomeFeed && topReleases.length > 0 && styles.sectionHeaderSpaced]}>
                <View style={[styles.sectionTitleRow, { flex: 1, marginRight: 8 }]}>
                  <View style={styles.sectionIconWrap}>
                    {isHomeFeed ? (
                      <Sparkles color={Colors.primary} size={15} strokeWidth={2.4} />
                    ) : (
                      <Search color={Colors.primary} size={15} strokeWidth={2.4} />
                    )}
                  </View>
                  <Text style={styles.sectionTitle} numberOfLines={1}>
                    {isHomeFeed ? 'Recently added' : `Results for "${searchedQuery}"`}
                  </Text>
                </View>
                {isHomeFeed ? (
                  <View style={styles.recentMetaBadge}>
                    <Text style={styles.recentMetaBadgeText}>
                      {`${recentlyAdded.length} Movies`}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.backToHomePill}
                    onPress={handleClearSearch}
                    activeOpacity={0.75}
                  >
                    <RotateCcw color="#FFFFFF" size={11} strokeWidth={2.4} style={{ marginRight: 4 }} />
                    <Text style={styles.backToHomePillText}>Back to Home</Text>
                  </TouchableOpacity>
                )}
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

      {/* Headless Poster Extractor WebView — navigates topic pages sequentially to extract poster images */}
      {posterWebViewUrl ? (
        <View style={styles.offscreenWebView}>
          <WebView
            source={{ uri: posterWebViewUrl }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
            injectedJavaScript={POSTER_EXTRACTOR_JS}
            onMessage={handlePosterWebViewMessage}
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

      {/* 7. Movie Detail Sheet (Netflix-style full page sheet) */}
      <MovieDetailSheet
        visible={detailVisible}
        movie={detailMovie}
        streamingResId={streamingResId}
        isSaved={detailMovie ? isMovieSaved(detailMovie) : false}
        onToggleSave={() => detailMovie && handleToggleSaveMovie(detailMovie)}
        onClose={() => setDetailVisible(false)}
        onMovieDownload={handleMovieDownload}
        onTorrentDownload={handleTorrentDownload}
        onStream={handleStreamResolution}
        onCopy={handleCopyMagnet}
        onOpenExternal={handleOpenExternalPlayer}
        enqueuePosterFetch={enqueuePosterFetch}
        backendUrl={backendUrl}
      />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(15, 15, 18, 0.88)',
  },
  headerLeft: {
    marginRight: 6,
    flexShrink: 0,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 4,
  },
  netflixVLogo: {
    width: 36,
    height: 36,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  brandTitleV: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTitleFlix: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandCinemaBadge: {
    backgroundColor: 'rgba(250, 36, 60, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 4,
    flexShrink: 0,
  },
  brandCinemaBadgeText: {
    color: Colors.primary,
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  screenSubtitle: {
    color: '#8E8E93',
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: -1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  mirrorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16171D',
    borderWidth: 1,
    borderColor: '#262835',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    maxWidth: 110,
    flexShrink: 1,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  mirrorChipText: {
    color: '#E5E5EA',
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 75,
  },
  headerSearchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16171D',
    borderWidth: 1,
    borderColor: '#262835',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#16171D',
    borderWidth: 1,
    borderColor: '#262835',
    justifyContent: 'center',
    alignItems: 'center',
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
  searchBackBtn: {
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
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
  homeResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
  },
  homeResetBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  backToHomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  backToHomePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  searchBtnDisabled: {
    opacity: 0.45,
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  langFilterContainer: {
    paddingVertical: 5,
    paddingBottom: 6,
  },
  langFilterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#16171E',
    borderWidth: 1,
    borderColor: '#262835',
  },
  langChipActive: {
    backgroundColor: Colors.primary,
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 36,
  },
  listGridContent: {
    paddingTop: 8,
    paddingBottom: 36,
  },
  listGridColumnWrapper: {
    gap: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  listHeaderBox: {
    marginBottom: 10,
  },
  continueWatchingSectionWrap: {
    marginBottom: 18,
  },
  cwBadge: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cwBadgeText: {
    color: Colors.primary,
    fontSize: 10.5,
    fontWeight: '700',
  },
  cwScroll: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  cwCard: {
    width: 140,
    height: 210,
    borderRadius: 12,
    backgroundColor: '#16171E',
    borderWidth: 1,
    borderColor: '#242634',
    overflow: 'hidden',
    marginRight: 10,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  cwGradientOverlay: {
    ...StyleSheet.absoluteFill,
  },
  cwDismissBtn: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cwCenterPlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cwPlayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cwBottomInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 10,
  },
  cwTitle: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  cwMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  cwRemainingText: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '600',
  },
  cwResText: {
    color: '#636366',
    fontSize: 9.5,
    fontWeight: '600',
  },
  cwProgressBarBg: {
    width: '100%',
    height: 3.5,
    backgroundColor: '#2C2D3A',
    borderRadius: 2,
    overflow: 'hidden',
  },
  cwProgressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  topReleaseSectionWrap: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  sectionHeaderSpaced: {
    marginTop: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(250, 36, 60, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  topReleaseBadge: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  topReleaseBadgeText: {
    color: Colors.primary,
    fontSize: 10.5,
    fontWeight: '700',
  },
  recentMetaBadge: {
    backgroundColor: '#16171D',
    borderWidth: 1,
    borderColor: '#262835',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  recentMetaBadgeText: {
    color: '#E5E5EA',
    fontSize: 10.5,
    fontWeight: '600',
  },
  topReleaseScroll: {
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  trCard: {
    width: 140,
    height: 210,
    borderRadius: 12,
    backgroundColor: '#16171E',
    borderWidth: 1,
    borderColor: '#242634',
    overflow: 'hidden',
    marginRight: 10,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  trGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 30,
  },
  trTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    letterSpacing: -0.2,
  },
  trRankBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    borderRadius: 6,
    overflow: 'hidden',
  },
  trRankGradient: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trRankText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  trQualityBadge: {
    position: 'absolute',
    bottom: 7,
    right: 7,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  trQualityText: {
    fontSize: 9,
    fontWeight: '800',
  },
  trLangBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: 'rgba(250, 36, 60, 0.85)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
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
  // ── Poster Grid Card (2-column Netflix/VFlix style) ──
  pgCard: {
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
  pgImage: {
    ...StyleSheet.absoluteFill,
  },
  pgShimmerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pgGradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 28,
  },
  pgTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 16,
    letterSpacing: -0.2,
  },
  pgYearBadge: {
    position: 'absolute',
    top: 7,
    left: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  pgYearText: {
    color: '#E5E5EA',
    fontSize: 9.5,
    fontWeight: '700',
  },
  pgLangBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: 'rgba(250, 36, 60, 0.85)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  pgLangText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pgCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pgQualityBadgeInline: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  trCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  trQualityBadgeInline: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4.5,
    paddingVertical: 1,
    alignSelf: 'flex-start',
  },
  pgQualityBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4.5,
    paddingVertical: 1,
  },
  pgQualityText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // ── Movie Detail Sheet (Netflix-style full page sheet) ──
  dsContainer: {
    flex: 1,
    backgroundColor: '#09090C',
  },
  dsHeroHeader: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  dsHero: {
    width: '100%',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  cardBookmarkBtn: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dsHeaderBookmarkBtn: {
    position: 'absolute',
    right: 60,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dsCloseBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dsMyListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginTop: 8,
  },
  dsMyListBtnActive: {
    backgroundColor: 'rgba(250, 36, 60, 0.15)',
    borderColor: 'rgba(250, 36, 60, 0.4)',
  },
  dsMyListBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dsQuickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  dsQuickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  dsQuickActionBtnText: {
    color: '#E5E5EA',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  dsHeroContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 2,
    gap: 12,
  },
  dsHeroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  dsBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  dsMetaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dsMetaBadgeText: {
    color: '#E5E5EA',
    fontSize: 11,
    fontWeight: '700',
  },
  dsCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  dsPlayBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dsPlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
  },
  dsPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dsDownloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  dsDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dsInfoSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 20,
  },
  dsSectionBlock: {
    gap: 10,
  },
  dsSectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  dsSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dsSectionSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
  },
  qmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  qmSheet: {
    backgroundColor: '#12131A',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#242735',
    maxHeight: '75%',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  qmHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3E4254',
    alignSelf: 'center',
    marginBottom: 12,
  },
  qmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  qmHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  qmIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qmTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  qmSubtitle: {
    color: '#8E8E93',
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  qmCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qmDestinationSelector: {
    flexDirection: 'row',
    backgroundColor: '#161822',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262A38',
  },
  qmDestinationTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  qmDestinationTabActivePlay: {
    backgroundColor: 'rgba(250, 36, 60, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(250, 36, 60, 0.5)',
  },
  qmDestinationTabActiveDownload: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.5)',
  },
  qmDestinationTabText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  qmDestinationTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  qmScroll: {
    maxHeight: 380,
  },
  qmScrollContent: {
    gap: 9,
    paddingVertical: 4,
  },
  qmOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171922',
    borderWidth: 1.2,
    borderColor: '#282C3D',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 13,
    justifyContent: 'space-between',
  },
  qmCardLeft: {
    flex: 1,
    gap: 4,
    marginRight: 10,
  },
  qmQualityBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  qmQualityBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  qmCardMeta: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '500',
  },
  qmCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qmSizeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  qmSizeBadgeText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  qmActionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qmLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 36,
  },
  qmLoadingText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
  },
  dsRawTitleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#14151C',
    borderWidth: 1,
    borderColor: '#242634',
    borderRadius: 8,
    padding: 10,
  },
  dsRawTitleText: {
    flex: 1,
    color: '#AEAEB2',
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dsStreamingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    marginTop: 8,
  },
  dsStreamingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  dsStreamingText: {
    color: '#8E8E93',
    fontSize: 11.5,
    fontWeight: '500',
  },
  dsMatchText: {
    color: '#46D369',
    fontSize: 13,
    fontWeight: '800',
  },
  dsRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  dsRatingText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
  },
  dsTaglineText: {
    color: '#8E8E93',
    fontSize: 12.5,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 2,
  },
  dsDbHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dsDbHeaderText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dsSynopsisText: {
    color: '#E5E5EA',
    fontSize: 13.5,
    lineHeight: 19,
  },
  dsMetaLineText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  dsMetaLabel: {
    color: '#8E8E93',
    fontWeight: '600',
  },
  dsMetaValue: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  dsGenresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  dsGenreChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dsGenreText: {
    color: '#E5E5EA',
    fontSize: 11,
    fontWeight: '600',
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
  notFoundActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  backHomeBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    shadowColor: Colors.netflixRed,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 3,
  },
  backHomeBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
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
  backendStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  backendStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  backendStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroSectionWrap: {
    marginBottom: 20,
    marginTop: 0,
    marginHorizontal: 0,
  },
  heroCardContainer: {
    borderRadius: 0,
    overflow: 'hidden',
    alignSelf: 'stretch',
    backgroundColor: '#09090C',
    borderWidth: 0,
    borderBottomWidth: 0,
  },
  heroGradientOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    padding: 16,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  heroBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroBookmarkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottomContent: {
    gap: 8,
    alignItems: 'center',
  },
  heroDotsCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 2,
  },
  heroMetaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  heroMetaBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  heroCtaBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  heroCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  heroCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  downloadedSectionWrap: {
    marginBottom: 20,
  },
  dlBadge: {
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  dlBadgeText: {
    color: '#30D158',
    fontSize: 11,
    fontWeight: '700',
  },
  dlScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
  },
  dlCard: {
    width: 140,
    height: 210,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1C1E24',
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  dlSizeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dlSizeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  dlOfflineBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dlOfflineBadgeText: {
    color: '#30D158',
    fontSize: 9,
    fontWeight: '800',
  },
  slideshowWrapper: {
    position: 'relative',
    width: '100%',
  },
  slideshowDotsContainer: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 15,
  },
  slideshowDot: {
    height: 6,
    borderRadius: 3,
  },
  slideshowDotActive: {
    width: 22,
    backgroundColor: Colors.primary,
  },
  slideshowDotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});
