/* ============================================
   ANIME METRICS V2 - MODO SUPERVIVENCIA
   Autor: Jaykai2
   Sistema: Rey de la Colina (Gauntlet)
   ============================================ */

// ============================================
// ATRIBUTOS DEL SISTEMA (Ruleta)
// ============================================
const ATTRIBUTES = [
  {
    id: 'animation',
    name: 'Calidad de Animación (Sakuga)',
    description: '¿Cuál tiene los movimientos más fluidos y espectaculares?',
    icon: '🎨'
  },
  {
    id: 'character_design',
    name: 'Diseño de Personajes',
    description: '¿Qué estilo visual es más único, estético o memorable?',
    icon: '👥'
  },
  {
    id: 'ost',
    name: 'Banda Sonora (OST)',
    description: '¿Qué música ambienta mejor las escenas?',
    icon: '🎵'
  },
  {
    id: 'protagonist',
    name: 'Desarrollo de Protagonista',
    description: '¿Qué personaje principal evoluciona mejor?',
    icon: '⭐'
  },
  {
    id: 'world_building',
    name: 'World Building',
    description: '¿Qué mundo está mejor construido?',
    icon: '🌍'
  },
  {
    id: 'pacing',
    name: 'Ritmo de la Historia',
    description: '¿Cuál se siente más entretenido?',
    icon: '⏱️'
  },
  {
    id: 'first_episode',
    name: 'Impacto del Primer Episodio',
    description: '¿Cuál te atrapó más rápido?',
    icon: '💥'
  },
  {
    id: 'backgrounds',
    name: 'Calidad de los Fondos',
    description: '¿Qué escenarios son más detallados?',
    icon: '🖼️'
  },
  {
    id: 'chemistry',
    name: 'Química entre Personajes',
    description: '¿Dónde se sienten más naturales las relaciones?',
    icon: '💬'
  },
  {
    id: 'originality',
    name: 'Factor de Originalidad',
    description: '¿Cuál rompe más los clichés?',
    icon: '💡'
  },
  {
    id: 'tension',
    name: 'Tensión / Suspenso',
    description: '¿Cuál te mantiene al borde del asiento?',
    icon: '😰'
  },
  {
    id: 'direction',
    name: 'Dirección de Arte',
    description: '¿Cuál tiene mejor uso de colores y planos?',
    icon: '🎬'
  }
];

// ============================================
// ESTADO GLOBAL DEL GAUNTLET
// ============================================
let gauntletState = {
  // Configuración
  dataSource: 'season',
  selectedSeasonId: null,
  
  // Pool de animes disponibles
  availableAnimes: [],
  usedAnimes: [], // IDs de animes que ya aparecieron
  
  // Campeón actual
  currentChampion: null,
  championStreak: 0,
  
  // Aspirante actual
  currentChallenger: null,
  
  // Atributo actual
  currentAttribute: null,
  
  // Estadísticas globales
  totalDuels: 0,
  attributeStats: {}, // Contador de veces que se usó cada atributo
  
  // Ranking de defensores
  defenders: {
    // Estructura: { animeId: { title, image, maxStreak, totalWins, attributes: {...} } }
  }
};

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const screens = {
  setup: document.getElementById('setupScreen'),
  gauntlet: document.getElementById('gauntletScreen'),
  results: document.getElementById('resultsScreen')
};

const setupElements = {
  seasonSelector: document.getElementById('seasonSelector'),
  seasonGroup: document.getElementById('seasonSelectorGroup'),
  startBtn: document.getElementById('startSessionBtn')
};

