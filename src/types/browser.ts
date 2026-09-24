export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  progress: number;
}

export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  category: 'Cinema' | 'Search' | 'Media' | 'Custom';
  color: string;
  iconLetter: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  timestamp: string;
}

export interface ShieldStats {
  adsBlocked: number;
  trackersBlocked: number;
  popupsPrevented: number;
  strictMode: boolean;
}
