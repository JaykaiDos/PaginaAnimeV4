/* ============================================
   WATCH PAGE - JAVASCRIPT (MODIFICADO)
   Autor: Jaykai2
   AHORA LEE DESDE FIREBASE
   ============================================ */

// Estado de la aplicación
let currentAnime = null;
let currentEpisodeNumber = 1;
let currentEpisodes = [];
let watchedEpisodes = [];

// Elementos del DOM
const videoContainer = document.getElementById('videoContainer');
const videoTitle = document.getElementById('videoTitle');
const animeTitle = document.getElementById('animeTitle');
const episodeNumber = document.getElementById('episodeNumber');
const episodeTitle = document.getElementById('episodeTitle');
const animeLink = document.getElementById('animeLink');
const episodesList = document.getElementById('episodesList');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const markWatchedBtn = document.getElementById('markWatchedBtn');

// ============================================
// CARGAR EPISODIOS VISTOS
// ============================================
const loadWatchedEpisodes = (animeId) => {
  const stored = localStorage.getItem(`watched_${animeId}`);
  return stored ? JSON.parse(stored) : [];
};

// ============================================
// GUARDAR EPISODIOS VISTOS
// ============================================
const saveWatchedEpisodes = (animeId, episodes) => {
  localStorage.setItem(`watched_${animeId}`, JSON.stringify(episodes));
};

// ============================================
// CONVERTIR LINKS DE DIFERENTES PLATAFORMAS
// ============================================
const getEmbedUrl = (videoUrl) => {
  // Ok.ru: Asegurar que tenga protocolo HTTPS
  if (videoUrl.includes('ok.ru')) {
    if (videoUrl.startsWith('//')) {
      return 'https:' + videoUrl;
    }
    return videoUrl;
  }
  
  // Google Drive: Si ya es un link de preview, retornarlo
  if (videoUrl.includes('/preview')) {
    return videoUrl;
  }
  
  // Google Drive: Convertir link de view a preview
  if (videoUrl.includes('/view')) {
    return videoUrl.replace('/view', '/preview');
  }
  
  // Google Drive: Extraer ID del archivo y crear URL de embed
  const fileIdMatch = videoUrl.match(/\/d\/([^/]+)/);
  if (fileIdMatch) {
    return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
  }
  
  // YouTube: Convertir a formato embed si es necesario
  if (videoUrl.includes('youtube.com/watch')) {
    const urlParams = new URLSearchParams(new URL(videoUrl).search);
    const videoId = urlParams.get('v');
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }
  
  if (videoUrl.includes('youtu.be/')) {
    const videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  
  // Para cualquier otra URL, retornarla tal cual
  return videoUrl;
};

// ============================================
// CARGAR ANIME Y EPISODIOS DESDE FIREBASE
// ============================================
const loadAnimeAndEpisodesFromFirebase = async (animeId) => {
  try {
    // Cargar información del anime
    const anime = await window.firebaseService.getAnimeById(animeId);
    
    if (!anime) {
      throw new Error('Anime no encontrado');
    }
    
    // Cargar episodios
    const episodes = await window.firebaseService.getEpisodesByAnime(animeId);
    
    if (episodes.length === 0) {
      throw new Error('Este anime no tiene episodios');
    }
    
    // Transformar al formato esperado
    currentAnime = {
      id: anime.id,
      title: anime.title,
      episodes: anime.totalEpisodes || episodes.length
    };
    
    currentEpisodes = episodes.map(ep => ({
      number: ep.episodeNumber,
      title: ep.title,
      duration: ep.duration,
      videoUrl: ep.videoUrl
    }));
    
    // Ordenar por número de episodio
    currentEpisodes.sort((a, b) => a.number - b.number);
    
    console.log(`📺 ${currentEpisodes.length} episodios cargados para ${currentAnime.title}`);
    
    return { anime: currentAnime, episodes: currentEpisodes };
    
  } catch (error) {
    console.error('Error al cargar datos:', error);
    throw error;
  }
};

// ============================================
// RENDERIZAR VIDEO PLAYER
// ============================================
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

  // Actualizar información
  videoTitle.textContent = `${currentAnime.title} - Episodio ${episode.number}`;
  animeTitle.textContent = `📺 ${currentAnime.title}`;
  episodeNumber.textContent = `EP ${episode.number}`;
  episodeTitle.textContent = `Episodio ${episode.number}`;

  // Actualizar breadcrumb link
  animeLink.href = `anime-details.html?id=${currentAnime.id}`;
  animeLink.textContent = `📺 ${currentAnime.title}`;

  // Actualizar botón de visto
  updateWatchedButton();

  // Marcar automáticamente como visto después de 5 segundos
  setTimeout(() => {
    if (!watchedEpisodes.includes(episode.number)) {
      watchedEpisodes.push(episode.number);
      saveWatchedEpisodes(currentAnime.id, watchedEpisodes);
      updateWatchedButton();
      renderEpisodesList();
    }
  }, 5000);
};

// ============================================
// RENDERIZAR LISTA DE EPISODIOS
// ============================================
const renderEpisodesList = () => {
  if (!currentAnime || !currentEpisodes || currentEpisodes.length === 0) return;

  episodesList.innerHTML = currentEpisodes.map(ep => `
    <div class="episode-item ${ep.number === currentEpisodeNumber ? 'active' : ''} ${watchedEpisodes.includes(ep.number) ? 'watched' : ''}"
         onclick="loadEpisode(${ep.number})">
      <div class="episode-item-number">EP ${ep.number}</div>
      <div class="episode-item-title">${ep.title}</div>
    </div>
  `).join('');
};

