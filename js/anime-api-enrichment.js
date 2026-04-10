/* ============================================
   ANIME API ENRICHMENT SERVICE
   Archivo: js/anime-api-enrichment.js
   Autor: Jaykai2
   Versión: 2.0

   CAMBIOS v2:
   - Géneros traducidos al español
   - syncStatusBadge() actualiza el badge principal
   - syncEpisodesBadge() no se llama aquí (lo hace
     anime-details.js tras cargar episodios reales)

   DATOS QUE AGREGA EN anime-details:
   ───────────────────────────────────
   1. Estado actualizado desde MAL: "En Emisión" / "Finalizado"
   2. Géneros traducidos al español
   3. Total de capítulos según MAL (≠ episodios subidos al hub)
   4. Próximo capítulo: fecha estimada (solo si está en emisión)
   5. Score de MyAnimeList
   6. Estudio de animación
   7. Fechas de emisión
   ============================================ */

// ============================================
// MAPA DE GÉNEROS (MAL → Español)
// ============================================

/**
 * Traduce los géneros de MyAnimeList al español.
 * Los géneros que no estén en el mapa se muestran
 * tal como vienen de la API (en inglés).
 */
const GENRES_ES = {
  'Action':           'Acción',
  'Adventure':        'Aventura',
  'Avant Garde':      'Vanguardia',
  'Award Winning':    'Premiado',
  'Boys Love':        'Boys Love',
  'Comedy':           'Comedia',
  'Drama':            'Drama',
  'Fantasy':          'Fantasía',
  'Girls Love':       'Girls Love',
  'Gourmet':          'Gastronomía',
  'Horror':           'Horror',
  'Mystery':          'Misterio',
  'Romance':          'Romance',
  'Sci-Fi':           'Ciencia Ficción',
  'Slice of Life':    'Vida Cotidiana',
  'Sports':           'Deportes',
  'Supernatural':     'Sobrenatural',
  'Suspense':         'Suspenso',
  'Ecchi':            'Ecchi',
  'Erotica':          'Erótica',
  'Hentai':           'Hentai',
  'Mecha':            'Mecha',
  'Music':            'Música',
  'Psychological':    'Psicológico',
  'Isekai':           'Isekai',
  'Military':         'Militar',
  'Historical':       'Histórico',
  'School':           'Escolar',
  'Shounen':          'Shounen',
  'Shoujo':           'Shoujo',
  'Seinen':           'Seinen',
  'Josei':            'Josei',
  'Kids':             'Infantil',
  'Parody':           'Parodia',
  'Racing':           'Carreras',
  'Samurai':          'Samurai',
  'Space':            'Espacial',
  'Vampire':          'Vampiros',
  'Martial Arts':     'Artes Marciales',
  'Super Power':      'Superpoderes',
  'Magic':            'Magia',
  'Demons':           'Demonios',
  'Game':             'Juegos',
  'Harem':            'Harem',
  'Time Travel':      'Viaje en el Tiempo',
  'Reincarnation':    'Reencarnación',
  'Survival':         'Supervivencia',
  'Mythology':        'Mitología',
  'Anthropomorphic':  'Antropomórfico',
  'CGDCT':            'CGDCT',
  'Childcare':        'Cuidado Infantil',
  'Crossdressing':    'Crossdressing',
  'Delinquents':      'Delincuentes',
  'Detective':        'Detective',
  'Educational':      'Educativo',
  'High Stakes Game': 'Juego de Alto Riesgo',
  'Idols (Female)':   'Idols (Femenino)',
  'Idols (Male)':     'Idols (Masculino)',
  'Love Polygon':     'Polígono Amoroso',
  'Mahou Shoujo':     'Mahou Shoujo',
  'Medical':          'Médico',
  'Organized Crime':  'Crimen Organizado',
  'Otaku Culture':    'Cultura Otaku',
  'Performing Arts':  'Artes Escénicas',
  'Pets':             'Mascotas',
  'Reverse Harem':    'Harem Inverso',
  'Romantic Subtext': 'Subtexto Romántico',
  'Showbiz':          'Entretenimiento',
  'Strategy Game':    'Juego de Estrategia',
  'Team Sports':      'Deportes en Equipo',
  'Video Game':       'Videojuego',
  'Visual Arts':      'Artes Visuales',
  'Workplace':        'Ambiente Laboral',
};

/**
 * Traduce un género al español. Si no hay traducción,
 * devuelve el original.
 * @param {string} genre
 * @returns {string}
 */
const translateGenre = (genre) => GENRES_ES[genre] || genre;

// ============================================
// HELPERS
// ============================================

