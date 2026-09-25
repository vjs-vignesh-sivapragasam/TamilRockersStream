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

    const stripForumBoilerplate = (str: string): string => {
      if (!str) return '';
      return str
        .replace(/<[^>]*>/g, '')
        .replace(/^(?:view\s+(?:the\s+)?topic|go\s+to\s+(?:the\s+)?topic)[\s:'"‘“\-]*/i, '')
        .replace(/['"’”]+$/g, '')
        .replace(/^['"‘“]+/g, '')
        .trim();
    };

    // 1. Matches anchors with title attribute (usually holds the complete full post title in IPS forums)
    const titleAttrRegex = /<a[^>]*href=["'](https?:\/\/[^"']*\/topic\/[^"']*)["'][^>]*title=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = titleAttrRegex.exec(html)) !== null) {
      const topicUrl = cleanTopicUrl(match[1]);
      const titleAttr = stripForumBoilerplate(match[2]);
      if (topicUrl && !topicUrl.includes('/topic/183-0') && titleAttr && titleAttr.length >= 3 && !/^(page|next|prev|last)$/i.test(titleAttr)) {
        topicMap.set(topicUrl, titleAttr);
      }
    }

    // 2. Matches topic links and their inner text (keep the longest, most descriptive text)
    const topicRegex = /<a[^>]*href=["'](https?:\/\/[^"']*\/topic\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = topicRegex.exec(html)) !== null) {
      const topicUrl = cleanTopicUrl(match[1]);
      const rawText = stripForumBoilerplate(match[2]);
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
        for (const res of parsed.resolutions) {
          const hasRes = existing.resolutions.some(
            (r) => r.resolution === res.resolution && (r.size === res.size || !res.size)
          );
          if (!hasRes) {
            existing.resolutions.push(res);
          }
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
    const stripForumBoilerplate = (str: string): string => {
      if (!str) return '';
      return str
        .replace(/<[^>]*>/g, '')
        .replace(/^(?:view\s+(?:the\s+)?topic|go\s+to\s+(?:the\s+)?topic)[\s:'"‘“\-]*/i, '')
        .replace(/['"’”]+$/g, '')
        .replace(/^['"‘“]+/g, '')
        .trim();
    };

    const isJunkText = (str: string) => {
      if (!str || str.length < 2) return true;
      const lower = str.toLowerCase().trim();
      return (
        /^(languages?|rips?|exclusive|\-|\+|\[|\/)/i.test(lower) ||
        /^[-–—\s\d.+]+(?:gb|mb)?(?:\s*\+\s*rips?)?[\])]?$/i.test(lower) ||
        /^(page|next|prev|last|forum|topic)$/i.test(lower) ||
        /^(view\s+(?:the\s+)?topic|go\s+to\s+topic)/i.test(lower) ||
        lower.includes('8.3gb') ||
        lower === 'languages' ||
        lower === 'language'
      );
    };

    let titleToParse = stripForumBoilerplate(rawTitle || '');

    // If titleToParse is junk, badge-only, or lacks year, recover clean title from topicUrl slug!
    if (topicUrl && (isJunkText(titleToParse) || !/\b(19\d\d|20\d\d)\b/.test(titleToParse))) {
      const slugMatch = topicUrl.match(/\/topic\/\d+[-_]?([^/?#]+)/i);
      if (slugMatch && slugMatch[1]) {
        const slugDecoded = decodeURIComponent(slugMatch[1]).replace(/[-_]+/g, ' ').trim();
        if (slugDecoded.length > titleToParse.length || isJunkText(titleToParse)) {
          titleToParse = stripForumBoilerplate(slugDecoded);
        }
      }
    }

    // Strip bracketed language tags like [Tamil + Telugu + Hindi] or [Exclusive] at start
    titleToParse = titleToParse.replace(/^\[[^\]]*\]\s*/g, '');
    titleToParse = titleToParse.replace(/^www\.[^\s]+ - /i, '').trim();
    titleToParse = stripForumBoilerplate(titleToParse);

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

    // Clean leading & trailing punctuation, brackets, hyphens, and boilerplate
    cleanTitle = stripForumBoilerplate(cleanTitle)
      .replace(/^[([{\-–—:_+\s]+/g, '')
      .replace(/[([{\-–—:_+\s]+$/g, '')
      .trim();

    // If still empty or junk, try fallback split on language/specs keywords
    if (!cleanTitle || cleanTitle.length < 2 || isJunkText(cleanTitle)) {
      const parts = titleToParse.split(/\s+(?:tamil|telugu|hindi|malayalam|kannada|1080p|720p|4k|web|hdrip)\b/i);
      if (parts[0] && parts[0].trim().length >= 2 && !isJunkText(parts[0])) {
        cleanTitle = stripForumBoilerplate(parts[0].trim());
      } else {
        cleanTitle = stripForumBoilerplate(titleToParse.slice(0, 30));
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

    cleanTitle = stripForumBoilerplate(cleanTitle);

    if (isJunkText(cleanTitle)) {
      cleanTitle = 'Tamil Movie';
    }

    // Format Title with clean Title Case
    cleanTitle = cleanTitle
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim();

    cleanTitle = stripForumBoilerplate(cleanTitle);

    // Extract Language
    let language = 'Tamil';
    const langMatch = rawTitle.match(/\b(Tamil|Telugu|Hindi|Malayalam|Kannada|English)\b/i);
    if (langMatch) {
      language = langMatch[1];
    }

    // Extract Codec (e.g. HEVC, AVC, x264, x265, 10Bit)
    const codecMatch = rawTitle.match(/\b(HEVC|AVC|x264|x265|H\.?264|H\.?265|10Bit)\b/i);
    const codec = codecMatch ? codecMatch[1] : undefined;

    // Extract Audio (e.g. DD+ 5.1, 640Kbps, AAC, Atmos, MP3)
    const audioMatch = rawTitle.match(/(DD\+?\s*5\.1|Atmos|AAC|MP3|\d+Kbps)/i);
    const audio = audioMatch ? audioMatch[1] : undefined;

    // Helper to get estimated clean size if not explicitly in segment
    const getEstimateSize = (resName: string): string => {
      if (/4k|2160p/i.test(resName)) return '6.5 GB';
      if (/1080p/i.test(resName)) return '2.8 GB';
      if (/720p.*hevc|hevc/i.test(resName)) return '850 MB';
      if (/720p/i.test(resName)) return '1.4 GB';
      if (/480p/i.test(resName)) return '450 MB';
      if (/250mb/i.test(resName)) return '250 MB';
      if (/700mb/i.test(resName)) return '700 MB';
      return '1.4 GB';
    };

    const resolutions: MovieResolutionItem[] = [];

    // Check if rawTitle lists multiple distinct resolutions separated by '|', '/', or multiple quality keywords
    const hasMultipleRes =
      (rawTitle.includes('|') || rawTitle.includes('/')) &&
      /(1080p|720p|480p|4k|2160p|250mb|700mb|hevc)/i.test(rawTitle);

    if (hasMultipleRes) {
      const segments = rawTitle.split(/[|/]/);
      for (const seg of segments) {
        if (!/(1080p|720p|480p|4k|2160p|250mb|700mb|hevc|hdrip)/i.test(seg)) continue;
        const segSizeMatch = seg.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB))\b/i);
        let segRes = '1080p Full HD';
        if (/4k|2160p|uhd/i.test(seg)) segRes = '4K 2160p UHD';
        else if (/1080p/i.test(seg)) segRes = '1080p Full HD';
        else if (/720p.*hevc|hevc.*720p/i.test(seg)) segRes = '720p HEVC';
        else if (/720p/i.test(seg)) segRes = '720p HD';
        else if (/480p/i.test(seg)) segRes = '480p SD';
        else if (/250mb/i.test(seg)) segRes = 'HQ HDRip (250 MB)';
        else if (/700mb/i.test(seg)) segRes = 'HQ HDRip (700 MB)';
        else if (/hevc/i.test(seg)) segRes = 'HEVC 10Bit';
        else if (/hdrip|web-dl/i.test(seg)) segRes = 'HDRip / WEB-DL';

        const segSize = segSizeMatch ? segSizeMatch[1].toUpperCase() : getEstimateSize(segRes);

        if (!resolutions.some((r) => r.resolution === segRes)) {
          resolutions.push({
            id: `res-${Math.random().toString(36).substring(2, 9)}`,
            resolution: segRes,
            rawTitle: seg.trim(),
            size: segSize,
            audio,
            codec,
            topicUrl,
          });
        }
      }
    }

    if (resolutions.length === 0) {
      // Single resolution extraction
      let resolution = '1080p Full HD';
      if (/4k|2160p|uhd/i.test(rawTitle)) {
        resolution = '4K 2160p UHD';
      } else if (/1080p/i.test(rawTitle)) {
        resolution = '1080p Full HD';
      } else if (/720p.*hevc|hevc.*720p/i.test(rawTitle)) {
        resolution = '720p HEVC';
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

      const sizeMatch = rawTitle.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB))\b/i);
      const size = sizeMatch ? sizeMatch[1].toUpperCase() : getEstimateSize(resolution);

      resolutions.push({
        id: `res-${Math.random().toString(36).substring(2, 9)}`,
        resolution,
        rawTitle,
        size,
        audio,
        codec,
        topicUrl,
      });
    }

    // Sort resolutions: 4K -> 1080p -> 720p -> 480p -> 250MB
    const getResOrder = (res: string): number => {
      if (/4k|2160p/i.test(res)) return 1;
      if (/1080p/i.test(res)) return 2;
      if (/720p.*hevc/i.test(res)) return 3;
      if (/720p/i.test(res)) return 4;
      if (/480p/i.test(res)) return 5;
      if (/700mb/i.test(res)) return 6;
      if (/250mb/i.test(res)) return 7;
      return 8;
    };
    resolutions.sort((a, b) => getResOrder(a.resolution) - getResOrder(b.resolution));

    return {
      id: `mv-${Math.random().toString(36).substring(2, 9)}`,
      movieTitle: cleanTitle,
      year,
      language,
      topicTitle: rawTitle,
      topicUrl,
      resolutions,
    };
  },

  /**
   * Extract direct magnet and .torrent download links from a topic page HTML.
   * If targetResolution is specified, finds the magnet specifically matching that quality.
   */
  async extractMagnetFromTopic(
    topicUrl: string,
    targetResolution?: string
  ): Promise<{ magnetUrl?: string; torrentUrl?: string }> {
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

      // Find all magnet links with context
      const magnetRegex = /href=["'](magnet:\?[^"']+)["']/gi;
      let mMatch;
      const allMagnets: { url: string; context: string }[] = [];

      while ((mMatch = magnetRegex.exec(html)) !== null) {
        let cleanMagnet = mMatch[1].replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
        const start = Math.max(0, mMatch.index - 250);
        const context = html.substring(start, mMatch.index).replace(/<[^>]+>/g, ' ');
        const dnMatch = cleanMagnet.match(/[?&]dn=([^&]+)/i);
        const dn = dnMatch ? decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')) : '';
        allMagnets.push({ url: cleanMagnet, context: `${context} ${dn}`.toLowerCase() });
      }

      let selectedMagnet = allMagnets.length > 0 ? allMagnets[0].url : undefined;

      if (targetResolution && allMagnets.length > 1) {
        const target = targetResolution.toLowerCase();
        let keyword = '';
        if (/4k|2160p/i.test(target)) keyword = '4k';
        else if (/1080p/i.test(target)) keyword = '1080p';
        else if (/720p.*hevc|hevc/i.test(target)) keyword = 'hevc';
        else if (/720p/i.test(target)) keyword = '720p';
        else if (/480p/i.test(target)) keyword = '480p';
        else if (/250mb/i.test(target)) keyword = '250mb';
        else if (/700mb/i.test(target)) keyword = '700mb';

        if (keyword) {
          const match = allMagnets.find((m) => m.context.includes(keyword));
          if (match) {
            selectedMagnet = match.url;
          }
        }
      }

      // Extract torrent file attachment URL
      const torrentMatch =
        html.match(/href=["'](https?:\/\/[^"']+\.torrent[^"']*)["']/i) ||
        html.match(
          /href=["'](https?:\/\/[^"']*\/index\.php\?\/applications\/core\/interface\/file\/attachment\.php\?[^"']+)["']/i
        );
      let torrentUrl = torrentMatch ? torrentMatch[1] : undefined;
      if (torrentUrl) {
        torrentUrl = torrentUrl.replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
      }

      return { magnetUrl: selectedMagnet, torrentUrl };
    } catch (err) {
      console.warn('Failed to extract magnet from topic:', err);
      return {};
    }
  },

  /**
   * Extract all resolution items with their exact file sizes, codecs, and magnet URLs
   * directly from a topic page HTML.
   */
  async extractResolutionsFromTopic(topicUrl: string): Promise<MovieResolutionItem[]> {
    if (!topicUrl) return [];
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

      if (!response.ok) return [];
      const html = await response.text();

      // Find first comment / post content container
      const postMatch =
        html.match(/data-role=["']commentContent["'][\s\S]*?(?:<\/div>\s*<\/div>|<!--post)/i) ||
        html.match(/class=["'][^"']*ipsType_richText[^"']*["'][\s\S]*?<\/div>/i);
      const searchArea = postMatch ? postMatch[0] : html;

      // Extract all magnet links
      const magnetRegex = /href=["'](magnet:\?[^"']+)["']/gi;
      let mMatch;
      const magnets: { url: string; index: number }[] = [];

      while ((mMatch = magnetRegex.exec(searchArea)) !== null) {
        let cleanMagnet = mMatch[1].replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
        magnets.push({ url: cleanMagnet, index: mMatch.index });
      }

      if (magnets.length === 0) return [];

      const results: MovieResolutionItem[] = [];

      for (let i = 0; i < magnets.length; i++) {
        const { url: magnetUrl, index } = magnets[i];

        // 1. Extract context text preceding this magnet link
        const startIndex = Math.max(0, index - 300);
        const precedingSnippet = searchArea.substring(startIndex, index);
        const cleanPrecedingText = precedingSnippet.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

        // 2. Extract dn= from magnet
        const dnMatch = magnetUrl.match(/[?&]dn=([^&]+)/i);
        let dnText = dnMatch ? decodeURIComponent(dnMatch[1].replace(/\+/g, ' ')) : '';

        const fullContext = `${cleanPrecedingText} ${dnText}`;

        // 3. Extract Size
        const sizeMatch = fullContext.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB))\b/i);
        let size = sizeMatch ? sizeMatch[1].toUpperCase() : undefined;

        // 4. Extract Resolution
        let resolution = '1080p Full HD';
        if (/4k|2160p|uhd/i.test(fullContext)) {
          resolution = '4K 2160p UHD';
          if (!size) size = '6.5 GB';
        } else if (/1080p/i.test(fullContext)) {
          resolution = '1080p Full HD';
          if (!size) size = '2.8 GB';
        } else if (/720p.*hevc|hevc.*720p/i.test(fullContext)) {
          resolution = '720p HEVC';
          if (!size) size = '850 MB';
        } else if (/720p/i.test(fullContext)) {
          resolution = '720p HD';
          if (!size) size = '1.4 GB';
        } else if (/480p/i.test(fullContext)) {
          resolution = '480p SD';
          if (!size) size = '450 MB';
        } else if (/250mb/i.test(fullContext)) {
          resolution = 'HQ HDRip (250 MB)';
          size = '250 MB';
        } else if (/700mb/i.test(fullContext)) {
          resolution = 'HQ HDRip (700 MB)';
          size = '700 MB';
        } else if (/hevc/i.test(fullContext)) {
          resolution = 'HEVC 10Bit';
          if (!size) size = '1.0 GB';
        } else if (/hdrip|web-dl/i.test(fullContext)) {
          resolution = 'HDRip / WEB-DL';
          if (!size) size = '1.2 GB';
        }

        // 5. Codec & Audio
        const codecMatch = fullContext.match(/\b(HEVC|AVC|x264|x265|H\.?264|H\.?265|10Bit)\b/i);
        const codec = codecMatch ? codecMatch[1] : undefined;

        const audioMatch = fullContext.match(/(DD\+?\s*5\.1|Atmos|AAC|MP3|\d+Kbps)/i);
        const audio = audioMatch ? audioMatch[1] : undefined;

        if (!results.some((r) => r.resolution === resolution && r.size === size)) {
          results.push({
            id: `res-topic-${i}-${Math.random().toString(36).substring(2, 7)}`,
            resolution,
            rawTitle: dnText || resolution,
            size: size || '1.4 GB',
            audio,
            codec,
            magnetUrl,
            topicUrl,
          });
        }
      }

      // Sort resolutions
      const getResOrder = (res: string): number => {
        if (/4k|2160p/i.test(res)) return 1;
        if (/1080p/i.test(res)) return 2;
        if (/720p.*hevc/i.test(res)) return 3;
        if (/720p/i.test(res)) return 4;
        if (/480p/i.test(res)) return 5;
        if (/700mb/i.test(res)) return 6;
        if (/250mb/i.test(res)) return 7;
        return 8;
      };
      results.sort((a, b) => getResOrder(a.resolution) - getResOrder(b.resolution));

      return results;
    } catch (err) {
      console.warn('Failed to extract resolutions from topic:', err);
      return [];
    }
  },

  /**
   * Extract the movie poster/thumbnail image URL from a topic page.
   * Looks for the first large content image (skips avatars, icons, banners, UI assets).
   */
  async extractPosterFromTopic(topicUrl: string): Promise<string | undefined> {
    if (!topicUrl) return undefined;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(topicUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) return undefined;
      const html = await response.text();

      // Derive origin from topicUrl so relative paths can be resolved
      let topicOrigin = '';
      try {
        const u = new URL(topicUrl);
        topicOrigin = u.origin; // e.g. "https://www.1tamilmv.lease"
      } catch {}

      // Find first comment / post content container
      const postMatch =
        html.match(/data-role=["']commentContent["'][\s\S]*?(?:<\/div>\s*<\/div>|<!--post)/i) ||
        html.match(/class=["'][^"']*ipsType_richText[^"']*["'][\s\S]*?<\/div>/i);
      const searchArea = postMatch ? postMatch[0] : html;

      // Extract all <img> tags and their src/data-src attributes
      const imgRegex = /<img[^>]+(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["'][^>]*>/gi;
      let match;

      while ((match = imgRegex.exec(searchArea)) !== null) {
        let src = match[1].replace(/&amp;/g, '&').trim();
        if (!src || src.length < 8) continue;
        if (/data:image/i.test(src)) continue;
        if (/\.(gif|svg|ico)(\?|$)/i.test(src)) continue;
        if (
          /(avatar|emoji|emoticon|smilie|icon|logo|banner|ad|pixel|track|torrborder|uTorrent|defaultPhoto|theme_images|ranks?|badges?)/i.test(
            src
          )
        ) {
          continue;
        }

        // Support standard image extensions AND query param images like pbs.twimg.com/media/...?format=jpg
        const isImgExt = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src) || /format=(jpg|jpeg|png|webp)/i.test(src);
        // Also support images hosted on known image hosting boards
        const isKnownHost =
          /(twimg\.com|pixelbb\.com|postimg|ibb\.co|imgur|imghippo|imagebam|turboimagehost)/i.test(src);

        if (isImgExt || isKnownHost) {
          // Convert relative URLs to absolute
          if (src.startsWith('//')) {
            src = 'https:' + src;
          } else if (src.startsWith('/') && topicOrigin) {
            src = topicOrigin + src;
          }
          if (src.startsWith('http://') || src.startsWith('https://')) {
            return src;
          }
        }
      }

      // Fallback: check og:image meta tag if present
      const ogMatch =
        html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
      if (ogMatch && ogMatch[1]) {
        let ogSrc = ogMatch[1].replace(/&amp;/g, '&').trim();
        if (!/(logo|icon|avatar|default)/i.test(ogSrc) && !/\.(gif|svg|ico)(\?|$)/i.test(ogSrc)) {
          if (ogSrc.startsWith('//')) ogSrc = 'https:' + ogSrc;
          else if (ogSrc.startsWith('/') && topicOrigin) ogSrc = topicOrigin + ogSrc;
          if (ogSrc.startsWith('http://') || ogSrc.startsWith('https://')) {
            return ogSrc;
          }
        }
      }

      return undefined;
    } catch (err) {
      console.warn('Failed to extract poster from topic:', err);
      return undefined;
    }
  },
};

// Module-level in-memory poster cache: topicUrl → posterUrl | null (null = confirmed no poster)
export const posterCache = new Map<string, string | null>();

