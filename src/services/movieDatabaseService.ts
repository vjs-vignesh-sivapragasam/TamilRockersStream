/**
 * Movie Database Service — Powered by TMDB (The Movie Database)
 * API Key: fd78b9d264f2f5a14deb84d3b6a83577
 * Replaces OMDb completely with high-fidelity TMDB poster, backdrop, rating, and metadata.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { useState, useEffect } from 'react';

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profileUrl?: string | null;
}

export interface RecommendationMovie {
  id: number;
  title: string;
  posterUrl?: string | null;
  year?: string;
  rating?: number;
}

export interface RealMovieMetadata {
  title: string;
  originalTitle?: string;
  tagline?: string;
  synopsis: string;
  rating: number; // e.g. 7.4
  voteCount?: number;
  matchScore: number; // e.g. 92%
  contentRating: string; // e.g. '13+'
  year: string;
  releaseDate?: string;
  runtime?: string; // e.g. '2h 49m'
  runtimeMinutes?: number; // e.g. 157
  country?: string; // e.g. 'KR'
  languages?: string; // e.g. 'Korean'
  genres: string[];
  cast: string[];
  castMembers?: CastMember[];
  director?: string;
  backdropUrl?: string;
  posterUrl?: string;
  trailerKey?: string;
  recommendations?: RecommendationMovie[];
  similar?: RecommendationMovie[];
  source: 'tmdb' | 'itunes';
}

export const TMDB_API_KEY = 'fd78b9d264f2f5a14deb84d3b6a83577';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// In-memory cache for instant 0ms lookups
const metadataCache = new Map<string, RealMovieMetadata | null>();

// Persistent disk cache file
const CACHE_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}tmdb_metadata_cache_v2.json`
  : '';

let isCacheLoaded = false;
let saveTimer: any = null;

export async function loadMetadataCacheFromDisk() {
  if (isCacheLoaded || !CACHE_FILE) return;
  try {
    const content = await FileSystem.readAsStringAsync(CACHE_FILE);
    if (content) {
      const parsed: [string, RealMovieMetadata | null][] = JSON.parse(content);
      if (Array.isArray(parsed)) {
        parsed.forEach(([key, val]) => {
          if (key && val) metadataCache.set(key, val);
        });
      }
    }
    isCacheLoaded = true;
  } catch {}
}

// Automatically load cached TMDB entries on module load
loadMetadataCacheFromDisk();

function saveMetadataCacheToDisk() {
  if (!CACHE_FILE) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const entries = Array.from(metadataCache.entries()).filter(([_, val]) => val !== null && val !== undefined);
      FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(entries)).catch(() => {});
    } catch {}
  }, 1200);
}

const TMDB_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/**
 * Sanitizes forum and torrent titles to extract clean movie title and year
 */
