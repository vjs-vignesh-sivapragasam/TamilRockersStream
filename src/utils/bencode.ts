/**
 * Lightweight Bencode Parser for .torrent files and Magnet link parser.
 * Supports integers, strings/byte arrays, lists, and dictionaries.
 */
import * as FileSystem from 'expo-file-system/legacy';

export interface ParsedTorrentInfo {
  name: string;
  totalSize: number;
  pieceLength?: number;
  piecesCount?: number;
  files?: { path: string; length: number }[];
  announce?: string;
  trackers?: string[];
  urlList?: string[];
  mainMovieFile?: {
    name: string;
    path: string;
    length: number;
    downloadUrl?: string;
  };
  comment?: string;
  createdBy?: string;
  creationDate?: Date;
  infoHash?: string;
}

export function parseMagnetUri(uri: string): ParsedTorrentInfo | null {
  if (!uri.startsWith('magnet:?')) return null;
  const params = new URLSearchParams(uri.substring(8));
  const xt = params.get('xt') || '';
  const dn = params.get('dn') || 'Torrent Download';
  const tr = params.getAll('tr');

  let infoHash = '';
  if (xt.startsWith('urn:btih:')) {
    infoHash = xt.substring(9);
  }

  return {
    name: dn,
    totalSize: 0,
    infoHash,
    announce: tr[0] || undefined,
    trackers: tr,
  };
}

export function extractInfoHashFromUrl(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  if (trimmed.startsWith('magnet:?')) {
    const parsed = parseMagnetUri(trimmed);
    if (parsed && parsed.infoHash) {
      return parsed.infoHash.toLowerCase();
    }
    const match = trimmed.match(/urn:btih:([a-fA-F0-9]{40}|[a-fA-F0-9]{32})/i);
    if (match) return match[1].toLowerCase();
  }

  const streamMatch = trimmed.match(/\/api\/stream\/([a-fA-F0-9]{40}|[a-fA-F0-9]{32})/i);
  if (streamMatch) {
    return streamMatch[1].toLowerCase();
  }

  if (/^[a-fA-F0-9]{40}$/i.test(trimmed) || /^[a-fA-F0-9]{32}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return null;
}

export function isTorrentUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('magnet:?')) return true;
  if (trimmed.includes('/api/stream/')) return true;
  if (extractInfoHashFromUrl(url)) return true;

  // Clean query string and fragments for path inspection
  const cleanUrl = trimmed.split('?')[0].split('#')[0];
  if (cleanUrl.endsWith('.torrent')) return true;

  // Check for common torrent download query params or path segments
  if (trimmed.includes('.torrent')) return true;
  if (trimmed.includes('download.php') && (trimmed.includes('torrent') || trimmed.includes('id='))) return true;
  if (trimmed.includes('/torrents/') && trimmed.includes('/download')) return true;

  return false;
}

export function extractTorrentFileName(url: string, suggestedTitle?: string): string {
  const isStream = url.includes('/api/stream/');
  const infoHash = extractInfoHashFromUrl(url);

  if (suggestedTitle && suggestedTitle.trim().length > 0) {
    let title = suggestedTitle.trim();
    if (isStream || infoHash || !title.includes('.')) {
      if (!title.match(/\.(mp4|mkv|avi|webm|ts|mov)$/i) && !title.toLowerCase().endsWith('.torrent')) {
        title += isStream || infoHash ? '.mp4' : '.torrent';
      }
    }
    return title;
  }

  if (url.startsWith('magnet:?')) {
    const parsed = parseMagnetUri(url);
    if (parsed && parsed.name && parsed.name !== 'Torrent Download') {
      const name = parsed.name;
      return name.match(/\.(mp4|mkv|avi|webm)$/i) ? name : `${name}.mp4`;
    }
    return infoHash ? `Movie_${infoHash.substring(0, 10)}.mp4` : 'magnet-download.mp4';
  }

  if (infoHash) {
    return `Movie_${infoHash.substring(0, 10)}.mp4`;
  }

  try {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const segments = cleanUrl.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      const decoded = decodeURIComponent(last);
      if (decoded.match(/\.(mp4|mkv|avi|webm|ts|mov)$/i)) {
        return decoded;
      }
      return decoded.toLowerCase().endsWith('.torrent') ? decoded : `${decoded}.torrent`;
    }
  } catch {
    // fallback
  }

  return `download-${Date.now()}.mp4`;
}

