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
          if (key) metadataCache.set(key, val);
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
      const entries = Array.from(metadataCache.entries());
      FileSystem.writeAsStringAsync(CACHE_FILE, JSON.stringify(entries)).catch(() => {});
    } catch {}
  }, 1200);
}

/**
 * Sanitizes forum and torrent titles to extract clean movie title and year
 */
export function cleanMovieSearchTitle(title: string, yearHint?: string): { clean: string; year: string } {
  if (!title) return { clean: '', year: '' };

  let clean = title
    .replace(/^(?:view\s+(?:the\s+)?topic|go\s+to\s+(?:the\s+)?topic)[\s:'"‘“\-]*/i, '')
    .replace(/^view\s+the\s+topic\s*/i, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(
      /\b(1080p|720p|480p|2160p|4k|bluray|webrip|brrip|x264|x265|hevc|aac|dvdrip|hdrip|hq|esub|sub|550mb|700mb|900mb|1\.4gb|2gb|2\.8gb|5\.4gb|tamil|telugu|hindi|malayalam|kannada|english|true|uncompressed)\b/gi,
      ''
    )
    .replace(/[_.-]+/g, ' ')
    .trim();

  // Extract 4-digit release year if present
  const yearMatch = (yearHint || title).match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : '';

  if (year) {
    clean = clean.replace(new RegExp(`\\b${year}\\b`, 'g'), '').trim();
  }

  // Remove trailing punctuation
  clean = clean.replace(/[-–—:]+$/g, '').trim();

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
 * Primary Movie Metadata fetcher via TMDB API
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

  // 1. Search TMDB with query + optional year
  try {
    let searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&include_adult=false`;
    if (year) {
      searchUrl += `&year=${year}`;
    }

    let res = await fetch(searchUrl);
    let data = res.ok ? await res.json() : null;

    // If no results with year, retry without year restriction (year might differ between festival/theatrical/digital)
    if ((!data || !data.results || data.results.length === 0) && year) {
      const fallbackSearchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}&include_adult=false`;
      const fallbackRes = await fetch(fallbackSearchUrl);
      if (fallbackRes.ok) {
        data = await fallbackRes.json();
      }
    }

    // If still no results and title has a subtitle separator (" - " or ": "), try prefix
    if (!data || !data.results || data.results.length === 0) {
      const subParts = clean.split(/[-:]/);
      if (subParts.length > 1 && subParts[0].trim().length >= 3) {
        const prefixClean = subParts[0].trim();
        const prefixUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(prefixClean)}&include_adult=false`;
        const prefixRes = await fetch(prefixUrl);
        if (prefixRes.ok) {
          data = await prefixRes.json();
        }
      }
    }

    if (data && data.results && data.results.length > 0) {
      const m = data.results[0];

      // Fetch full TMDB movie details, cast credits, videos, recommendations & similar
      try {
        const detailRes = await fetch(
          `${TMDB_BASE_URL}/movie/${m.id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,recommendations,similar`
        );
        if (detailRes.ok) {
          const d = await detailRes.json();
          const castList = (d.credits?.cast || []).slice(0, 10).map((c: any) => c.name);
          const castMembers: CastMember[] = (d.credits?.cast || []).slice(0, 16).map((c: any) => ({
            id: c.id,
            name: c.name || '',
            character: c.character || '',
            profileUrl: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
          }));
          const directorObj = (d.credits?.crew || []).find((c: any) => c.job === 'Director');
          const runtimeMins = d.runtime || 0;
          const runtimeStr =
            runtimeMins > 0
              ? `${Math.floor(runtimeMins / 60)}h ${runtimeMins % 60}m`
              : '';

          const voteAvg = Number((d.vote_average || m.vote_average || 0).toFixed(1));
          const relYear = (d.release_date || m.release_date || year || '').substring(0, 4);

          // Find YouTube trailer key
          const trailer = (d.videos?.results || []).find(
            (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
          ) || (d.videos?.results || []).find((v: any) => v.site === 'YouTube');
          const trailerKey = trailer?.key;

          // Recommendations
          const recommendations: RecommendationMovie[] = (d.recommendations?.results || []).slice(0, 10).map((r: any) => ({
            id: r.id,
            title: r.title || '',
            posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
            year: (r.release_date || '').substring(0, 4),
            rating: Number((r.vote_average || 0).toFixed(1)),
          }));

          // Similar movies
          const similar: RecommendationMovie[] = (d.similar?.results || []).slice(0, 10).map((s: any) => ({
            id: s.id,
            title: s.title || '',
            posterUrl: s.poster_path ? `https://image.tmdb.org/t/p/w342${s.poster_path}` : null,
            year: (s.release_date || '').substring(0, 4),
            rating: Number((s.vote_average || 0).toFixed(1)),
          }));

          const country = d.production_countries?.[0]?.iso_3166_1 || (d.origin_country?.[0] || 'IN');
          const languages = d.spoken_languages?.map((l: any) => l.english_name || l.name).filter(Boolean).join(', ') || d.original_language?.toUpperCase() || 'Tamil';

          const result: RealMovieMetadata = {
            title: d.title || m.title,
            originalTitle: d.original_title !== d.title ? d.original_title : undefined,
            tagline: d.tagline || undefined,
            synopsis: d.overview || m.overview || '',
            rating: voteAvg,
            voteCount: d.vote_count || m.vote_count,
            matchScore: Math.min(99, Math.max(65, Math.round((voteAvg || 7.2) * 10))),
            contentRating: d.adult ? '18+' : '13+',
            year: relYear,
            releaseDate: d.release_date || m.release_date,
            runtime: runtimeStr,
            runtimeMinutes: runtimeMins,
            country,
            languages,
            genres: (d.genres || []).map((g: any) => g.name),
            cast: castList,
            castMembers,
            director: directorObj?.name,
            backdropUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : undefined,
            posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : undefined,
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
      const relYear = (m.release_date || year || '').substring(0, 4);
      const basicResult: RealMovieMetadata = {
        title: m.title,
        synopsis: m.overview || '',
        rating: voteAvg,
        voteCount: m.vote_count,
        matchScore: Math.min(99, Math.max(65, Math.round((voteAvg || 7.2) * 10))),
        contentRating: m.adult ? '18+' : '13+',
        year: relYear,
        releaseDate: m.release_date,
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

  // Cache null so we do not repeatedly spam the network for unlisted titles
  metadataCache.set(cacheKey, null);
  saveMetadataCacheToDisk();
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
