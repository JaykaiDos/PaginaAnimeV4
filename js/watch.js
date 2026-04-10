/* ============================================
   WATCH PAGE - JAVASCRIPT
   Autor: Jaykai2
   Versión: 1.1 — OPTIMIZADO (DRY)

   CAMBIOS v1.1:
   ─────────────────────────────────────────────
   · ELIMINADA loadWatchedEpisodes() → ahora en utils.js
   · ELIMINADA saveWatchedEpisodes() → ahora en utils.js
   · Todas las llamadas internas reemplazadas por
     window.AnimeUtils.* (namespace centralizado)

   Orden de carga requerido en HTML:
     1. firebase-config.js
     2. firebase-service.js
     3. utils.js            ← NUEVO (obligatorio)
     4. watch.js            ← ESTE ARCHIVO
   ============================================ */

'use strict';

/* --------------------------------------------------
   ESTADO DE LA APLICACIÓN
-------------------------------------------------- */
let currentAnime         = null;
let currentEpisodeNumber = 1;
let currentEpisodes      = [];
let watchedEpisodes      = [];

/* --------------------------------------------------
   REFERENCIAS AL DOM
   Resueltas una sola vez al cargar el script.
-------------------------------------------------- */
const videoContainer = document.getElementById('videoContainer');
const videoTitle     = document.getElementById('videoTitle');
const animeTitle     = document.getElementById('animeTitle');
const episodeNumber  = document.getElementById('episodeNumber');
const episodeTitle   = document.getElementById('episodeTitle');
const animeLink      = document.getElementById('animeLink');
const episodesList   = document.getElementById('episodesList');
const prevBtn        = document.getElementById('prevBtn');
const nextBtn        = document.getElementById('nextBtn');
const markWatchedBtn = document.getElementById('markWatchedBtn');

/* --------------------------------------------------
   CONVERTIR LINKS DE DIFERENTES PLATAFORMAS
   
   Esta función es ESPECÍFICA de watch.js porque maneja
   múltiples plataformas (Ok.ru, Drive, YouTube).
   La parte de YouTube usa window.AnimeUtils.toYouTubeEmbed()
   internamente para evitar duplicar esa lógica.
   
   @param {string} videoUrl - URL de la plataforma de video
   @returns {string}        - URL en formato embed
-------------------------------------------------- */
const getEmbedUrl = (videoUrl) => {
  if (!videoUrl || typeof videoUrl !== 'string') return '';

  // Ok.ru: asegurar protocolo HTTPS
  if (videoUrl.includes('ok.ru')) {
    return videoUrl.startsWith('//') ? 'https:' + videoUrl : videoUrl;
  }

  // Google Drive: ya está en formato preview
  if (videoUrl.includes('/preview')) return videoUrl;

  // Google Drive: convertir /view a /preview
  if (videoUrl.includes('/view')) return videoUrl.replace('/view', '/preview');

  // Google Drive: extraer ID y construir URL de embed
  const fileIdMatch = videoUrl.match(/\/d\/([^/]+)/);
  if (fileIdMatch) {
    return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
  }

  // YouTube: delegar al helper centralizado de utils.js
  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    return window.AnimeUtils.toYouTubeEmbed(videoUrl);
  }

  // Cualquier otra URL: retornarla tal cual
  return videoUrl;
};

/* --------------------------------------------------
   CARGAR ANIME Y EPISODIOS DESDE FIREBASE
-------------------------------------------------- */

/**
 * Obtiene el anime y sus episodios desde Firestore,
 * y los normaliza al formato interno de la página.
 * @param {string} animeId
 * @returns {Promise<{ anime: object, episodes: object[] }>}
 */
const loadAnimeAndEpisodesFromFirebase = async (animeId) => {
  try {
    const anime = await window.firebaseService.getAnimeById(animeId);
    if (!anime) throw new Error('Anime no encontrado');

    const episodes = await window.firebaseService.getEpisodesByAnime(animeId);
    if (episodes.length === 0) throw new Error('Este anime no tiene episodios');

    currentAnime = {
      id:       anime.id,
      title:    anime.title,
      episodes: anime.totalEpisodes || episodes.length
    };

    currentEpisodes = episodes
      .map(ep => ({
        number:   ep.episodeNumber,
        title:    ep.title,
        duration: ep.duration,
        videoUrl: ep.videoUrl
      }))
      .sort((a, b) => a.number - b.number);

    console.log(`📺 ${currentEpisodes.length} episodios cargados para ${currentAnime.title}`);

    return { anime: currentAnime, episodes: currentEpisodes };

  } catch (error) {
    console.error('Error al cargar datos:', error);
    throw error;
  }
};

