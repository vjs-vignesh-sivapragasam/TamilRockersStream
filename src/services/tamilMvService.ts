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
  'https://www.1tamilmv.meme',
  'https://www.1tamilmv.rocks',
  'https://www.1tamilmv.li',
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

    const isRecent = !term || /^recent/i.test(term);
    const baseUrl = overrideUrl ? overrideUrl.replace(/\/+$/, '') : configuredBaseUrl;
    const searchUrl = isRecent
      ? baseUrl
      : `${baseUrl}/index.php?/search/&q=${encodeURIComponent(term)}&type=forums_topic`;

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
      return this.parseSearchResults(html, baseUrl, isRecent ? '' : term);
    } catch (err: any) {
      console.warn('TamilMV Search Fetch error:', err?.message || err);
      throw err;
    }
  },

  /**
   * Parse forum topic results from raw HTML search page
   */
  parseSearchResults(html: string, baseUrl: string, searchTerm: string): TamilMvMovieResult[] {
    const topicMap = new Map<string, string>();

    const cleanTopicUrl = (url: string) =>
      url.split('#')[0].replace(/&.*$/, '').replace(/\/page\/\d+\/?$/, '/');

    // 1. Matches anchors with title attribute (usually holds the complete full post title in IPS forums)
    const titleAttrRegex = /<a[^>]*href=["'](https?:\/\/[^"']*\/topic\/[^"']*)["'][^>]*title=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = titleAttrRegex.exec(html)) !== null) {
      const topicUrl = cleanTopicUrl(match[1]);
      const titleAttr = match[2].replace(/<[^>]*>/g, '').trim();
      if (topicUrl && !topicUrl.includes('/topic/183-0') && titleAttr && titleAttr.length >= 3 && !/^(page|next|prev|last)$/i.test(titleAttr)) {
        topicMap.set(topicUrl, titleAttr);
      }
    }

    // 2. Matches topic links and their inner text (keep the longest, most descriptive text)
    const topicRegex = /<a[^>]*href=["'](https?:\/\/[^"']*\/topic\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = topicRegex.exec(html)) !== null) {
      const topicUrl = cleanTopicUrl(match[1]);
      const rawText = match[2].replace(/<[^>]*>/g, '').trim();
      if (!topicUrl || topicUrl.includes('/topic/183-0') || !rawText || rawText.length < 3) continue;
      if (/^\d+$/.test(rawText) || /^(next|prev|last|page)$/i.test(rawText)) continue;

      const existing = topicMap.get(topicUrl);
      if (!existing || rawText.length > existing.length) {
        topicMap.set(topicUrl, rawText);
      }
    }

    const rawItems: { topicUrl: string; rawTitle: string }[] = [];
    topicMap.forEach((rawTitle, topicUrl) => {
      rawItems.push({ topicUrl, rawTitle });
    });

    return this.parseRawTopicItems(rawItems, searchTerm);
  },

  /**
   * Process and structure a list of scraped topic items into movies with resolutions
   */
  parseRawTopicItems(
    rawItems: { topicUrl: string; rawTitle: string }[],
    searchTerm: string = ''
  ): TamilMvMovieResult[] {
    const results: TamilMvMovieResult[] = [];
    const searchWords = (searchTerm || '')
      .toLowerCase()
      .split(/[\s_\-.]+/)
      .filter((w) => w.length > 1 && !/^(recent|upload|uploads|movies?|all)$/i.test(w));

    for (const item of rawItems) {
      if (!item.topicUrl || item.topicUrl.includes('/topic/183-0')) continue;
      const parsed = this.parseTitleMetadata(item.rawTitle.trim(), item.topicUrl);
      
      // Check if search terms match (skip check if search was generic like "Recent Upload")
      if (searchWords.length > 0) {
        const titleLower = `${parsed.movieTitle} ${parsed.topicTitle} ${parsed.topicUrl}`.toLowerCase();
        const matches = searchWords.some((word) => titleLower.includes(word));
        if (!matches) continue;
      }

      // Group resolutions under the same movie title
      const existing = results.find(
        (r) =>
          r.movieTitle.toLowerCase() === parsed.movieTitle.toLowerCase() ||
          (parsed.movieTitle.length > 3 && r.movieTitle.toLowerCase() === parsed.movieTitle.toLowerCase())
      );

      if (existing) {
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
    const isJunkText = (str: string) => {
      if (!str || str.length < 2) return true;
      const lower = str.toLowerCase().trim();
      return (
        /^(languages?|rips?|exclusive|\-|\+|\[|\/)/i.test(lower) ||
        /^[-–—\s\d.+]+(?:gb|mb)?(?:\s*\+\s*rips?)?[\])]?$/i.test(lower) ||
        /^(page|next|prev|last|forum|topic)$/i.test(lower) ||
        lower.includes('8.3gb') ||
        lower === 'languages' ||
        lower === 'language'
      );
    };

    let titleToParse = (rawTitle || '').replace(/<[^>]*>/g, '').trim();

    // If titleToParse is junk, badge-only, or lacks year, recover clean title from topicUrl slug!
    if (topicUrl && (isJunkText(titleToParse) || !/\b(19\d\d|20\d\d)\b/.test(titleToParse))) {
      const slugMatch = topicUrl.match(/\/topic\/\d+[-_]?([^/?#]+)/i);
      if (slugMatch && slugMatch[1]) {
        const slugDecoded = decodeURIComponent(slugMatch[1]).replace(/[-_]+/g, ' ').trim();
        if (slugDecoded.length > titleToParse.length || isJunkText(titleToParse)) {
          titleToParse = slugDecoded;
        }
      }
    }

    // Strip bracketed language tags like [Tamil + Telugu + Hindi] or [Exclusive] at start
    titleToParse = titleToParse.replace(/^\[[^\]]*\]\s*/g, '');
    titleToParse = titleToParse.replace(/^www\.[^\s]+ - /i, '').trim();

    // Extract Year (e.g. 2024, 2025, 2026, 2023)
    const yearMatch = titleToParse.match(/\b(19\d\d|20\d\d)\b/);
    const year = yearMatch ? yearMatch[1] : '';

    let cleanTitle = titleToParse;
    if (year) {
      const idx = titleToParse.indexOf(year);
      cleanTitle = titleToParse.substring(0, idx).trim();
    } else {
      cleanTitle = cleanTitle
        .replace(/www\.[^\s]+ - /gi, '')
        .replace(/(\[|\().*?(\]|\))/g, '')
        .replace(/\b(1080p|720p|4k|2160p|hdrip|web-dl|dvdrip|x264|hevc|aac|esub|sample|true)\b/gi, '')
        .trim();
    }

    // Clean leading & trailing punctuation, brackets, hyphens
    cleanTitle = cleanTitle
      .replace(/^[([{\-–—:_+\s]+/g, '')
      .replace(/[([{\-–—:_+\s]+$/g, '')
      .trim();

    // If still empty or junk, try fallback split on language/specs keywords
    if (!cleanTitle || cleanTitle.length < 2 || isJunkText(cleanTitle)) {
      const parts = titleToParse.split(/\s+(?:tamil|telugu|hindi|malayalam|kannada|1080p|720p|4k|web|hdrip)\b/i);
      if (parts[0] && parts[0].trim().length >= 2 && !isJunkText(parts[0])) {
        cleanTitle = parts[0].trim();
      } else {
        cleanTitle = titleToParse.slice(0, 30);
      }
    }

    // Secondary recovery from slug if cleanTitle is STILL junk
    if (isJunkText(cleanTitle) && topicUrl) {
      const slugMatch = topicUrl.match(/\/topic\/\d+[-_]?([^/?#]+)/i);
      if (slugMatch && slugMatch[1]) {
        const slugText = decodeURIComponent(slugMatch[1]).replace(/[-_]+/g, ' ').trim();
        const sYear = slugText.match(/\b(19\d\d|20\d\d)\b/);
        if (sYear) {
          cleanTitle = slugText.substring(0, slugText.indexOf(sYear[1])).trim();
        } else {
          cleanTitle = slugText
            .replace(/\b(tamil|telugu|hindi|malayalam|kannada|english|web|dl|hdrip|dvdrip|x264|x265|hevc|aac|esub|true|uncut|hq|rip|rips)\b/gi, '')
            .trim();
        }
      }
    }

    if (isJunkText(cleanTitle)) {
      cleanTitle = 'Tamil Movie';
    }

    // Format Title with clean Title Case
    cleanTitle = cleanTitle
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim();

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
      let magnetUrl = magnetMatch ? magnetMatch[1] : undefined;
      if (magnetUrl) {
        // Decode HTML entities like &amp; -> & so torrent clients and trackers parse correctly
        magnetUrl = magnetUrl.replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
      }

      // 2. Extract torrent file attachment URL
      const torrentMatch =
        html.match(/href=["'](https?:\/\/[^"']+\.torrent[^"']*)["']/i) ||
        html.match(
          /href=["'](https?:\/\/[^"']*\/index\.php\?\/applications\/core\/interface\/file\/attachment\.php\?[^"']+)["']/i
        );
      let torrentUrl = torrentMatch ? torrentMatch[1] : undefined;
      if (torrentUrl) {
        torrentUrl = torrentUrl.replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
      }

      return { magnetUrl, torrentUrl };
    } catch (err) {
      console.warn('Failed to extract magnet from topic:', err);
      return {};
    }
  },
};