// ============================================
// CARGAR EPISODIO
// ============================================
window.loadEpisode = (episodeNum) => {
  if (!currentAnime || !currentEpisodes) return;

  const episode = currentEpisodes.find(ep => ep.number === episodeNum);
  if (!episode) return;

  currentEpisodeNumber = episodeNum;

  // Actualizar URL sin recargar
  const newUrl = `${window.location.pathname}?anime=${currentAnime.id}&episode=${episodeNum}`;
  window.history.pushState({ anime: currentAnime.id, episode: episodeNum }, '', newUrl);

  // Renderizar
  renderVideoPlayer(episode);
  renderEpisodesList();
  updateNavigationButtons();

  // Scroll al top
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ============================================
// NAVEGACIÓN: EPISODIO ANTERIOR
// ============================================
window.previousEpisode = () => {
  if (currentEpisodeNumber > 1) {
    loadEpisode(currentEpisodeNumber - 1);
  }
};

// ============================================
// NAVEGACIÓN: EPISODIO SIGUIENTE
// ============================================
window.nextEpisode = () => {
  if (currentEpisodeNumber < currentAnime.episodes) {
    loadEpisode(currentEpisodeNumber + 1);
  }
};

// ============================================
// ACTUALIZAR BOTONES DE NAVEGACIÓN
// ============================================
const updateNavigationButtons = () => {
  prevBtn.disabled = currentEpisodeNumber <= 1;
  nextBtn.disabled = currentEpisodeNumber >= currentAnime.episodes;
};

// ============================================
// TOGGLE EPISODIO VISTO
// ============================================
window.toggleWatched = () => {
  const index = watchedEpisodes.indexOf(currentEpisodeNumber);
  
  if (index !== -1) {
    watchedEpisodes.splice(index, 1);
  } else {
    watchedEpisodes.push(currentEpisodeNumber);
  }

  saveWatchedEpisodes(currentAnime.id, watchedEpisodes);
  updateWatchedButton();
  renderEpisodesList();
};

// ============================================
// ACTUALIZAR BOTÓN DE VISTO
// ============================================
const updateWatchedButton = () => {
  const isWatched = watchedEpisodes.includes(currentEpisodeNumber);
  
  if (isWatched) {
    markWatchedBtn.classList.add('watched');
    markWatchedBtn.innerHTML = '✓ Marcado como Visto';
  } else {
    markWatchedBtn.classList.remove('watched');
    markWatchedBtn.innerHTML = '✓ Marcar como Visto';
  }
};

// ============================================
// ATAJOS DE TECLADO
// ============================================
document.addEventListener('keydown', (e) => {
  // Flecha izquierda: episodio anterior
  if (e.key === 'ArrowLeft' && !prevBtn.disabled) {
    e.preventDefault();
    previousEpisode();
  }
  
  // Flecha derecha: episodio siguiente
  if (e.key === 'ArrowRight' && !nextBtn.disabled) {
    e.preventDefault();
    nextEpisode();
  }
  
  // Tecla 'M': marcar como visto
  if (e.key === 'm' || e.key === 'M') {
    e.preventDefault();
    toggleWatched();
  }
});

// ============================================
// CARGAR DESDE URL
// ============================================
const loadFromUrl = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const animeId = urlParams.get('anime');
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

  // Mostrar loading
  videoContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando video desde Firebase...</p></div>';
  episodesList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando episodios...</p></div>';

  try {
    // Cargar anime y episodios desde Firebase
    const data = await loadAnimeAndEpisodesFromFirebase(animeId);
    
    currentAnime = data.anime;
    currentEpisodes = data.episodes;
    currentEpisodeNumber = episodeNum;
    watchedEpisodes = loadWatchedEpisodes(animeId);

    // Verificar que el episodio existe
    const episode = currentEpisodes.find(ep => ep.number === episodeNum);
    if (!episode) {
      // Si no existe, cargar el primer episodio
      loadEpisode(1);
      return;
    }

    // Renderizar
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

// ============================================
// MANEJAR NAVEGACIÓN DEL NAVEGADOR
// ============================================
window.addEventListener('popstate', (e) => {
  if (e.state) {
    loadFromUrl();
  }
});

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('▶️ Página de reproducción cargada');
  
  // Esperar a que Firebase esté listo
  if (window.firebaseService) {
    await loadFromUrl();
  } else {
    console.error('❌ Firebase Service no está disponible');
    videoContainer.innerHTML = '<div style="text-align: center; padding: 3rem;"><p style="color: #ef4444;">❌ Error: Firebase no está configurado</p></div>';
  }
});

console.log(`
╔═══════════════════════════════════════╗
║   ▶️ VIDEO PLAYER ▶️                 ║
║   Reproducción de Episodios          ║
║   🔥 Conectado a Firebase            ║
║   Hecho por: Jaykai2                 ║
║                                       ║
║   Atajos de Teclado:                 ║
║   ← Episodio Anterior                ║
║   → Episodio Siguiente               ║
║   M Marcar como Visto                ║
╚═══════════════════════════════════════╝
`);