import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { DownloadItem, StorageStats } from '../types/downloads';
import {
  isTorrentUrl,
  extractTorrentFileName,
  parseTorrentMetadata,
  parseMagnetUri,
  extractInfoHashFromUrl,
} from '../utils/bencode';

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function getStorageLocationText(fileUri?: string): string {
  if (fileUri && fileUri.includes('/storage/emulated/0/')) {
    const parts = fileUri.split('/storage/emulated/0/')[1] || '';
    const folder = parts.split('/')[0] || 'VFlix';
    return `Storage • ${folder}`;
  }
  return 'Internal Storage • VFlix';
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  if (bytesPerSec < 1024 * 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function sanitizeDownloadUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  // Auto-correct common typos like missing 's' in releases.ubuntu.com
  cleaned = cleaned.replace(/release\.ubuntu\.com/i, 'releases.ubuntu.com');
  return cleaned;
}

export function formatDownloadErrorMessage(err: any): string {
  const msg = err?.message || String(err || '');
  if (msg.includes('Unable to resolve host') || msg.includes('no address associated')) {
    return 'Host not found. Check domain spelling or internet connection.';
  }
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return 'Connection timed out. Tap retry.';
  }
  if (msg.includes('404')) {
    return 'File not found on server (404).';
  }
  if (msg.includes('Network request failed')) {
    return 'Network request failed. Check internet connection.';
  }
  return msg || 'Download failed';
}

export function formatMovieFileName(rawName: string, fallbackExt = '.mp4'): string {
  if (!rawName || typeof rawName !== 'string' || rawName.trim().length === 0) {
    return `Movie_${Date.now()}${fallbackExt}`;
  }

  let str = rawName.trim();

  let ext = fallbackExt;
  const extMatch = str.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch) {
    const foundExt = extMatch[0].toLowerCase();
    if (foundExt === '.torrent') {
      ext = '.torrent';
    } else if (foundExt === '.mp3') {
      ext = '.mp3';
    } else {
      ext = '.mp4';
    }
    str = str.slice(0, -extMatch[0].length);
  }

  // 1. Remove domain prefixes like www.1TamilMV.lease -
  str = str.replace(/^(www\.[a-z0-9.]+\s*-\s*|[a-z0-9.]*1tamilmv[a-z0-9.]*\s*-\s*|[a-z0-9.]*tamilrockers[a-z0-9.]*\s*-\s*|[a-z0-9.]*tamilblasters[a-z0-9.]*\s*-\s*|[a-z0-9.]*isaimini[a-z0-9.]*\s*-\s*)/gi, '');

  // 2. Remove bracketed info [Tamil + Telugu], [1080p], [ESub], etc.
  str = str.replace(/\[[^\]]*\]/g, '');

  // 3. Remove parenthetical info (except pure 4-digit years like (2026))
  str = str.replace(/\([^)]*\)/g, (m) => (/\b(19\d\d|20\d\d)\b/.test(m) ? m : ''));

  // 4. Remove standalone 4-digit years to keep pure movie title
  str = str.replace(/\b(19\d\d|20\d\d)\b/g, '');

  // 5. Remove video quality, resolution, rip, codec, audio, language, sub keywords
  str = str.replace(
    /\b(1080p|720p|480p|360p|2160p|4k|hdr|hdrip|hq|webrip|web-dl|webdl|brrip|bluray|dvdrip|hdtv|x264|x265|hevc|avc|aac|dd\+?5\.1|dd\+?2\.0|esub|sub|550mb|700mb|900mb|1\.4gb|1\.6gb|2gb|2\.8gb|5\.4gb|true web-dl|true|desktop|amd64|tamil|telugu|hindi|kan|kannada|mal|malayalam|eng|english|uncut|multi)\b/gi,
    ''
  );

  // 6. Clean characters: strip quotes, replace non-alphanumeric (spaces, dots, hyphens, etc.) with '_'
  str = str.replace(/['’]/g, '');
  str = str.replace(/[^a-zA-Z0-9]+/g, '_');

  // 7. Capitalize parts and join with '_'
  const parts = str.split('_').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  let formatted = parts.join('_');

  if (!formatted) {
    formatted = 'Movie';
  }

  return `${formatted}${ext}`;
}

export function makeUniqueFileName(desiredName: string, existingNames?: Iterable<string>): string {
  if (!desiredName || desiredName.trim().length === 0) {
    desiredName = `Movie_${Date.now()}.mp4`;
  }
  let cleanName = formatMovieFileName(desiredName);
  const extMatch = cleanName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[0] : '.mp4';
  const baseName = extMatch ? cleanName.slice(0, -ext.length) : cleanName;

  if (!existingNames) {
    return cleanName;
  }

  const existingSet = new Set(Array.from(existingNames).map((n) => (n || '').toLowerCase()));
  if (!existingSet.has(cleanName.toLowerCase())) {
    return cleanName;
  }

  let counter = 1;
  while (true) {
    const candidate = `${baseName}_${counter}${ext}`;
    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter++;
  }
}

export function cleanTitleFromFilename(fileName: string): string {
  if (!fileName || fileName.toLowerCase() === 'movie' || fileName.toLowerCase() === 'movie.mp4') return 'Movie';
  let clean = fileName.replace(/\.[^/.]+$/, '');

  // Remove site domain prefixes like www.1TamilMV.lease -
  clean = clean.replace(/^(www\.[a-z0-9.]+\s*-\s*|1tamilmv[a-z0-9.]*\s*-\s*)/gi, '');
  clean = clean.replace(/\[[^\]]*\]/g, ''); // Remove [Tamil + Telugu] bracketed tags
  clean = clean.replace(/\([^)]*\)/g, (match) => {
    return /\b(19\d\d|20\d\d)\b/.test(match) ? match : '';
  });

  const yearMatch = clean.match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : '';

  clean = clean.replace(/[_.-]+/g, ' ');
  clean = clean.replace(
    /\b(1080p|720p|480p|2160p|4k|bluray|webrip|brrip|x264|x265|hevc|aac|dvdrip|hdrip|hq|esub|sub|550mb|700mb|900mb|1\.4gb|2gb|2\.8gb|5\.4gb|surround|desktop|amd64)\b/gi,
    ''
  );
  if (year) {
    clean = clean.replace(new RegExp(`\\b${year}\\b`, 'g'), '');
  }
  clean = clean.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/\b\w/g, (c) => c.toUpperCase());
  return year ? `${clean} (${year})` : clean || fileName;
}

