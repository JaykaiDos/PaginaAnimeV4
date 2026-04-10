/* ============================================
   ANIME DETAILS - JAVASCRIPT
   Autor: Jaykai2
   Versión: 3.1 — OPTIMIZADO (DRY)

   CAMBIOS v3.1:
   ─────────────────────────────────────────────
   · ELIMINADA _toYouTubeEmbed()   → ahora en utils.js
   · ELIMINADA loadWatchedEpisodes() → ahora en utils.js
   · ELIMINADA saveWatchedEpisodes() → ahora en utils.js
   · Todas las llamadas internas reemplazadas por
     window.AnimeUtils.* (namespace centralizado)

   CORRECCIONES anteriores (v3.0):
   ─────────────────────────────────────────────
   · Fix bug crítico: callApiEnrichment movida antes de su uso
   · Fix: currentAnime ahora se asigna correctamente
   · Fix: badge de episodios se actualiza con conteo real
   · Añadido: syncEpisodesBadge()

   Orden de carga requerido en HTML:
     1. firebase-config.js
     2. firebase-service.js
     3. utils.js            ← NUEVO (obligatorio)
     4. anime-details.js    ← ESTE ARCHIVO
   ============================================ */

'use strict';

/* --------------------------------------------------
   ESTADO DE LA APLICACIÓN
-------------------------------------------------- */
let currentAnime    = null;
let currentEpisodes = [];
let watchedEpisodes = [];
let currentFilter   = 'all';

/* --------------------------------------------------
   REFERENCIAS AL DOM
   Resueltas una sola vez al cargar el script.
-------------------------------------------------- */
const animeDetails    = document.getElementById('animeDetails');
const episodesSection = document.getElementById('episodesSection');
const episodesGrid    = document.getElementById('episodesGrid');
const breadcrumbTitle = document.getElementById('breadcrumbTitle');

/* --------------------------------------------------
   ENRIQUECIMIENTO CON API
   ✅ Declarada ANTES de ser llamada en loadAnime()
   para evitar el bug de hoisting con const/let.
-------------------------------------------------- */

/**
 * Llama al servicio de enriquecimiento si el anime
 * tiene un malId vinculado. Se ejecuta en paralelo
 * a la carga de episodios (no bloquea la UI).
 * @param {object} anime - currentAnime
 */
const callApiEnrichment = (anime) => {
  if (!window.animeApiEnrichment) {
    console.warn('⚠️ animeApiEnrichment no disponible');
    return;
  }
  if (!anime.malId) {
    console.info('ℹ️ Sin MAL ID — saltando enriquecimiento de API');
    return;
  }
  // No bloqueante: el enriquecimiento ocurre en paralelo
  window.animeApiEnrichment.enrichAnimeDetails({
    malId:    anime.malId,
    title:    anime.title,
    episodes: currentEpisodes.length
  });
};

/* --------------------------------------------------
   SINCRONIZAR BADGE DE EPISODIOS SUBIDOS
   Llama esto DESPUÉS de cargar los episodios de Firebase
   para que el contador sea exacto (no depende de totalEpisodes).
-------------------------------------------------- */

/**
 * Actualiza el badge "📺 X ep subidos" con el conteo real
 * de episodios cargados desde Firebase, evitando depender
 * del campo `totalEpisodes` de Firestore.
 */
const syncEpisodesBadge = () => {
  const badge = document.getElementById('episodesBadge');
  if (!badge) return;
  badge.textContent = `📺 ${currentEpisodes.length} ep subidos`;
};

/* --------------------------------------------------
   CARGAR ANIME DESDE FIREBASE
-------------------------------------------------- */

/**
 * Obtiene los datos del anime desde Firestore y construye
 * el objeto `currentAnime` con todos los campos necesarios.
 * @param {string} animeId - ID del documento en Firestore
 * @returns {Promise<object|null>}
 */