export function cleanMovieSearchTitle(title: string, yearHint?: string): { clean: string; year: string } {
  if (!title) return { clean: '', year: '' };

  let clean = title
    .replace(/^(?:view\s+(?:the\s+)?topic|go\s+to\s+(?:the\s+)?topic)[\s:'"‘“\-]*/i, '')
    .replace(/^view\s+the\s+topic\s*/i, '')
    .replace(/www\.[^\s]+ - /gi, '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    // Strip rips, formats and release encoders
    .replace(
      /\b(web-?dl|web-?rip|proper|hdrip|dvdrip|brrip|bdrip|bluray|remux|hdtv|camrip|predvd|pre-?dvdrip|telecine|tc|ts|screener)\b/gi,
      ' '
    )
    // Strip resolutions and file sizes
    .replace(
      /\b(4k|uhd|2160p|1080p|720p|480p|360p|250mb|400mb|550mb|700mb|900mb|1\.4gb|2gb|2\.8gb|4gb|5\.4gb)\b/gi,
      ' '
    )
    // Strip video codecs and colour standards
    .replace(
      /\b(x264|x265|hevc|h264|h265|10bit|8bit|sdr|hdr|hdr10|hdr10\+|dv|dovi|dolby\s*vision)\b/gi,
      ' '
    )
    // Strip audio codecs
    .replace(
      /\b(aac|ac3|eac3|ddp5\.1|dd5\.1|ddp|dd|dts|atmos|mp3|uncompressed|true|hq|sample)\b/gi,
      ' '
    )
    // Strip language tags
    .replace(
      /\b(tamil|telugu|hindi|malayalam|kannada|english|multi|dual|org|original|audios?|sub|esub|subs)\b/gi,
      ' '
    )
    // Strip edition & series tags
    .replace(
      /\b(uncut|extended|directors\s*cut|remastered|special|exclusive|season\s*\d+|s\d+|ep\s*\d+|episodes?|complete)\b/gi,
      ' '
    )
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract 4-digit release year if present
  const yearMatch = (yearHint || title).match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : '';

  if (year) {
    clean = clean.replace(new RegExp(`\\b${year}\\b`, 'g'), '').trim();
  }

  // If title has alternative name with slash or aka, take first
  if (clean.includes('/')) {
    clean = clean.split('/')[0].trim();
  }

  // Remove trailing and leading punctuation
  clean = clean.replace(/[-–—:]+$/g, '').replace(/^[-–—:]+/g, '').replace(/\s+/g, ' ').trim();

  return { clean, year };
}

function getCacheKey(cleanTitle: string, year: string): string {
  return `${cleanTitle.toLowerCase().trim()}_${year || ''}`;
}

/**
 * Synchronous cache lookup
 */
export function getCachedMovieMetadata(title: string, yearHint?: string): RealMovieMetadata | null | undefined {
  const { clean, year } = cleanMovieSearchTitle(title, yearHint);
  if (!clean) return undefined;
  return metadataCache.get(getCacheKey(clean, year));
}

/**
 * Primary Movie Metadata fetcher via TMDB API (Supports both Feature Films and TV Web Series)
 */
export async function fetchMovieDatabaseMetadata(
  title: string,
  yearHint?: string
): Promise<RealMovieMetadata | null> {
  if (!title || title.trim().length < 2) return null;

  const { clean, year } = cleanMovieSearchTitle(title, yearHint);
  if (!clean || clean.length < 2) return null;

  const cacheKey = getCacheKey(clean, year);
  if (metadataCache.has(cacheKey)) {
    return metadataCache.get(cacheKey) ?? null;
  }

  // 1. Search TMDB with multi-stage fallback (Movie -> TV Show -> Prefix -> Words)
  try {
    let data: any = null;
    let isTv = false;

    // Stage 1: Search Movie with Year
    let movieUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&include_adult=false`;
    if (year) movieUrl += `&year=${year}`;
    let res = await fetch(movieUrl, { headers: TMDB_HEADERS });
    data = res.ok ? await res.json() : null;

    // Stage 2: Retry Movie without Year
    if ((!data || !data.results || data.results.length === 0) && year) {
      const fallbackMovieUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&include_adult=false`;
      const fallbackRes = await fetch(fallbackMovieUrl, { headers: TMDB_HEADERS });
      if (fallbackRes.ok) data = await fallbackRes.json();
    }

    // Stage 3: If no movie found, search TMDB TV Shows (/search/tv) for Web Series
    if (!data || !data.results || data.results.length === 0) {
      let tvUrl = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&include_adult=false`;
      if (year) tvUrl += `&first_air_date_year=${year}`;
      const tvRes = await fetch(tvUrl, { headers: TMDB_HEADERS });
      if (tvRes.ok) {
        const tvData = await tvRes.json();
        if (tvData && tvData.results && tvData.results.length > 0) {
          data = tvData;
          isTv = true;
        }
      }

      if ((!data || !data.results || data.results.length === 0) && year) {
        const fallbackTvUrl = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&include_adult=false`;
        const fallbackTvRes = await fetch(fallbackTvUrl, { headers: TMDB_HEADERS });
        if (fallbackTvRes.ok) {
          const tvData = await fallbackTvRes.json();
          if (tvData && tvData.results && tvData.results.length > 0) {
            data = tvData;
            isTv = true;
          }
        }
      }
    }

    // Stage 4: Try Title Prefix if separator like " - " or ": " is present
    if (!data || !data.results || data.results.length === 0) {
      const subParts = clean.split(/[-:]/);
      if (subParts.length > 1 && subParts[0].trim().length >= 3) {
        const prefixClean = subParts[0].trim();
        const prefixUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(prefixClean)}&include_adult=false`;
        const prefixRes = await fetch(prefixUrl, { headers: TMDB_HEADERS });
        if (prefixRes.ok) {
          data = await prefixRes.json();
          if (!data || !data.results || data.results.length === 0) {
            const prefixTvUrl = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(prefixClean)}&include_adult=false`;
            const prefixTvRes = await fetch(prefixTvUrl, { headers: TMDB_HEADERS });
            if (prefixTvRes.ok) {
              const tvData = await prefixTvRes.json();
              if (tvData && tvData.results && tvData.results.length > 0) {
                data = tvData;
                isTv = true;
              }
            }
          }
        }
      }
    }

    // Stage 5: Try first 2-3 words if long title
    if (!data || !data.results || data.results.length === 0) {
      const words = clean.split(/\s+/);
      if (words.length > 3) {
        const shortClean = words.slice(0, 3).join(' ');
        const shortRes = await fetch(
          `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(shortClean)}&include_adult=false`,
          { headers: TMDB_HEADERS }
        );
        if (shortRes.ok) data = await shortRes.json();
      }
    }

    if (data && data.results && data.results.length > 0) {
      const m = data.results[0];

      // Fetch full TMDB movie or TV details, cast credits, videos, recommendations & similar
      try {
        const detailEndpoint = isTv
          ? `${TMDB_BASE_URL}/tv/${m.id}?api_key=${TMDB_API_KEY}&append_to_response=credits,aggregate_credits,videos,recommendations,similar`
          : `${TMDB_BASE_URL}/movie/${m.id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,recommendations,similar`;

        const detailRes = await fetch(detailEndpoint, { headers: TMDB_HEADERS });
        if (detailRes.ok) {
          const d = await detailRes.json();
          const rawCast = isTv ? (d.aggregate_credits?.cast || d.credits?.cast || []) : (d.credits?.cast || []);
          const castList = rawCast.slice(0, 12).map((c: any) => c.name);
          const castMembers: CastMember[] = rawCast.slice(0, 20).map((c: any) => ({
            id: c.id,
            name: c.name || '',
            character: c.character || (c.roles && c.roles[0]?.character) || 'Cast',
            profileUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
          }));

          const rawCrew = isTv ? (d.aggregate_credits?.crew || d.credits?.crew || []) : (d.credits?.crew || []);
          const directorObj = rawCrew.find((c: any) => c.job === 'Director' || (c.jobs && c.jobs.some((j: any) => j.job === 'Director')));
          const runtimeMins = d.runtime || (d.episode_run_time && d.episode_run_time[0]) || 0;
          const runtimeStr =
            runtimeMins > 0
              ? `${Math.floor(runtimeMins / 60)}h ${runtimeMins % 60}m`
              : isTv && d.number_of_seasons
              ? `${d.number_of_seasons} Season${d.number_of_seasons > 1 ? 's' : ''}`
              : '';

          const voteAvg = Number((d.vote_average || m.vote_average || 0).toFixed(1));
          const relDate = d.release_date || d.first_air_date || m.release_date || m.first_air_date;
          const relYear = (relDate || year || '').substring(0, 4);

          // Find YouTube trailer key
          const trailer = (d.videos?.results || []).find(
            (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
          ) || (d.videos?.results || []).find((v: any) => v.site === 'YouTube');
          const trailerKey = trailer?.key;

          // Recommendations
          const recommendations: RecommendationMovie[] = (d.recommendations?.results || []).slice(0, 10).map((r: any) => ({
            id: r.id,
            title: r.title || r.name || '',
            posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
            year: (r.release_date || r.first_air_date || '').substring(0, 4),
            rating: Number((r.vote_average || 0).toFixed(1)),
          }));

          // Similar movies
          const similar: RecommendationMovie[] = (d.similar?.results || []).slice(0, 10).map((s: any) => ({
            id: s.id,
            title: s.title || s.name || '',
            posterUrl: s.poster_path ? `https://image.tmdb.org/t/p/w342${s.poster_path}` : null,
            year: (s.release_date || s.first_air_date || '').substring(0, 4),
            rating: Number((s.vote_average || 0).toFixed(1)),
          }));

          const country = d.production_countries?.[0]?.iso_3166_1 || (d.origin_country?.[0] || 'IN');
          const languages = d.spoken_languages?.map((l: any) => l.english_name || l.name).filter(Boolean).join(', ') || d.original_language?.toUpperCase() || 'Tamil';

          const result: RealMovieMetadata = {
            title: d.title || d.name || m.title || m.name,
            originalTitle: (d.original_title || d.original_name) !== (d.title || d.name) ? (d.original_title || d.original_name) : undefined,
            tagline: d.tagline || undefined,
            synopsis: d.overview || m.overview || '',
            rating: voteAvg,
            voteCount: d.vote_count || m.vote_count,
            matchScore: Math.min(99, Math.max(65, Math.round((voteAvg || 7.2) * 10))),
            contentRating: d.adult ? '18+' : '13+',
            year: relYear,
            releaseDate: relDate,
            runtime: runtimeStr,
            runtimeMinutes: runtimeMins,
            country,
            languages,
            genres: (d.genres || []).map((g: any) => g.name),
            cast: castList,
            castMembers,
            director: directorObj?.name,
            backdropUrl: (d.backdrop_path || m.backdrop_path) ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path || m.backdrop_path}` : undefined,
            posterUrl: (d.poster_path || m.poster_path) ? `https://image.tmdb.org/t/p/w500${d.poster_path || m.poster_path}` : undefined,
            trailerKey,
            recommendations,
            similar,
            source: 'tmdb',
          };

          metadataCache.set(cacheKey, result);
          saveMetadataCacheToDisk();
          return result;
        }
      } catch {}

      // Fallback to basic search result if detail endpoint had an issue
      const voteAvg = Number((m.vote_average || 0).toFixed(1));
      const relDate = m.release_date || m.first_air_date;
      const relYear = (relDate || year || '').substring(0, 4);
      const basicResult: RealMovieMetadata = {
        title: m.title || m.name,
        synopsis: m.overview || '',
        rating: voteAvg,
        voteCount: m.vote_count,
        matchScore: Math.min(99, Math.max(65, Math.round((voteAvg || 7.2) * 10))),
        contentRating: m.adult ? '18+' : '13+',
        year: relYear,
        releaseDate: relDate,
        genres: [],
        cast: [],
        backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : undefined,
        posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,
        source: 'tmdb',
      };

      metadataCache.set(cacheKey, basicResult);
      saveMetadataCacheToDisk();
      return basicResult;
    }
  } catch (err) {
    console.warn('[TMDB] Search error for:', clean, err);
  }

  // 2. iTunes Movie Search Fallback (Only if TMDB returned no match)
  try {
    const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=movie&limit=1`;
    const res = await fetch(iTunesUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const artwork = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : undefined;
        const result: RealMovieMetadata = {
          title: item.trackName || item.collectionName || clean,
          synopsis: item.longDescription || item.shortDescription || '',
          rating: 7.5,
          matchScore: 85,
          contentRating: item.contentAdvisoryRating || '13+',
          year: (item.releaseDate || year || '').substring(0, 4),
          releaseDate: item.releaseDate,
          genres: item.primaryGenreName ? [item.primaryGenreName] : [],
          cast: item.artistName ? [item.artistName] : [],
          director: item.artistName,
          posterUrl: artwork,
          backdropUrl: artwork,
          source: 'itunes',
        };

        metadataCache.set(cacheKey, result);
        saveMetadataCacheToDisk();
        return result;
      }
    }
  } catch {}

  // Cache null in memory for this session so we do not repeatedly spam the network
  metadataCache.set(cacheKey, null);
  return null;
}

/**
 * Reactive React hook to fetch & cache TMDB metadata for any movie component
 */
export function useMovieMetadata(title?: string, yearHint?: string): {
  metadata: RealMovieMetadata | null;
  loading: boolean;
} {
  const [data, setData] = useState<{ metadata: RealMovieMetadata | null; loading: boolean }>(() => {
    if (!title) return { metadata: null, loading: false };
    const cached = getCachedMovieMetadata(title, yearHint);
    if (cached !== undefined) {
      return { metadata: cached, loading: false };
    }
    return { metadata: null, loading: true };
  });

  useEffect(() => {
    if (!title || title.trim().length < 2) {
      setData({ metadata: null, loading: false });
      return;
    }

    const cached = getCachedMovieMetadata(title, yearHint);
    if (cached !== undefined) {
      setData({ metadata: cached, loading: false });
      return;
    }

    let isMounted = true;
    setData((prev) => (prev.loading ? prev : { ...prev, loading: true }));

    fetchMovieDatabaseMetadata(title, yearHint)
      .then((meta) => {
        if (isMounted) {
          setData({ metadata: meta, loading: false });
        }
      })
      .catch(() => {
        if (isMounted) {
          setData({ metadata: null, loading: false });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [title, yearHint]);

  return data;
}
