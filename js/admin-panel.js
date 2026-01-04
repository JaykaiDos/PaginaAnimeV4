/* ============================================
   ADMIN PANEL LOGIC
   Archivo: js/admin-panel.js
   ✅ ACTUALIZADO: Sistema de importación de personajes
   ============================================ */

const { 
  getAllSeasons, addSeason, deleteSeason,
  getAllAnimes, getAnimesBySeason, addAnime, updateAnime, deleteAnime,
  getEpisodesByAnime, addEpisode, deleteEpisode,
  getAllCharacters, getCharactersByAnime, addCharacter, addMultipleCharacters, deleteCharacter, deleteCharactersByAnime, hasCharacters
} = window.firebaseService;

// Estado global
let currentSeasons = [];
let currentAnimes = [];
let currentEpisodes = [];
let currentCharacters = [];
let selectedAnimeId = null;
let editingSeasonId = null;
let editingAnimeId = null;

// ============================================
// INICIALIZACIÓN
// ============================================
window.addEventListener('load', async () => {
  await window.authSystem.protectAdminPage();
  
  const user = firebase.auth().currentUser;
  if (user) {
    document.getElementById('userEmail').textContent = user.email;
  }
  
  await loadSeasons();
  await loadAllAnimes();
  await fillSeasonSelect();
  
  initTabs();
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
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const tabId = tab.dataset.tab + '-tab';
      document.getElementById(tabId).classList.add('active');
    });
  });
};

