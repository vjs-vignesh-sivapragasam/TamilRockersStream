import * as FileSystem from 'expo-file-system/legacy';

export interface ContinueWatchingItem {
  id: string; // unique item identifier (streamUrl, fileUri, or movieId)
  movieId?: string;
  movieTitle: string;
  posterUrl?: string | null;
  currentTime: number; // in seconds
  duration: number; // in seconds
  progress: number; // between 0.0 and 1.0
  streamUrl?: string;
  fileUri?: string;
  resolution?: string;
  topicUrl?: string;
  updatedAt: number;
}

const CONTINUE_WATCHING_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}vflex_continue_watching.json`
  : '';

class ContinueWatchingService {
  private items: ContinueWatchingItem[] = [];
  private loaded = false;
  private listeners: Set<(items: ContinueWatchingItem[]) => void> = new Set();

  constructor() {
    this.loadFromDisk();
  }

  private notify() {
    const copy = [...this.items];
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch (err) {
        console.warn('[ContinueWatchingService] Listener error:', err);
      }
    });
  }

  public subscribe(cb: (items: ContinueWatchingItem[]) => void): () => void {
    this.listeners.add(cb);
    if (this.loaded) {
      cb([...this.items]);
    }
    return () => this.listeners.delete(cb);
  }

  public async loadFromDisk(): Promise<ContinueWatchingItem[]> {
    if (this.loaded) return this.items;
    if (!CONTINUE_WATCHING_FILE) {
      this.loaded = true;
      return [];
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(CONTINUE_WATCHING_FILE);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(CONTINUE_WATCHING_FILE);
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          this.items = parsed;
        }
      }
    } catch (err) {
      console.warn('[ContinueWatchingService] Error loading from disk:', err);
    } finally {
      this.loaded = true;
      this.notify();
    }
    return this.items;
  }

  private async saveToDisk(): Promise<void> {
    if (!CONTINUE_WATCHING_FILE) return;
    try {
      await FileSystem.writeAsStringAsync(CONTINUE_WATCHING_FILE, JSON.stringify(this.items));
    } catch (err) {
      console.warn('[ContinueWatchingService] Error saving to disk:', err);
    }
  }

  public getItems(): ContinueWatchingItem[] {
    return [...this.items];
  }

  public async saveProgress(data: {
    id: string;
    movieTitle: string;
    currentTime: number;
    duration: number;
    posterUrl?: string | null;
    streamUrl?: string;
    fileUri?: string;
    resolution?: string;
    topicUrl?: string;
  }): Promise<void> {
    const { id, movieTitle, currentTime, duration, posterUrl, streamUrl, fileUri, resolution, topicUrl } = data;
    if (!id || !movieTitle || duration <= 0) return;

    // Filter out if user watched less than 10 seconds
    if (currentTime < 10) return;

    const progress = Math.min(1, Math.max(0, currentTime / duration));

    // If watched more than 94% or less than 40s remaining, treat as finished and remove
    if (progress > 0.94 || (duration - currentTime) < 40) {
      await this.remove(id);
      return;
    }

    const existingIdx = this.items.findIndex(
      (item) =>
        item.id === id ||
        (item.movieTitle.toLowerCase() === movieTitle.toLowerCase() && Math.abs(item.duration - duration) < 60)
    );

    const existingPoster = existingIdx >= 0 ? this.items[existingIdx].posterUrl : null;

    const updatedItem: ContinueWatchingItem = {
      id,
      movieTitle,
      posterUrl: posterUrl || existingPoster || null,
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration),
      progress,
      streamUrl,
      fileUri,
      resolution,
      topicUrl,
      updatedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      this.items.splice(existingIdx, 1);
    }

    // Insert at front (most recently played)
    this.items.unshift(updatedItem);

    // Keep max 20 items
    if (this.items.length > 20) {
      this.items = this.items.slice(0, 20);
    }

    this.notify();
    await this.saveToDisk();
  }

  public async remove(idOrTitle: string): Promise<void> {
    const clean = idOrTitle.trim().toLowerCase();
    const prev = this.items.length;
    this.items = this.items.filter(
      (item) => item.id.toLowerCase() !== clean && item.movieTitle.toLowerCase() !== clean
    );
    if (this.items.length !== prev) {
      this.notify();
      await this.saveToDisk();
    }
  }

  public async clear(): Promise<void> {
    this.items = [];
    this.notify();
    await this.saveToDisk();
  }
}

export const continueWatchingService = new ContinueWatchingService();
