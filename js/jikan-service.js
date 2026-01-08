/* ============================================
   JIKAN API SERVICE - MyAnimeList Integration
   Autor: Jaykai2
   ✅ ACTUALIZADO: Sin límite de personajes
   ============================================ */

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';
const RATE_LIMIT_DELAY = 350; // 350ms entre requests (seguro para rate limit)

// Queue para manejar rate limiting
let requestQueue = [];
let isProcessingQueue = false;

// ============================================
// HELPER: RATE LIMITING
// ============================================
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const queueRequest = async (requestFn) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ requestFn, resolve, reject });
    processQueue();
  });
};

const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  
  isProcessingQueue = true;
  
  while (requestQueue.length > 0) {
    const { requestFn, resolve, reject } = requestQueue.shift();
    
    try {
      const result = await requestFn();
      resolve(result);
    } catch (error) {
      reject(error);
    }
    
    // Esperar antes del siguiente request
    if (requestQueue.length > 0) {
      await delay(RATE_LIMIT_DELAY);
    }
  }
  
  isProcessingQueue = false;
};

// ============================================
// BUSCAR ANIME EN MYANIMELIST
// ============================================
const searchAnime = async (query) => {
  return queueRequest(async () => {
    try {
      const response = await fetch(`${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=10`);
      
      if (!response.ok) {
        throw new Error('Error al buscar anime');
      }
      
      const data = await response.json();
      
      return data.data.map(anime => ({
        malId: anime.mal_id,
        title: anime.title,
        titleEnglish: anime.title_english,
        titleJapanese: anime.title_japanese,
        image: anime.images.jpg.large_image_url,
        year: anime.year,
        episodes: anime.episodes,
        score: anime.score,
        synopsis: anime.synopsis
      }));
    } catch (error) {
      console.error('❌ Error en búsqueda de anime:', error);
      throw error;
    }
  });
};

// ============================================
// ✅ OBTENER PERSONAJES DE UN ANIME (SIN LÍMITE)
// ============================================
const getAnimeCharacters = async (malId) => {
  return queueRequest(async () => {
    try {
      console.log(`📡 Solicitando personajes para MAL ID: ${malId}`);
      
      const response = await fetch(`${JIKAN_BASE_URL}/anime/${malId}/characters`);
      
      if (!response.ok) {
        throw new Error('Error al obtener personajes');
      }
      
      const data = await response.json();
      
      console.log(`📊 Total de personajes recibidos: ${data.data.length}`);
      
      // ✅ IMPORTANTE: NO HAY LÍMITE - Se procesan TODOS los personajes
      return data.data
        .filter(char => char.role === 'Main' || char.role === 'Supporting')
        // ❌ LÍNEA ELIMINADA: .slice(0, 20)
        .map(char => ({
          malId: char.character.mal_id,
          name: char.character.name,
          image: char.character.images.jpg.image_url,
          role: char.role,
          favorites: char.favorites || 0
        }))
        .sort((a, b) => {
          // Ordenar: Main primero, luego por favoritos
          if (a.role === 'Main' && b.role !== 'Main') return -1;
          if (a.role !== 'Main' && b.role === 'Main') return 1;
          return b.favorites - a.favorites;
        });
    } catch (error) {
      console.error('❌ Error al obtener personajes:', error);
      throw error;
    }
  });
};

// ============================================
// OBTENER DETALLES DE UN ANIME
// ============================================
const getAnimeDetails = async (malId) => {
  return queueRequest(async () => {
    try {
      const response = await fetch(`${JIKAN_BASE_URL}/anime/${malId}`);
      
      if (!response.ok) {
        throw new Error('Error al obtener detalles del anime');
      }
      
      const data = await response.json();
      const anime = data.data;
      
      return {
        malId: anime.mal_id,
        title: anime.title,
        titleEnglish: anime.title_english,
        titleJapanese: anime.title_japanese,
        image: anime.images.jpg.large_image_url,
        trailer: anime.trailer?.embed_url || null,
        year: anime.year,
        season: anime.season,
        episodes: anime.episodes,
        score: anime.score,
        synopsis: anime.synopsis,
        genres: anime.genres.map(g => g.name),
        studios: anime.studios.map(s => s.name)
      };
    } catch (error) {
      console.error('❌ Error al obtener detalles:', error);
      throw error;
    }
  });
};

// ============================================
// BUSCAR PERSONAJE ESPECÍFICO
// ============================================
const searchCharacter = async (query) => {
  return queueRequest(async () => {
    try {
      const response = await fetch(`${JIKAN_BASE_URL}/characters?q=${encodeURIComponent(query)}&limit=10`);
      
      if (!response.ok) {
        throw new Error('Error al buscar personaje');
      }
      
      const data = await response.json();
      
      return data.data.map(char => ({
        malId: char.mal_id,
        name: char.name,
        image: char.images.jpg.image_url,
        favorites: char.favorites,
        about: char.about
      }));
    } catch (error) {
      console.error('❌ Error en búsqueda de personaje:', error);
      throw error;
    }
  });
};

// ============================================
// EXPORTAR SERVICIOS
// ============================================
window.jikanService = {
  searchAnime,
  getAnimeCharacters,
  getAnimeDetails,
  searchCharacter
};

console.log('🔗 Jikan API Service cargado');
console.log('📚 Conectado a MyAnimeList');
console.log('✅ Sin límite de personajes');