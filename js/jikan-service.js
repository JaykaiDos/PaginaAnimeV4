/* ============================================
   JIKAN API SERVICE - MyAnimeList Integration
   Autor: Jaykai2
   ✅ v2.0: Añadido soporte para broadcast, schedule
            y enriquecimiento completo de detalles.
   ============================================ */

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

/**
 * Delay mínimo entre requests para respetar el
 * rate-limit de Jikan (3 req/seg, 60 req/min).
 * Usamos 400ms para margen de seguridad.
 */
const RATE_LIMIT_DELAY = 400;

// -----------------------------------------------
// QUEUE: Serializa las requests para no superar
//        el rate-limit de la API.
// -----------------------------------------------
let requestQueue = [];
let isProcessingQueue = false;

/** Crea una promesa que resuelve después de `ms` ms */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Encola una función asíncrona y la ejecuta con
 * el delay reglamentario entre cada llamada.
 * @param {Function} requestFn - Función async a ejecutar
 * @returns {Promise<any>}
 */
const queueRequest = (requestFn) => {
  return new Promise((resolve, reject) => {
    requestQueue.push({ requestFn, resolve, reject });
    processQueue();
  });
};

/** Drena la cola de requests de forma secuencial */
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

    if (requestQueue.length > 0) {
      await delay(RATE_LIMIT_DELAY);
    }
  }

  isProcessingQueue = false;
};

// -----------------------------------------------
// HELPERS INTERNOS
// -----------------------------------------------

/**
 * Sanitiza texto plano para prevenir inyecciones XSS
 * antes de insertar contenido de la API en el DOM.
 * @param {string} str
 * @returns {string}
 */
