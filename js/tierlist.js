/* ============================================
   ANIME TIER LIST - MEJORADO
   ✅ Personalización de colores de texto
   ✅ Botones con primera letra
   ✅ Textos largos con wrap correcto
   ============================================ */

// Estado de la aplicación
let allAnimes = [];
let currentFilter = 'all';
let tiers = [];
let draggedElement = null;
let selectedAnime = null;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Elementos del DOM
const tiersArea = document.getElementById('tiersArea');
const animePool = document.getElementById('animePool');
const seasonFilter = document.getElementById('seasonFilter');
const addTierBtn = document.getElementById('addTierBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const animeCount = document.getElementById('animeCount');

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
  console.log('🏆 Tier List cargado (Versión mejorada)');
  
  if (window.firebaseService) {
    await loadSeasons();
    await loadAnimes();
    initializeTiers();
    loadTierListFromStorage();
    initEventListeners();
    
    if (isMobile) {
      console.log('📱 Modo móvil detectado - usando sistema de botones');
    }
  } else {
    console.error('❌ Firebase Service no está disponible');
    animePool.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 3rem;">❌ Error: Firebase no está configurado</p>';
  }
});

// ============================================
// CARGAR TEMPORADAS PARA FILTRO
// ============================================
const loadSeasons = async () => {
  try {
    const seasons = await window.firebaseService.getAllSeasons();
    
    seasonFilter.innerHTML = '<option value="all">Todos los animes</option>';
    
    seasons.forEach(season => {
      const option = document.createElement('option');
      option.value = season.id;
      option.textContent = season.name;
      seasonFilter.appendChild(option);
    });
    
    console.log(`✅ ${seasons.length} temporadas cargadas en filtro`);
  } catch (error) {
    console.error('❌ Error al cargar temporadas:', error);
  }
};

