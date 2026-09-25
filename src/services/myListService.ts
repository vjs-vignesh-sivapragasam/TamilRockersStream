import * as FileSystem from 'expo-file-system/legacy';
import { TamilMvMovieResult, MovieResolutionItem } from './tamilMvService';

export interface MyListItem {
  id: string; // unique ID (topicUrl or movieTitle-year)
  movieTitle: string;
  topicUrl: string;
  posterUrl?: string | null;
  year?: string;
  language?: string;
  resolutions?: MovieResolutionItem[];
  addedAt: number;
}

const MY_LIST_FILE = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}vflex_mylist.json`
  : '';

class MyListService {
  private items: MyListItem[] = [];
  private loaded = false;
  private listeners: Set<(items: MyListItem[]) => void> = new Set();

  constructor() {
    this.loadFromDisk();
  }

  private notify() {
    const copy = [...this.items];
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch (err) {
        console.warn('[MyListService] Listener error:', err);
      }
    });
  }

  public subscribe(cb: (items: MyListItem[]) => void): () => void {
    this.listeners.add(cb);
    if (this.loaded) {
      cb([...this.items]);
    }
    return () => this.listeners.delete(cb);
  }

  public async loadFromDisk(): Promise<MyListItem[]> {
    if (this.loaded) return this.items;
    if (!MY_LIST_FILE) {
      this.loaded = true;
      return [];
    }

    try {
      const fileInfo = await FileSystem.getInfoAsync(MY_LIST_FILE);
      if (fileInfo.exists) {
        const content = await FileSystem.readAsStringAsync(MY_LIST_FILE);
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          this.items = parsed;
        }
      }
    } catch (err) {
      console.warn('[MyListService] Error loading my list from disk:', err);
    } finally {
      this.loaded = true;
      this.notify();
    }
    return this.items;
  }

  private async saveToDisk(): Promise<void> {
    if (!MY_LIST_FILE) return;
    try {
      await FileSystem.writeAsStringAsync(MY_LIST_FILE, JSON.stringify(this.items));
    } catch (err) {
      console.warn('[MyListService] Error saving my list to disk:', err);
    }
  }

  public getItems(): MyListItem[] {
    return [...this.items];
  }

  public isSaved(idOrUrl: string): boolean {
    if (!idOrUrl) return false;
    const clean = idOrUrl.trim().toLowerCase();
    return this.items.some(
      (item) =>
        item.id.toLowerCase() === clean ||
        item.topicUrl.toLowerCase() === clean ||
        item.movieTitle.toLowerCase() === clean
    );
  }

  public async add(movie: TamilMvMovieResult, posterUrl?: string | null): Promise<void> {
    const id = movie.id || movie.topicUrl || movie.movieTitle;
    if (this.isSaved(id)) return;

    const newItem: MyListItem = {
      id,
      movieTitle: movie.movieTitle,
      topicUrl: movie.topicUrl || movie.resolutions?.[0]?.topicUrl || '',
      posterUrl: posterUrl ?? null,
      year: movie.year,
      language: movie.language,
      resolutions: movie.resolutions,
      addedAt: Date.now(),
    };

    this.items.unshift(newItem);
    this.notify();
    await this.saveToDisk();
  }

  public async remove(idOrUrl: string): Promise<void> {
    const clean = idOrUrl.trim().toLowerCase();
    const prevCount = this.items.length;
    this.items = this.items.filter(
      (item) =>
        item.id.toLowerCase() !== clean &&
        item.topicUrl.toLowerCase() !== clean &&
        item.movieTitle.toLowerCase() !== clean
    );
    if (this.items.length !== prevCount) {
      this.notify();
      await this.saveToDisk();
    }
  }

  public async toggle(movie: TamilMvMovieResult, posterUrl?: string | null): Promise<boolean> {
    const id = movie.id || movie.topicUrl || movie.movieTitle;
    if (this.isSaved(id)) {
      await this.remove(id);
      return false;
    } else {
      await this.add(movie, posterUrl);
      return true;
    }
  }

  public async clear(): Promise<void> {
    this.items = [];
    this.notify();
    await this.saveToDisk();
  }
}

export const myListService = new MyListService();
