/**
 * XML Feed Service for 1TamilMV RSS Feeds
 * Fetches and parses movie categories directly from XML feeds:
 * - Tamil Movies (PreDVD + HDRip)
 * - Hollywood
 * - HDTV
 * - Web Series
 * - 4K Movies
 */

import { TamilMvMovieResult, MovieResolutionItem, posterCache } from './tamilMvService';
import { storageService } from '@/utils/StorageService';

export type FeedCategoryKey = 'tamil' | 'hollywood' | 'hdtv' | 'series' | '4k';

export interface FeedCategoryConfig {
  key: FeedCategoryKey;
  label: string;
  urls: string[];
}

export const FEED_CATEGORIES: FeedCategoryConfig[] = [
  {
    key: 'tamil',
    label: 'Tamil Movies',
    urls: [
      'https://www.1tamilmv.solar/index.php?/forums/forum/10-predvd-dvdscr-cam-tc/all.xml',
      'https://www.1tamilmv.solar/index.php?/forums/forum/12-hd-rips-dvd-rips-br-rips/all.xml',
    ],
  },
  {
    key: 'hollywood',
    label: 'Hollywood',
    urls: [
      'https://www.1tamilmv.solar/index.php?/forums/forum/17-hollywood-movies-in-multi-audios/all.xml',
    ],
  },
  {
    key: 'hdtv',
    label: 'HDTV',
    urls: [
      'https://www.1tamilmv.solar/index.php?/forums/forum/14-hdtv-sdtv-hdtv-rips/all.xml',
    ],
  },
  {
    key: 'series',
    label: 'Web Series',
    urls: [
      'https://www.1tamilmv.solar/index.php?/forums/forum/19-web-series-tv-shows/all.xml',
    ],
  },
  {
    key: '4k',
    label: '4K Movies',
    urls: [
      'https://www.1tamilmv.solar/index.php?/forums/forum/13-dvd9-dvd5/all.xml',
    ],
  },
];

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const inMemoryFeedCache = new Map<string, { data: TamilMvMovieResult[]; timestamp: number }>();

function decodeHtml(html?: string): string {
  if (!html) return '';
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseItem(itemContent: string): TamilMvMovieResult | null {
  const titleMatch =
    itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ||
    itemContent.match(/<title>([\s\S]*?)<\/title>/i);
  const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/i);
  const descMatch =
    itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ||
    itemContent.match(/<description>([\s\S]*?)<\/description>/i);

  const rawTitle = titleMatch ? decodeHtml(titleMatch[1].trim()) : '';
  const topicUrl = linkMatch ? linkMatch[1].trim() : '';
  const desc = descMatch ? descMatch[1] : '';

  if (!rawTitle) return null;

  // 1. Poster extraction
  const allImgs = [...desc.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  const goodImg = allImgs.find(
    (im) =>
      !im[1].includes('torrborder') &&
      !im[1].includes('uTorrent') &&
      !im[1].includes('telegram') &&
      !im[1].includes('.gif') &&
      !im[1].includes('click_here')
  );
  const posterUrl = goodImg ? decodeHtml(goodImg[1]) : undefined;

  if (posterUrl && topicUrl) {
    posterCache.set(topicUrl, posterUrl);
  }

  // 2. Movie Title & Year extraction
  let cleanTitle = rawTitle;
  let year: string | undefined = undefined;

  const yearMatch = rawTitle.match(/\((\d{4})\)/);
  if (yearMatch) {
    year = yearMatch[1];
    cleanTitle = rawTitle.substring(0, rawTitle.indexOf(yearMatch[0])).trim();
  } else {
    const yearLoose = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearLoose) {
      year = yearLoose[1];
      cleanTitle = rawTitle.substring(0, rawTitle.indexOf(yearLoose[0])).trim();
    }
  }

  // Strip release keywords and boilerplate
  cleanTitle = cleanTitle
    .replace(/^[-\s|/]+/, '')
    .replace(/[-\s|/]+$/, '')
    .replace(
      /\b(tamil|telugu|hindi|malayalam|kannada|english|true|web-dl|hdrip|bluray|dvdrip|dvd9|dvd5|hdtv|sdtv|predvd|dvdscr|cam|tc|rip|rips)\b/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTitle && rawTitle) {
    cleanTitle = rawTitle.split(/[-–—(]/)[0].trim();
  }

  // 3. Resolutions & Magnets extraction
  const magnets = [...desc.matchAll(/href=["'](magnet:\?[^"']+)["']/gi)].map((x) => decodeHtml(x[1]));
  const torrents = [...desc.matchAll(/href=["']([^"']+\.torrent[^"']*)["']/gi)].map((x) => decodeHtml(x[1]));

  const resolutions: MovieResolutionItem[] = [];

  magnets.forEach((mag, i) => {
    let dn = '';
    try {
      const u = new URL(mag);
      dn = decodeURIComponent(u.searchParams.get('dn') || '');
    } catch {}

    const resMatch = (dn.match(/\b(2160p|4K|1080p|720p|480p|250MB|700MB|1\.4GB|2\.6GB|HEVC|HDRip|PreDVD|DVD9|DVD5|HDTV)\b/i) || [])[1];
    const sizeMatch = (dn.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB))\b/i) || [])[1];

    resolutions.push({
      id: `xml-res-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      resolution: resMatch || (i === 0 ? '1080p' : i === 1 ? '720p' : `Quality ${i + 1}`),
      rawTitle: dn || rawTitle,
      size: sizeMatch || undefined,
      magnetUrl: mag,
      torrentFileUrl: torrents[i] || undefined,
      topicUrl: topicUrl,
    });
  });

  return {
    id: topicUrl || `movie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    movieTitle: cleanTitle || rawTitle,
    year: year,
    posterUrl: posterUrl,
    topicTitle: rawTitle,
    topicUrl: topicUrl,
    resolutions: resolutions,
  };
}

async function fetchSingleXmlUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }

    return await response.text();
  } catch (err) {
    clearTimeout(timeoutId);
    // If solar failed, attempt mirror fallback
    if (url.includes('1tamilmv.solar')) {
      const fallbackUrl = url.replace('1tamilmv.solar', '1tamilmv.lease');
      const fallbackController = new AbortController();
      const fbTimeout = setTimeout(() => fallbackController.abort(), 10000);
      try {
        const fbRes = await fetch(fallbackUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: fallbackController.signal,
        });
        clearTimeout(fbTimeout);
        if (fbRes.ok) return await fbRes.text();
      } catch {
        clearTimeout(fbTimeout);
      }
    }
    throw err;
  }
}