/**
 * Sanitiza un string para inserción segura en innerHTML.
 * @param {string} str
 * @returns {string}
 */
const _sanitize = (str) => {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
};

/**
 * Formatea una fecha ISO a texto legible en español.
 * @param {string|null} isoDate
 * @returns {string}
 */
const _formatDate = (isoDate) => {
  if (!isoDate) return 'N/A';
  try {
    return new Date(isoDate).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch (_) { return 'N/A'; }
};

/**
 * ⚠️ FALLBACK: Convierte el horario de broadcast (Jikan/MAL)
 * a la hora local del usuario.
 *
 * NOTA: Esta función solo se llama si AniList NO proporciona
 * nextAiringEpisode.airingAt (timestamp UTC exacto).
 *
 * ❌ NO USAR ESTA FUNCIÓN PARA NUEVAS FEATURES
 * Use _getNextEpisodeFromTimestamp() con Unix timestamp en su lugar.
 *
 * @deprecated - Solo fallback para Jikan cuando AniList falla
 * @param {object|null} broadcast - { day, time, timezone }
 * @returns {string|null}
 */
const _getNextEpisodeInfo = (broadcast) => {
  if (!broadcast || !broadcast.day || !broadcast.time) return null;

  try {
    const DAYS_MAP = {
      Mondays: 1, Tuesdays: 2, Wednesdays: 3,
      Thursdays: 4, Fridays: 5, Saturdays: 6, Sundays: 0
    };

    const sourceTimezone = broadcast.timezone ?? 'Asia/Tokyo';
    const targetDay      = DAYS_MAP[broadcast.day];

    // Si el día no está en el mapa, mostrar sin conversión como fallback
    if (targetDay === undefined) {
      return `${broadcast.day} a las ${broadcast.time} (${sourceTimezone})`;
    }

    const [hours, minutes] = broadcast.time.split(':').map(Number);
    const now = new Date();

    // Hora actual en el timezone de origen (JST) para calcular días restantes
    const nowInSourceTZ = new Date(
      now.toLocaleString('en-US', { timeZone: sourceTimezone })
    );
    const currDayInSourceTZ = nowInSourceTZ.getDay();

    let daysUntil = targetDay - currDayInSourceTZ;
    if (
      daysUntil < 0 ||
      (daysUntil === 0 && (
        nowInSourceTZ.getHours() > hours ||
        (nowInSourceTZ.getHours() === hours && nowInSourceTZ.getMinutes() >= minutes)
      ))
    ) {
      daysUntil += 7;
    }

    // ── Construir el Date exacto del próximo episodio en el TZ origen ──
    // Usamos Intl.DateTimeFormat para obtener la diferencia de offset entre
    // el timezone de origen y UTC, y así crear un Date UTC correcto.
    const broadcastDateInSourceTZ = new Date(now);
    broadcastDateInSourceTZ.setDate(now.getDate() + daysUntil);

    // Formatear la fecha en el TZ fuente para extraer año/mes/día
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: sourceTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(broadcastDateInSourceTZ);

    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    // Crear un Date UTC representando ese momento en el TZ origen
    // e.g. "2025-03-03T23:00:00" en Asia/Tokyo → convertido a UTC
    const isoInSourceTZ = `${p.year}-${p.month}-${p.day}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00`;

    // Calcular el offset del timezone origen en ese instante
    const refDate        = new Date(isoInSourceTZ + 'Z'); // tratamos como UTC primero
    const sourceOffset   = getTimezoneOffset(sourceTimezone, refDate); // minutos
    const broadcastUTC   = new Date(refDate.getTime() - sourceOffset * 60000);

    // ── broadcastUTC es ahora el instante correcto en UTC ──
    // JS lo convierte al timezone LOCAL del navegador automáticamente

    const localDateStr = broadcastUTC.toLocaleDateString('es-ES', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    const localTimeStr = broadcastUTC.toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit'
    });

    // Nombre corto del timezone local del usuario (e.g. "GMT-3", "CET")
    const localTZName = new Intl.DateTimeFormat('es-ES', { timeZoneName: 'short' })
      .formatToParts(broadcastUTC)
      .find(p => p.type === 'timeZoneName')?.value ?? '';

    return `${localDateStr} — ${localTimeStr} (${localTZName})`;

  } catch (_) {
    // Fallback seguro: mostrar la hora original sin conversión
    return `${broadcast.day} a las ${broadcast.time} (${broadcast.timezone ?? 'JST'})`;
  }
};

