import { MagnetParser } from '@/utils/MagnetParser';
import { storageService } from '@/utils/StorageService';
import { useEffect, useState, useCallback } from 'react';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Constants ────────────────────────────────────────────────────────────────

const TAMILMV_BASE_URL = 'https://www.1tamilmv.capital';

export type Language = 'tamil' | 'english' | 'hindi' | 'telugu' | 'malayalam' | 'kannada';
export type Category = 'webhd' | 'hdrip' | 'hdtv' | 'series' | 'multiaudio';

const FORUM_IDS: Record<Language, Partial<Record<Category, string>>> = {
  tamil: {
    webhd: '11-web-hd-itunes-hd-bluray',
    series: '19-web-series-tv-shows',
    multiaudio: '17-hollywood-movies-in-multi-audios',
    hdrip: '12-hd-rips-dvd-rips-br-rips',
    hdtv: '14-hdtv-sdtv-hdtv-rips',
  },
  english: {
    webhd: '49-web-hd-itunes-hd-bluray',
    hdrip: '50-hd-rips-dvd-rips-br-rips'
  },
  hindi: {
    webhd: '58-web-hd-itunes-hd-bluray',
    hdrip: '59-hd-rips-dvd-rips-br-rips'
  },
  telugu: {
    webhd: '24-web-hd-itunes-hd-bluray',
    hdrip: '25-hd-rips-dvd-rips-br-rips'
  },
  malayalam: {
    webhd: '36-web-hd-itunes-hd-bluray',
    hdrip: '37-hd-rips-dvd-rips-br-rips'
  },
  kannada: {
    webhd: '69-web-hd-itunes-hd-bluray',
    hdrip: '70-hd-rips-dvd-rips-br-rips'
  },
};

const CATEGORY_LABELS: Record<Category, string> = {
  webhd: 'Web HD',
  hdrip: 'HD Rip',
  hdtv: 'HD TV',
  multiaudio: 'Multi Audios',
  series: 'Web Series & TV Shows',
};

const CATEGORY_TYPE: Record<Category, 'movie' | 'series'> = {
  webhd: 'movie',
  hdrip: 'movie',
  hdtv: 'movie',
  multiaudio: 'movie',
  series: 'series'
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TorrentItem {
  name: string | null;
  year: string | null;
  language: string;
  groupid: string;
  guid: string;
  poster: string | null;
  title: string;
  magnetUrl: string;
  infoHash: string;
  publishDate: string;
}

export interface GroupedItem {
  name: string | null;
  year: string | null;
  items: TorrentItem[];
}

export interface CatalogSection {
  category: Category;
  label: string;
  type: 'movie' | 'series';
  groups: GroupedItem[];
}

interface CacheEntry {
  data: GroupedItem[];
  timestamp: number;
}

// ─── XML Parsing ──────────────────────────────────────────────────────────────

function getTagContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractCDATA(content: string): string {
  const m = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : content;
}

function decodeHtml(html: string): string {
  if (!html) return html;
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&#x2F;': '/', '&#x3D;': '=', '&#39;': "'",
  };
  let decoded = html;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  decoded = decoded.replace(/&#(\d+);/g, (_m, dec: string) => String.fromCharCode(parseInt(dec, 10)));
  decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return decoded;
}

function extractPoster(description: string): string | null {
  const m = description.match(/<img [^>]*src="([^"]+)"/i);
  return m ? decodeHtml(m[1]) : null;
}