const gauntletElements = {
  // Sidebar
  currentStreak: document.getElementById('currentStreak'),
  streakChampion: document.getElementById('streakChampion'),
  defendersList: document.getElementById('defendersList'),
  totalDuels: document.getElementById('totalDuels'),
  finishBtn: document.getElementById('finishBtn'),
  
  // Arena
  currentAttribute: document.getElementById('currentAttribute'),
  attributeDescription: document.getElementById('attributeDescription'),
  
  // Campeón
  championImage: document.getElementById('championImage'),
  championTitle: document.getElementById('championTitle'),
  championStreakValue: document.getElementById('championStreakValue'),
  voteChampionBtn: document.getElementById('voteChampionBtn'),
  
  // Aspirante
  challengerImage: document.getElementById('challengerImage'),
  challengerTitle: document.getElementById('challengerTitle'),
  voteChallengerBtn: document.getElementById('voteChallengerBtn'),
  
  // Acciones
  tieBtn: document.getElementById('tieBtn')
};

const resultsElements = {
  grandChampionCard: document.getElementById('grandChampionCard'),
  finalTotalDuels: document.getElementById('finalTotalDuels'),
  finalTotalAnimes: document.getElementById('finalTotalAnimes'),
  finalLongestStreak: document.getElementById('finalLongestStreak'),
  podiumContainer: document.getElementById('podiumContainer'),
  attributesChart: document.getElementById('attributesChart'),
  newGauntletBtn: document.getElementById('newGauntletBtn'),
  exportBtn: document.getElementById('exportBtn'),
  shareBtn: document.getElementById('shareBtn')
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('👑 Modo Supervivencia cargado');
  
  if (window.firebaseService) {
    await loadSeasons();
    initSetupListeners();
    initGauntletListeners();
    initResultsListeners();
  } else {
    console.error('❌ Firebase Service no disponible');
    alert('❌ Error: Firebase no está configurado');
  }
});

// ============================================
// CARGAR TEMPORADAS
// ============================================
const loadSeasons = async () => {
  try {
    const seasons = await window.firebaseService.getAllSeasons();
    
    setupElements.seasonSelector.innerHTML = '<option value="">-- Selecciona una temporada --</option>';
    
    seasons.forEach(season => {
      const option = document.createElement('option');
      option.value = season.id;
      option.textContent = season.name;
      setupElements.seasonSelector.appendChild(option);
    });
    
    console.log(`✅ ${seasons.length} temporadas cargadas`);
  } catch (error) {
    console.error('❌ Error al cargar temporadas:', error);
  }
};

// ============================================
// LISTENERS DE CONFIGURACIÓN
// ============================================
const initSetupListeners = () => {
  // Radio buttons de fuente
  document.querySelectorAll('input[name="dataSource"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      gauntletState.dataSource = e.target.value;
      
      if (e.target.value === 'season') {
        setupElements.seasonGroup.style.display = 'block';
      } else {
        setupElements.seasonGroup.style.display = 'none';
      }
    });
  });
  
  // Botón iniciar
  setupElements.startBtn.addEventListener('click', startGauntlet);
};

// ============================================
// INICIAR GAUNTLET
// ============================================
const startGauntlet = async () => {
  try {
    // Validar configuración
    if (gauntletState.dataSource === 'season' && !setupElements.seasonSelector.value) {
      alert('⚠️ Por favor selecciona una temporada');
      return;
    }
    
    // Mostrar loading
    setupElements.startBtn.textContent = 'Cargando animes...';
    setupElements.startBtn.disabled = true;
    
    // Cargar animes
    await loadAnimesBySource();
    
    if (gauntletState.availableAnimes.length < 2) {
      alert('⚠️ Se necesitan al menos 2 animes. Selecciona otra fuente.');
      setupElements.startBtn.textContent = '🚀 Iniciar Gauntlet';
      setupElements.startBtn.disabled = false;
      return;
    }
    
    // Resetear estado
    gauntletState.usedAnimes = [];
    gauntletState.totalDuels = 0;
    gauntletState.defenders = {};
    gauntletState.attributeStats = {};
    ATTRIBUTES.forEach(attr => {
      gauntletState.attributeStats[attr.id] = 0;
    });
    
    // Seleccionar primer campeón aleatorio
    const firstChampion = selectRandomAnime();
    gauntletState.currentChampion = firstChampion;
    gauntletState.championStreak = 0;
    
    // Inicializar defensor
    initializeDefender(firstChampion);
    
    // Cambiar a pantalla de gauntlet
    switchScreen('gauntlet');
    
    // Iniciar primer duelo
    startNewDuel();
    
  } catch (error) {
    console.error('❌ Error al iniciar gauntlet:', error);
    alert('❌ Error al cargar animes');
    setupElements.startBtn.textContent = '🚀 Iniciar Gauntlet';
    setupElements.startBtn.disabled = false;
  }
};