const loadAnimeFromFirebase = async (animeId) => {
  animeDetails.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Cargando información del anime...</p>
    </div>
  `;

  try {
    console.log('🔍 Cargando anime con ID:', animeId);

    const anime = await window.firebaseService.getAnimeById(animeId);

    if (!anime) {
      animeDetails.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem;">
          <span style="font-size: 5rem;">😢</span>
          <h2 style="color: #ade8f4; margin: 1rem 0;">Anime no encontrado</h2>
          <p style="color: #48cae480;">El anime que buscas no existe en la base de datos.</p>
          <a href="search.html" class="footer-link" style="margin-top: 2rem;">🔍 Volver a Búsqueda</a>
        </div>
      `;
      return null;
    }

    console.log('✅ Anime cargado desde Firebase:', anime);

    // Obtener datos de la temporada
    const seasons    = await window.firebaseService.getAllSeasons();
    const season     = seasons.find(s => s.id === anime.seasonId);

    // Extraer año y nombre de temporada desde el seasonId (e.g. "fall_2025")
    const seasonParts = anime.seasonId ? anime.seasonId.split('_') : [];
    const seasonYear  = seasonParts.length >= 2 ? seasonParts[seasonParts.length - 1] : null;
    const seasonName  = seasonParts.length >= 1 ? seasonParts[0] : 'fall';

    // ✅ Asignar a currentAnime (previamente era solo retornado sin asignar)
    currentAnime = {
      id:          anime.id,
      title:       anime.title,
      season:      seasonName,
      seasonName:  season ? season.name : 'Temporada',
      year:        anime.year    || seasonYear || null,
      poster:      anime.poster  || '',
      synopsis:    anime.synopsis || '',
      episodes:    anime.totalEpisodes || 0,
      statusRaw:   anime.status || 'finished',
      status:      anime.status === 'airing' ? 'En Emisión' : 'Finalizado',
      trailers:    anime.trailers || [],
      malId:       anime.malId || null
    };

    return currentAnime;

  } catch (error) {
    console.error('❌ Error al cargar anime:', error);
    animeDetails.innerHTML = `
      <div style="text-align: center; padding: 4rem 2rem;">
        <span style="font-size: 5rem;">❌</span>
        <h2 style="color: #ef4444; margin: 1rem 0;">Error al cargar</h2>
        <p style="color: #48cae480;">Hubo un problema al cargar la información del anime.</p>
      </div>
    `;
    return null;
  }
};

/* --------------------------------------------------
   CARGAR EPISODIOS DESDE FIREBASE
-------------------------------------------------- */

/**
 * Obtiene y normaliza los episodios del anime desde Firestore.
 * Popula la variable de estado `currentEpisodes`.
 * @param {string} animeId
 * @returns {Promise<object[]>}
 */
const loadEpisodesFromFirebase = async (animeId) => {
  try {
    console.log('📺 Cargando episodios para anime:', animeId);

    const episodes = await window.firebaseService.getEpisodesByAnime(animeId);

    console.log('✅ Episodios obtenidos de Firebase:', episodes.length);

    if (episodes.length === 0) {
      currentEpisodes = [];
      return [];
    }

    currentEpisodes = episodes
      .map(ep => ({
        number:   ep.episodeNumber,
        title:    ep.title,
        duration: ep.duration,
        videoUrl: ep.videoUrl
      }))
      .sort((a, b) => a.number - b.number);

    console.log(`✅ ${currentEpisodes.length} episodios cargados`);
    return currentEpisodes;

  } catch (error) {
    console.error('❌ Error al cargar episodios:', error);
    currentEpisodes = [];
    return [];
  }
};

/* --------------------------------------------------
   DETECTAR URL DE RETORNO
-------------------------------------------------- */

/**
 * Retorna la URL del botón "Volver" según la página de origen.
 * @returns {string}
 */
const getBackUrl = () => {
  try {
    if (document.referrer && document.referrer.includes('my-list.html')) {
      return 'my-list.html';
    }
  } catch (_) { /* referrer no disponible */ }
  return 'search.html';
};

/**
 * Retorna el label del botón "Volver" según la página de origen.
 * @returns {string}
 */
const getBackLabel = () => {
  try {
    if (document.referrer && document.referrer.includes('my-list.html')) {
      return '← Volver a mi lista';
    }
  } catch (_) { /* sin acceso a referrer */ }
  return '← Volver a Búsqueda';
};

/* --------------------------------------------------
   RENDERIZAR DETALLES DEL ANIME
-------------------------------------------------- */

/**
 * Genera el HTML principal de la sección de detalles.
 * Usa window.AnimeUtils.toYouTubeEmbed() para los trailers
 * en lugar de la función local eliminada.
 * @param {object} anime - currentAnime
 */
