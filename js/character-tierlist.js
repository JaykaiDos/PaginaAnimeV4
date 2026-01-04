/* ============================================
   CHARACTER TIER LIST - MEJORADO
   ✅ Con botones para mover sin arrastrar
   ✅ Soporte para móvil
   ============================================ */

// Estado de la aplicación
let allCharacters = [];
let allAnimes = [];
let currentFilter = 'all';
let tiers = [];
let draggedElement = null;
let selectedCharacter = null;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Elementos del DOM
const tiersArea = document.getElementById('tiersArea');
const characterPool = document.getElementById('characterPool');
const animeSearchInput = document.getElementById('animeSearchInput');
const animeSearchResults = document.getElementById('animeSearchResults');
const seasonFilter = document.getElementById('seasonFilter');
const addTierBtn = document.getElementById('addTierBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const characterCount = document.getElementById('characterCount');

// Estado del filtro
let selectedAnimeFilter = 'all';
let selectedSeasonFilter = 'all';

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎭 Character Tier List cargado (Versión mejorada)');
  
  if (window.firebaseService) {
    await loadSeasons();
    await loadAnimes();
    await loadCharacters();
    initializeTiers();
    loadTierListFromStorage();
    initEventListeners();
    initAnimeSearch();
    
    if (isMobile) {
      console.log('📱 Modo móvil detectado - usando sistema de botones');
    }
  } else {
    console.error('❌ Firebase Service no está disponible');
    characterPool.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 3rem;">❌ Error: Firebase no está configurado</p>';
  }
});

// ============================================
// CARGAR ANIMES Y TEMPORADAS PARA FILTRO
// ============================================
const loadAnimes = async () => {
  try {
    allAnimes = await window.firebaseService.getAllAnimes();
    console.log(`✅ ${allAnimes.length} animes cargados en filtro`);
  } catch (error) {
    console.error('❌ Error al cargar animes:', error);
  }
};

const loadSeasons = async () => {
  try {
    const seasons = await window.firebaseService.getAllSeasons();
    
    seasonFilter.innerHTML = '<option value="all">Todas las temporadas</option>';
    
    seasons.forEach(season => {
      const option = document.createElement('option');
      option.value = season.id;
      option.textContent = season.name;
      seasonFilter.appendChild(option);
    });
    
    console.log(`✅ ${seasons.length} temporadas cargadas`);
  } catch (error) {
    console.error('❌ Error al cargar temporadas:', error);
  }
};

// ============================================
// CARGAR PERSONAJES DESDE FIREBASE
// ============================================
const loadCharacters = async () => {
  characterPool.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando personajes...</p></div>';
  
  try {
    allCharacters = await window.firebaseService.getAllCharacters();
    
    console.log(`✅ ${allCharacters.length} personajes cargados`);
    
    if (allCharacters.length === 0) {
      characterPool.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #48cae480;">
          <p style="font-size: 1.2rem; margin-bottom: 1rem;">No hay personajes disponibles</p>
          <p>Ve al panel de administración para importar personajes desde MyAnimeList</p>
        </div>
      `;
      return;
    }
    
    applyFilters();
  } catch (error) {
    console.error('❌ Error al cargar personajes:', error);
    characterPool.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 3rem;">❌ Error al cargar personajes</p>';
  }
};

// ============================================
// INICIALIZAR TIERS POR DEFECTO
// ============================================
const initializeTiers = () => {
  const defaultTiers = [
    { id: 'tier-S', name: 'S', color: '#ef4444' },
    { id: 'tier-A', name: 'A', color: '#f97316' },
    { id: 'tier-B', name: 'B', color: '#facc15' },
    { id: 'tier-C', name: 'C', color: '#22c55e' },
    { id: 'tier-D', name: 'D', color: '#3b82f6' }
  ];
  
  tiers = defaultTiers;
  renderTiers();
};

// ============================================
// RENDERIZAR TIERS
// ============================================
const renderTiers = () => {
  tiersArea.innerHTML = tiers.map(tier => `
    <div class="tier-row" data-tier="${tier.name}" data-tier-id="${tier.id}">
      <div class="tier-label">
        <div class="tier-name" onclick="editTierName('${tier.id}')">${tier.name}</div>
      </div>
      <div class="tier-items" data-tier-id="${tier.id}">
        <!-- Personajes se agregarán aquí -->
      </div>
      <div class="tier-actions">
        <button class="btn btn-danger" onclick="deleteTier('${tier.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
  
  initDragAndDrop();
};

// ============================================
// ✅ SISTEMA DE BÚSQUEDA DE ANIME
// ============================================
const initAnimeSearch = () => {
  // Evento de escritura en el input
  animeSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    
    if (query.length === 0) {
      animeSearchResults.style.display = 'none';
      animeSearchResults.innerHTML = '';
      return;
    }
    
    // Filtrar animes que coincidan
    const matches = allAnimes.filter(anime => 
      anime.title.toLowerCase().includes(query)
    ).slice(0, 10); // Máximo 10 resultados
    
    if (matches.length === 0) {
      animeSearchResults.style.display = 'none';
      return;
    }
    
    // Mostrar resultados
    animeSearchResults.innerHTML = matches.map(anime => `
      <div class="search-result-item" data-anime-id="${anime.id}" onclick="selectAnimeFromSearch('${anime.id}', '${anime.title.replace(/'/g, "\\'")}')">
        <img src="${anime.cardImage || anime.poster}" alt="${anime.title}">
        <span>${anime.title}</span>
      </div>
    `).join('');
    
    animeSearchResults.style.display = 'block';
  });
  
  // Cerrar resultados al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.anime-search-container')) {
      animeSearchResults.style.display = 'none';
    }
  });
};