// ============================================
// CARGAR ANIMES POR FUENTE
// ============================================
const loadAnimesBySource = async () => {
  switch (gauntletState.dataSource) {
    case 'season':
      gauntletState.selectedSeasonId = setupElements.seasonSelector.value;
      const seasonAnimes = await window.firebaseService.getAnimesBySeason(gauntletState.selectedSeasonId);
      gauntletState.availableAnimes = seasonAnimes.map(a => ({
        id: a.id,
        title: a.title,
        image: a.cardImage || a.poster
      }));
      break;
      
    case 'favorites':
      const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
      if (favorites.length < 2) {
        alert('⚠️ No tienes suficientes favoritos');
        throw new Error('Insufficient favorites');
      }
      const favoriteAnimes = await Promise.all(
        favorites.map(fav => window.firebaseService.getAnimeById(fav.id))
      );
      gauntletState.availableAnimes = favoriteAnimes.filter(a => a).map(a => ({
        id: a.id,
        title: a.title,
        image: a.cardImage || a.poster
      }));
      break;
      
    case 'global':
      const allAnimes = await window.firebaseService.getAllAnimes();
      gauntletState.availableAnimes = allAnimes.map(a => ({
        id: a.id,
        title: a.title,
        image: a.cardImage || a.poster
      }));
      break;
  }
  
  console.log(`✅ ${gauntletState.availableAnimes.length} animes cargados`);
};

// ============================================
// SELECCIONAR ANIME ALEATORIO
// ============================================
const selectRandomAnime = () => {
  // Filtrar animes no usados
  const available = gauntletState.availableAnimes.filter(
    anime => !gauntletState.usedAnimes.includes(anime.id)
  );
  
  // Si no hay disponibles, resetear pool
  if (available.length === 0) {
    console.log('🔄 Pool agotado, reseteando...');
    gauntletState.usedAnimes = [];
    return selectRandomAnime();
  }
  
  // Seleccionar aleatorio
  const randomIndex = Math.floor(Math.random() * available.length);
  const selected = available[randomIndex];
  
  // Marcar como usado
  gauntletState.usedAnimes.push(selected.id);
  
  return selected;
};

// ============================================
// INICIALIZAR DEFENSOR
// ============================================
const initializeDefender = (anime) => {
  if (!gauntletState.defenders[anime.id]) {
    gauntletState.defenders[anime.id] = {
      title: anime.title,
      image: anime.image,
      maxStreak: 0,
      totalWins: 0,
      attributes: {}
    };
    
    ATTRIBUTES.forEach(attr => {
      gauntletState.defenders[anime.id].attributes[attr.id] = 0;
    });
  }
};

// ============================================
// INICIAR NUEVO DUELO
// ============================================
const startNewDuel = () => {
  gauntletState.totalDuels++;
  
  // Seleccionar nuevo aspirante
  gauntletState.currentChallenger = selectRandomAnime();
  initializeDefender(gauntletState.currentChallenger);
  
  // Seleccionar atributo aleatorio
  gauntletState.currentAttribute = ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)];
  gauntletState.attributeStats[gauntletState.currentAttribute.id]++;
  
  // Renderizar
  renderGauntlet();
  updateSidebar();
};

