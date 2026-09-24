/**
 * TamilMV Movie & Resolution Search Service
 * Scrapes and parses movie listings, topics, and multi-resolution magnet/torrent links from 1TamilMV
 */

export interface MovieResolutionItem {
  id: string;
  resolution: string; // e.g. "1080p", "720p", "4K 2160p", "HQ HDRip 250MB", etc.
  rawTitle: string;
  size?: string; // e.g. "2.9 GB", "250 MB"
  audio?: string; // e.g. "DD+ 5.1", "AAC"
  codec?: string; // e.g. "HEVC", "AVC / x264"
  magnetUrl?: string;
  torrentFileUrl?: string;
  topicUrl: string;
}

export interface TamilMvMovieResult {
  id: string;
  movieTitle: string; // Cleaned movie title, e.g. "Modha Rathri", "Amaran", "Leo"
  year?: string;
  language?: string;
  posterUrl?: string;
  topicTitle: string;
  topicUrl: string;
  resolutions: MovieResolutionItem[];
}

export const DEFAULT_TAMILMV_URL = 'https://www.1tamilmv.lease';

export const POPULAR_MIRRORS = [
  'https://www.1tamilmv.lease',
  'https://www.1tamilmv.rocks',
  'https://www.1tamilmv.click',
  'https://www.1tamilmv.net',
  'https://www.1tamilmv.vin',
  'https://www.1tamilblasters.com',
];

let configuredBaseUrl = DEFAULT_TAMILMV_URL;