window.selectAnimeFromSearch = (animeId, animeTitle) => {
  selectedAnimeFilter = animeId;
  animeSearchInput.value = animeTitle;
  animeSearchResults.style.display = 'none';
  applyFilters();
};

window.clearAnimeSearch = () => {
  selectedAnimeFilter = 'all';
  animeSearchInput.value = '';
  animeSearchResults.style.display = 'none';
  applyFilters();
};

// ============================================
// APLICAR FILTROS COMBINADOS
// ============================================
const applyFilters = () => {
  let filteredCharacters = allCharacters;
  
  // Filtro por anime específico
  if (selectedAnimeFilter !== 'all') {
    filteredCharacters = filteredCharacters.filter(char => char.animeId === selectedAnimeFilter);
  }
  
  // Filtro por temporada
  if (selectedSeasonFilter !== 'all') {
    const animeIdsInSeason = allAnimes
      .filter(anime => anime.seasonId === selectedSeasonFilter)
      .map(anime => anime.id);
    
    filteredCharacters = filteredCharacters.filter(char => 
      animeIdsInSeason.includes(char.animeId)
    );
  }
  
  // Filtrar personajes que ya están en tiers
  const charactersInTiers = new Set();
  document.querySelectorAll('.tier-items .anime-card').forEach(card => {
    charactersInTiers.add(card.dataset.characterId);
  });
  
  filteredCharacters = filteredCharacters.filter(char => !charactersInTiers.has(char.id));
  
  // Actualizar contador
  characterCount.textContent = `${filteredCharacters.length} personajes disponibles`;
  
  if (filteredCharacters.length === 0) {
    characterPool.innerHTML = '<p style="color: #48cae460; text-align: center; padding: 3rem; font-style: italic;">No hay personajes disponibles con estos filtros</p>';
    return;
  }
  
  characterPool.innerHTML = filteredCharacters.map(char => createCharacterCard(char)).join('');
  initDragAndDrop();
};