// ============================================
// RENDERIZAR GAUNTLET
// ============================================
const renderGauntlet = () => {
  // Atributo
  gauntletElements.currentAttribute.textContent = gauntletState.currentAttribute.name;
  gauntletElements.attributeDescription.textContent = gauntletState.currentAttribute.description;
  
  // Campeón
  gauntletElements.championImage.src = gauntletState.currentChampion.image;
  gauntletElements.championImage.alt = gauntletState.currentChampion.title;
  gauntletElements.championTitle.textContent = gauntletState.currentChampion.title;
  gauntletElements.championStreakValue.textContent = gauntletState.championStreak;
  
  // Aspirante
  gauntletElements.challengerImage.src = gauntletState.currentChallenger.image;
  gauntletElements.challengerImage.alt = gauntletState.currentChallenger.title;
  gauntletElements.challengerTitle.textContent = gauntletState.currentChallenger.title;
};

// ============================================
// ACTUALIZAR SIDEBAR
// ============================================
const updateSidebar = () => {
  // Racha actual
  gauntletElements.currentStreak.textContent = gauntletState.championStreak;
  gauntletElements.streakChampion.textContent = gauntletState.currentChampion.title;
  
  // Total duelos
  gauntletElements.totalDuels.textContent = gauntletState.totalDuels;
  
  // Top Defensores
  const sortedDefenders = Object.entries(gauntletState.defenders)
    .sort(([, a], [, b]) => b.maxStreak - a.maxStreak)
    .slice(0, 5);
  
  if (sortedDefenders.length === 0) {
    gauntletElements.defendersList.innerHTML = '<li class="empty-defenders">Aún no hay defensores</li>';
  } else {
    gauntletElements.defendersList.innerHTML = sortedDefenders.map(([id, defender], index) => `
      <li>
        <span class="defender-name">${index + 1}. ${defender.title}</span>
        <span class="defender-streak">🔥 Racha máxima: ${defender.maxStreak}</span>
      </li>
    `).join('');
  }
};

// ============================================
// LISTENERS DEL GAUNTLET
// ============================================
const initGauntletListeners = () => {
  gauntletElements.voteChampionBtn.addEventListener('click', () => voteForChampion());
  gauntletElements.voteChallengerBtn.addEventListener('click', () => voteForChallenger());
  gauntletElements.tieBtn.addEventListener('click', () => handleTie());
  gauntletElements.finishBtn.addEventListener('click', () => finishGauntlet());
};

// ============================================
// VOTAR POR CAMPEÓN
// ============================================
const voteForChampion = () => {
  // Incrementar racha
  gauntletState.championStreak++;
  
  // Actualizar estadísticas del defensor
  const defender = gauntletState.defenders[gauntletState.currentChampion.id];
  defender.totalWins++;
  defender.attributes[gauntletState.currentAttribute.id]++;
  
  // Actualizar racha máxima
  if (gauntletState.championStreak > defender.maxStreak) {
    defender.maxStreak = gauntletState.championStreak;
  }
  
  // Animación de victoria
  showVictoryAnimation('champion');
  
  // Siguiente duelo después de animación
  setTimeout(() => {
    startNewDuel();
  }, 1000);
};

// ============================================
// VOTAR POR ASPIRANTE
// ============================================
const voteForChallenger = () => {
  // Mensaje de cambio de reinado
  if (gauntletState.championStreak > 0) {
    showReignEndMessage(gauntletState.currentChampion.title, gauntletState.championStreak);
  }
  
  // El aspirante se convierte en campeón
  gauntletState.currentChampion = gauntletState.currentChallenger;
  gauntletState.championStreak = 1;
  
  // Actualizar estadísticas
  const defender = gauntletState.defenders[gauntletState.currentChampion.id];
  defender.totalWins++;
  defender.attributes[gauntletState.currentAttribute.id]++;
  defender.maxStreak = Math.max(defender.maxStreak, 1);
  
  // Animación
  showVictoryAnimation('challenger');
  
  // Siguiente duelo
  setTimeout(() => {
    startNewDuel();
  }, 1500);
};