/**
 * ✅ FUNCIÓN PRINCIPAL PARA MOSTRAR FECHAS DE ESTRENO
 *
 * Convierte el Unix timestamp UTC de AniList a la zona horaria
 * local del navegador del usuario. Es simple, precisa y automática.
 *
 * CÓMO FUNCIONA:
 * 1. AniList proporciona: airingAt = 1709481600 (Unix timestamp UTC)
 * 2. new Date(airingAt * 1000) = Instante exacto en tiempo UTC
 * 3. date.toLocaleTimeString('es-ES') = JS detecta TZ local automáticamente
 * 4. Resultado: "martes, 3 de junio — 23:30 (ART)" en la zona horaria del usuario
 *
 * La misma hora se muestra diferente para cada usuario según su zona horaria,
 * pero representa el mismo instante exacto en el tiempo.
 *
 * @param {{ airingAt: number, episode: number }} nextAiring - { airingAt: Unix timestamp, episode: número }
 * @returns {string} - "día, fecha — hora (TZ)" o null si falla
 */
const _getNextEpisodeFromTimestamp = (nextAiring) => {
  if (!nextAiring?.airingAt) return null;

  try {
    // Unix timestamp (segundos) → milisegundos → Date en UTC
    const date = new Date(nextAiring.airingAt * 1000);

    // JavaScript convierte automáticamente a la zona horaria del navegador
    const localDate = date.toLocaleDateString('es-ES', {
      weekday: 'long', month: 'long', day: 'numeric'
    });

    const localTime = date.toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit'
    });

    // Obtiene nombre corto de la zona horaria local (e.g., "ART", "CET", "JST")
    const tzName = new Intl.DateTimeFormat('es-ES', { timeZoneName: 'short' })
      .formatToParts(date)
      .find(p => p.type === 'timeZoneName')?.value ?? '';

    const epLabel = nextAiring.episode ? ` (Ep. ${nextAiring.episode})` : '';

    return `${localDate} — ${localTime} (${tzName})${epLabel}`;

  } catch (_) {
    return null;
  }
};

/**
 * Calcula el offset en minutos de un timezone dado para
 * un instante determinado (maneja horario de verano correctamente).
 * Positivo = timezone adelantado respecto a UTC.
 * @param {string} timezone - IANA timezone name, e.g. "Asia/Tokyo"
 * @param {Date}   date
 * @returns {number} offset en minutos
 */
const getTimezoneOffset = (timezone, date) => {
  // Obtenemos la hora del timezone fuente y la hora UTC, luego restamos
  const tzDate  = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (tzDate - utcDate) / 60000; // ms → minutos
};

// ============================================
// SINCRONIZACIÓN DE BADGES EXISTENTES
// ============================================

/**
 * Actualiza el badge de estado principal (el que ya existe
 * en el HTML base de renderAnimeDetails) con el estado
 * confirmado por la API de MAL.
 * @param {'airing'|'finished'|'upcoming'} status
 */
const syncStatusBadge = (status) => {
  const badge = document.querySelector('.meta-badge.status');
  if (!badge) return;

  if (status === 'airing') {
    badge.textContent = '🔴 En Emisión';
    badge.style.background = 'rgba(239,68,68,0.2)';
    badge.style.color = '#fca5a5';
  } else if (status === 'finished') {
    badge.textContent = '✅ Finalizado';
    badge.style.background = 'rgba(16,185,129,0.2)';
    badge.style.color = '#6ee7b7';
  } else {
    badge.textContent = '🔜 Próximamente';
    badge.style.background = 'rgba(234,179,8,0.2)';
    badge.style.color = '#fde047';
  }
};

// ============================================
// RENDER DEL BLOQUE DE ENRIQUECIMIENTO
// ============================================

/**
 * Inyecta el bloque "📡 Información desde MyAnimeList"
 * en el DOM de anime-details, después de la sinopsis.
 *
 * @param {object} apiData          - Datos de Jikan
 * @param {number} uploadedEpisodes - Episodios subidos al hub (de Firebase)
 */