export function getPosterForFilename(fileName: string): string {
  const lower = (fileName || '').toLowerCase();
  if (lower.includes('sintel')) return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80';
  if (lower.includes('bunny')) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80';
  if (lower.includes('tear')) return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80';
  if (lower.includes('ubuntu')) return 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80';
  if (lower.includes('leo')) return 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80';
  if (lower.includes('jailer')) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&q=80';
  if (lower.includes('vikram')) return 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80';
  return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&q=80';
}

export const MOVIES_FOLDER_NAME = 'VFlix_Movies';
export const VFLIX_SHARED_FOLDER = 'VFlix';

class DownloadService {
  private activeTasks = new Map<
    string,
    {
      resumable?: any;
      abortController?: AbortController;
      lastBytes: number;
      lastTime: number;
      speed: string;
    }
  >();

  private baseDir: string = '';

  constructor() {
    this.initDir();
  }

  private async initDir() {
    if (FileSystem.documentDirectory) {
      this.baseDir = `${FileSystem.documentDirectory}${MOVIES_FOLDER_NAME}/`;
      const altDir = `${FileSystem.documentDirectory}${VFLIX_SHARED_FOLDER}/`;
      try {
        const info = await FileSystem.getInfoAsync(this.baseDir);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(this.baseDir, { intermediates: true });
        }
        const altInfo = await FileSystem.getInfoAsync(altDir);
        if (!altInfo.exists) {
          await FileSystem.makeDirectoryAsync(altDir, { intermediates: true });
        }
      } catch (err) {
        console.warn('Failed to initialize movies directory:', err);
      }
    }

