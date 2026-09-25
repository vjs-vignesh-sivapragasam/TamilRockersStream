import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';

import { DownloadItem, StorageStats } from '../types/downloads';
import { downloadService } from '../services/downloadService';
import { torrentEngine } from '../services/torrentEngine';
import { resolveTorrentMoviePayload, extractInfoHashFromUrl } from '../utils/bencode';
import { debridService } from '../services/debridService';

// Default backend URL with auto-detection for physical phones running Expo Go
const resolveDefaultBackendUrl = (): string => {
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:3000`;
      }
    }
  } catch {}
  return 'http://192.168.1.6:3000';
};

export const DEFAULT_BACKEND_URL = resolveDefaultBackendUrl();
const BACKEND_CONFIG_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}backend_config.json`
  : '';

interface DownloadContextType {
  downloads: DownloadItem[];
  activeDownloadsCount: number;
  storageStats: StorageStats;
  isBackendConnected: boolean;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  testPing: (url?: string) => Promise<{ ok: boolean; latency: number; message: string }>;
  startDownload: (url: string, suggestedTitle?: string) => Promise<DownloadItem>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  deleteDownload: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  refreshStorageStats: () => Promise<void>;
  rescanStorage: () => Promise<number>;
  importMovie: (sourceUri: string, fileName: string) => Promise<DownloadItem>;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

const MOVIES_DIR_NAME = 'VFlix_Movies';
const STORAGE_INDEX_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${MOVIES_DIR_NAME}/downloads_index.json`
  : '';
const LEGACY_STORAGE_INDEX_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}downloads_index.json`
  : '';

export const DownloadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const isLoadedRef = React.useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [backendUrl, setBackendUrlState] = useState(DEFAULT_BACKEND_URL);

  const [storageStats, setStorageStats] = useState<StorageStats>({
    freeBytes: 64 * 1024 * 1024 * 1024,
    totalBytes: 128 * 1024 * 1024 * 1024,
    appDownloadsBytes: 0,
  });

  const activeDownloadsCount = downloads.filter((d) => d.status === 'downloading').length;

  // Load persisted custom backend URL if present (ignoring old dead tunnels)
  useEffect(() => {
    if (BACKEND_CONFIG_FILE) {
      FileSystem.readAsStringAsync(BACKEND_CONFIG_FILE).then((content) => {
        try {
          const parsed = JSON.parse(content);
          if (parsed.backendUrl && !parsed.backendUrl.includes('.loca.lt')) {
            setBackendUrlState(parsed.backendUrl);
          } else {
            setBackendUrlState(resolveDefaultBackendUrl());
          }
        } catch {}
      }).catch(() => {});
    }
  }, []);

  const setBackendUrl = (newUrl: string) => {
    let clean = newUrl.trim().replace(/\/+$/, '');
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    setBackendUrlState(clean);
    if (BACKEND_CONFIG_FILE) {
      FileSystem.writeAsStringAsync(BACKEND_CONFIG_FILE, JSON.stringify({ backendUrl: clean })).catch(() => {});
    }
  };

  const testPing = async (targetUrl?: string): Promise<{ ok: boolean; latency: number; message: string }> => {
    const url = (targetUrl || backendUrl).trim().replace(/\/+$/, '');
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${url}/api/ping`, {
        signal: controller.signal,
        headers: { 'Bypass-Tunnel-Reminder': 'true' }
      });
      clearTimeout(timeout);
      const latency = Date.now() - startTime;
      if (res.ok) {
        const data = await res.json();
        return { ok: true, latency, message: `Connected (${latency}ms) • ${data.server || 'Server Online'}` };
      }
      return { ok: false, latency, message: `Server responded with HTTP ${res.status}` };
    } catch (err: any) {
      const latency = Date.now() - startTime;
      return { ok: false, latency, message: err?.message || 'Connection timed out' };
    }
  };

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    socketRef.current = io(backendUrl, {
      extraHeaders: {
        'Bypass-Tunnel-Reminder': 'true'
      }
    });

    socketRef.current.on('connect', () => setIsBackendConnected(true));
    socketRef.current.on('disconnect', () => setIsBackendConnected(false));

    socketRef.current.on('torrent_progress', (data) => {
      setDownloads((prev) => prev.map(d => {
        const matchesId = d.id === data.appId;
        const matchesHash = data.id && (
          d.url?.toLowerCase().includes(data.id.toLowerCase()) ||
          d.torrentMetadata?.infoHash?.toLowerCase() === data.id.toLowerCase()
        );

        if (matchesId || matchesHash) {
          const speedStr = data.downloadSpeed >= 1024 * 1024 
            ? (data.downloadSpeed / 1024 / 1024).toFixed(1) + ' MB/s' 
            : (data.downloadSpeed / 1024).toFixed(0) + ' KB/s';
            
          return {
            ...d,
            progress: data.progress,
            downloadedBytes: data.downloaded,
            speed: speedStr,
            peersCount: data.numPeers,
          };
        }
        return d;
      }));
    });

    socketRef.current.on('torrent_done', (data) => {
      setDownloads((prev) => prev.map(d => {
        const matchesId = d.id === data.appId;
        const matchesHash = data.id && (
          d.url?.toLowerCase().includes(data.id.toLowerCase()) ||
          d.torrentMetadata?.infoHash?.toLowerCase() === data.id.toLowerCase()
        );

        if (matchesId || matchesHash) {
          if (data.downloadUrl) {
            const finalItem = { ...d, url: backendUrl + data.downloadUrl, isTorrent: false };
            downloadService.startRealDownload(
              finalItem,
              (updates) => {
                setDownloads(curr => curr.map(item => item.id === d.id ? { ...item, ...updates } : item));
              },
              (updates) => {
                setDownloads(curr => curr.map(item => item.id === d.id ? { ...item, ...updates, status: 'completed' } : item));
              },
              (err) => {
                setDownloads(curr => curr.map(item => item.id === d.id ? { ...item, status: 'error', error: err } : item));
              }
            );
          }
          return { ...d, status: 'downloading', speed: 'Saving to phone storage...' };
        }
        return d;
      }));
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [backendUrl]);

  const refreshStorageStats = useCallback(async () => {
    try {
      const stats = await downloadService.getStorageStats(downloads);
      setStorageStats(stats);
    } catch (err) {
      console.warn('Failed to get storage stats:', err);
    }
  }, [downloads]);

  const mergeWithDiskFiles = async (baseList: DownloadItem[]): Promise<DownloadItem[]> => {
    try {
      const diskItems = await downloadService.scanDiskMovies();
      const map = new Map<string, DownloadItem>();

      for (const item of baseList) {
        map.set(item.id, item);
      }

      for (const diskItem of diskItems) {
        // Find existing match by fileUri, movieFileUri, fileName, or movieFileName
        const existing = baseList.find(
          (i) =>
            i.fileUri === diskItem.fileUri ||
            i.movieFileUri === diskItem.movieFileUri ||
            i.fileName.toLowerCase() === diskItem.fileName.toLowerCase() ||
            (i.movieFileName && i.movieFileName.toLowerCase() === diskItem.fileName.toLowerCase())
        );

        if (existing) {
          map.set(existing.id, {
            ...existing,
            status: 'completed',
            fileUri: diskItem.fileUri,
            movieFileUri: diskItem.movieFileUri,
            downloadedBytes: diskItem.downloadedBytes || existing.downloadedBytes,
            totalBytes: diskItem.totalBytes || existing.totalBytes,
            progress: 1,
            poster: existing.poster || diskItem.poster,
            completedAt: existing.completedAt || diskItem.completedAt,
          });
        } else {
          map.set(diskItem.id, diskItem);
        }
      }

      return Array.from(map.values());
    } catch (err) {
      console.warn('Failed to merge with disk files:', err);
      return baseList;
    }
  };

  // Load persisted downloads list on mount & scan internal storage
  useEffect(() => {
    const loadPersisted = async () => {
      try {
        let loadedItems: DownloadItem[] = [];

        if (Platform.OS !== 'web' && (STORAGE_INDEX_FILE || LEGACY_STORAGE_INDEX_FILE)) {
          let content = '';
          if (STORAGE_INDEX_FILE) {
            const info = await FileSystem.getInfoAsync(STORAGE_INDEX_FILE);
            if (info.exists) {
              content = await FileSystem.readAsStringAsync(STORAGE_INDEX_FILE);
            }
          }
          if (!content && LEGACY_STORAGE_INDEX_FILE) {
            const legacyInfo = await FileSystem.getInfoAsync(LEGACY_STORAGE_INDEX_FILE);
            if (legacyInfo.exists) {
              content = await FileSystem.readAsStringAsync(LEGACY_STORAGE_INDEX_FILE);
            }
          }

          if (content) {
            try {
              const parsed: DownloadItem[] = JSON.parse(content);
              if (Array.isArray(parsed)) {
                loadedItems = parsed;
              }
            } catch {}
          }
        } else if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          const content = localStorage.getItem('trs_downloads');
          if (content) {
            try {
              const parsed: DownloadItem[] = JSON.parse(content);
              if (Array.isArray(parsed)) {
                loadedItems = parsed;
              }
            } catch {}
          }
        }

        // Auto-discover movies existing in internal storage directory
        const merged = await mergeWithDiskFiles(loadedItems);

        const sanitized = merged.map((item) =>
          item.status === 'downloading'
            ? { ...item, status: 'paused' as const, speed: '0 KB/s' }
            : item
        );

        setDownloads(sanitized);
        isLoadedRef.current = true;
      } catch (err) {
        console.warn('Could not load persisted downloads:', err);
        isLoadedRef.current = true;
      }
    };

    loadPersisted();
  }, []);

  // Save persisted list on change (ONLY AFTER INITIAL LOAD COMPLETES)
  useEffect(() => {
    if (!isLoadedRef.current) return;

    const persist = async () => {
      try {
        const dataToSave = JSON.stringify(downloads);
        if (Platform.OS !== 'web' && STORAGE_INDEX_FILE) {
          // Ensure directory exists before writing index
          const dir = `${FileSystem.documentDirectory}${MOVIES_DIR_NAME}/`;
          const dirInfo = await FileSystem.getInfoAsync(dir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          }
          await FileSystem.writeAsStringAsync(STORAGE_INDEX_FILE, dataToSave);
        } else if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          localStorage.setItem('trs_downloads', dataToSave);
        }
      } catch (err) {
        // ignore persistence errors
      }
    };

    persist();
    refreshStorageStats();
  }, [downloads, refreshStorageStats]);

  const rescanStorage = useCallback(async (): Promise<number> => {
    try {
      const diskItems = await downloadService.scanDiskMovies();
      let newCount = 0;
      setDownloads((prev) => {
        const map = new Map<string, DownloadItem>();
        for (const item of prev) {
          map.set(item.id, item);
        }

        for (const diskItem of diskItems) {
          const existing = prev.find(
            (i) =>
              i.fileUri === diskItem.fileUri ||
              i.movieFileUri === diskItem.movieFileUri ||
              i.fileName.toLowerCase() === diskItem.fileName.toLowerCase() ||
              (i.movieFileName && i.movieFileName.toLowerCase() === diskItem.fileName.toLowerCase())
          );

          if (existing) {
            map.set(existing.id, {
              ...existing,
              status: 'completed',
              fileUri: diskItem.fileUri,
              movieFileUri: diskItem.movieFileUri,
              downloadedBytes: diskItem.downloadedBytes || existing.downloadedBytes,
              totalBytes: diskItem.totalBytes || existing.totalBytes,
              progress: 1,
              poster: existing.poster || diskItem.poster,
              completedAt: existing.completedAt || diskItem.completedAt,
            });
          } else {
            newCount++;
            map.set(diskItem.id, diskItem);
          }
        }

        return Array.from(map.values());
      });
      refreshStorageStats();
      return newCount;
    } catch (err) {
      console.warn('Failed to rescan storage:', err);
      return 0;
    }
  }, [refreshStorageStats]);

  const importMovie = useCallback(
    async (sourceUri: string, fileName: string): Promise<DownloadItem> => {
      const newItem = await downloadService.importMovieFile(sourceUri, fileName);
      setDownloads((prev) => {
        const filtered = prev.filter(
          (d) => d.id !== newItem.id && d.fileName.toLowerCase() !== newItem.fileName.toLowerCase()
        );
        return [newItem, ...filtered];
      });
      refreshStorageStats();
      return newItem;
    },
    [refreshStorageStats]
  );

  const updateItem = useCallback((id: string, updates: Partial<DownloadItem>) => {
    setDownloads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  // Subscribe to background WebTorrent P2P engine events
  useEffect(() => {
    const unsubscribe = torrentEngine.subscribe((event) => {
      const { type, id, data } = event;
      if (type === 'metadata') {
        updateItem(id, {
          title: data.name || data.movieFileName,
          movieFileName: data.movieFileName,
          totalBytes: data.totalSize,
          infoHash: data.infoHash,
          resolution: '1080p',
        });
      } else if (type === 'progress') {
        updateItem(id, {
          progress: data.progress,
          downloadedBytes: data.downloaded,
          totalBytes: data.total,
          speed: data.downloadSpeed,
          peersCount: data.peersCount,
          status: 'downloading',
        });
      } else if (type === 'done') {
        updateItem(id, {
          status: 'completed',
          progress: 1,
          speed: '0 KB/s',
          movieFileName: data.movieFileName,
          movieFileUri: data.blobUrl,
          completedAt: Date.now(),
        });
      } else if (type === 'error') {
        console.log('Torrent engine event error:', data.message);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [updateItem]);

  const startDownload = useCallback(
    async (url: string, suggestedTitle?: string): Promise<DownloadItem> => {
      let targetUrl = url.trim();
      const infoHash = extractInfoHashFromUrl(targetUrl);
      const isStreamEndpoint = targetUrl.includes('/api/stream/');

      // If it's a magnet link, infoHash, or stream endpoint URL:
      if (infoHash || isStreamEndpoint) {
        if (infoHash) {
          targetUrl = `${backendUrl}/api/stream/${infoHash}?raw=1`;
        } else if (isStreamEndpoint) {
          targetUrl = targetUrl.replace(/http:\/\/(localhost|127\.0\.0\.1):3000/g, backendUrl);
          if (!targetUrl.includes('raw=1')) {
            targetUrl += (targetUrl.includes('?') ? '&raw=1' : '?raw=1');
          }
        }
        
        // Pre-warm backend torrent engine stream in background
        if (infoHash) {
          fetch(`${backendUrl}/api/stream/warmup?hash=${infoHash}`, {
            headers: { 'Bypass-Tunnel-Reminder': 'true' }
          }).catch(() => {});
        }
      }

      const initialItem = downloadService.createDownloadItem(targetUrl, suggestedTitle);
      
      setDownloads((prev) => [initialItem, ...prev]);

      if (initialItem.isTorrent) {
        // Resolve the real movie video file from the torrent file
        resolveTorrentMoviePayload(initialItem.url, suggestedTitle).then((resolved) => {
          const movieFileName = resolved.movieFileName;
          const movieFileUri = `${downloadService.getDownloadsDirectory()}${movieFileName}`;
          const totalBytes = resolved.totalBytes > 0 ? resolved.totalBytes : initialItem.totalBytes;
          const directMovieUrl = resolved.movieDownloadUrl;

          const updatedPayloadItem: DownloadItem = {
            ...initialItem,
            title: resolved.title || initialItem.title,
            fileName: movieFileName,
            movieFileName,
            fileUri: movieFileUri,
            movieFileUri,
            totalBytes,
            torrentMetadata: resolved.torrentMetadata || initialItem.torrentMetadata,
            url: directMovieUrl || initialItem.url,
          };

          updateItem(initialItem.id, updatedPayloadItem);

          // If direct WebSeed/Media stream URL is resolved, download the real movie data directly!
          if (directMovieUrl) {
            downloadService.startRealDownload(
              updatedPayloadItem,
              (progressUpdates) => {
                updateItem(initialItem.id, progressUpdates);
              },
              (completedUpdates) => {
                updateItem(initialItem.id, {
                  ...completedUpdates,
                  title: resolved.title,
                  movieFileName,
                  movieFileUri,
                });
              },
              (errorMsg) => {
                updateItem(initialItem.id, {
                  status: 'error',
                  error: errorMsg,
                  speed: '0 KB/s',
                });
              }
            );
          } else {
            // Push to our dedicated backend server
            const runBackendDownload = async () => {
              updateItem(initialItem.id, { speed: 'Connecting to Backend...' });
              try {
                if (initialItem.url.startsWith('magnet:')) {
                  const res = await fetch(`${backendUrl}/api/torrent/magnet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                    body: JSON.stringify({ magnet: initialItem.url, appId: initialItem.id })
                  });
                  if (!res.ok) throw new Error('Failed to send magnet to backend');
                } else if (initialItem.url.startsWith('data:')) {
                  // It's a base64 encoded data URI!
                  const res = await fetch(`${backendUrl}/api/torrent/file-base64`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
                    body: JSON.stringify({ 
                      appId: initialItem.id, 
                      base64: initialItem.url,
                      name: initialItem.fileName || 'movie.torrent'
                    })
                  });
                  if (!res.ok) throw new Error('Failed to upload base64 torrent to backend');
                } else {
                  // Upload .torrent file via form data (if it's a file:// uri)
                  const formData = new FormData();
                  formData.append('appId', initialItem.id);
                  formData.append('torrent', {
                    uri: initialItem.url,
                    name: initialItem.fileName || 'movie.torrent',
                    type: 'application/x-bittorrent'
                  } as any);

                  const res = await fetch(`${backendUrl}/api/torrent/file`, {
                    method: 'POST',
                    headers: { 'Bypass-Tunnel-Reminder': 'true' },
                    body: formData
                  });
                  if (!res.ok) throw new Error('Failed to upload torrent to backend');
                }
              } catch (err: any) {
                console.warn('Backend Download Error:', err);
                updateItem(initialItem.id, {
                  status: 'error',
                  error: 'Backend Error: ' + err.message,
                  speed: '0 KB/s',
                });
              }
            };
            runBackendDownload();
          }
        });
      } else {
        // Direct HTTP stream or media download (MP4, MKV, /api/stream/...)
        downloadService.startRealDownload(
          initialItem,
          (progressUpdates) => {
            updateItem(initialItem.id, progressUpdates);
          },
          (completedUpdates) => {
            updateItem(initialItem.id, completedUpdates);
          },
          (errorMsg) => {
            updateItem(initialItem.id, {
              status: 'error',
              error: errorMsg,
              speed: '0 KB/s',
            });
          }
        );
      }

      return initialItem;
    },
    [backendUrl, updateItem]
  );

  const pauseDownload = useCallback(
    async (id: string) => {
      const item = downloads.find((d) => d.id === id);
      if (!item) return;

      const pausedUpdates = await downloadService.pauseDownload(item);
      if (item.isTorrent) {
        torrentEngine.pauseTorrent(id);
      }
      updateItem(id, pausedUpdates);
    },
    [downloads, updateItem]
  );

  const resumeDownload = useCallback(
    async (id: string) => {
      const item = downloads.find((d) => d.id === id);
      if (!item) return;

      updateItem(id, { status: 'downloading', error: undefined });

      downloadService.startRealDownload(
        { ...item, status: 'downloading' },
        (progressUpdates) => {
          updateItem(id, progressUpdates);
        },
        (completedUpdates) => {
          updateItem(id, completedUpdates);
        },
        (errorMsg) => {
          updateItem(id, {
            status: 'error',
            error: errorMsg,
            speed: '0 KB/s',
          });
        }
      );

      if (item.isTorrent) {
        torrentEngine.resumeTorrent(id);
      }
    },
    [downloads, updateItem]
  );

  const deleteDownload = useCallback(
    async (id: string) => {
      const item = downloads.find((d) => d.id === id);
      if (item) {
        if (item.isTorrent) {
          torrentEngine.removeTorrent(id);
        }
        await downloadService.deleteDownload(item);
      }
      setDownloads((prev) => prev.filter((d) => d.id !== id));
    },
    [downloads]
  );

  const clearCompleted = useCallback(async () => {
    const completed = downloads.filter((d) => d.status === 'completed');
    for (const item of completed) {
      if (item.isTorrent) {
        torrentEngine.removeTorrent(item.id);
      }
      await downloadService.deleteDownload(item);
    }
    setDownloads((prev) => prev.filter((d) => d.status !== 'completed'));
  }, [downloads]);

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        activeDownloadsCount,
        storageStats,
        isBackendConnected,
        backendUrl,
        setBackendUrl,
        testPing,
        startDownload,
        pauseDownload,
        resumeDownload,
        deleteDownload,
        clearCompleted,
        refreshStorageStats,
        rescanStorage,
        importMovie,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownloads = (): DownloadContextType => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownloads must be used within a DownloadProvider');
  }
  return context;
};