// ============================================
// CREAR TARJETA DE PERSONAJE - MEJORADA
// ============================================
const createCharacterCard = (character) => {
  const anime = allAnimes.find(a => a.id === character.animeId);
  const animeTitle = anime ? anime.title : 'Desconocido';
  
  return `
    <div class="anime-card character-card ${isMobile ? 'mobile' : ''}" 
         draggable="${!isMobile}" 
         data-character-id="${character.id}" 
         data-character-name="${character.name}"
         data-anime-title="${animeTitle}"
         onclick="${isMobile ? `selectCharacter('${character.id}')` : ''}">
      <img src="${character.image}" alt="${character.name}" onerror="this.src='https://via.placeholder.com/110x150?text=No+Image'">
      <div class="anime-card-title">${character.name}</div>
      ${!isMobile ? `
        <div class="anime-card-actions">
          ${tiers.map(tier => `
            <button class="quick-action-btn" 
                    onclick="event.stopPropagation(); moveToTier('${character.id}', '${tier.id}')"
                    title="Mover a ${tier.name}">
              ${tier.name}
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
};

// ============================================
// ✅ SISTEMA DE SELECCIÓN PARA MÓVIL
// ============================================
window.selectCharacter = (characterId) => {
  if (!isMobile) return;
  
  // Deseleccionar anterior
  if (selectedCharacter) {
    const prevCard = document.querySelector(`[data-character-id="${selectedCharacter}"]`);
    if (prevCard) prevCard.classList.remove('selected');
  }
  
  // Seleccionar nuevo
  if (selectedCharacter === characterId) {
    selectedCharacter = null;
    hideSelectionIndicator();
  } else {
    selectedCharacter = characterId;
    const card = document.querySelector(`[data-character-id="${characterId}"]`);
    if (card) card.classList.add('selected');
    showSelectionIndicator();
  }
};

const showSelectionIndicator = () => {
  let indicator = document.querySelector('.selection-mode-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'selection-mode-indicator';
    indicator.innerHTML = `
      <span>Selecciona una tier:</span>
      ${tiers.map(tier => `
        <button onclick="moveSelectedToTier('${tier.id}')">${tier.name}</button>
      `).join('')}
      <button onclick="cancelSelection()" style="background: #ef4444; color: #fff;">❌</button>
    `;
    document.body.appendChild(indicator);
  }
  indicator.classList.add('active');
};

const hideSelectionIndicator = () => {
  const indicator = document.querySelector('.selection-mode-indicator');
  if (indicator) {
    indicator.classList.remove('active');
  }
};

window.moveSelectedToTier = (tierId) => {
  if (!selectedCharacter) return;
  
  moveToTier(selectedCharacter, tierId);
  cancelSelection();
};

window.cancelSelection = () => {
  if (selectedCharacter) {
    const card = document.querySelector(`[data-character-id="${selectedCharacter}"]`);
    if (card) card.classList.remove('selected');
  }
  selectedCharacter = null;
  hideSelectionIndicator();
};

// ============================================
// ✅ MOVER PERSONAJE A TIER (SIN ARRASTRAR)
// ============================================
window.moveToTier = (characterId, tierId) => {
  const characterCard = document.querySelector(`[data-character-id="${characterId}"]`);
  if (!characterCard) {
    console.error('Personaje no encontrado:', characterId);
    return;
  }
  
  const tierContainer = document.querySelector(`.tier-items[data-tier-id="${tierId}"]`);
  if (!tierContainer) {
    console.error('Tier no encontrada:', tierId);
    return;
  }
  
  // Remover botones de acción antes de mover
  const actions = characterCard.querySelector('.anime-card-actions');
  if (actions) actions.remove();
  
  // Mover a la tier
  tierContainer.appendChild(characterCard);
  
  // Actualizar UI
  applyFilters();
  saveTierListToStorage();
  
  console.log(`✅ Personaje movido a tier ${tierId}`);
};

// ============================================
// DRAG & DROP (SOLO DESKTOP)
// ============================================
const initDragAndDrop = () => {
  if (isMobile) return; // No inicializar drag & drop en móvil
  
  const draggables = document.querySelectorAll('.anime-card');
  
  draggables.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
  });
  
  const dropZones = [...document.querySelectorAll('.tier-items'), characterPool];
  
  dropZones.forEach(zone => {
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('dragleave', handleDragLeave);
    zone.addEventListener('drop', handleDrop);
  });
};

const handleDragStart = (e) => {
  draggedElement = e.target.closest('.anime-card');
  draggedElement.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', draggedElement.innerHTML);
};

const handleDragEnd = (e) => {
  draggedElement.classList.remove('dragging');
  draggedElement = null;
};

const handleDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
};

const handleDragLeave = (e) => {
  e.currentTarget.classList.remove('drag-over');
};

const handleDrop = (e) => {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  if (!draggedElement) return;
  
  // Remover botones de acción antes de mover
  const actions = draggedElement.querySelector('.anime-card-actions');
  if (actions) actions.remove();
  
  e.currentTarget.appendChild(draggedElement);
  
  applyFilters();
  saveTierListToStorage();
};

// ============================================
// EDITAR NOMBRE DE TIER
// ============================================
window.editTierName = (tierId) => {
  const tier = tiers.find(t => t.id === tierId);
  if (!tier) return;
  
  const newName = prompt('Nuevo nombre para la tier:', tier.name);
  
  if (newName && newName.trim() !== '') {
    tier.name = newName.trim();
    
    const tierRow = document.querySelector(`[data-tier-id="${tierId}"]`);
    const tierNameElement = tierRow.querySelector('.tier-name');
    tierNameElement.textContent = tier.name;
    tierRow.dataset.tier = tier.name;
    
    saveTierListToStorage();
  }
};

// ============================================
// AGREGAR NUEVA TIER
// ============================================
window.addNewTier = () => {
  const tierName = prompt('Nombre de la nueva tier:', 'Nueva Tier');
  
  if (!tierName || tierName.trim() === '') return;
  
  const newTier = {
    id: `tier-${Date.now()}`,
    name: tierName.trim(),
    color: '#48cae4'
  };
  
  tiers.push(newTier);
  renderTiers();
  saveTierListToStorage();
  
  console.log('✅ Nueva tier agregada:', newTier.name);
};

// ============================================
// ELIMINAR TIER
// ============================================
window.deleteTier = (tierId) => {
  if (tiers.length <= 1) {
    alert('⚠️ Debes tener al menos una tier');
    return;
  }
  
  const tier = tiers.find(t => t.id === tierId);
  
  if (!confirm(`¿Eliminar la tier "${tier.name}"? Los personajes volverán al banco.`)) {
    return;
  }
  
  const tierElement = document.querySelector(`[data-tier-id="${tierId}"]`);
  const tierItems = tierElement.querySelector('.tier-items');
  const characterCards = tierItems.querySelectorAll('.anime-card');
  
  characterCards.forEach(card => {
    characterPool.appendChild(card);
  });
  
  tiers = tiers.filter(t => t.id !== tierId);
  
  renderTiers();
  applyFilters();
  saveTierListToStorage();
  
  console.log('✅ Tier eliminada:', tier.name);
};

// ============================================
// REINICIAR TIER LIST
// ============================================
window.resetTierList = () => {
  if (!confirm('¿Reiniciar el Tier List? Se perderán todos los cambios.')) {
    return;
  }
  
  document.querySelectorAll('.tier-items .anime-card').forEach(card => {
    characterPool.appendChild(card);
  });
  
  initializeTiers();
  applyFilters();
  
  localStorage.removeItem('character_tierlist_state');
  localStorage.removeItem('character_tierlist_tiers');
  
  console.log('✅ Character Tier List reiniciado');
};

// ============================================
// GUARDAR EN LOCALSTORAGE
// ============================================
const saveTierListToStorage = () => {
  try {
    localStorage.setItem('character_tierlist_tiers', JSON.stringify(tiers));
    
    const tierState = {};
    
    document.querySelectorAll('.tier-items').forEach(tierContainer => {
      const tierId = tierContainer.dataset.tierId;
      const characterIds = Array.from(tierContainer.querySelectorAll('.anime-card'))
        .map(card => card.dataset.characterId);
      
      tierState[tierId] = characterIds;
    });
    
    localStorage.setItem('character_tierlist_state', JSON.stringify(tierState));
    
    console.log('💾 Character Tier List guardado');
  } catch (error) {
    console.error('❌ Error al guardar:', error);
  }
};

// ============================================
// CARGAR DESDE LOCALSTORAGE
// ============================================
const loadTierListFromStorage = () => {
  try {
    const savedTiers = localStorage.getItem('character_tierlist_tiers');
    if (savedTiers) {
      tiers = JSON.parse(savedTiers);
      renderTiers();
    }
    
    const savedState = localStorage.getItem('character_tierlist_state');
    if (savedState) {
      const tierState = JSON.parse(savedState);
      
      Object.keys(tierState).forEach(tierId => {
        const tierContainer = document.querySelector(`.tier-items[data-tier-id="${tierId}"]`);
        if (!tierContainer) return;
        
        tierState[tierId].forEach(characterId => {
          const characterCard = document.querySelector(`.anime-card[data-character-id="${characterId}"]`);
          if (characterCard) {
            // Remover botones de acción antes de mover
            const actions = characterCard.querySelector('.anime-card-actions');
            if (actions) actions.remove();
            
            tierContainer.appendChild(characterCard);
          }
        });
      });
      
      // Actualizar pool después de mover personajes
      applyFilters();
      
      console.log('✅ Character Tier List cargado desde storage');
    }
  } catch (error) {
    console.error('❌ Error al cargar:', error);
  }
};

// ============================================
// EXPORTAR COMO IMAGEN
// ============================================
window.exportTierList = async () => {
  try {
    document.querySelectorAll('.tier-actions').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.anime-card-actions').forEach(el => el.style.display = 'none');
    
    const element = tiersArea;
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#0d0221',
      scale: 2,
      logging: false,
      useCORS: true
    });
    
    document.querySelectorAll('.tier-actions').forEach(el => el.style.display = '');
    document.querySelectorAll('.anime-card-actions').forEach(el => el.style.display = '');
    
    const link = document.createElement('a');
    link.download = `character-tierlist-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    console.log('📸 Character Tier List exportado como imagen');
  } catch (error) {
    console.error('❌ Error al exportar:', error);
    alert('❌ Error al exportar imagen. Intenta nuevamente.');
  }
};

// ============================================
// EVENT LISTENERS
// ============================================
const initEventListeners = () => {
  // Filtro de temporada
  seasonFilter.addEventListener('change', (e) => {
    selectedSeasonFilter = e.target.value;
    applyFilters();
  });
  
  addTierBtn.addEventListener('click', addNewTier);
  resetBtn.addEventListener('click', resetTierList);
  exportBtn.addEventListener('click', exportTierList);
};

console.log(`
╔═══════════════════════════════════════════╗
║   🎭 CHARACTER TIER LIST 🎭 (MEJORADO)   ║
║   ✅ Sistema de botones                  ║
║   ✅ Soporte móvil                       ║
║   ✅ Tamaños optimizados                 ║
║   🔥 Conectado a Firebase                ║
║   📚 Datos de MyAnimeList                ║
║   Hecho por: Jaykai2                     ║
╚═══════════════════════════════════════════╝
`);