const renderAnimeDetails = (anime) => {
  const backUrl   = getBackUrl();
  const backLabel = getBackLabel();

  animeDetails.innerHTML = `
    <div class="details-hero">
      <img
        src="${anime.poster}"
        alt="${anime.title}"
        class="anime-poster"
        onerror="this.src='https://via.placeholder.com/400x550?text=Sin+Imagen'"
      >

      <div class="anime-info">
        <h1 class="anime-title">${anime.title}</h1>

        <div class="anime-meta">
          <span class="meta-badge season">📅 ${anime.seasonName}</span>
          <span class="meta-badge status">
            ${anime.statusRaw === 'airing' ? '🔴' : '✅'} ${anime.status}
          </span>
          <!--
            📺 Muestra los episodios SUBIDOS AL HUB.
            Actualizado en syncEpisodesBadge() con el conteo real de Firebase.
          -->
          <span class="meta-badge episodes" id="episodesBadge">
            📺 ${anime.episodes} ep subidos
          </span>
        </div>

        <div class="anime-synopsis">
          <h3>📖 Sinopsis</h3>
          <p>${anime.synopsis}</p>
        </div>

        <div class="anime-actions">
          <button class="action-btn btn-primary" onclick="playFirstEpisode()">
            ▶️ Ver Primer Episodio
          </button>
          <button class="action-btn btn-secondary" id="favBtn" onclick="toggleFavorite()">
            ⭐ Agregar a Favoritos
          </button>
          <a href="${backUrl}" class="action-btn btn-back">
            ${backLabel}
          </a>
        </div>
      </div>
    </div>

    ${anime.trailers && anime.trailers.length > 0 ? `
    <div class="anime-trailers">
      <h3>🎬 Trailers</h3>
      <div class="trailers-grid">
        ${anime.trailers.map(trailer => `
          <iframe
            src="${window.AnimeUtils.toYouTubeEmbed(trailer)}"
            title="Trailer"
            allowfullscreen
            loading="lazy">
          </iframe>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;

  updateFavoriteButton();
};

/* --------------------------------------------------
   RENDERIZAR LISTA DE EPISODIOS
-------------------------------------------------- */

/**
 * Renderiza el grid de episodios aplicando el filtro activo.
 * @param {'all'|'watched'|'unwatched'} filter
 */
const renderEpisodes = (filter = 'all') => {
  console.log('🎨 Renderizando episodios. Total:', currentEpisodes.length, '| Filtro:', filter);

  if (!currentAnime) {
    episodesGrid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:2rem; color:#48cae480;">
        <p>No se ha cargado el anime</p>
      </div>
    `;
    return;
  }

  if (!currentEpisodes || currentEpisodes.length === 0) {
    episodesGrid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:2rem; color:#48cae480;">
        <p>Este anime aún no tiene episodios disponibles</p>
      </div>
    `;
    return;
  }

  let episodes = currentEpisodes;

  if (filter === 'watched') {
    episodes = episodes.filter(ep => watchedEpisodes.includes(ep.number));
  } else if (filter === 'unwatched') {
    episodes = episodes.filter(ep => !watchedEpisodes.includes(ep.number));
  }

  if (episodes.length === 0) {
    episodesGrid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:2rem; color:#48cae480;">
        <p>No hay episodios en esta categoría</p>
      </div>
    `;
    return;
  }

  episodesGrid.innerHTML = episodes.map(episode => `
    <article
      class="episode-card ${watchedEpisodes.includes(episode.number) ? 'watched' : ''}"
      onclick="playEpisode(${episode.number})"
    >
      <div class="episode-number">EP ${episode.number}</div>
      <h3 class="episode-title">${episode.title}</h3>
      <p class="episode-duration">⏱️ ${episode.duration}</p>
    </article>
  `).join('');
};

/* --------------------------------------------------
   REPRODUCCIÓN
-------------------------------------------------- */

/**
 * Navega a la pantalla de reproducción y marca el episodio como visto.
 * Usa window.AnimeUtils.saveWatchedEpisodes() en lugar de la función local.
 * @param {number} episodeNumber
 */
window.playEpisode = (episodeNumber) => {
  if (!currentAnime) return;

  if (!watchedEpisodes.includes(episodeNumber)) {
    watchedEpisodes.push(episodeNumber);
    // ✅ OPTIMIZADO: usa helper centralizado de utils.js
    window.AnimeUtils.saveWatchedEpisodes(currentAnime.id, watchedEpisodes);
  }

  window.location.href = `watch.html?anime=${currentAnime.id}&episode=${episodeNumber}`;
};

/** Reproduce el primer episodio disponible. */
window.playFirstEpisode = () => {
  if (currentEpisodes.length > 0) {
    playEpisode(currentEpisodes[0].number);
  } else {
    alert('⚠️ Este anime aún no tiene episodios disponibles');
  }
};

/* --------------------------------------------------
   FAVORITOS
-------------------------------------------------- */

/**
 * Agrega o quita el anime actual de la lista de favoritos
 * en localStorage.
 */
window.toggleFavorite = () => {
  if (!currentAnime) return;

  let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
  const favIndex = favorites.findIndex(fav => fav.id === currentAnime.id);

  if (favIndex !== -1) {
    favorites.splice(favIndex, 1);
  } else {
    favorites.push({
      id:          currentAnime.id,
      title:       currentAnime.title,
      poster:      currentAnime.poster      || '',
      season:      currentAnime.season      || '',
      seasonName:  currentAnime.seasonName  || '',
      year:        currentAnime.year        || null,
      watchStatus: 'pending'
    });
  }

  localStorage.setItem('favorites', JSON.stringify(favorites));
  updateFavoriteButton();
};

/**
 * Actualiza el texto y estilo del botón de favoritos
 * según el estado actual en localStorage.
 */
const updateFavoriteButton = () => {
  const favBtn = document.getElementById('favBtn');
  if (!favBtn || !currentAnime) return;

  const favorites  = JSON.parse(localStorage.getItem('favorites')) || [];
  const isFavorite = favorites.some(fav => fav.id === currentAnime.id);

  favBtn.classList.toggle('active', isFavorite);
  favBtn.innerHTML = isFavorite ? '⭐ En Favoritos' : '⭐ Agregar a Favoritos';
};

/* --------------------------------------------------
   FILTROS DE EPISODIOS
   Delegación de eventos: un solo listener para todos
   los botones de filtro (más eficiente que N listeners).
-------------------------------------------------- */
document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('filter-btn')) return;

  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');

  currentFilter = e.target.dataset.filter;
  renderEpisodes(currentFilter);
});