/* --------------------------------------------------
   RENDERIZAR VIDEO PLAYER
-------------------------------------------------- */

/**
 * Inserta el iframe del video y actualiza toda la
 * información de la UI (título, breadcrumb, botones).
 * Usa window.AnimeUtils.saveWatchedEpisodes() para
 * el marcado automático a los 5 segundos.
 * @param {object} episode - { number, title, videoUrl, ... }
 */
const renderVideoPlayer = (episode) => {
  const embedUrl = getEmbedUrl(episode.videoUrl);

  videoContainer.innerHTML = `
    <iframe
      src="${embedUrl}"
      allow="autoplay; encrypted-media"
      allowfullscreen
      title="${currentAnime.title} - Episodio ${episode.number}">
    </iframe>
  `;

  // Actualizar información visible
  videoTitle.textContent    = `${currentAnime.title} - Episodio ${episode.number}`;
  animeTitle.textContent    = `📺 ${currentAnime.title}`;
  episodeNumber.textContent = `EP ${episode.number}`;
  episodeTitle.textContent  = `Episodio ${episode.number}`;

  // Actualizar breadcrumb link
  animeLink.href        = `anime-details.html?id=${currentAnime.id}`;
  animeLink.textContent = `📺 ${currentAnime.title}`;

  updateWatchedButton();

  // Marcado automático como visto después de 5 segundos
  setTimeout(() => {
    if (!watchedEpisodes.includes(episode.number)) {
      watchedEpisodes.push(episode.number);
      // ✅ OPTIMIZADO: usa helper centralizado de utils.js
      window.AnimeUtils.saveWatchedEpisodes(currentAnime.id, watchedEpisodes);
      updateWatchedButton();
      renderEpisodesList();
    }
  }, 5000);
};

/* --------------------------------------------------
   RENDERIZAR LISTA DE EPISODIOS (SIDEBAR)
-------------------------------------------------- */

/**
 * Regenera el listado lateral de episodios marcando
 * el activo y los ya vistos.
 */
const renderEpisodesList = () => {
  if (!currentAnime || !currentEpisodes || currentEpisodes.length === 0) return;

  episodesList.innerHTML = currentEpisodes.map(ep => `
    <div
      class="episode-item
        ${ep.number === currentEpisodeNumber ? 'active'   : ''}
        ${watchedEpisodes.includes(ep.number) ? 'watched' : ''}"
      onclick="loadEpisode(${ep.number})"
    >
      <div class="episode-item-number">EP ${ep.number}</div>
      <div class="episode-item-title">${ep.title}</div>
    </div>
  `).join('');
};

/* --------------------------------------------------
   NAVEGACIÓN DE EPISODIOS
-------------------------------------------------- */

/**
 * Carga un episodio por número, actualiza la URL
 * sin recargar la página y hace scroll al top.
 * @param {number} episodeNum
 */
window.loadEpisode = (episodeNum) => {
  if (!currentAnime || !currentEpisodes) return;

  const episode = currentEpisodes.find(ep => ep.number === episodeNum);
  if (!episode) return;

  currentEpisodeNumber = episodeNum;

  // Actualizar URL sin recargar (History API)
  const newUrl = `${window.location.pathname}?anime=${currentAnime.id}&episode=${episodeNum}`;
  window.history.pushState({ anime: currentAnime.id, episode: episodeNum }, '', newUrl);

  renderVideoPlayer(episode);
  renderEpisodesList();
  updateNavigationButtons();

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/** Navega al episodio anterior si existe. */
window.previousEpisode = () => {
  if (currentEpisodeNumber > 1) loadEpisode(currentEpisodeNumber - 1);
};

/** Navega al episodio siguiente si existe. */
window.nextEpisode = () => {
  if (currentEpisodeNumber < currentAnime.episodes) loadEpisode(currentEpisodeNumber + 1);
};

/**
 * Habilita o deshabilita los botones de navegación
 * según la posición del episodio actual.
 */
const updateNavigationButtons = () => {
  prevBtn.disabled = currentEpisodeNumber <= 1;
  nextBtn.disabled = currentEpisodeNumber >= currentAnime.episodes;
};

/* --------------------------------------------------
   TOGGLE EPISODIO VISTO
-------------------------------------------------- */

/**
 * Alterna el estado "visto" del episodio actual.
 * Usa window.AnimeUtils.saveWatchedEpisodes() en lugar
 * de la función local eliminada.
 */
window.toggleWatched = () => {
  const index = watchedEpisodes.indexOf(currentEpisodeNumber);

  if (index !== -1) {
    watchedEpisodes.splice(index, 1);
  } else {
    watchedEpisodes.push(currentEpisodeNumber);
  }

  // ✅ OPTIMIZADO: usa helper centralizado de utils.js
  window.AnimeUtils.saveWatchedEpisodes(currentAnime.id, watchedEpisodes);
  updateWatchedButton();
  renderEpisodesList();
};

/**
 * Actualiza el texto y estilo del botón "Marcar como Visto"
 * según el estado del episodio actual.
 */
const updateWatchedButton = () => {
  const isWatched = watchedEpisodes.includes(currentEpisodeNumber);
  markWatchedBtn.classList.toggle('watched', isWatched);
  markWatchedBtn.innerHTML = isWatched ? '✓ Marcado como Visto' : '✓ Marcar como Visto';
};

/* --------------------------------------------------
   ATAJOS DE TECLADO
-------------------------------------------------- */
document.addEventListener('keydown', (e) => {
  // ← Episodio anterior
  if (e.key === 'ArrowLeft' && !prevBtn.disabled) {
    e.preventDefault();
    previousEpisode();
  }
  // → Episodio siguiente
  if (e.key === 'ArrowRight' && !nextBtn.disabled) {
    e.preventDefault();
    nextEpisode();
  }
  // M: marcar como visto
  if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    toggleWatched();
  }
});