export const xmlFeedService = {
  /**
   * Fetches and parses movies for a given category key
   */
  async fetchCategory(categoryKey: FeedCategoryKey, forceRefresh = false): Promise<TamilMvMovieResult[]> {
    const cacheKey = `xml_feed_${categoryKey}`;

    // 1. Check in-memory cache
    if (!forceRefresh) {
      const mem = inMemoryFeedCache.get(categoryKey);
      if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS && mem.data.length > 0) {
        return mem.data;
      }

      // 2. Check storage cache
      try {
        const stored = storageService.getItem(cacheKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.data) && parsed.data.length > 0) {
            inMemoryFeedCache.set(categoryKey, { data: parsed.data, timestamp: parsed.timestamp });
            return parsed.data;
          }
        }
      } catch {}
    }

    const config = FEED_CATEGORIES.find((c) => c.key === categoryKey);
    if (!config) return [];

    const movieMap = new Map<string, TamilMvMovieResult>();

    // Fetch all URLs for this category
    for (const feedUrl of config.urls) {
      try {
        const xml = await fetchSingleXmlUrl(feedUrl);
        const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

        for (const match of itemMatches) {
          const parsed = parseItem(match[1]);
          if (parsed && parsed.movieTitle) {
            const key = parsed.topicUrl || `${parsed.movieTitle.toLowerCase()}_${parsed.year || ''}`;
            if (!movieMap.has(key)) {
              movieMap.set(key, parsed);
            }
          }
        }
      } catch (err: any) {
        console.warn(`[xmlFeedService] Failed to fetch feed ${feedUrl}:`, err?.message || err);
      }
    }

    const results = Array.from(movieMap.values());

    if (results.length > 0) {
      const cacheEntry = { data: results, timestamp: Date.now() };
      inMemoryFeedCache.set(categoryKey, cacheEntry);
      try {
        storageService.setItem(cacheKey, JSON.stringify(cacheEntry));
      } catch {}
    }

    return results;
  },

  /**
   * Clear cached feeds
   */
  clearCache() {
    inMemoryFeedCache.clear();
  },
};
