/* ============================================
   ADMIN PANEL LOGICO - JAVASCRIPT
   Autor: Jaykai2
   ============================================ */

const { 
  getAllSeasons, addSeason, deleteSeason,
  getAllAnimes, getAnimesBySeason, addAnime, updateAnime, deleteAnime,
  getEpisodesByAnime, addEpisode, deleteEpisode
} = window.firebaseService;

// Estado global
let currentSeasons = [];
let currentAnimes = [];
let currentEpisodes = [];
let selectedAnimeId = null;
let editingSeasonId = null;
let editingAnimeId = null;

// ============================================
// INICIALIZACIÓN
// ============================================
window.addEventListener('load', async () => {
  // Proteger página de admin
  await window.authSystem.protectAdminPage();
  
  // Mostrar email del usuario
  const user = firebase.auth().currentUser;
  if (user) {
    document.getElementById('userEmail').textContent = user.email;
  }
  
  // Cargar datos iniciales
  await loadSeasons();
  await loadAllAnimes();
  
  fillSeasonSelect();
  // Inicializar navegación por tabs
  initTabs();
  
  // Inicializar formularios
  initForms();
  
  console.log('✅ Panel de administración cargado');
});

// ============================================
// NAVEGACIÓN POR TABS
// ============================================
const initTabs = () => {
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remover active de todos
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Activar el clickeado
      tab.classList.add('active');
      const tabId = tab.dataset.tab + '-tab';
      document.getElementById(tabId).classList.add('active');
    });
  });
};

// ============================================
// GESTIÓN DE TEMPORADAS
// ============================================

