/* ============================================
   ANILIST API SERVICE
   Archivo: js/anilist-service.js
   Autor: Jaykai2
   Versión: 1.0

   ¿Por qué AniList además de Jikan/MAL?
   ──────────────────────────────────────
   AniList tiene datos más actualizados para:
   • Broadcast: `nextAiringEpisode.airingAt` es un
     Unix timestamp UTC exacto → sin conversiones de
     timezone, sin ambigüedad de día/hora.
   • Score (usa sistema de 100 puntos, más granular)
   • Estado de emisión (actualizado más rápido)

   Jikan/MAL se sigue usando para:
   • Personajes (AniList no tiene imágenes propias)
   • Búsqueda al vincular (tiene malId nativo)

   ENDPOINTS:
   • API GraphQL: https://graphql.anilist.co
   • Sin API key requerida para consultas públicas
   • Rate limit: 90 req/min (muy generoso)
   • CORS: abierto para browser requests

   CAMPO CLAVE: nextAiringEpisode
   ────────────────────────────────
   AniList devuelve el próximo episodio como:
     nextAiringEpisode: {
       airingAt: 1709481600,  ← Unix timestamp UTC exacto
       episode:  14
     }

   Esto elimina completamente el problema de
   "¿qué día es en el timezone del usuario?" —
   simplemente hacemos new Date(airingAt * 1000).
   ============================================ */

const ANILIST_URL = 'https://graphql.anilist.co';

// -----------------------------------------------
// HELPER: fetch GraphQL
// -----------------------------------------------

/**
 * Ejecuta una query GraphQL contra la API de AniList.
 * Sin API key — las consultas públicas no la requieren.
 *
 * @param {string} query     - Query GraphQL
 * @param {object} variables - Variables de la query
 * @returns {Promise<object>} - data del response
 */
const anilistFetch = async (query, variables = {}) => {
  const response = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`AniList HTTP ${response.status}`);
  }

  const json = await response.json();

  if (json.errors?.length) {
    // AniList devuelve errores en el body con status 200
    const msg = json.errors.map(e => e.message).join(', ');
    throw new Error(`AniList GraphQL error: ${msg}`);
  }

  return json.data;
};

// -----------------------------------------------
// HELPER: sanitizar texto de la API
// -----------------------------------------------

/**
 * Sanitiza texto para prevenir XSS al insertar
 * contenido de la API en el DOM.
 * @param {string} str
 * @returns {string}
 */
const _aniSanitize = (str) => {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
};

// -----------------------------------------------
// QUERY: Buscar anime por nombre (para vincular)
// -----------------------------------------------

/**
 * Busca animes por nombre en AniList.
 * Devuelve resultados con idMal para poder vincular
 * con el sistema existente que usa MAL IDs.
 *
 * @param {string} query - Nombre del anime
 * @returns {Promise<Array>} - Lista de resultados normalizados
 */
const searchAnimeAniList = async (query) => {
  const GQL = `
    query ($search: String) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          status
          episodes
          season
          seasonYear
          averageScore
          coverImage { large }
          nextAiringEpisode {
            airingAt
            episode
          }
          airingSchedule(notYetAired: true, perPage: 1) {
            nodes {
              airingAt
              episode
            }
          }
        }
      }
    }
  `;

  const data = await anilistFetch(GQL, { search: query });

  return (data.Page.media ?? []).map(media => ({
    anilistId:    media.id,
    malId:        media.idMal,             // Para compatibilidad con sistema existente
    title:        _aniSanitize(media.title.romaji),
    titleEnglish: _aniSanitize(media.title.english ?? ''),
    titleNative:  _aniSanitize(media.title.native  ?? ''),
    image:        media.coverImage?.large  ?? '',
    status:       _normalizeAniListStatus(media.status),
    episodes:     media.episodes           ?? null,
    year:         media.seasonYear         ?? null,
    season:       media.season             ?? null,
    score:        media.averageScore       != null ? (media.averageScore / 10).toFixed(1) : null,
    nextAiring:   _extractNextAiring(media)
  }));
};