const renderApiEnrichment = (apiData, uploadedEpisodes) => {
  // Eliminar bloque anterior para evitar duplicados
  const existing = document.getElementById('apiEnrichmentBlock');
  if (existing) existing.remove();

  const isAiring = apiData.status === 'airing';

  // ✅ Géneros traducidos al español
  const genresBadges = apiData.genres.length > 0
    ? apiData.genres
        .map(g => `<span class="api-genre-badge">${_sanitize(translateGenre(g))}</span>`)
        .join('')
    : '<span class="api-no-data">Sin información</span>';

  // ✅ PRÓXIMO CAPÍTULO: Flujo de obtención de fecha de estreno
  // 
  // Prioridad:
  // 1. 🎯 AniList nextAiringEpisode.airingAt (Unix timestamp UTC — RECOMENDADO)
  //    - Exacto, sin ambigüedad, compatible con todas las zonas horarias
  // 2. 🔄 Fallback a Jikan broadcast si AniList no tiene datos
  //    - Cálculos complejos, solo fallback histórico
  const nextEpInfo = isAiring
    ? (apiData.nextAiringEpisode?.airingAt
        ? _getNextEpisodeFromTimestamp(apiData.nextAiringEpisode)
        : _getNextEpisodeInfo(apiData.broadcast))
    : null;
  const nextEpHtml = (isAiring && nextEpInfo)
    ? `
      <div class="api-info-row">
        <span class="api-label">📅 Próximo capítulo</span>
        <span class="api-value">${_sanitize(nextEpInfo)}</span>
      </div>
    `
    : '';

  const statusClass = isAiring ? 'api-status-airing' : 'api-status-finished';
  const statusText  = isAiring ? '🔴 En Emisión'     : '✅ Finalizado';

  const block = document.createElement('div');
  block.id        = 'apiEnrichmentBlock';
  block.className = 'api-enrichment-block';

  block.innerHTML = `
    <h3 class="api-enrichment-title">
      📡 Información
      <a href="https://myanimelist.net/anime/${apiData.malId}"
         target="_blank"
         rel="noopener noreferrer"
         class="api-mal-link"
         title="Ver en MyAnimeList">↗ MAL</a>
    </h3>

    <div class="api-info-grid">

      <div class="api-info-row">
        <span class="api-label">Estado</span>
        <span class="api-value ${statusClass}">${statusText}</span>
      </div>

      <!--
        🎬 Total capítulos según.
        DISTINTO a "episodios subidos al hub" (que se muestra
        en el badge 📺 del encabezado del anime).
      -->
      <div class="api-info-row">
        <span class="api-label">🎬 Total capítulos</span>
        <span class="api-value">
          ${apiData.apiEpisodes != null ? apiData.apiEpisodes + ' ep' : '? ep'}
          <small class="api-note">(subidos al hub: ${uploadedEpisodes})</small>
        </span>
      </div>

      ${nextEpHtml}

      <div class="api-info-row">
        <span class="api-label">⭐ Score </span>
        <span class="api-value">${apiData.score ? apiData.score + ' / 10' : 'N/A'}</span>
      </div>

      <div class="api-info-row">
        <span class="api-label">🎨 Estudio</span>
        <span class="api-value">${_sanitize(apiData.studios.join(', ') || 'N/A')}</span>
      </div>

      <div class="api-info-row">
        <span class="api-label">📆 Inicio de emisión</span>
        <span class="api-value">${_formatDate(apiData.airedFrom)}</span>
      </div>

      ${!isAiring && apiData.airedTo ? `
      <div class="api-info-row">
        <span class="api-label">🏁 Fin de emisión</span>
        <span class="api-value">${_formatDate(apiData.airedTo)}</span>
      </div>
      ` : ''}

    </div>

    <!-- ✅ Géneros en Español -->
    <div class="api-genres-section">
      <span class="api-label">🏷️ Géneros</span>
      <div class="api-genres-list">
        ${genresBadges}
      </div>
    </div>
  `;

  // Insertar después de la sinopsis (o al final de .anime-info como fallback)
  const synopsisDiv = document.querySelector('.anime-synopsis');
  if (synopsisDiv) {
    synopsisDiv.insertAdjacentElement('afterend', block);
  } else {
    const animeInfo = document.querySelector('.anime-info');
    if (animeInfo) animeInfo.appendChild(block);
  }
};

/** Muestra indicador de carga mientras se espera la API. */
const renderApiLoading = () => {
  const existing = document.getElementById('apiEnrichmentBlock');
  if (existing) existing.remove();

  const block = document.createElement('div');
  block.id        = 'apiEnrichmentBlock';
  block.className = 'api-enrichment-block api-loading-block';
  block.innerHTML = `
    <div class="api-loading-inner">
      <div class="api-spinner"></div>
      <span>Obteniendo datos desde AniList / MyAnimeList…</span>
    </div>
  `;

  const synopsisDiv = document.querySelector('.anime-synopsis');
  if (synopsisDiv) synopsisDiv.insertAdjacentElement('afterend', block);
};