/* --------------------------------------------------
   FLUJO PRINCIPAL DE CARGA
-------------------------------------------------- */

/**
 * Orquesta la carga completa de la página de detalles:
 * 1. Lee el ID del anime desde la URL
 * 2. Carga datos de Firebase
 * 3. Renderiza la UI base
 * 4. Lanza el enriquecimiento de API (no bloqueante)
 * 5. Carga y renderiza los episodios
 * 6. Actualiza el badge de episodios con el conteo real
 */
const loadAnime = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const animeId   = urlParams.get('id');

  console.log('🚀 Iniciando carga. ID:', animeId);

  if (!animeId) {
    animeDetails.innerHTML = `
      <div style="text-align: center; padding: 4rem 2rem;">
        <span style="font-size: 5rem;">😢</span>
        <h2 style="color: #ade8f4; margin: 1rem 0;">Anime no especificado</h2>
        <p style="color: #48cae480;">No se proporcionó un ID de anime.</p>
        <a href="search.html" class="footer-link" style="margin-top: 2rem;">🔍 Volver a Búsqueda</a>
      </div>
    `;
    return;
  }

  // 1. Cargar anime desde Firebase
  const anime = await loadAnimeFromFirebase(animeId);
  if (!anime) {
    console.error('❌ No se pudo cargar el anime');
    return;
  }

  // 2. ✅ OPTIMIZADO: usa helper centralizado de utils.js
  watchedEpisodes = window.AnimeUtils.loadWatchedEpisodes(animeId);
  console.log('📋 Episodios vistos:', watchedEpisodes);

  // 3. Actualizar breadcrumb
  breadcrumbTitle.textContent = anime.title;

  // 4. Renderizar estructura base de la página
  renderAnimeDetails(anime);

  // 5. Lanzar enriquecimiento de API EN PARALELO (no bloquea)
  callApiEnrichment(anime);

  // 6. Mostrar loading de episodios
  episodesSection.style.display = 'block';
  episodesGrid.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>Cargando episodios...</p>
    </div>
  `;

  // 7. Cargar episodios desde Firebase
  await loadEpisodesFromFirebase(animeId);
  console.log('🎬 Episodios cargados:', currentEpisodes.length);

  // 8. Actualizar badge con conteo real de episodios
  syncEpisodesBadge();

  // 9. Renderizar episodios
  renderEpisodes(currentFilter);
};

/* --------------------------------------------------
   INICIALIZACIÓN
-------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📺 Página de detalles iniciando...');

  if (window.firebaseService) {
    console.log('✅ Firebase Service disponible');
    await loadAnime();
  } else {
    console.error('❌ Firebase Service no disponible');
    animeDetails.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <p style="color: #ef4444;">❌ Error: Firebase no está configurado</p>
      </div>
    `;
  }
});

console.log(`
╔═══════════════════════════════════════╗
║   📺 ANIME DETAILS v3.1 📺           ║
║   Detalles y Lista de Capítulos      ║
║   🔥 Firebase + 📡 Jikan API         ║
║   🛠️ Optimizado con utils.js         ║
║   Hecho por: Jaykai2                 ║
╚═══════════════════════════════════════╝
`);