// Cargar temporadas
const loadSeasons = async () => {
  const grid = document.getElementById('seasonsGrid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
  
  currentSeasons = await getAllSeasons();
  
  if (currentSeasons.length === 0) {
    grid.innerHTML = '<p class="empty-state">No hay temporadas creadas</p>';
    return;
  }
  
  grid.innerHTML = currentSeasons.map(season => `
    <div class="season-card">
      <div class="season-card-header">
        <div class="season-emoji">${season.emoji || '📅'}</div>
        <span class="meta-tag ${season.status === 'active' ? 'category' : 'season'}">
          ${season.status === 'active' ? '✅ Activo' : '⏸️ Finalizado'}
        </span>
      </div>
      <h3 class="season-card-title">${season.name}</h3>
      <p class="season-card-period">${season.period}</p>
      <p class="season-card-count">📺 ${season.animeCount || 0} animes</p>
      <div class="season-card-actions">
        <button class="btn-edit" onclick="editSeason('${season.id}')">
          ✏️ Editar
        </button>
        <button class="btn-danger" onclick="confirmDeleteSeason('${season.id}')">
          🗑️ Eliminar
        </button>
      </div>
    </div>
  `).join('');
  
  // Actualizar selector de temporadas en formularios
  updateSeasonSelectors();
};

// Abrir modal de temporada
window.openSeasonModal = (seasonId = null) => {
  editingSeasonId = seasonId;
  const modal = document.getElementById('seasonModal');
  const title = document.getElementById('seasonModalTitle');
  const form = document.getElementById('seasonForm');
  
  if (seasonId) {
    // Modo edición
    const season = currentSeasons.find(s => s.id === seasonId);
    title.textContent = 'Editar Temporada';
    document.getElementById('seasonName').value = season.name;
    document.getElementById('seasonEmoji').value = season.emoji || '';
    document.getElementById('seasonPeriod').value = season.period;
    document.getElementById('seasonStatus').value = season.status;
    document.getElementById('seasonOrder').value = season.order || 1;
  } else {
    // Modo creación
    title.textContent = 'Nueva Temporada';
    form.reset();
  }
  
  modal.classList.add('show');
};

// Cerrar modal de temporada
window.closeSeasonModal = () => {
  document.getElementById('seasonModal').classList.remove('show');
  document.getElementById('seasonForm').reset();
  editingSeasonId = null;
};

// Editar temporada
window.editSeason = (seasonId) => {
  openSeasonModal(seasonId);
};

// Confirmar eliminación
window.confirmDeleteSeason = (seasonId) => {
  const season = currentSeasons.find(s => s.id === seasonId);
  if (confirm(`¿Eliminar la temporada "${season.name}" y TODOS sus animes?`)) {
    deleteSeasonHandler(seasonId);
  }
};

// Eliminar temporada
const deleteSeasonHandler = async (seasonId) => {
  const result = await deleteSeason(seasonId);
  if (result.success) {
    alert('✅ Temporada eliminada correctamente');
    await loadSeasons();
    await loadAllAnimes();
  } else {
    alert('❌ Error al eliminar temporada');
  }
};

// ============================================
// GESTIÓN DE ANIMES
// ============================================

// Cargar todos los animes
const loadAllAnimes = async () => {
  const list = document.getElementById('animesList');
  list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
  
  currentAnimes = await getAllAnimes();
  
  if (currentAnimes.length === 0) {
    list.innerHTML = '<p class="empty-state">No hay animes creados</p>';
    return;
  }
  
  renderAnimesList(currentAnimes);
  
  // Actualizar selector de animes para episodios
  updateAnimeSelector();
};

// Renderizar lista de animes
const renderAnimesList = (animes) => {
  const list = document.getElementById('animesList');
  
  list.innerHTML = animes.map(anime => {
    const season = currentSeasons.find(s => s.id === anime.seasonId);
    return `
      <div class="anime-item">
        <img src="${anime.cardImage}" alt="${anime.title}" class="anime-item-image">
        <div class="anime-item-info">
          <h3>${anime.title}</h3>
          <div class="anime-item-meta">
            <span class="meta-tag season">${season ? season.name : 'Sin temporada'}</span>
            <span class="meta-tag category">
              ${anime.category === 'continuation' ? '⭐ Continuación' : '🆕 Nuevo'}
            </span>
            <span class="meta-tag episodes">📺 ${anime.totalEpisodes || 0} eps</span>
            <span class="meta-tag ${anime.status === 'airing' ? 'category' : 'season'}">
              ${anime.status === 'airing' ? '🔴 En emisión' : '✅ Finalizado'}
            </span>
          </div>
        </div>
        <div class="anime-item-actions">
          <button class="btn-edit" onclick="editAnime('${anime.id}')">
            ✏️ Editar
          </button>
          <button class="btn-danger" onclick="confirmDeleteAnime('${anime.id}')">
            🗑️ Eliminar
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// Filtrar animes por temporada
window.filterAnimesBySeason = () => {
  const seasonId = document.getElementById('seasonFilter').value;
  
  if (seasonId === 'all') {
    renderAnimesList(currentAnimes);
  } else {
    const filtered = currentAnimes.filter(a => a.seasonId === seasonId);
    renderAnimesList(filtered);
  }
};

// Abrir modal de anime
window.openAnimeModal = (animeId = null) => {
  editingAnimeId = animeId;
  const modal = document.getElementById('animeModal');
  const title = document.getElementById('animeModalTitle');
  const form = document.getElementById('animeForm');
  
  // Mostrar el modal
  modal.classList.add('active');
  
  if (animeId) {
    // MODO EDICIÓN
    const anime = currentAnimes.find(a => a.id === animeId);
    
    if (anime) {
      title.textContent = 'Editar Anime';
      
      // Vinculación con la temporada
      document.getElementById('animeSeasonId').value = anime.seasonId || "";
      
      // Resto de campos
      document.getElementById('animeTitle').value = anime.title || "";
      document.getElementById('animeCategory').value = anime.category || "new";
      document.getElementById('animeYear').value = anime.year || 2025;
      document.getElementById('animeStatus').value = anime.status || "airing";
      document.getElementById('animeOrder').value = anime.order || 1;
      document.getElementById('animeCardImage').value = anime.cardImage || "";
      document.getElementById('animePoster').value = anime.poster || "";
      document.getElementById('animeSynopsis').value = anime.synopsis || "";
      
      // Manejo de trailers (Array a String para el input)
      document.getElementById('animeTrailers').value = anime.trailers ? anime.trailers.join(', ') : '';
    }
  } else {
    // MODO CREACIÓN
    title.textContent = 'Nuevo Anime';
    form.reset();
    // Importante resetear manualmente el select de temporada
    document.getElementById('animeSeasonId').value = "";
  }
  
  modal.classList.add('show');
};

// Cerrar modal de anime
window.closeAnimeModal = () => {
  document.getElementById('animeModal').classList.remove('show');
  document.getElementById('animeForm').reset();
  editingAnimeId = null;
};

// Editar anime
window.editAnime = (animeId) => {
  openAnimeModal(animeId);
};

// Confirmar eliminación de anime
window.confirmDeleteAnime = (animeId) => {
  const anime = currentAnimes.find(a => a.id === animeId);
  if (confirm(`¿Eliminar "${anime.title}" y TODOS sus episodios?`)) {
    deleteAnimeHandler(animeId);
  }
};

// Eliminar anime
const deleteAnimeHandler = async (animeId) => {
  const result = await deleteAnime(animeId);
  if (result.success) {
    alert('✅ Anime eliminado correctamente');
    await loadAllAnimes();
    await loadSeasons(); // Actualizar contador
  } else {
    alert('❌ Error al eliminar anime');
  }
};

// ============================================
// GESTIÓN DE EPISODIOS - MEJORADO
// ============================================

// Cargar episodios por anime
window.loadEpisodesByAnime = async () => {
  const selector = document.getElementById('animeSelector');
  const addBtn = document.getElementById('addEpisodeBtn');
  const list = document.getElementById('episodesList');
  
  selectedAnimeId = selector.value;
  
  if (!selectedAnimeId) {
    list.innerHTML = '<p class="empty-state">Selecciona un anime</p>';
    addBtn.disabled = true;
    return;
  }
  
  addBtn.disabled = false;
  list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
  
  try {
    currentEpisodes = await getEpisodesByAnime(selectedAnimeId);
    
    console.log(`📺 ${currentEpisodes.length} episodios cargados`);
    
    if (currentEpisodes.length === 0) {
      list.innerHTML = '<p class="empty-state">Este anime no tiene episodios</p>';
      return;
    }
    
    list.innerHTML = currentEpisodes.map(ep => `
      <div class="episode-item">
        <div class="episode-item-info">
          <div class="episode-item-number">EP ${ep.episodeNumber}</div>
          <div class="episode-item-title">${ep.title} • ${ep.duration}</div>
        </div>
        <div class="episode-item-actions">
          <button class="btn-danger" onclick="confirmDeleteEpisode('${ep.id}')">
            🗑️ Eliminar
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('❌ Error al cargar episodios:', error);
    list.innerHTML = '<p class="empty-state" style="color: #ef4444;">Error al cargar episodios</p>';
  }
};

// Abrir modal de episodio
window.openEpisodeModal = () => {
  if (!selectedAnimeId) {
    alert('⚠️ Primero selecciona un anime');
    return;
  }
  
  const modal = document.getElementById('episodeModal');
  const form = document.getElementById('episodeForm');
  
  // Sugerir el siguiente número de episodio
  const nextEpisodeNumber = currentEpisodes.length + 1;
  document.getElementById('episodeNumber').value = nextEpisodeNumber;
  document.getElementById('episodeTitle').value = `Episodio ${nextEpisodeNumber}`;
  
  modal.classList.add('show');
};

// Cerrar modal de episodio
window.closeEpisodeModal = () => {
  document.getElementById('episodeModal').classList.remove('show');
  document.getElementById('episodeForm').reset();
};

// Confirmar eliminación de episodio
window.confirmDeleteEpisode = (episodeId) => {
  if (confirm('¿Eliminar este episodio?')) {
    deleteEpisodeHandler(episodeId);
  }
};

// Eliminar episodio
const deleteEpisodeHandler = async (episodeId) => {
  const result = await deleteEpisode(episodeId, selectedAnimeId);
  if (result.success) {
    alert('✅ Episodio eliminado');
    await loadEpisodesByAnime();
    await loadAllAnimes(); // Actualizar contador
  } else {
    alert('❌ Error al eliminar episodio');
  }
};

// ============================================
// ACTUALIZAR SELECTORES
// ============================================

// Actualizar selector de temporadas
const updateSeasonSelectors = () => {
  const selectors = ['seasonFilter'];
  
  selectors.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const currentValue = select.value;
    const isFilterSelect = selectId === 'seasonFilter';
    
    select.innerHTML = isFilterSelect ? '<option value="all">Todas las temporadas</option>' : '<option value="">-- Selecciona --</option>';
    
    currentSeasons.forEach(season => {
      const option = document.createElement('option');
      option.value = season.id;
      option.textContent = season.name;
      select.appendChild(option);
    });
    
    if (currentValue) {
      select.value = currentValue;
    }
  });
};