// -----------------------------------------------
// QUERY: Detalles completos + broadcast exacto
// -----------------------------------------------

/**
 * Obtiene todos los metadatos de un anime desde AniList,
 * incluyendo el timestamp exacto del próximo episodio.
 *
 * Acepta tanto anilistId como malId para búsqueda.
 *
 * @param {object} ids - { anilistId?, malId? } — al menos uno requerido
 * @returns {Promise<object>} - Datos normalizados del anime
 */
const getAnimeDetailsAniList = async ({ anilistId, malId }) => {
  if (!anilistId && !malId) {
    throw new Error('Se requiere anilistId o malId');
  }

  const GQL = `
    query ($id: Int, $idMal: Int) {
      Media(id: $id, idMal: $idMal, type: ANIME) {
        id
        idMal
        title {
          romaji
          english
          native
        }
        status
        episodes
        season
        seasonYear
        averageScore
        meanScore
        popularity
        description(asHtml: false)
        genres
        studios(isMain: true) {
          nodes { name }
        }
        coverImage { extraLarge large }
        bannerImage
        trailer { id site }
        startDate { year month day }
        endDate   { year month day }

        # ✅ CLAVE: próximo episodio con timestamp UTC exacto
        nextAiringEpisode {
          airingAt   # Unix timestamp — new Date(airingAt * 1000) da la hora exacta
          timeUntilAiring
          episode
        }

        # Próximos 5 episodios para vista completa
        airingSchedule(notYetAired: true, perPage: 5) {
          nodes {
            airingAt
            episode
          }
        }

        # Horario de broadcast (día de la semana en JST — como MAL)
        # AniList lo llama "externalLinks" — no tiene campo broadcast directo,
        # pero nextAiringEpisode.airingAt es suficiente y más preciso.
      }
    }
  `;

  const variables = {};
  if (anilistId) variables.id    = anilistId;
  if (malId)     variables.idMal = malId;

  const data = await anilistFetch(GQL, variables);
  const media = data.Media;

  if (!media) throw new Error('Anime no encontrado en AniList');

  // Solo extraer nextAiring si el anime está ACTUALMENTE EN EMISIÓN.
  // Un anime FINISHED nunca debe tener broadcast ni nextAiring,
  // aunque airingSchedule tenga datos históricos en AniList.
  const isReleasing = media.status === 'RELEASING' || media.status === 'HIATUS';

  const nextAiring = isReleasing ? _extractNextAiring(media) : null;

  // Inferir broadcast SOLO si está en emisión y tiene próximo episodio real
  const broadcast = (isReleasing && nextAiring)
    ? _inferBroadcastFromTimestamp(nextAiring.airingAt)
    : null;

  // Fecha de inicio
  const startDate = _buildDateFromParts(media.startDate);
  const endDate   = _buildDateFromParts(media.endDate);

  return {
    anilistId:   media.id,
    malId:       media.idMal,
    title:       _aniSanitize(media.title.romaji),
    titleEnglish: _aniSanitize(media.title.english ?? ''),
    image:       media.coverImage?.extraLarge ?? media.coverImage?.large ?? '',
    banner:      media.bannerImage ?? null,
    status:      _normalizeAniListStatus(media.status),
    episodes:    media.episodes  ?? null,
    score:       media.averageScore != null ? (media.averageScore / 10).toFixed(1) : null,
    genres:      (media.genres ?? []).map(_aniSanitize),
    studios:     (media.studios?.nodes ?? []).map(s => _aniSanitize(s.name)),
    synopsis:    _aniSanitize((media.description ?? '').replace(/<[^>]+>/g, '')), // strip HTML
    airedFrom:   startDate,
    airedTo:     endDate,

    // ✅ Broadcast inferido del timestamp exacto
    broadcast,

    // ✅ Próximo episodio con timestamp Unix exacto
    nextAiring,

    // Lista de próximos episodios
    upcomingEpisodes: (media.airingSchedule?.nodes ?? []).map(ep => ({
      episode:  ep.episode,
      airingAt: ep.airingAt
    }))
  };
};