/** Muestra un error discreto sin bloquear la UI. */
const renderApiError = (message) => {
  const existing = document.getElementById('apiEnrichmentBlock');
  if (existing) existing.remove();

  const block = document.createElement('div');
  block.id        = 'apiEnrichmentBlock';
  block.className = 'api-enrichment-block api-error-block';
  block.innerHTML = `
    <span>⚠️ No se pudo obtener información de la API: ${_sanitize(message)}</span>
  `;

  const synopsisDiv = document.querySelector('.anime-synopsis');
  if (synopsisDiv) synopsisDiv.insertAdjacentElement('afterend', block);
};

// ============================================
// PUNTO DE ENTRADA PRINCIPAL
// ============================================

/**
 * Enriquece la página de anime-details con datos de la API.
 * Se llama desde anime-details.js DESPUÉS de renderAnimeDetails().
 *
 * Estrategia de fuentes (prioridad):
 *  1. AniList — más preciso para broadcast y timestamps
 *  2. Jikan/MAL — fallback si AniList falla
 *
 * Normalización de datos de AniList al formato de Jikan:
 * Los datos de AniList se adaptan al mismo schema que usa
 * renderApiEnrichment(), así no se cambia ningún otro archivo.
 *
 * @param {object} anime
 * @param {number} anime.malId      - ID en MyAnimeList
 * @param {number} [anime.anilistId]- ID en AniList (si ya está guardado)
 * @param {string} anime.title      - Título del anime
 * @param {number} anime.episodes   - Episodios subidos al hub
 */
const enrichAnimeDetails = async (anime) => {
  if (!anime || !anime.malId) {
    console.info('ℹ️ Sin MAL ID — saltando enriquecimiento de API.');
    return;
  }

  console.log(`📡 Enriqueciendo "${anime.title}"...`);
  renderApiLoading();

  try {
    let apiData    = null;
    let dataSource = 'Jikan/MAL';

    // ── Paso 1: Intentar AniList (más preciso para horarios) ──
    if (window.anilistService) {
      try {
        const raw = await window.anilistService.getAnimeDetails({
          anilistId: anime.anilistId || null,
          malId:     anime.malId
        });

        // ✅ Normalizar AniList → schema de renderApiEnrichment
        apiData = {
          malId:       raw.malId ?? anime.malId,
          status:      raw.status,
          apiEpisodes: raw.episodes,
          score:       raw.score,      // ya en formato "7.2" (de 10)
          genres:      raw.genres,
          studios:     raw.studios,
          synopsis:    raw.synopsis,
          airedFrom:   raw.airedFrom,
          airedTo:     raw.airedTo,
          broadcast:   raw.broadcast,  // incluye airingAt timestamp exacto

          // Próximo episodio: usamos el timestamp exacto de AniList
          nextAiringEpisode: raw.nextAiring ?? null
        };

        dataSource = 'AniList';
        console.log(`✅ Datos obtenidos desde AniList`);

      } catch (aniErr) {
        console.warn('⚠️ AniList falló, usando Jikan...', aniErr.message);
      }
    }

    // ── Paso 2: Fallback a Jikan si AniList no funcionó ──
    if (!apiData && window.jikanService) {
      const raw = await window.jikanService.getAnimeDetails(anime.malId);
      apiData = {
        malId:             raw.malId,
        status:            raw.status,
        apiEpisodes:       raw.apiEpisodes,
        score:             raw.score,
        genres:            raw.genres,
        studios:           raw.studios,
        synopsis:          raw.synopsis,
        airedFrom:         raw.airedFrom,
        airedTo:           raw.airedTo,
        broadcast:         raw.broadcast,
        nextAiringEpisode: null  // Jikan no tiene timestamp exacto
      };
      dataSource = 'Jikan/MAL';
      console.log('✅ Datos obtenidos desde Jikan (fallback)');
    }

    if (!apiData) throw new Error('No se pudieron obtener datos de ninguna API');

    // ✅ Renderizar bloque con géneros traducidos
    renderApiEnrichment(apiData, anime.episodes ?? 0);

    // ✅ Actualizar badge de estado principal
    syncStatusBadge(apiData.status);

    console.log(`✅ Enriquecimiento completado (${dataSource}):`, {
      status:   apiData.status,
      episodes: apiData.apiEpisodes,
      genres:   apiData.genres?.length
    });

  } catch (error) {
    console.error('❌ Error en enriquecimiento:', error);
    renderApiError(error.message);
  }
};

// ============================================
// EXPORTAR
// ============================================
window.animeApiEnrichment = {
  enrichAnimeDetails,
  translateGenre    // Expuesto por si otro módulo lo necesita
};

console.log('🔗 Anime API Enrichment v3.0 cargado — AniList + Jikan, géneros en español');