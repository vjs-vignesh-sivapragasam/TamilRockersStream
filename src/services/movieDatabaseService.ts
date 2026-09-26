export interface RealMovieMetadata {
  title: string;
  originalTitle?: string;
  tagline?: string;
  synopsis: string;
  rating: number; // e.g. 8.4
  voteCount?: number;
  matchScore: number; // e.g. 92%
  contentRating: string; // e.g. '13+'
  year: string;
  releaseDate?: string;
  runtime?: string; // e.g. '2h 49m'
  genres: string[];
  cast: string[];
  director?: string;
  backdropUrl?: string;
  posterUrl?: string;
  source: 'tmdb' | 'itunes' | 'omdb';
}

const TMDB_API_KEYS = [
  '15d2ee50754e5961b46f56728e0a5996',
  'b02660d13bc7520e5c8e312e75344445',
  '0172e27b9c65691d17d59a850e058c42',
];

export async function fetchMovieDatabaseMetadata(
  title: string,
  yearHint?: string
): Promise<RealMovieMetadata | null> {
  if (!title || title.trim().length < 2) return null;

  // Clean title for search (remove boilerplate prefixes, quality tags, year)
  let clean = title
    .replace(/^(?:view\s+(?:the\s+)?topic|go\s+to\s+(?:the\s+)?topic)[\s:'"‘“\-]*/i, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(
      /\b(1080p|720p|480p|2160p|4k|bluray|webrip|brrip|x264|x265|hevc|aac|dvdrip|hdrip|hq|esub|sub|550mb|700mb|900mb|1\.4gb|2gb|2\.8gb|5\.4gb|tamil|telugu|hindi|malayalam|kannada|english)\b/gi,
      ''
    )
    .replace(/[_.-]+/g, ' ')
    .trim();

  // Extract year if present
  const yearMatch = (yearHint || title).match(/\b(19\d\d|20\d\d)\b/);
  const year = yearMatch ? yearMatch[1] : '';

  if (year) {
    clean = clean.replace(new RegExp(`\\b${year}\\b`, 'g'), '').trim();
  }

  // 1. Try TMDB Search API
  for (const apiKey of TMDB_API_KEYS) {
    try {
      const yearQuery = year ? `&year=${year}` : '';
      const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(clean)}${yearQuery}&include_adult=false`;
      const res = await fetch(searchUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const m = data.results[0];

          // Fetch full details with credits
          try {
            const detailRes = await fetch(
              `https://api.themoviedb.org/3/movie/${m.id}?api_key=${apiKey}&append_to_response=credits`
            );
            if (detailRes.ok) {
              const d = await detailRes.json();
              const castList = (d.credits?.cast || []).slice(0, 5).map((c: any) => c.name);
              const directorObj = (d.credits?.crew || []).find((c: any) => c.job === 'Director');
              const runtimeMins = d.runtime || 0;
              const runtimeStr =
                runtimeMins > 0
                  ? `${Math.floor(runtimeMins / 60)}h ${runtimeMins % 60}m`
                  : '';

              return {
                title: d.title || m.title,
                originalTitle: d.original_title !== d.title ? d.original_title : undefined,
                tagline: d.tagline || undefined,
                synopsis: d.overview || m.overview || '',
                rating: Number((d.vote_average || m.vote_average || 0).toFixed(1)),
                voteCount: d.vote_count || m.vote_count,
                matchScore: Math.min(99, Math.max(70, Math.round((d.vote_average || 7.5) * 10))),
                contentRating: d.adult ? '18+' : '13+',
                year: (d.release_date || m.release_date || year || '').substring(0, 4),
                releaseDate: d.release_date || m.release_date,
                runtime: runtimeStr,
                genres: (d.genres || []).map((g: any) => g.name),
                cast: castList,
                director: directorObj?.name,
                backdropUrl: d.backdrop_path ? `https://image.tmdb.org/t/p/w1280${d.backdrop_path}` : undefined,
                posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w780${d.poster_path}` : undefined,
                source: 'tmdb',
              };
            }
          } catch {}

          return {
            title: m.title,
            synopsis: m.overview || '',
            rating: Number((m.vote_average || 0).toFixed(1)),
            voteCount: m.vote_count,
            matchScore: Math.min(99, Math.max(70, Math.round((m.vote_average || 7.5) * 10))),
            contentRating: m.adult ? '18+' : '13+',
            year: (m.release_date || year || '').substring(0, 4),
            releaseDate: m.release_date,
            genres: [],
            cast: [],
            backdropUrl: m.backdrop_path ? `https://image.tmdb.org/t/p/w1280${m.backdrop_path}` : undefined,
            posterUrl: m.poster_path ? `https://image.tmdb.org/t/p/w780${m.poster_path}` : undefined,
            source: 'tmdb',
          };
        }
      }
    } catch {}
  }

  // 2. Try iTunes Movie API Fallback
  try {
    const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&entity=movie&limit=1`;
    const res = await fetch(iTunesUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const artwork = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : undefined;
        return {
          title: item.trackName || item.collectionName || clean,
          synopsis: item.longDescription || item.shortDescription || '',
          rating: 8.0,
          matchScore: 88,
          contentRating: item.contentAdvisoryRating || '13+',
          year: (item.releaseDate || year || '').substring(0, 4),
          releaseDate: item.releaseDate,
          genres: item.primaryGenreName ? [item.primaryGenreName] : [],
          cast: item.artistName ? [item.artistName] : [],
          director: item.artistName,
          posterUrl: artwork,
          backdropUrl: artwork,
          source: 'itunes',
        };
      }
    }
  } catch {}

  // 3. Try OMDb API Fallback
  try {
    const omdbUrl = `https://www.omdbapi.com/?t=${encodeURIComponent(clean)}&apikey=trilogy`;
    const res = await fetch(omdbUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.Response === 'True') {
        const ratingNum = parseFloat(data.imdbRating) || 7.5;
        return {
          title: data.Title || clean,
          synopsis: data.Plot && data.Plot !== 'N/A' ? data.Plot : '',
          rating: ratingNum,
          matchScore: Math.min(99, Math.max(70, Math.round(ratingNum * 10))),
          contentRating: data.Rated && data.Rated !== 'N/A' ? data.Rated : '13+',
          year: data.Year || year,
          releaseDate: data.Released,
          runtime: data.Runtime && data.Runtime !== 'N/A' ? data.Runtime : undefined,
          genres: data.Genre ? data.Genre.split(',').map((s: string) => s.trim()) : [],
          cast: data.Actors ? data.Actors.split(',').map((s: string) => s.trim()) : [],
          director: data.Director && data.Director !== 'N/A' ? data.Director : undefined,
          posterUrl: data.Poster && data.Poster !== 'N/A' ? data.Poster : undefined,
          source: 'omdb',
        };
      }
    }
  } catch {}

  return null;
}