export const tamilMvService = {
  getBaseUrl(): string {
    return configuredBaseUrl;
  },

  setBaseUrl(url: string) {
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    // Remove trailing slash
    clean = clean.replace(/\/+$/, '');
    configuredBaseUrl = clean;
  },

  /**
   * Search for a movie by name from the configured 1TamilMV URL
   */
  async searchMovie(query: string, overrideUrl?: string): Promise<TamilMvMovieResult[]> {
    const term = query.trim();
    if (!term) return [];

    const baseUrl = overrideUrl ? overrideUrl.replace(/\/+$/, '') : configuredBaseUrl;
    const searchUrl = `${baseUrl}/index.php?/search/&q=${encodeURIComponent(term)}&type=forums_topic`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status} from ${baseUrl}`);
      }

      const html = await response.text();
      return this.parseSearchResults(html, baseUrl, term);
    } catch (err: any) {
      console.warn('TamilMV Search Fetch error:', err?.message || err);
      throw err;
    }
  },

  /**
   * Parse forum topic results from raw HTML search page
   */
  parseSearchResults(html: string, baseUrl: string, searchTerm: string): TamilMvMovieResult[] {
    const rawItems: { topicUrl: string; rawTitle: string }[] = [];
    const seenUrls = new Set<string>();

    // 1. Matches ipsStreamItem_title anchors
    const streamItemRegex = /<span[^>]*class=["'][^"']*ipsStreamItem_title[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["'](https?:\/\/[^"']*\/index\.php\?\/forums\/topic\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = streamItemRegex.exec(html)) !== null) {
      const topicUrl = match[1];
      const rawTitle = match[2].replace(/<[^>]*>/g, '').trim();
      if (rawTitle && !seenUrls.has(topicUrl)) {
        seenUrls.add(topicUrl);
        rawItems.push({ topicUrl, rawTitle });
      }
    }

    // 2. Fallback general topic anchor regex
    const topicRegex = /href=["'](https?:\/\/[^"']*\/index\.php\?\/forums\/topic\/(\d+-[^"'/]+)\/?)["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = topicRegex.exec(html)) !== null) {
      const topicUrl = match[1];
      const rawTitle = match[3].replace(/<[^>]*>/g, '').trim();
      if (rawTitle && rawTitle.length >= 4 && !seenUrls.has(topicUrl)) {
        // Exclude pagination / author link noise
        if (!/^\d+$/.test(rawTitle) && !/page|prev|next|last/i.test(rawTitle)) {
          seenUrls.add(topicUrl);
          rawItems.push({ topicUrl, rawTitle });
        }
      }
    }

    return this.parseRawTopicItems(rawItems, searchTerm);
  },

  /**
   * Process and structure a list of scraped topic items into movies with resolutions
   */
  parseRawTopicItems(
    rawItems: { topicUrl: string; rawTitle: string }[],
    searchTerm: string
  ): TamilMvMovieResult[] {
    const results: TamilMvMovieResult[] = [];
    const searchWords = searchTerm
      .toLowerCase()
      .split(/[\s_\-.]+/)
      .filter((w) => w.length > 1);

    for (const item of rawItems) {
      const rawTitle = item.rawTitle.trim();
      const titleLower = rawTitle.toLowerCase();

      // Check if search terms match
      if (searchWords.length > 0) {
        const matchesAll = searchWords.every((word) => titleLower.includes(word));
        const matchesAny = searchWords.some((word) => titleLower.includes(word));
        if (!matchesAll && !matchesAny) continue;
      }

      const parsed = this.parseTitleMetadata(rawTitle, item.topicUrl);

      // Group resolutions under the same movie title
      const existing = results.find(
        (r) =>
          r.movieTitle.toLowerCase() === parsed.movieTitle.toLowerCase() ||
          (parsed.movieTitle.length > 3 && r.movieTitle.toLowerCase().includes(parsed.movieTitle.toLowerCase()))
      );

      if (existing) {
        // Check if resolution already listed
        const hasRes = existing.resolutions.some((res) => res.rawTitle === parsed.resolutions[0].rawTitle);
        if (!hasRes) {
          existing.resolutions.push(...parsed.resolutions);
        }
      } else {
        results.push(parsed);
      }
    }

    return results;
  },

  /**
   * Parse movie title, year, language, and resolution info from a post title
   */
  parseTitleMetadata(rawTitle: string, topicUrl: string): TamilMvMovieResult {
    // Extract Year (e.g. 2024, 2025, 2026, 2023)
    const yearMatch = rawTitle.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? yearMatch[1] : '';

    // Extract Clean Movie Title
    let cleanTitle = rawTitle;
    if (year) {
      const parts = rawTitle.split(year);
      cleanTitle = parts[0].replace(/[(\[\\/]/g, '').trim();
    } else {
      cleanTitle = cleanTitle
        .replace(/www\.[^\s]+ - /gi, '')
        .replace(/(\[|\().*?(\]|\))/g, '')
        .replace(/1080p|720p|4k|2160p|hdrip|web-dl|dvdrip|x264|hevc|aac/gi, '')
        .trim();
    }

    // Clean prefix like "www.1TamilMV.rocks - "
    cleanTitle = cleanTitle.replace(/^www\.[^\s]+ - /i, '').trim();
    if (!cleanTitle) cleanTitle = rawTitle.slice(0, 30);

    // Extract Language
    let language = 'Tamil';
    const langMatch = rawTitle.match(/\b(Tamil|Telugu|Hindi|Malayalam|Kannada|English)\b/i);
    if (langMatch) {
      language = langMatch[1];
    }

    // Extract Size (e.g. 2.9GB, 1.4GB, 700MB, 250MB, 4.5GB)
    const sizeMatch = rawTitle.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB))\b/i);
    const size = sizeMatch ? sizeMatch[1].toUpperCase() : undefined;

    // Extract Codec (e.g. HEVC, AVC, x264, x265, 10Bit)
    const codecMatch = rawTitle.match(/\b(HEVC|AVC|x264|x265|H\.?264|H\.?265|10Bit)\b/i);
    const codec = codecMatch ? codecMatch[1] : undefined;

    // Extract Audio (e.g. DD+ 5.1, 640Kbps, AAC, Atmos, MP3)
    const audioMatch = rawTitle.match(/(DD\+?\s*5\.1|Atmos|AAC|MP3|\d+Kbps)/i);
    const audio = audioMatch ? audioMatch[1] : undefined;

    // Detect Resolution (e.g. 4K, 2160p, 1080p, 720p, 480p, HDRip, WEB-DL)
    let resolution = '1080p Full HD';
    if (/4k|2160p|uhd/i.test(rawTitle)) {
      resolution = '4K 2160p UHD';
    } else if (/1080p/i.test(rawTitle)) {
      resolution = '1080p Full HD';
    } else if (/720p/i.test(rawTitle)) {
      resolution = '720p HD';
    } else if (/480p/i.test(rawTitle)) {
      resolution = '480p SD';
    } else if (/250mb/i.test(rawTitle)) {
      resolution = 'HQ HDRip (250 MB)';
    } else if (/700mb/i.test(rawTitle)) {
      resolution = 'HQ HDRip (700 MB)';
    } else if (/hdrip|web-dl|dvdrip/i.test(rawTitle)) {
      resolution = 'HDRip / WEB-DL';
    }

    const resolutionItem: MovieResolutionItem = {
      id: `res-${Math.random().toString(36).substring(2, 9)}`,
      resolution,
      rawTitle,
      size,
      audio,
      codec,
      topicUrl,
    };

    return {
      id: `mv-${Math.random().toString(36).substring(2, 9)}`,
      movieTitle: cleanTitle,
      year,
      language,
      topicTitle: rawTitle,
      topicUrl,
      resolutions: [resolutionItem],
    };
  },

  /**
   * Extract direct magnet and .torrent download links from a topic page HTML
   */
  async extractMagnetFromTopic(topicUrl: string): Promise<{ magnetUrl?: string; torrentUrl?: string }> {
    if (!topicUrl) return {};
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(topicUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) return {};
      const html = await response.text();

      // 1. Extract magnet URL
      const magnetMatch = html.match(/href=["'](magnet:\?[^"']+)["']/i);
      const magnetUrl = magnetMatch ? magnetMatch[1] : undefined;

      // 2. Extract torrent file attachment URL
      const torrentMatch =
        html.match(/href=["'](https?:\/\/[^"']+\.torrent[^"']*)["']/i) ||
        html.match(
          /href=["'](https?:\/\/[^"']*\/index\.php\?\/applications\/core\/interface\/file\/attachment\.php\?[^"']+)["']/i
        );
      const torrentUrl = torrentMatch ? torrentMatch[1] : undefined;

      return { magnetUrl, torrentUrl };
    } catch (err) {
      console.warn('Failed to extract magnet from topic:', err);
      return {};
    }
  },
};