// ============================================
// GESTIÓN DE TEMPORADAS
// ============================================
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
        <button class="btn-edit" onclick="editSeason('${season.id}')">✏️ Editar</button>
        <button class="btn-danger" onclick="confirmDeleteSeason('${season.id}')">🗑️ Eliminar</button>
      </div>
    </div>
  `).join('');
  
  updateSeasonSelectors();
};

window.openSeasonModal = (seasonId = null) => {
  editingSeasonId = seasonId;
  const modal = document.getElementById('seasonModal');
  const title = document.getElementById('seasonModalTitle');
  const form = document.getElementById('seasonForm');
  
  if (seasonId) {
    const season = currentSeasons.find(s => s.id === seasonId);
    title.textContent = 'Editar Temporada';
    document.getElementById('seasonName').value = season.name;
    document.getElementById('seasonEmoji').value = season.emoji || '';
    document.getElementById('seasonPeriod').value = season.period;
    document.getElementById('seasonStatus').value = season.status;
    document.getElementById('seasonOrder').value = season.order || 1;
  } else {
    title.textContent = 'Nueva Temporada';
    form.reset();
  }
  
  modal.classList.add('show');
};

window.closeSeasonModal = () => {
  document.getElementById('seasonModal').classList.remove('show');
  document.getElementById('seasonForm').reset();
  editingSeasonId = null;
};

window.editSeason = (seasonId) => openSeasonModal(seasonId);

window.confirmDeleteSeason = (seasonId) => {
  const season = currentSeasons.find(s => s.id === seasonId);
  if (confirm(`¿Eliminar la temporada "${season.name}" y TODOS sus animes?`)) {
    deleteSeasonHandler(seasonId);
  }
};

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
const loadAllAnimes = async () => {
  const list = document.getElementById('animesList');
  list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
  
  currentAnimes = await getAllAnimes();
  
  if (currentAnimes.length === 0) {
    list.innerHTML = '<p class="empty-state">No hay animes creados</p>';
    return;
  }
  
  renderAnimesList(currentAnimes);
  updateAnimeSelector();
  updateCharacterAnimeSelector();
};

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
            ${anime.malId ? `<span class="meta-tag">🔗 MAL: ${anime.malId}</span>` : ''}
          </div>
        </div>
        <div class="anime-item-actions">
          <button class="btn-edit" onclick="editAnime('${anime.id}')">✏️ Editar</button>
          <button class="btn-primary" onclick="importCharactersForAnime('${anime.id}')">
            🎭 Importar Personajes
          </button>
          <button class="btn-danger" onclick="confirmDeleteAnime('${anime.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
};

window.filterAnimesBySeason = () => {
  const seasonId = document.getElementById('seasonFilter').value;
  
  if (seasonId === 'all') {
    renderAnimesList(currentAnimes);
  } else {
    const filtered = currentAnimes.filter(a => a.seasonId === seasonId);
    renderAnimesList(filtered);
  }
};

window.openAnimeModal = (animeId = null) => {
  editingAnimeId = animeId;
  const modal = document.getElementById('animeModal');
  const title = document.getElementById('animeModalTitle');
  const form = document.getElementById('animeForm');
  
  if (animeId) {
    const anime = currentAnimes.find(a => a.id === animeId);
    
    if (anime) {
      title.textContent = 'Editar Anime';
      document.getElementById('animeSeasonId').value = anime.seasonId || "";
      document.getElementById('animeTitle').value = anime.title || "";
      document.getElementById('animeCategory').value = anime.category || "new";
      document.getElementById('animeYear').value = anime.year || 2025;
      document.getElementById('animeStatus').value = anime.status || "airing";
      document.getElementById('animeOrder').value = anime.order || 1;
      document.getElementById('animeCardImage').value = anime.cardImage || "";
      document.getElementById('animePoster').value = anime.poster || "";
      document.getElementById('animeSynopsis').value = anime.synopsis || "";
      document.getElementById('animeTrailers').value = anime.trailers ? anime.trailers.join(', ') : '';
      document.getElementById('animeMalId').value = anime.malId || '';
    }
  } else {
    title.textContent = 'Nuevo Anime';
    form.reset();
    document.getElementById('animeSeasonId').value = "";
  }
  
  modal.classList.add('show');
};

window.closeAnimeModal = () => {
  document.getElementById('animeModal').classList.remove('show');
  document.getElementById('animeForm').reset();
  editingAnimeId = null;
};

window.editAnime = (animeId) => openAnimeModal(animeId);

window.confirmDeleteAnime = (animeId) => {
  const anime = currentAnimes.find(a => a.id === animeId);
  if (confirm(`¿Eliminar "${anime.title}" y TODOS sus episodios y personajes?`)) {
    deleteAnimeHandler(animeId);
  }
};

const deleteAnimeHandler = async (animeId) => {
  // Eliminar personajes primero
  await deleteCharactersByAnime(animeId);
  
  const result = await deleteAnime(animeId);
  if (result.success) {
    alert('✅ Anime eliminado correctamente');
    await loadAllAnimes();
    await loadSeasons();
  } else {
    alert('❌ Error al eliminar anime');
  }
};

// ============================================
// ✅ IMPORTAR PERSONAJES DESDE JIKAN
// ============================================
window.importCharactersForAnime = async (animeId) => {
  const anime = currentAnimes.find(a => a.id === animeId);
  
  if (!anime) {
    alert('❌ Anime no encontrado');
    return;
  }
  
  // Verificar si ya tiene personajes
  const hasChars = await hasCharacters(animeId);
  if (hasChars) {
    if (!confirm(`"${anime.title}" ya tiene personajes importados. ¿Deseas reemplazarlos?`)) {
      return;
    }
    await deleteCharactersByAnime(animeId);
  }
  
  // Si no tiene MAL ID, buscar primero
  if (!anime.malId) {
    alert('Este anime no tiene un ID de MyAnimeList vinculado. Busca el anime primero.');
    openMalSearchModal(animeId);
    return;
  }
  
  try {
    // Mostrar loading
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'importLoading';
    loadingDiv.innerHTML = `
      <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                  background: rgba(13, 2, 33, 0.95); padding: 2rem; border-radius: 12px; 
                  border: 2px solid #48cae4; z-index: 10000; text-align: center;">
        <div class="spinner" style="margin: 0 auto 1rem;"></div>
        <p style="color: #ade8f4;">Importando personajes desde MyAnimeList...</p>
      </div>
    `;
    document.body.appendChild(loadingDiv);
    
    // Obtener personajes desde Jikan
    const characters = await window.jikanService.getAnimeCharacters(anime.malId);
    
    if (characters.length === 0) {
      alert('⚠️ No se encontraron personajes para este anime');
      document.body.removeChild(loadingDiv);
      return;
    }
    
    // Preparar datos para Firebase
    const charactersToAdd = characters.map(char => ({
      name: char.name,
      image: char.image,
      role: char.role,
      animeId: animeId,
      animeTitle: anime.title,
      malId: char.malId,
      favorites: char.favorites
    }));
    
    // Guardar en Firebase
    const result = await addMultipleCharacters(charactersToAdd);
    
    document.body.removeChild(loadingDiv);
    
    if (result.success) {
      alert(`✅ ${result.count} personajes importados correctamente`);
    } else {
      alert('❌ Error al importar personajes');
    }
  } catch (error) {
    console.error('❌ Error en importación:', error);
    alert('❌ Error al importar personajes. Verifica la consola.');
    const loadingDiv = document.getElementById('importLoading');
    if (loadingDiv) document.body.removeChild(loadingDiv);
  }
};

// ============================================
// BUSCAR ANIME EN MYANIMELIST
// ============================================
window.openMalSearchModal = (animeId) => {
  const anime = currentAnimes.find(a => a.id === animeId);
  document.getElementById('malSearchQuery').value = anime.title;
  document.getElementById('malSearchResults').innerHTML = '';
  document.getElementById('malSearchModal').classList.add('show');
  document.getElementById('malSearchModal').dataset.animeId = animeId;
};

window.closeMalSearchModal = () => {
  document.getElementById('malSearchModal').classList.remove('show');
};

window.searchMal = async () => {
  const query = document.getElementById('malSearchQuery').value.trim();
  const resultsDiv = document.getElementById('malSearchResults');
  
  if (!query) {
    alert('Ingresa un nombre para buscar');
    return;
  }
  
  resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Buscando...</p></div>';
  
  try {
    const results = await window.jikanService.searchAnime(query);
    
    if (results.length === 0) {
      resultsDiv.innerHTML = '<p class="empty-state">No se encontraron resultados</p>';
      return;
    }
    
    resultsDiv.innerHTML = results.map(anime => `
      <div class="mal-result" onclick="selectMalAnime(${anime.malId}, '${anime.title}')">
        <img src="${anime.image}" alt="${anime.title}">
        <div class="mal-result-info">
          <h4>${anime.title}</h4>
          <p>${anime.titleEnglish || ''}</p>
          <small>MAL ID: ${anime.malId} • ${anime.year || 'N/A'} • ${anime.episodes || '?'} eps • ⭐ ${anime.score || 'N/A'}</small>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error en búsqueda MAL:', error);
    resultsDiv.innerHTML = '<p style="color: #ef4444;">❌ Error en la búsqueda</p>';
  }
};

