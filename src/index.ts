import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { RadarrMovieDetails } from './types';

const TMDB_API_KEY = process.env.TMDB_API_KEY!;
const SOURCE_URL = process.env.SOURCE_URL!;
const COUNTRY = process.env.COUNTRY!;
const STREAMING_SERVICES = process.env.STREAMING_SERVICES!.split(',').map(s => s.trim().toLowerCase());
const OUTPUT_FILE = 'filteredMovies.json';

const fetchMovieDetails = async (title: string, year?: string): Promise<Partial<RadarrMovieDetails> | null> => {
  try {
    const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
      params: { query: title, year, api_key: TMDB_API_KEY },
    });

    const movie = response.data.results[0];
    if (!movie) return null;

    return {
      id: movie.id,
      release_year: movie.release_date?.split('-')[0] ?? year,
      adult: movie.adult,
    };
  } catch (err: any) {
    console.error(`Error fetching "${title}":`, err.message);
    return null;
  }
};

const fetchStreamingAvailability = async (movieId: number): Promise<string[]> => {
  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`,
      {
        params: { api_key: TMDB_API_KEY },
      }
    );

    const providers = response.data.results;
    const availableServices: string[] = [];

    const regionProviders = providers[COUNTRY];
    if (!regionProviders || !regionProviders.flatrate) return [];

        regionProviders.flatrate.forEach((service: any) => {
        if (STREAMING_SERVICES.includes(service.provider_name.toLowerCase())) {
            availableServices.push(service.provider_name.toLowerCase());
        }
    });


    return availableServices;
  } catch (err: any) {
    console.error(`Error fetching streaming availability for ID ${movieId}:`, err.message);
    return [];
  }
};

const getFilteredMovies = async (): Promise<RadarrMovieDetails[]> => {
  const { data } = await axios.get<RadarrMovieDetails[]>(SOURCE_URL);
  const filteredMovies: RadarrMovieDetails[] = [];

  for (const movie of data) {
    const extra = await fetchMovieDetails(movie.title, movie.release_year);
    if (extra?.id) {
      const available = await fetchStreamingAvailability(extra.id);
      if (available.length === 0) {
        filteredMovies.push({
          ...movie,
          ...extra,
          clean_title: movie.title.toLowerCase().replace(/[^a-z0-9]/gi, ''),
        });
      }
    } else {
      filteredMovies.push(movie); // fallback if TMDb lookup fails
    }
  }

  return filteredMovies;
};

const exportFilteredMovies = async () => {
  const filtered = await getFilteredMovies();
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filtered, null, 2));
  console.log(`Exported ${filtered.length} filtered movies to ${OUTPUT_FILE}`);
};

const startServer = () => {
  const app = express();
  const port = 5432;

  app.use(express.static(path.join(__dirname, '..'))); // serve from root

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/${OUTPUT_FILE}`);
  });
};

// Main
(async () => {
  await exportFilteredMovies();
  startServer();
})();