// ============================================
// MANEJAR EMPATE
// ============================================
const handleTie = () => {
  // Cambiar atributo sin cambiar competidores
  gauntletState.currentAttribute = ATTRIBUTES[Math.floor(Math.random() * ATTRIBUTES.length)];
  gauntletState.attributeStats[gauntletState.currentAttribute.id]++;
  
  // Re-renderizar solo el atributo
  gauntletElements.currentAttribute.textContent = gauntletState.currentAttribute.name;
  gauntletElements.attributeDescription.textContent = gauntletState.currentAttribute.description;
  
  // Feedback visual
  const attributeDisplay = document.querySelector('.attribute-display');
  attributeDisplay.style.animation = 'none';
  setTimeout(() => {
    attributeDisplay.style.animation = 'pulse-border 2s infinite';
  }, 10);
};

// ============================================
// ANIMACIONES
// ============================================
const showVictoryAnimation = (winner) => {
  const card = winner === 'champion' 
    ? document.getElementById('championCard')
    : document.getElementById('challengerCard');
  
  card.style.transform = 'scale(1.1)';
  card.style.boxShadow = '0 0 50px rgba(254, 240, 138, 0.8)';
  
  setTimeout(() => {
    card.style.transform = '';
    card.style.boxShadow = '';
  }, 500);
};

const showReignEndMessage = (championName, streak) => {
  // Crear overlay temporal
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95));
    padding: 2rem 3rem;
    border-radius: 16px;
    border: 3px solid #fef08a;
    z-index: 10000;
    text-align: center;
    box-shadow: 0 0 50px rgba(239, 68, 68, 0.8);
    animation: fadeIn 0.3s ease;
  `;
  
  overlay.innerHTML = `
    <h3 style="color: #fff; font-size: 1.5rem; margin-bottom: 0.5rem;">
      ⚔️ ¡El reinado ha terminado! ⚔️
    </h3>
    <p style="color: #fef08a; font-size: 1.2rem; font-weight: 700;">
      ${championName}
    </p>
    <p style="color: #fff; font-size: 1rem;">
      🔥 Racha final: ${streak} victoria${streak !== 1 ? 's' : ''}
    </p>
  `;
  
  document.body.appendChild(overlay);
  
  setTimeout(() => {
    overlay.remove();
  }, 1200);
};

// ============================================
// FINALIZAR GAUNTLET
// ============================================
const finishGauntlet = () => {
  if (gauntletState.totalDuels < 3) {
    alert('⚠️ Completa al menos 3 duelos antes de finalizar');
    return;
  }
  
  switchScreen('results');
  renderResults();
};

// ============================================
// RENDERIZAR RESULTADOS
// ============================================
const renderResults = () => {
  // Encontrar gran campeón (mayor racha)
  const grandChampion = Object.entries(gauntletState.defenders)
    .sort(([, a], [, b]) => b.maxStreak - a.maxStreak)[0];
  
  if (grandChampion) {
    const [id, champion] = grandChampion;
    resultsElements.grandChampionCard.innerHTML = `
      <img src="${champion.image}" alt="${champion.title}">
      <h3>${champion.title}</h3>
      <p>🔥 Racha máxima: <strong>${champion.maxStreak}</strong> victorias</p>
      <p>⚔️ Total de victorias: <strong>${champion.totalWins}</strong></p>
    `;
  }
  
  // Stats generales
  resultsElements.finalTotalDuels.textContent = gauntletState.totalDuels;
  resultsElements.finalTotalAnimes.textContent = Object.keys(gauntletState.defenders).length;
  resultsElements.finalLongestStreak.textContent = grandChampion ? grandChampion[1].maxStreak : 0;
  
  // Top 5 Defensores (Podium)
  const topDefenders = Object.entries(gauntletState.defenders)
    .sort(([, a], [, b]) => b.maxStreak - a.maxStreak)
    .slice(0, 5);
  
  resultsElements.podiumContainer.innerHTML = topDefenders.map(([id, defender], index) => {
    const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
    return `
      <div class="podium-item">
        <div class="podium-rank">${medals[index]}</div>
        <img src="${defender.image}" alt="${defender.title}">
        <div class="podium-name">${defender.title}</div>
        <div class="podium-streak">🔥 ${defender.maxStreak} victorias seguidas</div>
      </div>
    `;
  }).join('');
  
  // Gráfico de atributos más competidos
  const sortedAttributes = Object.entries(gauntletState.attributeStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  
  const maxValue = sortedAttributes[0]?.[1] || 1;
  
  resultsElements.attributesChart.innerHTML = sortedAttributes.map(([attrId, count]) => {
    const attribute = ATTRIBUTES.find(a => a.id === attrId);
    const percentage = (count / maxValue) * 100;
    
    return `
      <div class="attribute-bar">
        <div class="attribute-bar-label">
          <span>${attribute.name}</span>
          <span>${count} duelos</span>
        </div>
        <div class="attribute-bar-fill-container">
          <div class="attribute-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  }).join('');
};

