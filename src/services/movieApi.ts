import { MediaItem } from '../data/sampleMedia';

export type ApiProvider = 'tvmaze' | 'tmdb' | 'custom';

export interface ApiConfig {
  provider: ApiProvider;
  baseUrl: string;
  apiKey?: string;
}

export const DEFAULT_CONFIG: ApiConfig = {
  provider: 'tvmaze',
  baseUrl: 'https://api.tvmaze.com',
  apiKey: '',
};

let currentConfig: ApiConfig = { ...DEFAULT_CONFIG };

export const setApiConfig = (newConfig: Partial<ApiConfig>) => {
  currentConfig = { ...currentConfig, ...newConfig };
};

export const getApiConfig = (): ApiConfig => {
  return currentConfig;
};

// Helper to sanitize HTML summaries from TVMaze
const stripHtml = (html: string): string => {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
};

/**
 * Fetch popular / trending shows & movies from configured provider
 */
export const fetchMediaCatalog = async (): Promise<{
  hero: MediaItem;
  trending: MediaItem[];
  topRated: MediaItem[];
  action: MediaItem[];
  drama: MediaItem[];
}> => {
  try {
    if (currentConfig.provider === 'tvmaze') {
      const response = await fetch(`${currentConfig.baseUrl}/shows?page=1`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();

      const items: MediaItem[] = data.slice(0, 40).map((show: any, index: number) => {
        const posterUrl =
          show.image?.original ||
          show.image?.medium ||
          'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80';

        const matchScore = show.rating?.average
          ? Math.round(show.rating.average * 10)
          : Math.floor(Math.random() * 15) + 84;

        return {
          id: `tv-${show.id}`,
          title: show.name || 'Untitled',
          poster: posterUrl,
          backdrop: posterUrl,
          matchScore: Math.min(matchScore, 99),
          rating: show.type === 'Scripted' ? '16+' : '13+',
          duration: show.averageRuntime ? `${show.averageRuntime}m` : '1h 45m',
          quality: '4K Ultra HD',
          genres: show.genres?.length ? show.genres : ['Drama', 'Action'],
          synopsis: stripHtml(show.summary) || 'No synopsis available.',
          cast: ['Featured Cast'],
          isTopTen: index < 10,
          topTenRank: index < 10 ? index + 1 : undefined,
        };
      });

      const hero = items[0] || null;
      const trending = items.slice(0, 10);
      const topRated = items.slice(10, 20);
      const action = items.filter((i) => i.genres.includes('Action') || i.genres.includes('Adventure')).slice(0, 10);
      const drama = items.filter((i) => i.genres.includes('Drama') || i.genres.includes('Sci-Fi')).slice(0, 10);

      return {
        hero,
        trending: trending.length ? trending : items.slice(0, 8),
        topRated: topRated.length ? topRated : items.slice(8, 16),
        action: action.length ? action : items.slice(16, 24),
        drama: drama.length ? drama : items.slice(24, 32),
      };
    }

    // Default fallback if TMDB / custom provider
    if (currentConfig.provider === 'tmdb' && currentConfig.apiKey) {
      const response = await fetch(
        `${currentConfig.baseUrl}/trending/movie/week?api_key=${currentConfig.apiKey}`
      );
      if (!response.ok) throw new Error(`TMDB error ${response.status}`);
      const data = await response.json();
      const items: MediaItem[] = data.results.map((m: any, index: number) => ({
        id: `tmdb-${m.id}`,
        title: m.title || m.name,
        poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        backdrop: `https://image.tmdb.org/t/p/w1280${m.backdrop_path || m.poster_path}`,
        matchScore: Math.round((m.vote_average || 7.5) * 10),
        rating: m.adult ? '18+' : '13+',
        duration: '2h 10m',
        quality: '4K Ultra HD',
        genres: ['Featured', 'Trending'],
        synopsis: m.overview || 'No overview available.',
        cast: ['Hollywood Cast'],
        isTopTen: index < 10,
        topTenRank: index < 10 ? index + 1 : undefined,
      }));

      return {
        hero: items[0],
        trending: items.slice(0, 10),
        topRated: items.slice(5, 15),
        action: items.slice(10, 20),
        drama: items.slice(2, 12),
      };
    }

    throw new Error('Configured provider returned no results');
  } catch (err) {
    console.warn('Media fetch failed, falling back to local dataset:', err);
    throw err;
  }
};

/**
 * Search movies / shows across configured API
 */
export const searchMedia = async (query: string): Promise<MediaItem[]> => {
  if (!query.trim()) return [];

  try {
    if (currentConfig.provider === 'tvmaze') {
      const response = await fetch(
        `${currentConfig.baseUrl}/search/shows?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) return [];
      const data = await response.json();

      return data.map((entry: any) => {
        const show = entry.show;
        const posterUrl =
          show.image?.original ||
          show.image?.medium ||
          'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&q=80';

        const matchScore = show.rating?.average
          ? Math.round(show.rating.average * 10)
          : 90;

        return {
          id: `search-${show.id}`,
          title: show.name,
          poster: posterUrl,
          backdrop: posterUrl,
          matchScore,
          rating: '16+',
          duration: show.averageRuntime ? `${show.averageRuntime}m` : '1h 30m',
          quality: '4K Ultra HD',
          genres: show.genres?.length ? show.genres : ['Cinema'],
          synopsis: stripHtml(show.summary) || 'No summary available.',
          cast: ['Main Cast'],
        };
      });
    }

    if (currentConfig.provider === 'tmdb' && currentConfig.apiKey) {
      const response = await fetch(
        `${currentConfig.baseUrl}/search/movie?api_key=${currentConfig.apiKey}&query=${encodeURIComponent(query)}`
      );
      if (!response.ok) return [];
      const data = await response.json();

      return (data.results || []).map((m: any) => ({
        id: `search-tmdb-${m.id}`,
        title: m.title || m.name,
        poster: `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        backdrop: `https://image.tmdb.org/t/p/w1280${m.backdrop_path || m.poster_path}`,
        matchScore: Math.round((m.vote_average || 7.5) * 10),
        rating: '13+',
        duration: '2h 00m',
        quality: '4K Ultra HD',
        genres: ['Movie'],
        synopsis: m.overview || '',
        cast: ['Featured Actors'],
      }));
    }

    return [];
  } catch (error) {
    console.error('Search query failed:', error);
    return [];
  }
};