/**
 * Decodes bencoded Uint8Array into JavaScript object/values
 */
export function decodeBencode(data: Uint8Array | string): any {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let pos = 0;

  function decodeNext(): any {
    if (pos >= bytes.length) {
      return null;
    }

    const byte = bytes[pos];

    // Integer: i<digits>e
    if (byte === 0x69) { // 'i'
      pos++;
      let end = pos;
      while (end < bytes.length && bytes[end] !== 0x65) { // 'e'
        end++;
      }
      const numStr = new TextDecoder('utf-8').decode(bytes.subarray(pos, end));
      pos = end + 1;
      return parseInt(numStr, 10);
    }

    // List: l<items>e
    if (byte === 0x6c) { // 'l'
      pos++;
      const list: any[] = [];
      while (pos < bytes.length && bytes[pos] !== 0x65) { // 'e'
        list.push(decodeNext());
      }
      pos++; // skip 'e'
      return list;
    }

    // Dictionary: d<key><value>e
    if (byte === 0x64) { // 'd'
      pos++;
      const dict: Record<string, any> = {};
      while (pos < bytes.length && bytes[pos] !== 0x65) { // 'e'
        const key = decodeString();
        const value = decodeNext();
        if (key !== null) {
          dict[key] = value;
        }
      }
      pos++; // skip 'e'
      return dict;
    }

    // String: <len>:<contents>
    if (byte >= 0x30 && byte <= 0x39) { // '0'-'9'
      return decodeString();
    }

    return null;
  }

  function decodeString(): string | null {
    let colonPos = pos;
    while (colonPos < bytes.length && bytes[colonPos] !== 0x3a) { // ':'
      colonPos++;
    }
    if (colonPos >= bytes.length) return null;

    const lenStr = new TextDecoder('utf-8').decode(bytes.subarray(pos, colonPos));
    const length = parseInt(lenStr, 10);
    pos = colonPos + 1;

    const strBytes = bytes.subarray(pos, pos + length);
    pos += length;

    // Try decoding as UTF-8 string, fallback to ascii
    try {
      return new TextDecoder('utf-8').decode(strBytes);
    } catch {
      return String.fromCharCode.apply(null, Array.from(strBytes));
    }
  }

  return decodeNext();
}

/**
 * Parses decoded bencode dictionary into clean TorrentMetadata
 */
export function parseTorrentMetadata(data: Uint8Array | string): ParsedTorrentInfo | null {
  try {
    const decoded = decodeBencode(data);
    if (!decoded || typeof decoded !== 'object') {
      return null;
    }

    const info = decoded.info;
    if (!info) return null;

    const name = info['name.utf-8'] || info.name || 'Unknown Torrent';
    let totalSize = 0;
    const filesList: { path: string; length: number }[] = [];

    if (info.files && Array.isArray(info.files)) {
      for (const f of info.files) {
        const filePath = Array.isArray(f.path) ? f.path.join('/') : (f.path || 'file');
        const fileLen = typeof f.length === 'number' ? f.length : 0;
        filesList.push({ path: filePath, length: fileLen });
        totalSize += fileLen;
      }
    } else if (typeof info.length === 'number') {
      totalSize = info.length;
      filesList.push({ path: name, length: totalSize });
    }

    const pieceLength = typeof info['piece length'] === 'number' ? info['piece length'] : undefined;
    const piecesStr = info.pieces;
    const piecesCount = piecesStr && typeof piecesStr === 'string' ? Math.floor(piecesStr.length / 20) : undefined;

    const announce = decoded.announce || undefined;
    const trackers: string[] = [];
    if (announce) trackers.push(announce);
    if (decoded['announce-list'] && Array.isArray(decoded['announce-list'])) {
      for (const tier of decoded['announce-list']) {
        if (Array.isArray(tier)) {
          for (const tr of tier) {
            if (typeof tr === 'string' && !trackers.includes(tr)) {
              trackers.push(tr);
            }
          }
        }
      }
    }

    // Extract WebSeeds (url-list)
    const urlList: string[] = [];
    const rawUrlList = decoded['url-list'];
    if (typeof rawUrlList === 'string') {
      urlList.push(rawUrlList);
    } else if (Array.isArray(rawUrlList)) {
      for (const u of rawUrlList) {
        if (typeof u === 'string') urlList.push(u);
      }
    }

    // Determine the main movie/video file
    let mainMovieFile: { name: string; path: string; length: number; downloadUrl?: string } | undefined;
    const videoExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts', '.m4v', '.iso'];
    
    let candidate = filesList[0];
    for (const f of filesList) {
      const lower = f.path.toLowerCase();
      const isVideo = videoExts.some((ext) => lower.endsWith(ext));
      if (isVideo) {
        if (!candidate || !videoExts.some((ext) => candidate.path.toLowerCase().endsWith(ext)) || f.length > candidate.length) {
          candidate = f;
        }
      } else if (!candidate || f.length > candidate.length) {
        candidate = f;
      }
    }

    if (candidate) {
      let downloadUrl: string | undefined;
      const cleanPath = candidate.path.split('/').map(encodeURIComponent).join('/');
      for (const ws of urlList) {
        if (ws.endsWith('.mp4') || ws.endsWith('.mkv') || ws.endsWith('.iso')) {
          downloadUrl = ws;
          break;
        } else {
          const isMulti = filesList.length > 1;
          const base = ws.endsWith('/') ? ws : `${ws}/`;
          if (isMulti) {
            downloadUrl = `${base}${encodeURIComponent(name)}/${cleanPath}`;
          } else {
            downloadUrl = `${base}${cleanPath}`;
          }
          break;
        }
      }

      mainMovieFile = {
        name: candidate.path.split('/').pop() || candidate.path,
        path: candidate.path,
        length: candidate.length,
        downloadUrl,
      };
    }

    return {
      name,
      totalSize,
      pieceLength,
      piecesCount,
      files: filesList,
      announce,
      trackers,
      urlList,
      mainMovieFile,
      comment: decoded.comment || undefined,
      createdBy: decoded['created by'] || undefined,
      creationDate: decoded['creation date'] ? new Date(decoded['creation date'] * 1000) : undefined,
    };
  } catch (err) {
    console.warn('Failed to parse torrent metadata:', err);
    return null;
  }
}