    // On Android, attempt to ensure the shared internal storage VFlix folder is ready
    if (Platform.OS === 'android') {
      try {
        const sharedTR = 'file:///storage/emulated/0/VFlix/';
        const info = await FileSystem.getInfoAsync(sharedTR);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(sharedTR, { intermediates: true });
        }
      } catch {}
    }
  }

  public getDownloadsDirectory(): string {
    return (
      this.baseDir ||
      (FileSystem.documentDirectory
        ? `${FileSystem.documentDirectory}${MOVIES_FOLDER_NAME}/`
        : '')
    );
  }

  public isTaskActive(id: string): boolean {
    return this.activeTasks.has(id);
  }

  /**
   * Recursively scans a directory up to maxDepth for media files
   */
  private async scanDirectoryRecursive(
    dirUri: string,
    depth: number = 0,
    maxDepth: number = 2
  ): Promise<string[]> {
    if (depth > maxDepth) return [];
    try {
      const info = await FileSystem.getInfoAsync(dirUri);
      if (!info.exists || !info.isDirectory) return [];

      const entries = await FileSystem.readDirectoryAsync(dirUri);
      const results: string[] = [];

      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'downloads_index.json') continue;
        const normalizedDir = dirUri.endsWith('/') ? dirUri : `${dirUri}/`;
        const fullPath = `${normalizedDir}${entry}`;

        try {
          const itemInfo = await FileSystem.getInfoAsync(fullPath);
          if (itemInfo.exists) {
            if (itemInfo.isDirectory) {
              const subItems = await this.scanDirectoryRecursive(fullPath, depth + 1, maxDepth);
              results.push(...subItems);
            } else {
              results.push(fullPath);
            }
          }
        } catch {}
      }

      return results;
    } catch {
      return [];
    }
  }

  /**
   * Scans internal and shared storage folders (TamilRockers, TamilRockers_Movies,
   * Download/TamilRockers, Movies/TamilRockers, etc.) to automatically rediscover
   * and index all manually moved or downloaded movies on the device.
   */
  public async scanDiskMovies(): Promise<DownloadItem[]> {
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
      return [];
    }

    const discoveredItems: DownloadItem[] = [];
    const mediaExts = [
      '.mp4',
      '.mkv',
      '.avi',
      '.mov',
      '.webm',
      '.ts',
      '.m4v',
      '.flv',
      '.wmv',
      '.3gp',
      '.mpg',
      '.mpeg',
      '.vob',
      '.iso',
    ];
    const targetDir = this.getDownloadsDirectory();

    // Candidate directories to scan
    const candidateDirs: { path: string; isInternalAppDir: boolean }[] = [
      // App Internal Sandboxed directories
      { path: targetDir, isInternalAppDir: true },
      { path: `${FileSystem.documentDirectory}VFlix/`, isInternalAppDir: true },
      { path: `${FileSystem.documentDirectory}VFlix_Movies/`, isInternalAppDir: true },
      { path: `${FileSystem.documentDirectory}VFlex/`, isInternalAppDir: true },
      { path: `${FileSystem.documentDirectory}VFlex_Movies/`, isInternalAppDir: true },
      { path: `${FileSystem.documentDirectory}TamilRockers/`, isInternalAppDir: true },
      { path: `${FileSystem.documentDirectory}TamilRockersStream/`, isInternalAppDir: true },
      { path: `${FileSystem.documentDirectory}downloads/`, isInternalAppDir: true },
      { path: FileSystem.documentDirectory, isInternalAppDir: true },
    ];

    // On Android, scan shared Internal Storage locations where users manually copy files:
    if (Platform.OS === 'android') {
      const androidSharedLocations = [
        // Primary VFlix storage folders
        'file:///storage/emulated/0/VFlix/',
        'file:///storage/emulated/0/VFlix_Movies/',
        'file:///storage/emulated/0/Download/VFlix/',
        'file:///storage/emulated/0/Download/VFlix_Movies/',
        'file:///storage/emulated/0/Movies/VFlix/',
        'file:///storage/emulated/0/Movies/VFlix_Movies/',
        // Fallback folders (so existing files are still found)
        'file:///storage/emulated/0/VFlex/',
        'file:///storage/emulated/0/VFlex_Movies/',
        'file:///storage/emulated/0/Download/VFlex/',
        'file:///storage/emulated/0/TamilRockers/',
        'file:///storage/emulated/0/Tamil Rockers/',
        'file:///storage/emulated/0/tamilrockers/',
        'file:///storage/emulated/0/TamilRockers_Movies/',
        'file:///storage/emulated/0/TamilRockersStream/',
        'file:///storage/emulated/0/Download/TamilRockers/',
        'file:///storage/emulated/0/Download/TamilRockers_Movies/',
        'file:///storage/emulated/0/Movies/TamilRockers/',
        'file:///storage/emulated/0/Movies/TamilRockers_Movies/',
      ];

      for (const loc of androidSharedLocations) {
        candidateDirs.push({ path: loc, isInternalAppDir: false });
      }
    }

    const processedFiles = new Set<string>();

    for (const { path: dirPath } of candidateDirs) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        if (!dirInfo.exists || !dirInfo.isDirectory) continue;

        const filePaths = await this.scanDirectoryRecursive(dirPath, 0, 2);

        for (const currentFilePath of filePaths) {
          const fileName = currentFilePath.substring(currentFilePath.lastIndexOf('/') + 1);
          if (
            fileName.endsWith('.json') ||
            fileName.startsWith('.') ||
            fileName === MOVIES_FOLDER_NAME ||
            fileName === 'downloads'
          ) {
            continue;
          }

          const lower = fileName.toLowerCase();
          const isMedia = mediaExts.some((ext) => lower.endsWith(ext));
          if (!isMedia) continue;

          // Prevent duplicate listings
          const dedupeKey = `${fileName.toLowerCase()}_${currentFilePath}`;
          if (processedFiles.has(dedupeKey)) continue;
          processedFiles.add(dedupeKey);

          const fileInfo = await FileSystem.getInfoAsync(currentFilePath);
          if (fileInfo.exists && (fileInfo as any).size >= 1024 * 1024) {
            const size = (fileInfo as any).size || 0;
            const cleanTitle = cleanTitleFromFilename(fileName);
            const poster = getPosterForFilename(fileName);

            // Determine resolution based on file attributes or size
            let resolution: '4K' | '1080p' | '720p' | 'HD' = '720p';
            if (lower.includes('2160p') || lower.includes('4k') || size > 3.5 * 1024 * 1024 * 1024) {
              resolution = '4K';
            } else if (lower.includes('1080p') || size > 1.2 * 1024 * 1024 * 1024) {
              resolution = '1080p';
            } else if (lower.includes('720p') || size > 400 * 1024 * 1024) {
              resolution = '720p';
            }

            discoveredItems.push({
              id: `movie-${fileName.replace(/[^a-zA-Z0-9]/g, '_')}-${size}`,
              url: '',
              fileName,
              movieFileName: fileName,
              title: cleanTitle,
              fileUri: currentFilePath,
              movieFileUri: currentFilePath,
              status: 'completed',
              downloadedBytes: size,
              totalBytes: size,
              progress: 1,
              speed: '0 KB/s',
              createdAt: (fileInfo as any).modificationTime
                ? (fileInfo as any).modificationTime * 1000
                : Date.now(),
              completedAt: (fileInfo as any).modificationTime
                ? (fileInfo as any).modificationTime * 1000
                : Date.now(),
              resolution,
              isTorrent: false,
              poster,
            });
          }
        }
      } catch (err) {
        // Continue scanning other directories even if one is restricted
      }
    }

    return discoveredItems;
  }

  /**
   * Imports an external movie file picked from device storage directly into the offline library
   */
  public async importMovieFile(
    sourceUri: string,
    originalName: string,
    existingFileNames?: Iterable<string>
  ): Promise<DownloadItem> {
    const rawName = originalName || `Movie_${Date.now()}.mp4`;
    const fileName = makeUniqueFileName(rawName, existingFileNames);
    const targetDir = this.getDownloadsDirectory();
    const destPath = `${targetDir}${fileName}`;

    try {
      const dirInfo = await FileSystem.getInfoAsync(targetDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
      }

      // If not already in target directory, copy it into app storage
      if (sourceUri !== destPath) {
        await FileSystem.copyAsync({ from: sourceUri, to: destPath });
      }
    } catch (copyErr) {
      console.warn('Could not copy imported movie to app directory, using source URI directly:', copyErr);
    }

    const finalUri = (await FileSystem.getInfoAsync(destPath)).exists ? destPath : sourceUri;
    const fileInfo = await FileSystem.getInfoAsync(finalUri);
    const size = fileInfo.exists && (fileInfo as any).size ? (fileInfo as any).size : 0;
    const cleanTitle = cleanTitleFromFilename(fileName);
    const poster = getPosterForFilename(fileName);

    let resolution: '4K' | '1080p' | '720p' | 'HD' = '720p';
    const lower = fileName.toLowerCase();
    if (lower.includes('2160p') || lower.includes('4k') || size > 3.5 * 1024 * 1024 * 1024) {
      resolution = '4K';
    } else if (lower.includes('1080p') || size > 1.2 * 1024 * 1024 * 1024) {
      resolution = '1080p';
    }

    return {
      id: `imported-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      url: '',
      fileName,
      movieFileName: fileName,
      title: cleanTitle,
      fileUri: finalUri,
      movieFileUri: finalUri,
      status: 'completed',
      downloadedBytes: size,
      totalBytes: size,
      progress: 1,
      speed: '0 KB/s',
      createdAt: Date.now(),
      completedAt: Date.now(),
      resolution,
      isTorrent: false,
      poster,
    };
  }

  public async getStorageStats(items: DownloadItem[]): Promise<StorageStats> {
    let freeBytes = 64 * 1024 * 1024 * 1024; // 64 GB fallback
    let totalBytes = 128 * 1024 * 1024 * 1024; // 128 GB fallback

    if (Platform.OS !== 'web' && typeof FileSystem.getFreeDiskStorageAsync === 'function') {
      try {
        freeBytes = await FileSystem.getFreeDiskStorageAsync();
        totalBytes = await FileSystem.getTotalDiskCapacityAsync();
      } catch (err) {
        // fallback
      }
    }

    const appDownloadsBytes = items
      .filter((i) => i.status === 'completed')
      .reduce((acc, i) => acc + (i.downloadedBytes || i.totalBytes || 0), 0);

    return {
      freeBytes,
      totalBytes,
      appDownloadsBytes,
    };
  }

  public createDownloadItem(
    rawUrl: string,
    suggestedTitle?: string,
    posterUrl?: string,
    existingFileNames?: Iterable<string>
  ): DownloadItem {
    const url = sanitizeDownloadUrl(rawUrl);
    const infoHash = extractInfoHashFromUrl(url);
    const isStreamUrl = url.includes('/api/stream/');
    const isTorrent = isTorrentUrl(url) || Boolean(infoHash) || url.startsWith('magnet:');
    const rawFileName = extractTorrentFileName(url, suggestedTitle);
    const fileName = makeUniqueFileName(rawFileName, existingFileNames);
    const id = `dl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let initialTitle = suggestedTitle || fileName.replace(/\.(torrent|mp4|mkv)$/i, '');
    let initialMetadata = undefined;

    if (url.startsWith('magnet:?')) {
      const magnetInfo = parseMagnetUri(url);
      if (magnetInfo) {
        if (magnetInfo.name && magnetInfo.name !== 'Torrent Download') {
          initialTitle = magnetInfo.name;
        }
        initialMetadata = magnetInfo;
      }
    } else if (infoHash && (!suggestedTitle || suggestedTitle.toLowerCase() === 'movie')) {
      initialTitle = `Movie (${infoHash.substring(0, 8)})`;
    }

    initialTitle = cleanTitleFromFilename(initialTitle);
    const fileUri = this.baseDir ? `${this.baseDir}${fileName}` : fileName;
    const poster = posterUrl || getPosterForFilename(initialTitle || fileName);

    return {
      id,
      url,
      fileName,
      title: initialTitle,
      fileUri,
      status: 'downloading',
      downloadedBytes: 0,
      totalBytes: 0,
      progress: 0,
      speed: '0 KB/s',
      createdAt: Date.now(),
      isTorrent,
      poster,
      torrentMetadata: initialMetadata,
    };
  }

  /**
   * Starts or resumes a real download task.
   */
  public async startRealDownload(
    item: DownloadItem,
    onProgress: (updated: Partial<DownloadItem>) => void,
    onComplete: (updated: Partial<DownloadItem>) => void,
    onError: (errorMsg: string) => void
  ): Promise<void> {
    // If native FileSystem is available
    if (
      Platform.OS !== 'web' &&
      typeof FileSystem.createDownloadResumable === 'function' &&
      FileSystem.documentDirectory
    ) {
      await this.startNativeDownload(item, onProgress, onComplete, onError);
    } else {
      await this.startWebFallbackDownload(item, onProgress, onComplete, onError);
    }
  }

  private async startNativeDownload(
    item: DownloadItem,
    onProgress: (updated: Partial<DownloadItem>) => void,
    onComplete: (updated: Partial<DownloadItem>) => void,
    onError: (errorMsg: string) => void
  ) {
    try {
      const targetUri = item.fileUri || `${this.baseDir}${item.fileName}`;

      // Check existing partial file size on disk for resume support
      let existingSize = item.downloadedBytes || 0;
      try {
        const fileInfo = await FileSystem.getInfoAsync(targetUri);
        if (fileInfo.exists && typeof (fileInfo as any).size === 'number' && (fileInfo as any).size > 0) {
          existingSize = Math.max(existingSize, (fileInfo as any).size);
        }
      } catch {}

      // If existingSize > 0 and no valid resumeData is set, construct valid resumeData
      let effectiveResumeData = item.resumeData;
      if (!effectiveResumeData && existingSize > 0 && existingSize < (item.totalBytes || Infinity)) {
        try {
          effectiveResumeData = JSON.stringify({
            url: item.url,
            fileUri: targetUri,
            options: {
              headers: {
                Range: `bytes=${existingSize}-`,
                'Bypass-Tunnel-Reminder': 'true',
              },
            },
            resumeData: String(existingSize),
          });
        } catch {}
      }

      const taskState = {
        lastBytes: existingSize,
        lastTime: Date.now(),
        speed: '0 KB/s',
        resumable: null as any,
      };

      const progressCallback = (data: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
        const now = Date.now();
        const timeDiff = (now - taskState.lastTime) / 1000;
        let currentSpeed = taskState.speed;

        if (timeDiff >= 0.5) {
          const bytesDiff = data.totalBytesWritten - taskState.lastBytes;
          const bytesPerSec = timeDiff > 0 ? Math.max(0, bytesDiff / timeDiff) : 0;
          currentSpeed = formatSpeed(bytesPerSec);
          taskState.lastBytes = data.totalBytesWritten;
          taskState.lastTime = now;
          taskState.speed = currentSpeed;
        }

        const total = data.totalBytesExpectedToWrite > 0 ? data.totalBytesExpectedToWrite : item.totalBytes;
        const progress = total > 0 ? Math.min(1, data.totalBytesWritten / total) : 0;

        onProgress({
          downloadedBytes: data.totalBytesWritten,
          totalBytes: total,
          progress,
          speed: currentSpeed,
          status: 'downloading',
        });
      };

      const resumable = FileSystem.createDownloadResumable(
        item.url,
        targetUri,
        {
          headers: {
            'Bypass-Tunnel-Reminder': 'true',
          },
        },
        progressCallback,
        effectiveResumeData
      );

      taskState.resumable = resumable;
      this.activeTasks.set(item.id, taskState);

      let result: FileSystem.FileSystemDownloadResult | undefined;
      if (effectiveResumeData) {
        try {
          result = await resumable.resumeAsync();
        } catch (resumeErr) {
          console.warn('[DownloadService] resumeAsync failed, falling back to fresh downloadAsync:', resumeErr);
          result = await resumable.downloadAsync();
        }
      } else {
        result = await resumable.downloadAsync();
      }
      this.activeTasks.delete(item.id);

      if (!result || !result.uri) {
        // Paused or canceled
        return;
      }

      if ((result as any).status && (result as any).status >= 400) {
        try {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
        } catch {}
        onError(`Server error (HTTP ${(result as any).status})`);
        return;
      }

      // Completed download! Check file info
      const fileInfo = await FileSystem.getInfoAsync(result.uri);
      const actualSize = fileInfo.exists && typeof (fileInfo as any).size === 'number' ? (fileInfo as any).size : item.downloadedBytes;

      const isActualTorrentFile = (result.uri || '').toLowerCase().endsWith('.torrent');
      if (!isActualTorrentFile && actualSize < 100 * 1024) {
        try {
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
        } catch {}
        onError('Downloaded file is corrupted or too small (under 100 KB)');
        return;
      }
      let torrentMetadata = item.torrentMetadata;
      let finalTitle = item.title;

      if (isActualTorrentFile && actualSize < 1024 * 1024) {
        try {
          const base64Content = await FileSystem.readAsStringAsync(result.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const binaryStr = atob(base64Content);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const parsed = parseTorrentMetadata(bytes);
          if (parsed) {
            torrentMetadata = parsed;
            if (parsed.name) finalTitle = parsed.name;
          }
        } catch (parseErr) {
          // ignore torrent file parse error
        }
      }

      onComplete({
        status: 'completed',
        progress: 1,
        speed: '0 KB/s',
        fileUri: result.uri,
        downloadedBytes: actualSize,
        totalBytes: actualSize,
        completedAt: Date.now(),
        title: finalTitle,
        torrentMetadata,
      });
    } catch (err: any) {
      this.activeTasks.delete(item.id);
      const friendlyMsg = formatDownloadErrorMessage(err);
      onError(friendlyMsg);
    }
  }

  private async startWebFallbackDownload(
    item: DownloadItem,
    onProgress: (updated: Partial<DownloadItem>) => void,
    onComplete: (updated: Partial<DownloadItem>) => void,
    onError: (errorMsg: string) => void
  ) {
    const abortController = new AbortController();
    const taskState = {
      abortController,
      lastBytes: item.downloadedBytes || 0,
      lastTime: Date.now(),
      speed: '0 KB/s',
    };
    this.activeTasks.set(item.id, taskState);

    try {
      const headers: Record<string, string> = {};
      if (item.downloadedBytes > 0) {
        headers['Range'] = `bytes=${item.downloadedBytes}-`;
      }

      const response = await fetch(item.url, {
        signal: abortController.signal,
        headers,
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength
        ? parseInt(contentLength, 10) + item.downloadedBytes
        : item.totalBytes || 1024 * 1024;

      const reader = response.body?.getReader();
      if (!reader) {
        // Fallback to blob if streaming reader not supported
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let torrentMeta = item.torrentMetadata;
        let title = item.title;
        if (item.isTorrent) {
          const parsed = parseTorrentMetadata(bytes);
          if (parsed) {
            torrentMeta = parsed;
            if (parsed.name) title = parsed.name;
          }
        }

        this.activeTasks.delete(item.id);
        onComplete({
          status: 'completed',
          progress: 1,
          downloadedBytes: blob.size,
          totalBytes: blob.size,
          completedAt: Date.now(),
          title,
          torrentMetadata: torrentMeta,
        });
        return;
      }

      let receivedBytes = item.downloadedBytes;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        const now = Date.now();
        const timeDiff = (now - taskState.lastTime) / 1000;
        let currentSpeed = taskState.speed;

        if (timeDiff >= 0.5) {
          const bytesDiff = receivedBytes - taskState.lastBytes;
          const bytesPerSec = timeDiff > 0 ? Math.max(0, bytesDiff / timeDiff) : 0;
          currentSpeed = formatSpeed(bytesPerSec);
          taskState.lastBytes = receivedBytes;
          taskState.lastTime = now;
          taskState.speed = currentSpeed;
        }

        const progress = totalBytes > 0 ? Math.min(1, receivedBytes / totalBytes) : 0;
        onProgress({
          downloadedBytes: receivedBytes,
          totalBytes,
          progress,
          speed: currentSpeed,
          status: 'downloading',
        });
      }

      this.activeTasks.delete(item.id);

      // Concatenate chunks
      const combined = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      let torrentMetadata = item.torrentMetadata;
      let finalTitle = item.title;
      const isActualTorrentFile = (item.fileUri || item.fileName || '').toLowerCase().endsWith('.torrent');
      if (isActualTorrentFile && receivedBytes < 1024 * 1024) {
        try {
          const parsed = parseTorrentMetadata(combined);
          if (parsed) {
            torrentMetadata = parsed;
            if (parsed.name) finalTitle = parsed.name;
          }
        } catch {}
      }

      onComplete({
        status: 'completed',
        progress: 1,
        speed: '0 KB/s',
        downloadedBytes: receivedBytes,
        totalBytes: receivedBytes,
        completedAt: Date.now(),
        title: finalTitle,
        torrentMetadata,
      });
    } catch (err: any) {
      this.activeTasks.delete(item.id);
      if (err.name === 'AbortError') {
        // Paused intentionally
        return;
      }
      onError(formatDownloadErrorMessage(err));
    }
  }

  /**
   * Pauses an active download task.
   */
  public async pauseDownload(item: DownloadItem): Promise<Partial<DownloadItem>> {
    const task = this.activeTasks.get(item.id);
    let resumeData = item.resumeData;

    if (task && task.resumable && task.resumable.pauseAsync) {
      try {
        const pauseResult = await task.resumable.pauseAsync();
        if (pauseResult && pauseResult.resumeData) {
          resumeData = pauseResult.resumeData;
        }
      } catch (err) {
        console.warn('Error pausing native download:', err);
      }
    } else if (task && task.abortController) {
      task.abortController.abort();
    }

    // Inspect actual disk file size to maintain accurate progress and resume data
    const targetUri = item.fileUri || `${this.baseDir}${item.fileName}`;
    let currentBytes = item.downloadedBytes || 0;
    try {
      if (Platform.OS !== 'web' && typeof FileSystem.getInfoAsync === 'function') {
        const fileInfo = await FileSystem.getInfoAsync(targetUri);
        if (fileInfo.exists && typeof (fileInfo as any).size === 'number') {
          currentBytes = Math.max(currentBytes, (fileInfo as any).size);
        }
      }
    } catch {}

    if (!resumeData && currentBytes > 0) {
      try {
        resumeData = JSON.stringify({
          url: item.url,
          fileUri: targetUri,
          options: {
            headers: {
              Range: `bytes=${currentBytes}-`,
              'Bypass-Tunnel-Reminder': 'true',
            },
          },
          resumeData: String(currentBytes),
        });
      } catch {}
    }

    if (task) {
      this.activeTasks.delete(item.id);
    }

    const progress = item.totalBytes > 0 ? Math.min(1, currentBytes / item.totalBytes) : item.progress;

    return {
      status: 'paused',
      speed: '0 KB/s',
      downloadedBytes: currentBytes,
      progress,
      resumeData,
    };
  }

  /**
   * Deletes a downloaded file or cancels an in-progress download.
   */
  public async deleteDownload(item: DownloadItem): Promise<void> {
    const task = this.activeTasks.get(item.id);
    if (task) {
      if (task.resumable && task.resumable.pauseAsync) {
        try {
          await task.resumable.pauseAsync();
        } catch {}
      } else if (task.abortController) {
        task.abortController.abort();
      }
      this.activeTasks.delete(item.id);
    }

    if (Platform.OS !== 'web' && item.fileUri && typeof FileSystem.deleteAsync === 'function') {
      try {
        const info = await FileSystem.getInfoAsync(item.fileUri);
        if (info.exists) {
          await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
        }
      } catch (err) {
        console.warn('Could not delete file from disk:', err);
      }
    }
  }
}

export const downloadService = new DownloadService();

export async function saveToGallery(fileUri: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;

    // Safely verify if native MediaLibrary binary module exists in current runtime environment
    const nativeModule =
      requireOptionalNativeModule('ExpoMediaLibraryNext') ||
      requireOptionalNativeModule('ExpoMediaLibrary');

    if (!nativeModule) {
      console.warn('[saveToGallery] ExpoMediaLibrary native module is not present in this client build.');
      return false;
    }

    let MediaLibrary: any = null;
    try {
      MediaLibrary = require('expo-media-library');
    } catch (e) {
      console.warn('[saveToGallery] expo-media-library module load error:', e);
      return false;
    }

    if (!MediaLibrary || typeof MediaLibrary.requestPermissionsAsync !== 'function') {
      console.warn('[saveToGallery] MediaLibrary native methods not available.');
      return false;
    }

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }
    const info = await FileSystem.getInfoAsync(fileUri).catch(() => null);
    if (!info || !info.exists) return false;

    const asset = await MediaLibrary.createAssetAsync(fileUri);
    if (asset) {
      await MediaLibrary.createAlbumAsync('VFlix Downloads', asset, false).catch(() => {});
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[SaveToGallery Error]:', err);
    return false;
  }
}

export interface ParsedMediaFormat {
  id: string;
  label: string;
  resolution: string;
  container: string;
  hasAudio?: boolean;
  hasVideo?: boolean;
  url?: string;
}

export interface ParsedMediaResult {
  success: boolean;
  platform: 'youtube' | 'instagram' | 'direct';
  title: string;
  thumbnail: string;
  duration?: number;
  author?: string;
  formats: ParsedMediaFormat[];
}

export async function parseSocialVideoUrl(url: string, backendServerIp?: string): Promise<ParsedMediaResult> {
  const cleanUrl = url.trim();
  const cleanBackend = (backendServerIp || '').replace(/\/+$/, '');
  const isYt = /youtu\.?be/i.test(cleanUrl);
  const isIg = /instagram\.com/i.test(cleanUrl);

  // 1. Try local backend server /api/media/parse if available
  if (cleanBackend) {
    const endpoint = `${cleanBackend}/api/media/parse`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[parseSocialVideoUrl Backend Fetch Failed]:', e);
    }
  }

  // 2. Fetch YouTube oEmbed metadata directly if server unavailable
  let title = isYt ? 'YouTube Video' : isIg ? 'Instagram Reel Video' : 'Downloaded Video';
  let thumbnail = isYt
    ? 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&q=80'
    : isIg
    ? 'https://images.unsplash.com/photo-1611262588024-d12430b98920?w=600&q=80'
    : 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&q=80';
  let author = '';

  if (isYt) {
    try {
      const ytIdMatch = cleanUrl.match(/(?:v=|\/|be\/)([a-zA-Z0-9_-]{11})/);
      if (ytIdMatch && ytIdMatch[1]) {
        thumbnail = `https://img.youtube.com/vi/${ytIdMatch[1]}/maxresdefault.jpg`;
      }
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`);
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        if (oembed.title) title = oembed.title;
        if (oembed.author_name) author = oembed.author_name;
        if (oembed.thumbnail_url) thumbnail = oembed.thumbnail_url;
      }
    } catch (err) {
      console.warn('oEmbed fetch error:', err);
    }
  }

  return {
    success: true,
    platform: isYt ? 'youtube' : isIg ? 'instagram' : 'direct',
    title,
    thumbnail,
    author,
    formats: [
      { id: '1080p', label: '1080p Full HD (MP4)', resolution: '1080p', container: 'mp4' },
      { id: '720p', label: '720p HD (MP4)', resolution: '720p', container: 'mp4' },
      { id: '480p', label: '480p SD (MP4)', resolution: '480p', container: 'mp4' },
      { id: 'audio_mp3', label: 'Audio Only (MP3)', resolution: 'Audio MP3', container: 'mp3' },
    ],
  };
}