// Actualizar selector de animes
const updateAnimeSelector = () => {
  const select = document.getElementById('animeSelector');
  if (!select) return;
  
  select.innerHTML = '<option value="">-- Selecciona un anime --</option>';
  
  currentAnimes.forEach(anime => {
    const option = document.createElement('option');
    option.value = anime.id;
    option.textContent = anime.title;
    select.appendChild(option);
  });
};

// ============================================
// INICIALIZAR FORMULARIOS
// ============================================
const initForms = () => {
  // Formulario de temporada
  document.getElementById('seasonForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const seasonData = {
      name: document.getElementById('seasonName').value,
      emoji: document.getElementById('seasonEmoji').value,
      period: document.getElementById('seasonPeriod').value,
      status: document.getElementById('seasonStatus').value,
      order: parseInt(document.getElementById('seasonOrder').value)
    };
    
    // Si está editando, actualizar; si no, crear nuevo
    let result;
    if (editingSeasonId) {
      result = await window.firebaseDB.seasonsRef.doc(editingSeasonId).update(seasonData);
      alert('✅ Temporada actualizada');
    } else {
      result = await addSeason(seasonData);
      if (result.success) {
        alert('✅ Temporada creada');
      }
    }
    
    closeSeasonModal();
    await loadSeasons();
  });
  
  // Formulario de anime
  document.getElementById('animeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const trailersText = document.getElementById('animeTrailers').value;
    const trailers = trailersText ? trailersText.split(',').map(t => t.trim()) : [];
    
    const animeData = {
      seasonId: document.getElementById('animeSeasonId').value,
      title: document.getElementById('animeTitle').value,
      category: document.getElementById('animeCategory').value,
      year: parseInt(document.getElementById('animeYear').value),
      status: document.getElementById('animeStatus').value,
      order: parseInt(document.getElementById('animeOrder').value),
      cardImage: document.getElementById('animeCardImage').value,
      poster: document.getElementById('animePoster').value,
      synopsis: document.getElementById('animeSynopsis').value,
      trailers: trailers,
      totalEpisodes: 0
    };
    
    let result;
    if (editingAnimeId) {
      result = await updateAnime(editingAnimeId, animeData);
      alert('✅ Anime actualizado');
    } else {
      result = await addAnime(animeData);
      if (result.success) {
        alert('✅ Anime creado');
      }
    }
    
    closeAnimeModal();
    await loadAllAnimes();
    await loadSeasons();
  });
  
  // Formulario de episodio - CORREGIDO
  document.getElementById('episodeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedAnimeId) {
      alert('⚠️ Error: No hay un anime seleccionado');
      return;
    }
    
    const episodeData = {
      animeId: selectedAnimeId,
      episodeNumber: parseInt(document.getElementById('episodeNumber').value),
      title: document.getElementById('episodeTitle').value,
      duration: document.getElementById('episodeDuration').value,
      videoUrl: document.getElementById('episodeVideoUrl').value
    };
    
    console.log('📤 Enviando episodio:', episodeData);
    
    const result = await addEpisode(episodeData);
    
    if (result.success) {
      alert('✅ Episodio agregado correctamente');
      closeEpisodeModal();
      await loadEpisodesByAnime(); // Recargar lista de episodios
      await loadAllAnimes(); // Actualizar contador en la lista de animes
    } else {
      alert('❌ Error al agregar episodio: ' + (result.error?.message || 'Error desconocido'));
      console.error('Error completo:', result.error);
    }
  });
};

const fillSeasonSelect = () => {
  const select = document.getElementById('animeSeasonId');
  if (!select || currentSeasons.length === 0) return;

  select.innerHTML = '<option value="">Selecciona una temporada...</option>';
  currentSeasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.id;
    option.textContent = season.name;
    select.appendChild(option);
  });
};

console.log('🎛️ Admin Panel JS cargado');