window.selectMalAnime = async (malId, malTitle) => {
  const modal = document.getElementById('malSearchModal');
  const animeId = modal.dataset.animeId;
  
  if (!confirm(`¿Vincular "${malTitle}" a este anime?`)) return;
  
  // Actualizar anime con MAL ID
  await updateAnime(animeId, { malId });
  
  closeMalSearchModal();
  await loadAllAnimes();
  
  alert(`✅ Anime vinculado. Ahora puedes importar personajes.`);
};

// ============================================
// GESTIÓN DE EPISODIOS
// ============================================
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
          <button class="btn-danger" onclick="confirmDeleteEpisode('${ep.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('❌ Error al cargar episodios:', error);
    list.innerHTML = '<p class="empty-state" style="color: #ef4444;">Error al cargar episodios</p>';
  }
};

window.openEpisodeModal = () => {
  if (!selectedAnimeId) {
    alert('⚠️ Primero selecciona un anime');
    return;
  }
  
  const modal = document.getElementById('episodeModal');
  const nextEpisodeNumber = currentEpisodes.length + 1;
  document.getElementById('episodeNumber').value = nextEpisodeNumber;
  document.getElementById('episodeTitle').value = `Episodio ${nextEpisodeNumber}`;
  
  modal.classList.add('show');
};

window.closeEpisodeModal = () => {
  document.getElementById('episodeModal').classList.remove('show');
  document.getElementById('episodeForm').reset();
};

window.confirmDeleteEpisode = (episodeId) => {
  if (confirm('¿Eliminar este episodio?')) {
    deleteEpisodeHandler(episodeId);
  }
};

const deleteEpisodeHandler = async (episodeId) => {
  const result = await deleteEpisode(episodeId, selectedAnimeId);
  if (result.success) {
    alert('✅ Episodio eliminado');
    await loadEpisodesByAnime();
    await loadAllAnimes();
  } else {
    alert('❌ Error al eliminar episodio');
  }
};