// -----------------------------------------------
// QUERY: Obtener AniList ID desde MAL ID
// Útil para enriquecer un anime que ya tiene malId
// -----------------------------------------------

/**
 * Busca el ID de AniList dado un MAL ID.
 * @param {number} malId
 * @returns {Promise<number|null>} - anilistId o null
 */
const getAniListIdFromMal = async (malId) => {
  const GQL = `
    query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        id
        idMal
        nextAiringEpisode { airingAt episode }
      }
    }
  `;
  try {
    const data = await anilistFetch(GQL, { idMal: malId });
    return data.Media?.id ?? null;
  } catch (_) {
    return null;
  }
};

// -----------------------------------------------
// HELPERS INTERNOS
// -----------------------------------------------

/**
 * Normaliza el estado de AniList al formato interno del hub.
 * AniList usa: FINISHED, RELEASING, NOT_YET_RELEASED, CANCELLED
 * @param {string} status
 * @returns {'airing'|'finished'|'upcoming'|'cancelled'}
 */
const _normalizeAniListStatus = (status) => {
  const MAP = {
    RELEASING:        'airing',
    FINISHED:         'finished',
    NOT_YET_RELEASED: 'upcoming',
    CANCELLED:        'finished',
    HIATUS:           'airing'
  };
  return MAP[status] ?? 'finished';
};

/**
 * Extrae el próximo episodio del objeto Media de AniList.
 * Prioriza nextAiringEpisode, fallback a airingSchedule.
 *
 * @param {object} media - Respuesta Media de AniList
 * @returns {{ airingAt: number, episode: number } | null}
 */
const _extractNextAiring = (media) => {
  if (media.nextAiringEpisode?.airingAt) {
    return {
      airingAt: media.nextAiringEpisode.airingAt,
      episode:  media.nextAiringEpisode.episode
    };
  }
  const firstScheduled = media.airingSchedule?.nodes?.[0];
  if (firstScheduled?.airingAt) {
    return {
      airingAt: firstScheduled.airingAt,
      episode:  firstScheduled.episode
    };
  }
  return null;
};

/**
 * Infiere el broadcast (día + hora en JST) a partir de
 * un Unix timestamp exacto del próximo episodio.
 *
 * Esto genera un objeto compatible con el campo `broadcast`
 * existente en Firebase: { day, time, timezone }
 *
 * El resultado es MÁS PRECISO que el de MAL porque se basa
 * en el timestamp real del próximo episodio, no en una
 * cadena de texto que puede estar desactualizada.
 *
 * @param {number} airingAt - Unix timestamp UTC
 * @returns {{ day: string, time: string, timezone: string }}
 */
const _inferBroadcastFromTimestamp = (airingAt) => {
  const DAYS_JST = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

  const date = new Date(airingAt * 1000); // Unix → Date

  // Extraer día y hora en JST (UTC+9)
  const jstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const dayName = DAYS_JST[jstDate.getDay()];
  const hours   = String(jstDate.getHours()).padStart(2, '0');
  const minutes = String(jstDate.getMinutes()).padStart(2, '0');

  return {
    day:      dayName,         // e.g. "Tuesdays"
    time:     `${hours}:${minutes}`,  // e.g. "23:30"
    timezone: 'Asia/Tokyo',
    // ✅ Guardar el timestamp exacto para uso futuro
    airingAt: airingAt
  };
};

/**
 * Construye una fecha ISO desde el objeto { year, month, day }
 * que devuelve AniList.
 * @param {{ year, month, day }} parts
 * @returns {string|null} - ISO date string o null
 */
const _buildDateFromParts = (parts) => {
  if (!parts?.year) return null;
  const month = String(parts.month ?? 1).padStart(2, '0');
  const day   = String(parts.day   ?? 1).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
};

// ============================================
// EXPORTAR
// ============================================
window.anilistService = {
  searchAnime:      searchAnimeAniList,
  getAnimeDetails:  getAnimeDetailsAniList,
  getAniListIdFromMal
};

console.log('🎌 AniList Service v1.0 cargado');
console.log('✅ GraphQL API — Sin API key — Timestamps exactos');