const INVALID_RELEASE_REGEX = /\s(cam|unknown|telesync|dvdsrc|dvdscr|predvdrip|prehd|pre-hdrip|hdts|hdtv|camrip)\s/i;
const LOW_QUALITY_REGEX = /(480p|720p|360p|240p)/i;
const TITLE_YEAR_REGEX = /^([^(]+)\s*\((\d{4})\)/;

function isValidQuality(displayName: string, category: Category): boolean {
  return !INVALID_RELEASE_REGEX.test(displayName) && !LOW_QUALITY_REGEX.test(displayName);
}

function extractTitleYear(title: string): { name: string | null; year: string | null } {
  const cleaned = title.replace(/^[^-]+-\s*/, '');
  const match = cleaned.match(TITLE_YEAR_REGEX);
  return match ? { name: match[1].trim(), year: match[2] } : { name: null, year: null };
}

function parseRSSFeed(xmlString: string, language: Language, category: Category): GroupedItem[] {
  const itemMatches = [...xmlString.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const grouped: Record<string, GroupedItem> = {};

  for (const match of itemMatches) {
    const itemContent = match[1];
    const description = extractCDATA(getTagContent(itemContent, 'description'));
    const pubDate = getTagContent(itemContent, 'pubDate');
    const guid = getTagContent(itemContent, 'guid');
    const poster = extractPoster(description);

    const magnetLinks = MagnetParser.extractMagnetLinks(description);
    if (magnetLinks.length === 0) continue;

    magnetLinks.forEach((magnetLink, i) => {
      const displayName = MagnetParser.extractDisplayName(magnetLink);
      if (!displayName || !isValidQuality(displayName, category)) return;

      const { name, year } = extractTitleYear(displayName);
      const key = `${name}|||${year}`;

      if (!grouped[key]) {
        grouped[key] = { name, year, items: [] };
      }

      let infoHash = '';
      try {
        const url = new URL(magnetLink);
        infoHash = url.searchParams.get('xt')?.replace('urn:btih:', '') ?? '';
      } catch { }

      grouped[key].items.push({
        name,
        year,
        language,
        groupid: guid,
        guid: `${guid}-magnet-${i}`,
        poster,
        title: displayName,
        magnetUrl: magnetLink,
        infoHash,
        publishDate: pubDate || new Date().toUTCString(),
      });
    });
  }

  return Object.values(grouped).sort((a, b) => {
    const aDate = a.items[0]?.publishDate ?? '';
    const bDate = b.items[0]?.publishDate ?? '';
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

// ─── Fetch + Cache ────────────────────────────────────────────────────────────

function getRssUrl(language: Language, category: Category): string | null {
  const forumId = FORUM_IDS[language]?.[category];
  if (!forumId) return null;
  return `${TAMILMV_BASE_URL}/index.php?/forums/forum/${forumId}/all.xml`;
}

function getCacheKey(language: Language, category: Category): string {
  return `rss:${language}:${category}`;
}

function readCache(key: string): GroupedItem[] | null {
  try {
    const raw = storageService.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: GroupedItem[]): void {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    storageService.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.warn('Cache write failed', e);
  }
}

function deleteCache(key: string): void {
  try {
    storageService.removeItem(key);
  } catch { }
}

async function fetchAndParse(language: Language, category: Category): Promise<GroupedItem[]> {
  const cacheKey = getCacheKey(language, category);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const url = getRssUrl(language, category);
  if (!url) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Cache-Control': 'no-cache',
    },
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const xml = await response.text();
  const groups = parseRSSFeed(xml, language, category);
  writeCache(cacheKey, groups);
  return groups;
}

// ─── Hook: single category ────────────────────────────────────────────────────

interface UseTamilMVResult {
  groups: GroupedItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTamilMV(language: Language, category: Category): UseTamilMVResult {
  const [groups, setGroups] = useState<GroupedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    deleteCache(getCacheKey(language, category));
    setTick((t) => t + 1);
  }, [language, category]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAndParse(language, category)
      .then((data) => { if (!cancelled) setGroups(data); })
      .catch((e: any) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [language, category, tick]);

  return { groups, loading, error, refresh };
}

// ─── Hook: all categories for a language (home screen) ───────────────────────

interface UseTamilMVCatalogResult {
  sections: CatalogSection[];
  loading: boolean;
  errors: string[];
  refresh: () => void;
}

export function useTamilMVCatalog(language: Language): UseTamilMVCatalogResult {
  const availableCategories = Object.keys(FORUM_IDS[language]) as Category[];

  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    availableCategories.forEach((cat) => deleteCache(getCacheKey(language, cat)));
    setTick((t) => t + 1);
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrors([]);
    setSections([]);

    const results: CatalogSection[] = [];
    const errs: string[] = [];

    Promise.all(
      availableCategories.map(async (category) => {
        try {
          const groups = await fetchAndParse(language, category);
          results.push({
            category,
            label: CATEGORY_LABELS[category],
            type: CATEGORY_TYPE[category],
            groups,
          });
        } catch (e: any) {
          errs.push(`${category}: ${e.message}`);
        }
      }),
    ).then(() => {
      if (cancelled) return;
      const ordered = availableCategories
        .map((cat) => results.find((r) => r.category === cat))
        .filter((s): s is CatalogSection => Boolean(s));
      setSections(ordered);
      setErrors(errs);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [language, tick]);

  return { sections, loading, errors, refresh };
}

// ─── Re-export helpers for consumers ─────────────────────────────────────────

export { FORUM_IDS, CATEGORY_LABELS, CATEGORY_TYPE };