/* --------------------------------------------------
   MANEJAR NAVEGACIÓN DEL NAVEGADOR (BOTÓN ATRÁS)
-------------------------------------------------- */
window.addEventListener('popstate', (e) => {
  if (e.state) loadFromUrl();
});

/* --------------------------------------------------
   CARGAR DESDE URL
-------------------------------------------------- */

/**
 * Punto de entrada: lee los parámetros de la URL
 * y orquesta la carga del anime + episodio inicial.
 */
const loadFromUrl = async () => {
  const urlParams  = new URLSearchParams(window.location.search);
  const animeId    = urlParams.get('anime');
  const episodeNum = parseInt(urlParams.get('episode')) || 1;

  if (!animeId) {
    videoContainer.innerHTML = `
      <div class="loading">
        <span style="font-size: 5rem;">😢</span>
        <h2 style="color: #ade8f4; margin: 1rem 0;">Anime no especificado</h2>
        <p>No se proporcionó un ID de anime.</p>
        <a href="search.html" class="footer-link" style="margin-top: 2rem;">🔍 Volver a Búsqueda</a>
      </div>
    `;
    return;
  }

  // Mostrar loading mientras se carga
  videoContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando video desde Firebase...</p></div>';
  episodesList.innerHTML   = '<div class="loading"><div class="spinner"></div><p>Cargando episodios...</p></div>';

  try {
    const data = await loadAnimeAndEpisodesFromFirebase(animeId);

    currentAnime         = data.anime;
    currentEpisodes      = data.episodes;
    currentEpisodeNumber = episodeNum;

    // ✅ OPTIMIZADO: usa helper centralizado de utils.js
    watchedEpisodes = window.AnimeUtils.loadWatchedEpisodes(animeId);

    // Si el episodio pedido no existe, cargar el primero
    const episode = currentEpisodes.find(ep => ep.number === episodeNum);
    if (!episode) {
      loadEpisode(1);
      return;
    }

    renderVideoPlayer(episode);
    renderEpisodesList();
    updateNavigationButtons();

  } catch (error) {
    console.error('Error:', error);
    videoContainer.innerHTML = `
      <div class="loading">
        <span style="font-size: 5rem;">❌</span>
        <h2 style="color: #ef4444; margin: 1rem 0;">Error al cargar</h2>
        <p>${error.message}</p>
        <a href="search.html" class="footer-link" style="margin-top: 2rem;">🔍 Volver a Búsqueda</a>
      </div>
    `;
  }
};

/* --------------------------------------------------
   INICIALIZACIÓN
-------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('▶️ Página de reproducción cargada');

  if (window.firebaseService) {
    await loadFromUrl();
  } else {
    console.error('❌ Firebase Service no está disponible');
    videoContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <p style="color: #ef4444;">❌ Error: Firebase no está configurado</p>
      </div>
    `;
  }
});

console.log(`
╔═══════════════════════════════════════╗
║   ▶️ VIDEO PLAYER v1.1 ▶️            ║
║   Reproducción de Episodios          ║
║   🔥 Firebase + 🛠️ utils.js          ║
║   Hecho por: Jaykai2                 ║
║                                       ║
║   Atajos de Teclado:                 ║
║   ← Episodio Anterior                ║
║   → Episodio Siguiente               ║
║   M Marcar como Visto                ║
╚═══════════════════════════════════════╝
`);