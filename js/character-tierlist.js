/* ============================================
   CHARACTER TIER LIST - MEJORADO
   ✅ Personalización de colores de texto
   ✅ Botones con primera letra
   ✅ Textos largos con wrap correcto
   ✅ Búsqueda de anime integrada
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

// ✅ PALETA DE COLORES PREDEFINIDOS
const COLOR_PALETTE = [
  { name: 'Rojo Neón', value: '#ff6b6b', shadow: '#ff6b6b' },
  { name: 'Naranja', value: '#ffa94d', shadow: '#ffa94d' },
  { name: 'Amarillo', value: '#ffd43b', shadow: '#ffd43b' },
  { name: 'Verde Neón', value: '#51cf66', shadow: '#51cf66' },
  { name: 'Cyan', value: '#48cae4', shadow: '#48cae4' },
  { name: 'Azul', value: '#5c7cfa', shadow: '#5c7cfa' },
  { name: 'Morado', value: '#cc5de8', shadow: '#cc5de8' },
  { name: 'Rosa', value: '#ff6ac1', shadow: '#ff6ac1' }
];

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
    { id: 'tier-S', name: 'S', color: '#fca5a5', bgColor: 'rgba(239, 68, 68, 0.3)' },
    { id: 'tier-A', name: 'A', color: '#fdba74', bgColor: 'rgba(251, 146, 60, 0.3)' },
    { id: 'tier-B', name: 'B', color: '#fde047', bgColor: 'rgba(250, 204, 21, 0.3)' },
    { id: 'tier-C', name: 'C', color: '#86efac', bgColor: 'rgba(34, 197, 94, 0.3)' },
    { id: 'tier-D', name: 'D', color: '#93c5fd', bgColor: 'rgba(59, 130, 246, 0.3)' }
  ];
  
  tiers = defaultTiers;
  renderTiers();
};

// ============================================
// ✅ RENDERIZAR TIERS CON COLORES PERSONALIZADOS
// ============================================
const renderTiers = () => {
  tiersArea.innerHTML = tiers.map(tier => `
    <div class="tier-row" data-tier="${tier.name}" data-tier-id="${tier.id}">
      <div class="tier-label" style="background: linear-gradient(135deg, ${tier.bgColor || 'rgba(72, 202, 228, 0.2)'} 0%, rgba(0, 180, 216, 0.1) 100%);">
        <div class="tier-name" 
             onclick="openEditTierModal('${tier.id}')"
             style="color: ${tier.color || '#fff'}; text-shadow: 0 0 15px ${tier.color || '#48cae4'}; word-wrap: break-word; word-break: break-word; line-height: 1.2; max-width: 100%; text-align: center;">
          ${tier.name}
        </div>
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
// ✅ ABRIR MODAL PARA EDITAR TIER
// ============================================
window.openEditTierModal = (tierId) => {
  const tier = tiers.find(t => t.id === tierId);
  if (!tier) return;
  
  const modal = document.createElement('div');
  modal.className = 'tier-edit-modal';
  modal.id = 'tierEditModal';
  modal.innerHTML = `
    <div class="tier-edit-modal-content">
      <div class="tier-edit-header">
        <h3>✏️ Editar Tier</h3>
        <button class="btn-close-modal" onclick="closeTierEditModal()">✕</button>
      </div>
      
      <div class="tier-edit-body">
        <div class="form-group">
          <label>Nombre de la Tier:</label>
          <input type="text" id="tierNameInput" value="${tier.name}" maxlength="30" placeholder="Ej: Mejores Personajes 🎭">
          <small>Máximo 30 caracteres</small>
        </div>
        
        <div class="form-group">
          <label>Color del texto:</label>
          <div class="color-palette">
            ${COLOR_PALETTE.map(c => `
              <div class="color-option ${tier.color === c.value ? 'selected' : ''}" 
                   data-color="${c.value}" 
                   data-shadow="${c.shadow}"
                   onclick="selectTierColor('${c.value}', '${c.shadow}')"
                   style="background: ${c.value};"
                   title="${c.name}">
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      
      <div class="tier-edit-footer">
        <button class="btn btn-secondary" onclick="closeTierEditModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="saveTierEdit('${tierId}')">💾 Guardar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  setTimeout(() => modal.classList.add('show'), 10);
  
  window.tempTierColor = tier.color || '#fff';
  window.tempTierShadow = tier.color || '#48cae4';
};

// ============================================
// ✅ SELECCIONAR COLOR
// ============================================
window.selectTierColor = (color, shadow) => {
  window.tempTierColor = color;
  window.tempTierShadow = shadow;
  
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.remove('selected');
  });
  
  document.querySelector(`[data-color="${color}"]`).classList.add('selected');
};

// ============================================
// ✅ GUARDAR EDICIÓN DE TIER
// ============================================
window.saveTierEdit = (tierId) => {
  const newName = document.getElementById('tierNameInput').value.trim();
  
  if (!newName) {
    alert('⚠️ El nombre no puede estar vacío');
    return;
  }
  
  const tier = tiers.find(t => t.id === tierId);
  if (!tier) return;
  
  tier.name = newName;
  tier.color = window.tempTierColor || '#fff';
  
  const rgb = hexToRgb(tier.color);
  tier.bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
  
  renderTiers();
  saveTierListToStorage();
  closeTierEditModal();
  
  console.log('✅ Tier actualizada:', tier.name);
};

// ============================================
// ✅ CERRAR MODAL
// ============================================
window.closeTierEditModal = () => {
  const modal = document.getElementById('tierEditModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  }
};

// ============================================
// ✅ HELPER: Convertir HEX a RGB
// ============================================
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 72, g: 202, b: 228 };
};

// ============================================
// ✅ SISTEMA DE BÚSQUEDA DE ANIME
// ============================================
const initAnimeSearch = () => {
  animeSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    
    if (query.length === 0) {
      animeSearchResults.style.display = 'none';
      animeSearchResults.innerHTML = '';
      return;
    }
    
    const matches = allAnimes.filter(anime => 
      anime.title.toLowerCase().includes(query)
    ).slice(0, 10);
    
    if (matches.length === 0) {
      animeSearchResults.style.display = 'none';
      return;
    }
    
    animeSearchResults.innerHTML = matches.map(anime => `
      <div class="search-result-item" data-anime-id="${anime.id}" onclick="selectAnimeFromSearch('${anime.id}', '${anime.title.replace(/'/g, "\\'")}')">
        <img src="${anime.cardImage || anime.poster}" alt="${anime.title}">
        <span>${anime.title}</span>
      </div>
    `).join('');
    
    animeSearchResults.style.display = 'block';
  });
  
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
  
  if (selectedAnimeFilter !== 'all') {
    filteredCharacters = filteredCharacters.filter(char => char.animeId === selectedAnimeFilter);
  }
  
  if (selectedSeasonFilter !== 'all') {
    const animeIdsInSeason = allAnimes
      .filter(anime => anime.seasonId === selectedSeasonFilter)
      .map(anime => anime.id);
    
    filteredCharacters = filteredCharacters.filter(char => 
      animeIdsInSeason.includes(char.animeId)
    );
  }
  
  const charactersInTiers = new Set();
  document.querySelectorAll('.tier-items .anime-card').forEach(card => {
    charactersInTiers.add(card.dataset.characterId);
  });
  
  filteredCharacters = filteredCharacters.filter(char => !charactersInTiers.has(char.id));
  
  characterCount.textContent = `${filteredCharacters.length} personajes disponibles`;
  
  if (filteredCharacters.length === 0) {
    characterPool.innerHTML = '<p style="color: #48cae460; text-align: center; padding: 3rem; font-style: italic;">No hay personajes disponibles con estos filtros</p>';
    return;
  }
  
  characterPool.innerHTML = filteredCharacters.map(char => createCharacterCard(char)).join('');
  initDragAndDrop();
};

// ============================================
// ✅ CREAR TARJETA DE PERSONAJE CON PRIMERA LETRA
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
          ${tiers.map((tier, index) => {
            const label = tier.name.charAt(0).toUpperCase();
            return `
              <button class="quick-action-btn" 
                      onclick="event.stopPropagation(); moveToTier('${character.id}', '${tier.id}')"
                      title="Mover a ${tier.name}">
                ${label}
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `;
};

// ============================================
// MOVER PERSONAJE A TIER
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
  
  const actions = characterCard.querySelector('.anime-card-actions');
  if (actions) actions.remove();
  
  tierContainer.appendChild(characterCard);
  
  applyFilters();
  saveTierListToStorage();
  
  console.log(`✅ Personaje movido a tier ${tierId}`);
};

// ============================================
// SISTEMA DE SELECCIÓN PARA MÓVIL
// ============================================
window.selectCharacter = (characterId) => {
  if (!isMobile) return;
  
  if (selectedCharacter) {
    const prevCard = document.querySelector(`[data-character-id="${selectedCharacter}"]`);
    if (prevCard) prevCard.classList.remove('selected');
  }
  
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
      ${tiers.map(tier => {
        const label = tier.name.charAt(0).toUpperCase();
        return `<button onclick="moveSelectedToTier('${tier.id}')">${label}</button>`;
      }).join('')}
      <button onclick="cancelSelection()" style="background: #ef4444; color: #fff;">✕</button>
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
// DRAG & DROP (SOLO DESKTOP)
// ============================================
const initDragAndDrop = () => {
  if (isMobile) return;
  
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
  
  const actions = draggedElement.querySelector('.anime-card-actions');
  if (actions) actions.remove();
  
  e.currentTarget.appendChild(draggedElement);
  
  applyFilters();
  saveTierListToStorage();
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
    color: '#48cae4',
    bgColor: 'rgba(72, 202, 228, 0.3)'
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
            const actions = characterCard.querySelector('.anime-card-actions');
            if (actions) actions.remove();
            
            tierContainer.appendChild(characterCard);
          }
        });
      });
      
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
    let titleText = 'Personajes';
    
    if (selectedAnimeFilter !== 'all') {
      const anime = allAnimes.find(a => a.id === selectedAnimeFilter);
      titleText = anime ? anime.title : 'Personajes';
    } else if (selectedSeasonFilter !== 'all') {
      const seasonSelect = document.getElementById('seasonFilter');
      const selectedOption = seasonSelect.options[seasonSelect.selectedIndex];
      titleText = selectedOption.textContent;
    } else {
      titleText = 'Todos los Personajes';
    }
    
    const titleHeader = document.createElement('div');
    titleHeader.id = 'export-title-header';
    titleHeader.style.cssText = `
      background: linear-gradient(135deg, rgba(13, 2, 33, 0.95) 0%, rgba(38, 23, 94, 0.9) 100%);
      border: 3px solid #48cae4;
      border-radius: 16px 16px 0 0;
      padding: 1.5rem;
      text-align: center;
      margin-bottom: -2px;
    `;
    titleHeader.innerHTML = `
      <h1 style="
        font-family: 'Roboto Mono', monospace;
        font-size: 2rem;
        font-weight: 700;
        color: #caf0f8;
        text-shadow: 0 0 15px #48cae4, 0 0 30px #00b4d8;
        margin: 0;
        letter-spacing: 0.1em;
      ">🎭 TIER LIST DE PERSONAJES 🎭</h1>
      <p style="
        font-family: 'Roboto Mono', monospace;
        font-size: 1.2rem;
        color: #6ee7b7;
        text-shadow: 0 0 10px #34d399;
        margin: 0.5rem 0 0 0;
        font-weight: 700;
      ">${titleText}</p>
    `;
    
    const tiersArea = document.getElementById('tiersArea');
    tiersArea.parentNode.insertBefore(titleHeader, tiersArea);
    
    const exportContainer = document.createElement('div');
    exportContainer.style.cssText = `
      background: #0d0221;
      padding: 2rem;
      border-radius: 16px;
    `;
    exportContainer.appendChild(titleHeader.cloneNode(true));
    exportContainer.appendChild(tiersArea.cloneNode(true));
    
    exportContainer.style.position = 'absolute';
    exportContainer.style.left = '-9999px';
    document.body.appendChild(exportContainer);
    
    document.querySelectorAll('.tier-actions').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.anime-card-actions').forEach(el => el.style.display = 'none');
    exportContainer.querySelectorAll('.tier-actions').forEach(el => el.style.display = 'none');
    exportContainer.querySelectorAll('.anime-card-actions').forEach(el => el.style.display = 'none');
    
    const canvas = await html2canvas(exportContainer, {
      backgroundColor: '#0d0221',
      scale: 2,
      logging: false,
      useCORS: true,
      width: exportContainer.scrollWidth,
      height: exportContainer.scrollHeight
    });
    
    document.querySelectorAll('.tier-actions').forEach(el => el.style.display = '');
    document.querySelectorAll('.anime-card-actions').forEach(el => el.style.display = '');
    
    document.body.removeChild(exportContainer);
    titleHeader.remove();
    
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0,10);
    const filename = `character-tierlist-${titleText.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.png`;
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    console.log('📸 Character Tier List exportado con título:', titleText);
    
  } catch (error) {
    console.error('❌ Error al exportar:', error);
    alert('❌ Error al exportar imagen. Intenta nuevamente.');
    
    const titleHeader = document.getElementById('export-title-header');
    if (titleHeader) titleHeader.remove();
    
    document.querySelectorAll('.tier-actions').forEach(el => el.style.display = '');
    document.querySelectorAll('.anime-card-actions').forEach(el => el.style.display = '');
  }
};

// ============================================
// EVENT LISTENERS
// ============================================
const initEventListeners = () => {
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
║   ✅ Colores personalizables             ║
║   ✅ Botones con primera letra           ║
║   ✅ Textos largos con wrap              ║
║   🔥 Conectado a Firebase                ║
║   📚 Datos de MyAnimeList                ║
║   Hecho por: Jaykai2                     ║
╚═══════════════════════════════════════════╝
`);