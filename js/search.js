/* ============================================
   ANIME SEARCH - JAVASCRIPT (MODIFICADO)
   Autor: Jaykai2
   AHORA LEE DESDE FIREBASE
   ============================================ */

// Estado de la aplicación
let animesDatabase = []; // Ahora se llenará desde Firebase
let filteredAnimes = [];
let currentSort = 'default';
let currentSeason = 'all';
let currentSearch = '';

// Elementos del DOM
const searchBar = document.getElementById('searchBar');
const seasonFilter = document.getElementById('seasonFilter');
const sortFilter = document.getElementById('sortFilter');
const animeGrid = document.getElementById('animeGrid');
const resultsCount = document.getElementById('resultsCount');
const noResults = document.getElementById('no-results');

// Mapeo de nombres de temporadas
const seasonNames = {
  fall: 'Otoño',
  winter: 'Invierno',
  spring: 'Primavera',
  summer: 'Verano'
};

// ============================================
// CARGAR ANIMES DESDE FIREBASE
// ============================================
const loadAnimesFromFirebase = async () => {
  animeGrid.innerHTML = '<div style="grid-column: 1/-1;"><div class="loading"><div class="spinner"></div><p>Cargando animes desde Firebase...</p></div></div>';
  
  try {
    // Obtener todos los animes desde Firebase
    const animes = await window.firebaseService.getAllAnimes();
    
    // Transformar al formato que espera la UI
    animesDatabase = animes.map(anime => {
      // Extraer el tipo de temporada del seasonId (ej: 'fall_2025' → 'fall')
      const seasonKey = anime.seasonId ? anime.seasonId.split('_')[0] : 'fall';
      
      return {
        id: anime.id,
        title: anime.title,
        season: seasonKey,
        image: anime.cardImage || anime.poster,
        type: anime.category === 'continuation' ? 'Continuación' : 'Nuevo'
      };
    });
    
    console.log(`📊 ${animesDatabase.length} animes cargados desde Firebase`);
    
    // Cargar temporadas para el filtro
    await loadSeasonsForFilter();
    
    // Renderizar todos los animes
    filteredAnimes = [...animesDatabase];
    renderAnimeCards(filteredAnimes);
    
  } catch (error) {
    console.error('Error al cargar animes:', error);
    animeGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;"><p style="color: #ef4444;">❌ Error al cargar animes. Verifica tu conexión a Firebase.</p></div>';
  }
};

// ============================================
// CARGAR TEMPORADAS PARA EL FILTRO
// ============================================
const loadSeasonsForFilter = async () => {
  try {
    const seasons = await window.firebaseService.getAllSeasons();
    
    // Limpiar y llenar el selector
    seasonFilter.innerHTML = '<option value="all">Todas las Temporadas</option>';
    
    seasons.forEach(season => {
      const option = document.createElement('option');
      // Usar el primer segmento del ID como valor (fall_2025 → fall)
      const seasonKey = season.id.split('_')[0];
      option.value = seasonKey;
      option.textContent = season.name;
      seasonFilter.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error al cargar temporadas:', error);
  }
};

// ============================================
// FUNCIÓN PARA RENDERIZAR LAS TARJETAS
// ============================================
const renderAnimeCards = (animes) => {
  if (animes.length === 0) {
    animeGrid.style.display = 'none';
    noResults.style.display = 'block';
    resultsCount.textContent = 'No se encontraron animes';
    return;
  }

  animeGrid.style.display = 'grid';
  noResults.style.display = 'none';
  resultsCount.textContent = `Mostrando ${animes.length} anime${animes.length !== 1 ? 's' : ''}`;

  animeGrid.innerHTML = animes.map(anime => `
    <article class="anime-card" onclick="navigateToDetails('${anime.id}')">
      <span class="season-badge ${anime.season}">${seasonNames[anime.season] || anime.season}</span>
      <img src="${anime.image}" alt="${anime.title}" class="card-image" loading="lazy" onerror="this.src='https://via.placeholder.com/280x350?text=Sin+Imagen'">
      <h3 class="card-title">${anime.title}</h3>
      <p class="card-info">📺 ${anime.type}</p>
    </article>
  `).join('');
};

// ============================================
// FUNCIÓN DE NAVEGACIÓN A DETALLES
// ============================================
window.navigateToDetails = (animeId, season) => {
  // Guardar el ID del anime en localStorage
  localStorage.setItem('selectedAnime', animeId);
  localStorage.setItem('selectedSeason', season);
  
  // Navegar a la página de detalles
  window.location.href = `anime-details.html?id=${animeId}`;
};

// ============================================
// FUNCIÓN PARA APLICAR FILTROS
// ============================================
const applyFilters = () => {
  // Filtrar por temporada
  let result = currentSeason === 'all' 
    ? [...animesDatabase] 
    : animesDatabase.filter(anime => anime.season === currentSeason);

  // Filtrar por búsqueda
  if (currentSearch) {
    result = result.filter(anime => 
      anime.title.toLowerCase().includes(currentSearch.toLowerCase())
    );
  }

  // Ordenar
  if (currentSort === 'az') {
    result.sort((a, b) => a.title.localeCompare(b.title));
  } else if (currentSort === 'za') {
    result.sort((a, b) => b.title.localeCompare(a.title));
  }

  filteredAnimes = result;
  renderAnimeCards(filteredAnimes);
};

// ============================================
// EVENT LISTENERS
// ============================================

// Búsqueda en tiempo real
searchBar.addEventListener('input', (e) => {
  currentSearch = e.target.value.trim();
  applyFilters();
});

// Filtro de temporada
seasonFilter.addEventListener('change', (e) => {
  currentSeason = e.target.value;
  applyFilters();
});

// Filtro de ordenamiento
sortFilter.addEventListener('change', (e) => {
  currentSort = e.target.value;
  applyFilters();
});

// Atajo de teclado para búsqueda
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== searchBar) {
    e.preventDefault();
    searchBar.focus();
  }
  
  if (e.key === 'Escape' && document.activeElement === searchBar) {
    searchBar.value = '';
    currentSearch = '';
    applyFilters();
    searchBar.blur();
  }
});

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔍 Página de búsqueda cargada');
  
  // Esperar a que Firebase esté listo
  if (window.firebaseService) {
    // Cargar animes desde Firebase
    await loadAnimesFromFirebase();
    
    // Restaurar filtros desde URL si existen
    const urlParams = new URLSearchParams(window.location.search);
    const seasonParam = urlParams.get('season');
    
    if (seasonParam && ['fall', 'winter', 'spring', 'summer'].includes(seasonParam)) {
      seasonFilter.value = seasonParam;
      currentSeason = seasonParam;
      applyFilters();
    }
  } else {
    console.error('❌ Firebase Service no está disponible');
    animeGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;"><p style="color: #ef4444;">❌ Error: Firebase no está configurado</p></div>';
  }
});

console.log(`
╔═══════════════════════════════════════╗
║   🔍 ANIME SEARCH 🔍                 ║
║   Búsqueda y Filtrado Avanzado       ║
║   🔥 Conectado a Firebase            ║
║   Hecho por: Jaykai2                 ║
╚═══════════════════════════════════════╝
`);