/**
 * Resolves a .torrent URL into its real movie payload details
 */
export async function resolveTorrentMoviePayload(
  torrentUrl: string,
  suggestedTitle?: string
): Promise<{
  title: string;
  movieFileName: string;
  movieDownloadUrl?: string;
  totalBytes: number;
  torrentMetadata?: ParsedTorrentInfo;
}> {
  // If it's a magnet link
  if (torrentUrl.startsWith('magnet:?')) {
    const magnet = parseMagnetUri(torrentUrl);
    return {
      title: suggestedTitle || magnet?.name || 'Torrent Movie',
      movieFileName: `${magnet?.name || 'Movie'}.mp4`,
      totalBytes: 0,
      torrentMetadata: magnet || undefined,
    };
  }

  try {
    let bytes: Uint8Array | null = null;

    // Use fetch() as the primary reader for all URI types:
    // - file:// from DocumentPicker (fetch can access these; FileSystem cannot)
    // - data: URIs (pre-encoded base64, from the pick flow)
    // - content:// URIs
    // - https:// remote URLs
    // FileSystem APIs are NOT used here to avoid Android sandbox restrictions.
    if (torrentUrl.startsWith('file://') || torrentUrl.startsWith('content://') || torrentUrl.startsWith('data:')) {
      try {
        const res = await fetch(torrentUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          bytes = new Uint8Array(arrayBuffer);
        }
      } catch (readErr) {
        console.warn('Could not read local torrent file via fetch:', readErr);
      }
    }

    if (!bytes) {
      const res = await fetch(torrentUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      }
    }

    if (bytes) {
      const meta = parseTorrentMetadata(bytes);
      if (meta) {
        const title = meta.name || suggestedTitle || 'Downloaded Movie';
        const movieFileName = meta.mainMovieFile?.name || `${title}.mp4`;
        const totalBytes = meta.mainMovieFile?.length || meta.totalSize || 0;
        const movieDownloadUrl = meta.mainMovieFile?.downloadUrl;

        return {
          title,
          movieFileName,
          movieDownloadUrl,
          totalBytes,
          torrentMetadata: meta,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to resolve torrent movie payload:', err);
  }

  const fallbackName = extractTorrentFileName(torrentUrl, suggestedTitle);
  return {
    title: suggestedTitle || fallbackName.replace(/\.torrent$/i, ''),
    movieFileName: fallbackName.replace(/\.torrent$/i, '.mp4'),
    totalBytes: 0,
  };
}