// ============================================
// ✅ GESTIÓN DE PERSONAJES
// ============================================
window.loadCharacters = async () => {
  const list = document.getElementById('charactersList');
  const selector = document.getElementById('characterAnimeFilter');
  const animeId = selector.value;
  
  list.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';
  
  try {
    currentCharacters = animeId === 'all' 
      ? await getAllCharacters()
      : await getCharactersByAnime(animeId);
    
    if (currentCharacters.length === 0) {
      list.innerHTML = '<p class="empty-state">No hay personajes</p>';
      return;
    }
    
    list.innerHTML = currentCharacters.map(char => {
      const anime = currentAnimes.find(a => a.id === char.animeId);
      return `
        <div class="character-item">
          <img src="${char.image}" alt="${char.name}" class="character-image">
          <div class="character-info">
            <h4>${char.name}</h4>
            <p class="character-anime">📺 ${anime ? anime.title : 'Desconocido'}</p>
            <span class="meta-tag ${char.role === 'Main' ? 'category' : 'season'}">
              ${char.role === 'Main' ? '⭐ Principal' : '👥 Secundario'}
            </span>
          </div>
          <div class="character-actions">
            <button class="btn-danger" onclick="confirmDeleteCharacter('${char.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('❌ Error al cargar personajes:', error);
    list.innerHTML = '<p style="color: #ef4444;">Error al cargar personajes</p>';
  }
};

window.confirmDeleteCharacter = (characterId) => {
  if (confirm('¿Eliminar este personaje?')) {
    deleteCharacterHandler(characterId);
  }
};

const deleteCharacterHandler = async (characterId) => {
  const result = await deleteCharacter(characterId);
  if (result.success) {
    alert('✅ Personaje eliminado');
    await loadCharacters();
  } else {
    alert('❌ Error al eliminar personaje');
  }
};

// ============================================
// ACTUALIZAR SELECTORES
// ============================================
const updateSeasonSelectors = () => {
  const selectors = ['animeSeasonId', 'seasonFilter'];
  
  selectors.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const currentValue = select.value;
    const isFilterSelect = selectId === 'seasonFilter';
    
    select.innerHTML = isFilterSelect ? 
      '<option value="all">Todas las temporadas</option>' : 
      '<option value="">-- Selecciona temporada --</option>';
    
    currentSeasons.forEach(season => {
      const option = document.createElement('option');
      option.value = season.id;
      option.textContent = season.name;
      select.appendChild(option);
    });
    
    if (currentValue) select.value = currentValue;
  });
};

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

const updateCharacterAnimeSelector = () => {
  const select = document.getElementById('characterAnimeFilter');
  if (!select) return;
  
  select.innerHTML = '<option value="all">Todos los animes</option>';
  
  currentAnimes.forEach(anime => {
    const option = document.createElement('option');
    option.value = anime.id;
    option.textContent = anime.title;
    select.appendChild(option);
  });
};

const fillSeasonSelect = async () => {
  const select = document.getElementById('animeSeasonId');
  
  if (!select) {
    console.error('❌ No se encontró el elemento animeSeasonId');
    return;
  }
  
  if (currentSeasons.length === 0) {
    select.innerHTML = '<option value="">No hay temporadas creadas</option>';
    return;
  }

  select.innerHTML = '<option value="">-- Selecciona temporada --</option>';
  
  currentSeasons.forEach(season => {
    const option = document.createElement('option');
    option.value = season.id;
    option.textContent = season.name;
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
    
    if (editingSeasonId) {
      await window.firebaseDB.seasonsRef.doc(editingSeasonId).update(seasonData);
      alert('✅ Temporada actualizada');
    } else {
      const result = await addSeason(seasonData);
      if (result.success) alert('✅ Temporada creada');
    }
    
    closeSeasonModal();
    await loadSeasons();
    await fillSeasonSelect();
  });
  
  // Formulario de anime
  document.getElementById('animeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const seasonId = document.getElementById('animeSeasonId').value;
    
    if (!seasonId) {
      alert('⚠️ Debes seleccionar una temporada');
      return;
    }
    
    const trailersText = document.getElementById('animeTrailers').value;
    const trailers = trailersText ? trailersText.split(',').map(t => t.trim()) : [];
    
    const animeData = {
      seasonId: seasonId,
      title: document.getElementById('animeTitle').value,
      category: document.getElementById('animeCategory').value,
      year: parseInt(document.getElementById('animeYear').value),
      status: document.getElementById('animeStatus').value,
      order: parseInt(document.getElementById('animeOrder').value),
      cardImage: document.getElementById('animeCardImage').value,
      poster: document.getElementById('animePoster').value,
      synopsis: document.getElementById('animeSynopsis').value,
      trailers: trailers,
      malId: parseInt(document.getElementById('animeMalId').value) || null,
      totalEpisodes: 0
    };
    
    if (editingAnimeId) {
      await updateAnime(editingAnimeId, animeData);
      alert('✅ Anime actualizado');
    } else {
      const result = await addAnime(animeData);
      if (result.success) alert('✅ Anime creado');
    }
    
    closeAnimeModal();
    await loadAllAnimes();
    await loadSeasons();
  });
  
  // Formulario de episodio
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
    
    const result = await addEpisode(episodeData);
    
    if (result.success) {
      alert('✅ Episodio agregado correctamente');
      closeEpisodeModal();
      await loadEpisodesByAnime();
      await loadAllAnimes();
    } else {
      alert('❌ Error al agregar episodio');
    }
  });
};

console.log('🎛️ Admin Panel JS cargado con soporte de personajes');