// ============================================
// CARGAR ANIMES DESDE FIREBASE
// ============================================
const loadAnimes = async () => {
  animePool.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando animes...</p></div>';
  
  try {
    const animes = await window.firebaseService.getAllAnimes();
    
    allAnimes = animes.map(anime => ({
      id: anime.id,
      title: anime.title,
      image: anime.cardImage || anime.poster,
      seasonId: anime.seasonId
    }));
    
    console.log(`✅ ${allAnimes.length} animes cargados`);
    
    renderAnimePool();
  } catch (error) {
    console.error('❌ Error al cargar animes:', error);
    animePool.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 3rem;">❌ Error al cargar animes</p>';
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
        <!-- Animes se agregarán aquí -->
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
  
  // Crear modal
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
          <input type="text" id="tierNameInput" value="${tier.name}" maxlength="30" placeholder="Ej: Mejor Anime 🏆">
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
  
  // Guardar color seleccionado temporalmente
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
  
  // Calcular bgColor basado en el color seleccionado
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
// RENDERIZAR ANIME POOL
// ============================================
const renderAnimePool = () => {
  let filteredAnimes = allAnimes;
  
  if (currentFilter !== 'all') {
    filteredAnimes = allAnimes.filter(anime => anime.seasonId === currentFilter);
  }
  
  const animesInTiers = new Set();
  document.querySelectorAll('.tier-items .anime-card').forEach(card => {
    animesInTiers.add(card.dataset.animeId);
  });
  
  filteredAnimes = filteredAnimes.filter(anime => !animesInTiers.has(anime.id));
  
  animeCount.textContent = `${filteredAnimes.length} animes disponibles`;
  
  if (filteredAnimes.length === 0) {
    animePool.innerHTML = '<p style="color: #48cae460; text-align: center; padding: 3rem; font-style: italic;">No hay animes disponibles</p>';
    return;
  }
  
  animePool.innerHTML = filteredAnimes.map(anime => createAnimeCard(anime)).join('');
  
  initDragAndDrop();
};

// ============================================
// ✅ CREAR TARJETA DE ANIME CON PRIMERA LETRA
// ============================================
const createAnimeCard = (anime) => {
  return `
    <div class="anime-card ${isMobile ? 'mobile' : ''}" 
         draggable="${!isMobile}" 
         data-anime-id="${anime.id}" 
         data-anime-title="${anime.title}"
         onclick="${isMobile ? `selectAnime('${anime.id}')` : ''}">
      <img src="${anime.image}" alt="${anime.title}" onerror="this.src='https://via.placeholder.com/110x150?text=No+Image'">
      <div class="anime-card-title">${anime.title}</div>
      ${!isMobile ? `
        <div class="anime-card-actions">
          ${tiers.map((tier, index) => {
            const label = tier.name.charAt(0).toUpperCase(); // ✅ Primera letra
            return `
              <button class="quick-action-btn" 
                      onclick="event.stopPropagation(); moveToTier('${anime.id}', '${tier.id}')"
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
// MOVER ANIME A TIER
// ============================================
window.moveToTier = (animeId, tierId) => {
  const animeCard = document.querySelector(`[data-anime-id="${animeId}"]`);
  if (!animeCard) {
    console.error('Anime no encontrado:', animeId);
    return;
  }
  
  const tierContainer = document.querySelector(`.tier-items[data-tier-id="${tierId}"]`);
  if (!tierContainer) {
    console.error('Tier no encontrada:', tierId);
    return;
  }
  
  const actions = animeCard.querySelector('.anime-card-actions');
  if (actions) actions.remove();
  
  tierContainer.appendChild(animeCard);
  
  renderAnimePool();
  saveTierListToStorage();
  
  console.log(`✅ Anime movido a tier ${tierId}`);
};

// ============================================
// SISTEMA DE SELECCIÓN PARA MÓVIL
// ============================================
window.selectAnime = (animeId) => {
  if (!isMobile) return;
  
  if (selectedAnime) {
    const prevCard = document.querySelector(`[data-anime-id="${selectedAnime}"]`);
    if (prevCard) prevCard.classList.remove('selected');
  }
  
  if (selectedAnime === animeId) {
    selectedAnime = null;
    hideSelectionIndicator();
  } else {
    selectedAnime = animeId;
    const card = document.querySelector(`[data-anime-id="${animeId}"]`);
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
  if (!selectedAnime) return;
  
  moveToTier(selectedAnime, tierId);
  cancelSelection();
};

window.cancelSelection = () => {
  if (selectedAnime) {
    const card = document.querySelector(`[data-anime-id="${selectedAnime}"]`);
    if (card) card.classList.remove('selected');
  }
  selectedAnime = null;
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
  
  const dropZones = [...document.querySelectorAll('.tier-items'), animePool];
  
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
  
  renderAnimePool();
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
  
  if (!confirm(`¿Eliminar la tier "${tier.name}"? Los animes volverán al banco.`)) {
    return;
  }
  
  const tierElement = document.querySelector(`[data-tier-id="${tierId}"]`);
  const tierItems = tierElement.querySelector('.tier-items');
  const animeCards = tierItems.querySelectorAll('.anime-card');
  
  animeCards.forEach(card => {
    animePool.appendChild(card);
  });
  
  tiers = tiers.filter(t => t.id !== tierId);
  
  renderTiers();
  renderAnimePool();
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
    animePool.appendChild(card);
  });
  
  initializeTiers();
  renderAnimePool();
  
  localStorage.removeItem('tierlist_state');
  localStorage.removeItem('tierlist_tiers');
  
  console.log('✅ Tier List reiniciado');
};

// ============================================
// GUARDAR EN LOCALSTORAGE
// ============================================
const saveTierListToStorage = () => {
  try {
    localStorage.setItem('tierlist_tiers', JSON.stringify(tiers));
    
    const tierState = {};
    
    document.querySelectorAll('.tier-items').forEach(tierContainer => {
      const tierId = tierContainer.dataset.tierId;
      const animeIds = Array.from(tierContainer.querySelectorAll('.anime-card'))
        .map(card => card.dataset.animeId);
      
      tierState[tierId] = animeIds;
    });
    
    localStorage.setItem('tierlist_state', JSON.stringify(tierState));
    
    console.log('💾 Tier List guardado');
  } catch (error) {
    console.error('❌ Error al guardar:', error);
  }
};

// ============================================
// CARGAR DESDE LOCALSTORAGE
// ============================================
const loadTierListFromStorage = () => {
  try {
    const savedTiers = localStorage.getItem('tierlist_tiers');
    if (savedTiers) {
      tiers = JSON.parse(savedTiers);
      renderTiers();
    }
    
    const savedState = localStorage.getItem('tierlist_state');
    if (savedState) {
      const tierState = JSON.parse(savedState);
      
      Object.keys(tierState).forEach(tierId => {
        const tierContainer = document.querySelector(`.tier-items[data-tier-id="${tierId}"]`);
        if (!tierContainer) return;
        
        tierState[tierId].forEach(animeId => {
          const animeCard = document.querySelector(`.anime-card[data-anime-id="${animeId}"]`);
          if (animeCard) {
            const actions = animeCard.querySelector('.anime-card-actions');
            if (actions) actions.remove();
            
            tierContainer.appendChild(animeCard);
          }
        });
      });
      
      renderAnimePool();
      
      console.log('✅ Tier List cargado desde storage');
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
    const seasonFilter = document.getElementById('seasonFilter');
    const selectedSeasonId = seasonFilter.value;
    let titleText = 'Todos los Animes';
    
    if (selectedSeasonId !== 'all') {
      const selectedOption = seasonFilter.options[seasonFilter.selectedIndex];
      titleText = selectedOption.textContent;
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
      ">🏆 TIER LIST 🏆</h1>
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
    const filename = `tierlist-${titleText.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.png`;
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    console.log('📸 Tier List exportado con título:', titleText);
    
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
    currentFilter = e.target.value;
    renderAnimePool();
  });
  
  addTierBtn.addEventListener('click', addNewTier);
  resetBtn.addEventListener('click', resetTierList);
  exportBtn.addEventListener('click', exportTierList);
};

console.log(`
╔═══════════════════════════════════════════╗
║   🏆 TIER LIST CREATOR 🏆 (MEJORADO)     ║
║   ✅ Colores personalizables             ║
║   ✅ Botones con primera letra           ║
║   ✅ Textos largos con wrap              ║
║   🔥 Conectado a Firebase                ║
║   Hecho por: Jaykai2                     ║
╚═══════════════════════════════════════════╝
`);