// ============================================
// LISTENERS DE RESULTADOS
// ============================================
const initResultsListeners = () => {
  resultsElements.newGauntletBtn.addEventListener('click', () => {
    switchScreen('setup');
    setupElements.startBtn.textContent = '🚀 Iniciar Gauntlet';
    setupElements.startBtn.disabled = false;
  });
  
  resultsElements.exportBtn.addEventListener('click', exportToFirebase);
  resultsElements.shareBtn.addEventListener('click', shareResults);
};

// ============================================
// EXPORTAR A FIREBASE
// ============================================
const exportToFirebase = async () => {
  try {
    resultsElements.exportBtn.textContent = 'Guardando...';
    resultsElements.exportBtn.disabled = true;
    
    const sessionData = {
      type: 'survival_gauntlet',
      dataSource: gauntletState.dataSource,
      selectedSeasonId: gauntletState.selectedSeasonId,
      totalDuels: gauntletState.totalDuels,
      defenders: gauntletState.defenders,
      attributeStats: gauntletState.attributeStats,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await window.firebaseDB.db.collection('gauntlet_sessions').add(sessionData);
    
    alert('✅ Sesión guardada en Firebase');
    resultsElements.exportBtn.textContent = '💾 Guardado ✓';
    
  } catch (error) {
    console.error('❌ Error al guardar:', error);
    alert('❌ Error al guardar');
    resultsElements.exportBtn.textContent = '💾 Guardar en Firebase';
    resultsElements.exportBtn.disabled = false;
  }
};

// ============================================
// COMPARTIR RESULTADOS
// ============================================
const shareResults = () => {
  const grandChampion = Object.entries(gauntletState.defenders)
    .sort(([, a], [, b]) => b.maxStreak - a.maxStreak)[0];
  
  if (!grandChampion) return;
  
  const shareText = `🏆 Mi Gran Campeón en Anime Gauntlet:

👑 ${grandChampion[1].title}
🔥 Racha máxima: ${grandChampion[1].maxStreak} victorias
⚔️ ${gauntletState.totalDuels} duelos totales

¡Juega tú también en Anime Hub! 🎮`;
  
  if (navigator.share) {
    navigator.share({
      title: 'Anime Gauntlet - Resultados',
      text: shareText
    }).catch(err => console.log('Error al compartir:', err));
  } else {
    // Copiar al portapapeles
    navigator.clipboard.writeText(shareText).then(() => {
      alert('📋 Resultados copiados al portapapeles');
    });
  }
};

// ============================================
// CAMBIAR DE PANTALLA
// ============================================
const switchScreen = (screenName) => {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  screens[screenName].classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ============================================
// CONSOLA
// ============================================
console.log(`
╔═══════════════════════════════════════════╗
║   👑 MODO SUPERVIVENCIA 👑               ║
║   Rey de la Colina - Gauntlet           ║
║   🔥 Sistema de Rachas                   ║
║   Hecho por: Jaykai2                     ║
╚═══════════════════════════════════════════╝
`);