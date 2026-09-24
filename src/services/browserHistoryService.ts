import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { HistoryItem } from '../types/browser';

const HISTORY_STORAGE_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}trs_browser_history.json`
  : null;

const DEFAULT_HISTORY: HistoryItem[] = [
  {
    id: 'h-1',
    title: 'Google',
    url: 'https://www.google.co.in',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
  {
    id: 'h-2',
    title: 'VFlix Movies 2026',
    url: 'https://www.google.co.in/search?q=vflix+movies',
    timestamp: 'Today',
  },
  {
    id: 'h-3',
    title: 'Latest Tamil & South Indian 4K Torrents',
    url: 'https://www.google.co.in/search?q=tamil+movies+download',
    timestamp: 'Yesterday',
  },
];

class BrowserHistoryService {
  private cachedHistory: HistoryItem[] | null = null;

  public async getHistory(): Promise<HistoryItem[]> {
    if (this.cachedHistory) {
      return this.cachedHistory;
    }

    try {
      if (Platform.OS !== 'web' && HISTORY_STORAGE_FILE) {
        const info = await FileSystem.getInfoAsync(HISTORY_STORAGE_FILE);
        if (info.exists) {
          const content = await FileSystem.readAsStringAsync(HISTORY_STORAGE_FILE);
          if (content) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.cachedHistory = parsed;
              return parsed;
            }
          }
        }
      } else if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const content = localStorage.getItem('trs_browser_history');
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cachedHistory = parsed;
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load browser history:', err);
    }

    this.cachedHistory = [...DEFAULT_HISTORY];
    return this.cachedHistory;
  }

  public async addEntry(url: string, title?: string): Promise<HistoryItem[]> {
    if (!url || url === 'about:blank') {
      return this.cachedHistory || [];
    }

    const current = await this.getHistory();
    const cleanUrl = url.trim();
    const cleanTitle = title?.trim() || cleanUrl;

    // Filter out existing exact url to move it to the top
    const filtered = current.filter((item) => item.url.toLowerCase() !== cleanUrl.toLowerCase());

    const newEntry: HistoryItem = {
      id: `h-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: cleanTitle,
      url: cleanUrl,
      timestamp: 'Just now',
    };

    const updated = [newEntry, ...filtered].slice(0, 50);
    this.cachedHistory = updated;
    await this.persist(updated);
    return updated;
  }

  public async removeEntry(id: string): Promise<HistoryItem[]> {
    const current = await this.getHistory();
    const updated = current.filter((item) => item.id !== id);
    this.cachedHistory = updated;
    await this.persist(updated);
    return updated;
  }

  public async clearHistory(): Promise<HistoryItem[]> {
    this.cachedHistory = [];
    await this.persist([]);
    return [];
  }

  private async persist(items: HistoryItem[]): Promise<void> {
    try {
      const json = JSON.stringify(items);
      if (Platform.OS !== 'web' && HISTORY_STORAGE_FILE) {
        await FileSystem.writeAsStringAsync(HISTORY_STORAGE_FILE, json);
      } else if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem('trs_browser_history', json);
      }
    } catch (err) {
      console.warn('Failed to persist browser history:', err);
    }
  }
}

export const browserHistoryService = new BrowserHistoryService();
