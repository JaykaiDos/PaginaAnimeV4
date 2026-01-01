/* ============================================
   ANIME DETAILS - JAVASCRIPT
   Autor: Jaykai2
   ============================================ */

// Estado de la aplicación
let currentAnime = null;
let currentEpisodes = [];
let watchedEpisodes = [];
let currentFilter = 'all';

// Elementos del DOM
const animeDetails = document.getElementById('animeDetails');
const episodesSection = document.getElementById('episodesSection');
const episodesGrid = document.getElementById('episodesGrid');
const breadcrumbTitle = document.getElementById('breadcrumbTitle');

// ============================================
// CARGAR EPISODIOS VISTOS DESDE LOCALSTORAGE
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
// CARGAR ANIME DESDE FIREBASE
// ============================================
const loadAnimeFromFirebase = async (animeId) => {
  animeDetails.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando información del anime...</p></div>';
  
  try {
    console.log('🔍 Cargando anime con ID:', animeId);
    
    // Obtener anime desde Firebase
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
    
    console.log('✅ Anime cargado:', anime);
    
    // Obtener temporada
    const seasons = await window.firebaseService.getAllSeasons();
    const season = seasons.find(s => s.id === anime.seasonId);
    
    // Transformar al formato esperado
    currentAnime = {
      id: anime.id,
      title: anime.title,
      season: anime.seasonId ? anime.seasonId.split('_')[0] : 'fall',
      seasonName: season ? season.name : 'Temporada',
      poster: anime.poster,
      synopsis: anime.synopsis,
      episodes: anime.totalEpisodes || 0,
      status: anime.status === 'airing' ? 'En emisión' : 'Finalizado',
      trailers: anime.trailers || []
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

// ============================================
// CARGAR EPISODIOS DESDE FIREBASE - MEJORADO
// ============================================
const loadEpisodesFromFirebase = async (animeId) => {
  try {
    console.log('📺 Cargando episodios para anime:', animeId);
    
    const episodes = await window.firebaseService.getEpisodesByAnime(animeId);
    
    console.log('✅ Episodios obtenidos de Firebase:', episodes.length);
    
    if (episodes.length === 0) {
      console.log('⚠️ No se encontraron episodios');
      currentEpisodes = [];
      return [];
    }
    
    // Transformar al formato esperado
    currentEpisodes = episodes.map(ep => ({
      number: ep.episodeNumber,
      title: ep.title,
      duration: ep.duration,
      videoUrl: ep.videoUrl // Importante: guardar la URL del video
    }));
    
    // Ordenar por número de episodio
    currentEpisodes.sort((a, b) => a.number - b.number);
    
    console.log(`✅ ${currentEpisodes.length} episodios transformados:`, currentEpisodes);
    return currentEpisodes;
    
  } catch (error) {
    console.error('❌ Error al cargar episodios:', error);
    currentEpisodes = [];
    return [];
  }
};

// ============================================
// RENDERIZAR DETALLES DEL ANIME
// ============================================
const renderAnimeDetails = (anime) => {
  animeDetails.innerHTML = `
    <div class="details-hero">
      <img src="${anime.poster}" alt="${anime.title}" class="anime-poster" onerror="this.src='https://via.placeholder.com/400x550?text=Sin+Imagen'">
      
      <div class="anime-info">
        <h1 class="anime-title">${anime.title}</h1>
        
        <div class="anime-meta">
          <span class="meta-badge season">📅 ${anime.seasonName}</span>
          <span class="meta-badge status">🔴 ${anime.status}</span>
          <span class="meta-badge episodes">📺 ${anime.episodes} episodios</span>
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
        </div>
      </div>
    </div>
    
    ${anime.trailers && anime.trailers.length > 0 ? `
    <div class="anime-trailers">
      <h3>🎬 Trailers</h3>
      <div class="trailers-grid">
        ${anime.trailers.map(trailer => `
          <iframe src="${trailer}" title="Trailer" allowfullscreen></iframe>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;

  // Actualizar estado del botón de favoritos
  updateFavoriteButton();
};

// ============================================
// RENDERIZAR LISTA DE EPISODIOS - CORREGIDO
// ============================================
const renderEpisodes = (filter = 'all') => {
  console.log('🎨 Renderizando episodios. Total:', currentEpisodes.length, 'Filtro:', filter);
  
  if (!currentAnime) {
    console.warn('⚠️ No hay anime actual');
    episodesGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #48cae480;">
        <p>No se ha cargado el anime</p>
      </div>
    `;
    return;
  }
  
  if (!currentEpisodes || currentEpisodes.length === 0) {
    console.log('ℹ️ No hay episodios disponibles');
    episodesGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #48cae480;">
        <p>Este anime aún no tiene episodios disponibles</p>
      </div>
    `;
    return;
  }

  let episodes = currentEpisodes;

  // Aplicar filtro
  if (filter === 'watched') {
    episodes = episodes.filter(ep => watchedEpisodes.includes(ep.number));
  } else if (filter === 'unwatched') {
    episodes = episodes.filter(ep => !watchedEpisodes.includes(ep.number));
  }

  if (episodes.length === 0) {
    episodesGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #48cae480;">
        <p>No hay episodios en esta categoría</p>
      </div>
    `;
    return;
  }

  console.log('✅ Renderizando', episodes.length, 'episodios en el DOM');

  episodesGrid.innerHTML = episodes.map(episode => `
    <article class="episode-card ${watchedEpisodes.includes(episode.number) ? 'watched' : ''}"
             onclick="playEpisode(${episode.number})">
      <div class="episode-number">EP ${episode.number}</div>
      <h3 class="episode-title">${episode.title}</h3>
      <p class="episode-duration">⏱️ ${episode.duration}</p>
    </article>
  `).join('');
};

// ============================================
// REPRODUCIR EPISODIO
// ============================================
window.playEpisode = (episodeNumber) => {
  console.log('▶️ Reproduciendo episodio:', episodeNumber);
  
  // Marcar como visto
  if (!watchedEpisodes.includes(episodeNumber)) {
    watchedEpisodes.push(episodeNumber);
    saveWatchedEpisodes(currentAnime.id, watchedEpisodes);
  }

  // Navegar a página de reproducción
  window.location.href = `watch.html?anime=${currentAnime.id}&episode=${episodeNumber}`;
};

// ============================================
// REPRODUCIR PRIMER EPISODIO
// ============================================
window.playFirstEpisode = () => {
  if (currentEpisodes.length > 0) {
    playEpisode(1);
  } else {
    alert('⚠️ Este anime aún no tiene episodios disponibles');
  }
};

// ============================================
// TOGGLE FAVORITO
// ============================================
window.toggleFavorite = () => {
  let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
  const favIndex = favorites.findIndex(fav => fav.id === currentAnime.id);

  if (favIndex !== -1) {
    favorites.splice(favIndex, 1);
  } else {
    favorites.push({ 
      id: currentAnime.id, 
      title: currentAnime.title 
    });
  }

  localStorage.setItem('favorites', JSON.stringify(favorites));
  updateFavoriteButton();
};

// ============================================
// ACTUALIZAR BOTÓN DE FAVORITOS
// ============================================
const updateFavoriteButton = () => {
  const favBtn = document.getElementById('favBtn');
  if (!favBtn) return;

  const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
  const isFavorite = favorites.some(fav => fav.id === currentAnime.id);

  if (isFavorite) {
    favBtn.classList.add('active');
    favBtn.innerHTML = '⭐ En Favoritos';
  } else {
    favBtn.classList.remove('active');
    favBtn.innerHTML = '⭐ Agregar a Favoritos';
  }
};

// ============================================
// FILTROS DE EPISODIOS
// ============================================
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-btn')) {
    // Remover active de todos
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Agregar active al clickeado
    e.target.classList.add('active');
    
    // Aplicar filtro
    const filter = e.target.dataset.filter;
    currentFilter = filter;
    renderEpisodes(filter);
  }
});

// ============================================
// CARGAR ANIME DESDE URL - MEJORADO
// ============================================
const loadAnime = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const animeId = urlParams.get('id');
  
  console.log('🚀 Iniciando carga de anime. ID:', animeId);
  
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
  
  // Cargar anime desde Firebase
  const anime = await loadAnimeFromFirebase(animeId);
  
  if (!anime) {
    console.error('❌ No se pudo cargar el anime');
    return;
  }
  
  // Cargar episodios vistos
  watchedEpisodes = loadWatchedEpisodes(animeId);
  console.log('📋 Episodios vistos previamente:', watchedEpisodes);

  // Actualizar breadcrumb
  breadcrumbTitle.textContent = anime.title;

  // Renderizar detalles
  renderAnimeDetails(anime);
  
  // Mostrar sección de episodios
  episodesSection.style.display = 'block';
  episodesGrid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando episodios...</p></div>';
  
  // Cargar y mostrar episodios
  await loadEpisodesFromFirebase(animeId);
  
  console.log('🎬 Total de episodios cargados:', currentEpisodes.length);
  
  // Renderizar episodios
  renderEpisodes(currentFilter);
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📺 Página de detalles cargada');
  
  // Esperar a que Firebase esté listo
  if (window.firebaseService) {
    console.log('✅ Firebase Service disponible');
    await loadAnime();
  } else {
    console.error('❌ Firebase Service no está disponible');
    animeDetails.innerHTML = '<div style="text-align: center; padding: 3rem;"><p style="color: #ef4444;">❌ Error: Firebase no está configurado</p></div>';
  }
});

console.log(`
╔═══════════════════════════════════════╗
║   📺 ANIME DETAILS 📺                ║
║   Detalles y Lista de Capítulos      ║
║   🔥 Conectado a Firebase            ║
║   Hecho por: Jaykai2                 ║
╚═══════════════════════════════════════╝
`);