const sanitizeText = (str) => {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return str.replace(/[&<>"']/g, (char) => map[char]);
};

/**
 * Fetch genérico con manejo de errores HTTP.
 * @param {string} url
 * @returns {Promise<object>} - JSON parseado
 */
const apiFetch = async (url) => {
  const response = await fetch(url);

  if (response.status === 429) {
    // Rate-limit hit: esperar 2 segundos y reintentar una vez
    console.warn('⚠️ Rate limit alcanzado. Reintentando en 2s...');
    await delay(2000);
    const retry = await fetch(url);
    if (!retry.ok) throw new Error(`HTTP ${retry.status} en ${url}`);
    return retry.json();
  }

  if (!response.ok) throw new Error(`HTTP ${response.status} en ${url}`);
  return response.json();
};

// ============================================
// BUSCAR ANIME EN MYANIMELIST
// ============================================

/**
 * Busca animes por nombre en MyAnimeList.
 * @param {string} query - Nombre del anime
 * @returns {Promise<Array>} - Lista de resultados simplificados
 */
const searchAnime = (query) => {
  return queueRequest(async () => {
    const data = await apiFetch(
      `${JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=10`
    );

    return data.data.map(anime => ({
      malId:         anime.mal_id,
      title:         anime.title,
      titleEnglish:  anime.title_english,
      titleJapanese: anime.title_japanese,
      image:         anime.images?.jpg?.large_image_url ?? '',
      year:          anime.year,
      episodes:      anime.episodes,
      score:         anime.score,
      synopsis:      anime.synopsis
    }));
  });
};

// ============================================
// ✅ OBTENER DETALLES COMPLETOS DE UN ANIME
//    Incluye: géneros, estado, broadcast, score
// ============================================

/**
 * Obtiene todos los metadatos de un anime desde Jikan.
 *
 * Campos nuevos respecto a v1:
 *  - `genres`        → Array de géneros (string[])
 *  - `status`        → 'airing' | 'finished' | 'upcoming'
 *  - `apiEpisodes`   → Total de episodios según MAL (distinto a los subidos)
 *  - `broadcast`     → Objeto con día, hora y timezone de emisión
 *  - `nextEpisode`   → Fecha/hora del próximo capítulo si está en emisión
 *  - `airedFrom`     → Fecha de inicio de emisión
 *  - `airedTo`       → Fecha de fin de emisión
 *
 * @param {number} malId - ID de MyAnimeList
 * @returns {Promise<object>} - Detalles completos del anime
 */
const getAnimeDetails = (malId) => {
  return queueRequest(async () => {
    const data = await apiFetch(`${JIKAN_BASE_URL}/anime/${malId}`);
    const anime = data.data;

    // -----------------------------------------------
    // Normalizar estado hacia valores internos del hub
    // -----------------------------------------------
    const STATUS_MAP = {
      'Currently Airing': 'airing',
      'Finished Airing':  'finished',
      'Not yet aired':    'upcoming'
    };
    const normalizedStatus = STATUS_MAP[anime.status] ?? 'finished';

    // -----------------------------------------------
    // Broadcast: Jikan devuelve algo como:
    //   { day: "Saturdays", time: "23:00", timezone: "Asia/Tokyo" }
    // -----------------------------------------------
    const broadcast = anime.broadcast
      ? {
          day:      anime.broadcast.day      ?? null,  // "Saturdays"
          time:     anime.broadcast.time     ?? null,  // "23:00"
          timezone: anime.broadcast.timezone ?? 'Asia/Tokyo',
          string:   anime.broadcast.string   ?? null   // "Saturdays at 23:00 (JST)"
        }
      : null;

    return {
      malId:          anime.mal_id,
      title:          anime.title,
      titleEnglish:   anime.title_english  ?? null,
      titleJapanese:  anime.title_japanese ?? null,
      image:          anime.images?.jpg?.large_image_url ?? '',
      trailer:        anime.trailer?.embed_url ?? null,
      year:           anime.year    ?? null,
      season:         anime.season  ?? null,         // "winter", "spring", etc.

      // ✅ ESTADO NORMALIZADO
      status:         normalizedStatus,
      statusRaw:      anime.status,                  // Texto original de MAL

      // ✅ GÉNEROS (array de strings, sanitizados)
      genres:         (anime.genres  ?? []).map(g => sanitizeText(g.name)),
      themes:         (anime.themes  ?? []).map(t => sanitizeText(t.name)),
      demographics:   (anime.demographics ?? []).map(d => sanitizeText(d.name)),

      studios:        (anime.studios ?? []).map(s => sanitizeText(s.name)),

      // ✅ EPISODIOS DE LA API (distinto a "episodios subidos")
      apiEpisodes:    anime.episodes ?? null,

      score:          anime.score    ?? null,
      synopsis:       anime.synopsis ?? '',

      // ✅ BROADCAST (día y hora de emisión)
      broadcast,

      // Fechas de emisión
      airedFrom:  anime.aired?.from ?? null,
      airedTo:    anime.aired?.to   ?? null
    };
  });
};

// ============================================
// ✅ OBTENER PROGRAMACIÓN DE LA TEMPORADA ACTUAL
//    Usado por el carrusel "Estrenos de Hoy"
// ============================================

/**
 * Obtiene los animes en emisión de la temporada actual
 * con su horario de broadcast.
 *
 * Jikan ofrece `/schedules?day=<dayName>` para filtrar
 * por día. Usamos esto para la sección de estrenos de hoy.
 *
 * @param {string} [dayName] - Nombre del día en inglés (e.g. "monday").
 *                             Si se omite, devuelve todos los días.
 * @returns {Promise<Array>} - Lista de animes programados para ese día
 */
const getScheduleByDay = (dayName) => {
  return queueRequest(async () => {
    const dayParam = dayName ? `?filter=${encodeURIComponent(dayName.toLowerCase())}` : '';
    const data = await apiFetch(`${JIKAN_BASE_URL}/schedules${dayParam}&sfw=true`);

    return (data.data ?? []).map(anime => ({
      malId:       anime.mal_id,
      title:       sanitizeText(anime.title),
      image:       anime.images?.jpg?.image_url ?? '',
      score:       anime.score ?? null,
      episodes:    anime.episodes ?? null,
      broadcast:   anime.broadcast
        ? {
            day:      anime.broadcast.day      ?? null,
            time:     anime.broadcast.time     ?? null,
            timezone: anime.broadcast.timezone ?? 'Asia/Tokyo'
          }
        : null,
      genres:      (anime.genres ?? []).map(g => sanitizeText(g.name)),
      synopsis:    sanitizeText((anime.synopsis ?? '').slice(0, 200)) + '…',
      url:         anime.url ?? null
    }));
  });
};

// ============================================
// ✅ OBTENER PERSONAJES (SIN LÍMITE)
// ============================================

/**
 * Obtiene todos los personajes (principales y secundarios)
 * de un anime dado su MAL ID.
 * @param {number} malId
 * @returns {Promise<Array>}
 */
const getAnimeCharacters = (malId) => {
  return queueRequest(async () => {
    const data = await apiFetch(`${JIKAN_BASE_URL}/anime/${malId}/characters`);

    return data.data
      .filter(char => char.role === 'Main' || char.role === 'Supporting')
      .map(char => ({
        malId:     char.character.mal_id,
        name:      sanitizeText(char.character.name),
        image:     char.character.images?.jpg?.image_url ?? '',
        role:      char.role,
        favorites: char.favorites ?? 0
      }))
      .sort((a, b) => {
        if (a.role === 'Main' && b.role !== 'Main') return -1;
        if (a.role !== 'Main' && b.role === 'Main') return 1;
        return b.favorites - a.favorites;
      });
  });
};

// ============================================
// BUSCAR PERSONAJE ESPECÍFICO
// ============================================

/**
 * Busca personajes por nombre en MyAnimeList.
 * @param {string} query
 * @returns {Promise<Array>}
 */
const searchCharacter = (query) => {
  return queueRequest(async () => {
    const data = await apiFetch(
      `${JIKAN_BASE_URL}/characters?q=${encodeURIComponent(query)}&limit=10`
    );

    return data.data.map(char => ({
      malId:     char.mal_id,
      name:      sanitizeText(char.name),
      image:     char.images?.jpg?.image_url ?? '',
      favorites: char.favorites,
      about:     char.about ?? ''
    }));
  });
};

// ============================================
// EXPORTAR SERVICIOS
// ============================================
window.jikanService = {
  searchAnime,
  getAnimeDetails,
  getAnimeCharacters,
  getScheduleByDay,   // ✅ NUEVO
  searchCharacter
};

console.log('🔗 Jikan API Service v2.0 cargado');
console.log('📚 Conectado a MyAnimeList via Jikan v4');
console.log('✅ Soporte para géneros, broadcast y schedule');