import { ParsedTorrentInfo } from '../utils/bencode';

export interface DownloadItem {
  id: string;
  url: string;
  fileName: string;
  title: string;
  movieFileName?: string;
  fileUri: string;
  movieFileUri?: string;
  status: 'downloading' | 'paused' | 'completed' | 'error';
  downloadedBytes: number;
  totalBytes: number;
  progress: number; // 0 to 1
  speed: string; // e.g. "1.2 MB/s"
  peersCount?: number;
  resolution?: '4K' | '1080p' | '720p' | 'HD';
  duration?: string;
  poster?: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
  isTorrent: boolean;
  infoHash?: string;
  resumeData?: string;
  torrentMetadata?: ParsedTorrentInfo;
}

export interface StorageStats {
  freeBytes: number;
  totalBytes: number;
  appDownloadsBytes: number;
}
