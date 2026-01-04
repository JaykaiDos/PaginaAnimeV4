/* ============================================
   TIER LIST - JAVASCRIPT
   Autor: Jaykai2
   ============================================ */

// Estado de la aplicación
let allAnimes = [];
let currentFilter = 'all';
let tiers = [];
let draggedElement = null;

// Elementos del DOM
const tiersArea = document.getElementById('tiersArea');
const animePool = document.getElementById('animePool');
const seasonFilter = document.getElementById('seasonFilter');
const addTierBtn = document.getElementById('addTierBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const animeCount = document.getElementById('animeCount');

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🏆 Tier List cargado');
  
  if (window.firebaseService) {
    await loadSeasons();
    await loadAnimes();
    initializeTiers();
    loadTierListFromStorage();
    initEventListeners();
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
        <!-- Animes se agregarán aquí -->
      </div>
      <div class="tier-actions">
        <button class="btn btn-danger" onclick="deleteTier('${tier.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
  
  // Re-inicializar drag & drop
  initDragAndDrop();
};

// ============================================
// RENDERIZAR ANIME POOL
// ============================================
const renderAnimePool = () => {
  let filteredAnimes = allAnimes;
  
  // Aplicar filtro de temporada
  if (currentFilter !== 'all') {
    filteredAnimes = allAnimes.filter(anime => anime.seasonId === currentFilter);
  }
  
  // Filtrar animes que ya están en tiers
  const animesInTiers = new Set();
  document.querySelectorAll('.tier-items .anime-card').forEach(card => {
    animesInTiers.add(card.dataset.animeId);
  });
  
  filteredAnimes = filteredAnimes.filter(anime => !animesInTiers.has(anime.id));
  
  // Actualizar contador
  animeCount.textContent = `${filteredAnimes.length} animes disponibles`;
  
  if (filteredAnimes.length === 0) {
    animePool.innerHTML = '<p style="color: #48cae460; text-align: center; padding: 3rem; font-style: italic;">No hay animes disponibles</p>';
    return;
  }
  
  animePool.innerHTML = filteredAnimes.map(anime => createAnimeCard(anime)).join('');
  
  // Re-inicializar drag & drop
  initDragAndDrop();
};

// ============================================
// CREAR TARJETA DE ANIME
// ============================================
const createAnimeCard = (anime) => {
  return `
    <div class="anime-card" draggable="true" data-anime-id="${anime.id}" data-anime-title="${anime.title}">
      <img src="${anime.image}" alt="${anime.title}" onerror="this.src='https://via.placeholder.com/110x150?text=No+Image'">
      <div class="anime-card-title">${anime.title}</div>
    </div>
  `;
};

// ============================================
// DRAG & DROP
// ============================================
const initDragAndDrop = () => {
  // Todos los elementos arrastrables
  const draggables = document.querySelectorAll('.anime-card');
  
  draggables.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
  });
  
  // Todas las zonas de drop (tiers + pool)
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
  
  // Agregar el elemento al nuevo contenedor
  e.currentTarget.appendChild(draggedElement);
  
  // Actualizar pool (remover animes que ya no están)
  renderAnimePool();
  
  // Guardar estado
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
    
    // Actualizar en el DOM
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
  
  if (!confirm(`¿Eliminar la tier "${tier.name}"? Los animes volverán al banco.`)) {
    return;
  }
  
  // Devolver animes al pool
  const tierElement = document.querySelector(`[data-tier-id="${tierId}"]`);
  const tierItems = tierElement.querySelector('.tier-items');
  const animeCards = tierItems.querySelectorAll('.anime-card');
  
  animeCards.forEach(card => {
    animePool.appendChild(card);
  });
  
  // Eliminar tier del array
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
  
  // Devolver todos los animes al pool
  document.querySelectorAll('.tier-items .anime-card').forEach(card => {
    animePool.appendChild(card);
  });
  
  // Reiniciar tiers
  initializeTiers();
  renderAnimePool();
  
  // Limpiar storage
  localStorage.removeItem('tierlist_state');
  localStorage.removeItem('tierlist_tiers');
  
  console.log('✅ Tier List reiniciado');
};

// ============================================
// GUARDAR EN LOCALSTORAGE
// ============================================
const saveTierListToStorage = () => {
  try {
    // Guardar estructura de tiers
    localStorage.setItem('tierlist_tiers', JSON.stringify(tiers));
    
    // Guardar distribución de animes
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
    // Cargar tiers
    const savedTiers = localStorage.getItem('tierlist_tiers');
    if (savedTiers) {
      tiers = JSON.parse(savedTiers);
      renderTiers();
    }
    
    // Cargar distribución
    const savedState = localStorage.getItem('tierlist_state');
    if (savedState) {
      const tierState = JSON.parse(savedState);
      
      Object.keys(tierState).forEach(tierId => {
        const tierContainer = document.querySelector(`.tier-items[data-tier-id="${tierId}"]`);
        if (!tierContainer) return;
        
        tierState[tierId].forEach(animeId => {
          const animeCard = document.querySelector(`.anime-card[data-anime-id="${animeId}"]`);
          if (animeCard) {
            tierContainer.appendChild(animeCard);
          }
        });
      });
      
      // Actualizar pool después de mover animes
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
    // Ocultar botones temporalmente
    document.querySelectorAll('.tier-actions').forEach(el => el.style.display = 'none');
    
    const element = tiersArea;
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#0d0221',
      scale: 2,
      logging: false,
      useCORS: true
    });
    
    // Restaurar botones
    document.querySelectorAll('.tier-actions').forEach(el => el.style.display = '');
    
    // Descargar imagen
    const link = document.createElement('a');
    link.download = `tierlist-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    console.log('📸 Tier List exportado como imagen');
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
    currentFilter = e.target.value;
    renderAnimePool();
  });
  
  // Botones principales
  addTierBtn.addEventListener('click', addNewTier);
  resetBtn.addEventListener('click', resetTierList);
  exportBtn.addEventListener('click', exportTierList);
};

// ============================================
// MENSAJE DE CONSOLA
// ============================================
console.log(`
╔═══════════════════════════════════════╗
║   🏆 TIER LIST CREATOR 🏆            ║
║   Crea tu ranking personalizado      ║
║   🔥 Conectado a Firebase            ║
║   Hecho por: Jaykai2                 ║
╚═══════════════════════════════════════╝
`);