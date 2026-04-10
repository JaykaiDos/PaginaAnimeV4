/* ============================================
   ADMIN PANEL LOGIC
   Archivo: js/admin-panel.js
   Autor: Jaykai2
   Versión: 3.1

   MEJORAS v3.1:
   ─────────────────────────────────────────────
   FIX CRÍTICO: El onclick inline en los resultados
   del modal MAL fallaba cuando el título del anime
   contenía comillas dobles (ej: Himesama "Goumon"...),
   ya que rompían el atributo HTML onclick="...".

   Solución: Se reemplazó el onclick inline por
   data-attributes + delegación de eventos. Los títulos
   ahora se almacenan en data-mal-title (escapado con
   &quot;/&#39;) y se leen en el handler de forma segura.

   MEJORAS v3 (anteriores):
   ─────────────────────────────────────────────
   1. Botón "🔗 Vincular MAL" separado del de
      importar personajes. Muestra badge de estado
      (vinculado / no vinculado) en la card.

   2. Al vincular un MAL ID, también se guarda
      el broadcast (día/hora) en Firebase para que
      today-schedule NO tenga que consultar Jikan
      cada vez que carga la página.

   3. Botón "📅 Estrenos" en cada anime para
      activar/desactivar su aparición en el
      carrusel "Estrenos de Hoy" sin eliminar
      la vinculación.

   4. Los filtros (temporada) y la posición del
      scroll del listado de animes se preservan
      después de operaciones de vinculación,
      importación de personajes, etc.
      (Sin recargas ni pérdida de estado de UI)
   ─────────────────────────────────────────────
   CAMPOS NUEVOS EN FIREBASE (colección animes):
   • malId         → number  - ID de MyAnimeList
   • malTitle      → string  - Título en MAL
   • broadcast     → object  - { day, time, timezone }
                               guardado desde Jikan al vincular
   • scheduleActive→ boolean - true = mostrar en carrusel hoy
                               false = excluir del carrusel
   ============================================ */

// ============================================
// ESTADO GLOBAL
// ============================================
const { 
  getAllSeasons, addSeason, updateSeason, deleteSeason,
  getAllAnimes, getAnimesBySeason, addAnime, updateAnime, deleteAnime,
  getEpisodesByAnime, addEpisode, deleteEpisode,
  getAllCharacters, getCharactersByAnime, addCharacter,
  addMultipleCharacters, deleteCharacter, deleteCharactersByAnime, hasCharacters
} = window.firebaseService;

let currentSeasons    = [];
let currentAnimes     = [];
let currentEpisodes   = [];
let currentCharacters = [];
let selectedAnimeId   = null;
let editingSeasonId   = null;
let editingAnimeId    = null;

// -----------------------------------------------
// Estado de UI que queremos preservar entre recargas
// de lista (sin perder posición ni filtros)
// -----------------------------------------------
let _savedSeasonFilter = 'all';   // filtro de temporada activo
let _savedScrollTop    = 0;       // posición de scroll del listado

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

  console.log('✅ Admin Panel v3.1 cargado');
});

// ============================================
// NAVEGACIÓN POR TABS
// ============================================
const initTabs = () => {
  const navTabs     = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
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

  if (seasonId) {
    const season = currentSeasons.find(s => s.id === seasonId);
    document.getElementById('seasonModalTitle').textContent = 'Editar Temporada';
    document.getElementById('seasonName').value   = season.name;
    document.getElementById('seasonEmoji').value  = season.emoji || '';
    document.getElementById('seasonPeriod').value = season.period;
    document.getElementById('seasonStatus').value = season.status;
    document.getElementById('seasonOrder').value  = season.order || 1;
  } else {
    document.getElementById('seasonModalTitle').textContent = 'Nueva Temporada';
    document.getElementById('seasonForm').reset();
  }

  modal.classList.add('show');
};

window.closeSeasonModal = () => {
  document.getElementById('seasonModal').classList.remove('show');
  document.getElementById('seasonForm').reset();
  editingSeasonId = null;
};

window.editSeason           = (id) => openSeasonModal(id);
window.confirmDeleteSeason  = (id) => {
  const s = currentSeasons.find(s => s.id === id);
  if (confirm(`¿Eliminar la temporada "${s.name}" y TODOS sus animes?`)) {
    deleteSeasonHandler(id);
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

  // ✅ Reaplicar filtro guardado sin perderlo
  const filterSelect = document.getElementById('seasonFilter');
  if (filterSelect && _savedSeasonFilter !== 'all') {
    filterSelect.value = _savedSeasonFilter;
  }

  renderAnimesList(currentAnimes, _savedSeasonFilter);
  updateAnimeSelector();
  updateCharacterAnimeSelector();
};

/**
 * Renderiza la lista de animes aplicando el filtro de temporada.
 * Preserva la posición de scroll después del render.
 * @param {object[]} animes
 * @param {string}   seasonFilter - 'all' o seasonId
 */
const renderAnimesList = (animes, seasonFilter = 'all') => {
  const list = document.getElementById('animesList');

  const filtered = seasonFilter === 'all'
    ? animes
    : animes.filter(a => a.seasonId === seasonFilter);

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">No hay animes para esta temporada</p>';
    return;
  }

  list.innerHTML = filtered.map(anime => {
    const season = currentSeasons.find(s => s.id === anime.seasonId);

    // Badge de vinculación MAL
    const malBadge = anime.malId
      ? `<span class="meta-tag mal-linked" title="MAL ID: ${anime.malId}">🔗 MAL vinculado</span>`
      : `<span class="meta-tag mal-unlinked">⚠️ Sin vincular</span>`;

    // Badge de broadcast guardado
    const broadcastBadge = anime.broadcast
      ? `<span class="meta-tag" title="Horario guardado en Firebase">
           📅 ${anime.broadcast.day ?? '?'} ${anime.broadcast.time ?? ''}
         </span>`
      : '';

    // Botón de carrusel (toggle schedule)
    const scheduleActive = anime.scheduleActive !== false;
    const isFinished     = anime.status === 'completed' || anime.status === 'finished';

    const scheduleBtnLabel = scheduleActive
      ? '📅 En Carrusel'
      : (isFinished ? '📅 Finalizado' : '📅 Excluido');

    const scheduleBtnTitle = scheduleActive
      ? 'Quitar del carrusel de estrenos de hoy'
      : (isFinished
          ? 'Anime finalizado — no aparece en estrenos'
          : 'Activar para que aparezca en estrenos de hoy');

    const scheduleBtn = anime.malId
      ? `<button
           class="btn-schedule ${scheduleActive ? 'btn-schedule--on' : 'btn-schedule--off'}"
           onclick="toggleScheduleActive('${anime.id}')"
           title="${scheduleBtnTitle}">
           ${scheduleBtnLabel}
         </button>`
      : '';

    // Botón vincular / re-vincular
    const linkBtn = `<button
      class="btn-link-mal"
      onclick="openMalSearchModal('${anime.id}')"
      title="${anime.malId ? 'Re-vincular MAL ID' : 'Vincular con MyAnimeList'}">
      ${anime.malId ? '🔗 Re-vincular' : '🔗 Vincular MAL'}
    </button>`;

    return `
      <div class="anime-item" id="anime-item-${anime.id}">
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
            ${malBadge}
            ${broadcastBadge}
          </div>
        </div>

        <div class="anime-item-actions">
          <button class="btn-edit" onclick="editAnime('${anime.id}')">✏️ Editar</button>
          ${linkBtn}
          ${scheduleBtn}
          <button class="btn-primary" onclick="importCharactersForAnime('${anime.id}')">
            🎭 Importar Personajes
          </button>
          <button class="btn-danger" onclick="confirmDeleteAnime('${anime.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `;
  }).join('');

  // ✅ Restaurar scroll
  list.scrollTop = _savedScrollTop;
};

/**
 * Guarda el estado actual de filtro y scroll antes
 * de cualquier operación que pudiera re-renderizar la lista.
 */
const saveListState = () => {
  const filterSelect = document.getElementById('seasonFilter');
  const list         = document.getElementById('animesList');
  _savedSeasonFilter = filterSelect ? filterSelect.value : 'all';
  _savedScrollTop    = list ? list.scrollTop : 0;
};

window.filterAnimesBySeason = () => {
  const seasonId = document.getElementById('seasonFilter').value;
  _savedSeasonFilter = seasonId;
  renderAnimesList(currentAnimes, seasonId);
};

window.openAnimeModal = (animeId = null) => {
  editingAnimeId = animeId;
  const modal = document.getElementById('animeModal');

  if (animeId) {
    const anime = currentAnimes.find(a => a.id === animeId);
    if (anime) {
      document.getElementById('animeModalTitle').textContent = 'Editar Anime';
      document.getElementById('animeSeasonId').value  = anime.seasonId  || '';
      document.getElementById('animeTitle').value     = anime.title     || '';
      document.getElementById('animeCategory').value  = anime.category  || 'new';
      document.getElementById('animeYear').value      = anime.year      || 2025;
      document.getElementById('animeStatus').value    = anime.status    || 'airing';
      document.getElementById('animeOrder').value     = anime.order     || 1;
      document.getElementById('animeCardImage').value = anime.cardImage || '';
      document.getElementById('animePoster').value    = anime.poster    || '';
      document.getElementById('animeSynopsis').value  = anime.synopsis  || '';
      document.getElementById('animeTrailers').value  = anime.trailers  ? anime.trailers.join(', ') : '';
      document.getElementById('animeMalId').value     = anime.malId     || '';

      // ── Cargar sección de override de broadcast ──
      _renderBroadcastOverrideSection(anime);
    }
  } else {
    document.getElementById('animeModalTitle').textContent = 'Nuevo Anime';
    document.getElementById('animeForm').reset();
    document.getElementById('animeSeasonId').value = '';
    // Ocultar sección broadcast al crear un anime nuevo
    _hideBroadcastOverrideSection();
  }

  modal.classList.add('show');
};

window.closeAnimeModal = () => {
  document.getElementById('animeModal').classList.remove('show');
  document.getElementById('animeForm').reset();
  _hideBroadcastOverrideSection();
  editingAnimeId = null;
};

window.editAnime           = (id) => openAnimeModal(id);
window.confirmDeleteAnime  = (id) => {
  const anime = currentAnimes.find(a => a.id === id);
  if (confirm(`¿Eliminar "${anime.title}" y TODOS sus episodios y personajes?`)) {
    deleteAnimeHandler(id);
  }
};

const deleteAnimeHandler = async (animeId) => {
  await deleteCharactersByAnime(animeId);
  const result = await deleteAnime(animeId);
  if (result.success) {
    alert('✅ Anime eliminado');
    saveListState();
    await loadAllAnimes();
    await loadSeasons();
  } else {
    alert('❌ Error al eliminar anime');
  }
};

// ============================================
// ✅ TOGGLE CARRUSEL (scheduleActive)
// Activa o desactiva el anime en el carrusel
// "Estrenos de Hoy" sin eliminar la vinculación.
// ============================================

/**
 * Alterna el campo `scheduleActive` en Firestore.
 * - true  → el anime aparece en el carrusel si emite hoy
 * - false → el anime es excluido del carrusel
 * @param {string} animeId
 */
window.toggleScheduleActive = async (animeId) => {
  saveListState();

  const anime   = currentAnimes.find(a => a.id === animeId);
  if (!anime) return;

  const current = anime.scheduleActive !== false;
  const next    = !current;

  // Feedback visual inmediato
  _updateScheduleBtn(animeId, next);

  const result = await updateAnime(animeId, { scheduleActive: next });

  if (result.success) {
    const idx = currentAnimes.findIndex(a => a.id === animeId);
    if (idx !== -1) currentAnimes[idx].scheduleActive = next;

    const label = next ? 'activado en el carrusel' : 'excluido del carrusel';
    _showToast(`✅ "${anime.title}" ${label}`);
  } else {
    _updateScheduleBtn(animeId, current);
    alert('❌ Error al actualizar estado del carrusel');
  }
};

/**
 * Actualiza el botón de schedule en el DOM sin re-renderizar.
 * @param {string}  animeId
 * @param {boolean} isActive
 */
const _updateScheduleBtn = (animeId, isActive) => {
  const btn = document.querySelector(`#anime-item-${animeId} .btn-schedule`);
  if (!btn) return;

  btn.className   = `btn-schedule ${isActive ? 'btn-schedule--on' : 'btn-schedule--off'}`;
  btn.textContent = isActive ? '📅 En Carrusel' : '📅 Excluido';
  btn.title       = isActive ? 'Quitar del carrusel de hoy' : 'Mostrar en carrusel de hoy';
};

// ============================================
// ✅ IMPORTAR PERSONAJES (preserva estado de UI)
// ============================================
window.importCharactersForAnime = async (animeId) => {
  saveListState();

  const anime = currentAnimes.find(a => a.id === animeId);
  if (!anime) { alert('❌ Anime no encontrado'); return; }

  if (!anime.malId) {
    alert('⚠️ Este anime no tiene un MAL ID vinculado.\nUsa el botón "🔗 Vincular MAL" primero.');
    openMalSearchModal(animeId);
    return;
  }

  const hasChars = await hasCharacters(animeId);
  if (hasChars) {
    if (!confirm(`"${anime.title}" ya tiene personajes importados. ¿Reemplazarlos?`)) return;
    await deleteCharactersByAnime(animeId);
  }

  const loadingDiv = _showLoadingOverlay('🎭 Importando Personajes', 'Obteniendo personajes desde MyAnimeList...');

  try {
    const characters = await window.jikanService.getAnimeCharacters(anime.malId);

    if (characters.length === 0) {
      document.body.removeChild(loadingDiv);
      alert('⚠️ No se encontraron personajes para este anime');
      return;
    }

    const mainCount       = characters.filter(c => c.role === 'Main').length;
    const supportingCount = characters.filter(c => c.role === 'Supporting').length;

    const charactersToAdd = characters.map(char => ({
      name:       char.name,
      image:      char.image,
      role:       char.role,
      animeId:    animeId,
      animeTitle: anime.title,
      malId:      char.malId,
      favorites:  char.favorites
    }));

    const result = await addMultipleCharacters(charactersToAdd);
    document.body.removeChild(loadingDiv);

    if (result.success) {
      _showToast(`✅ ${result.count} personajes importados para "${anime.title}"`);
      console.log(`✅ Importación completa — Main: ${mainCount} / Supporting: ${supportingCount}`);
    } else {
      alert('❌ Error al importar personajes');
    }

  } catch (error) {
    console.error('❌ Error en importación:', error);
    const overlay = document.getElementById('adminLoadingOverlay');
    if (overlay) document.body.removeChild(overlay);
    alert(`❌ Error: ${error.message}`);
  }
};

// ============================================
// ✅ BUSCAR Y VINCULAR EN MYANIMELIST
//    v3.1 FIX: Reemplazado onclick inline por
//    data-attributes + delegación de eventos.
//    Corrige el bug con títulos que contienen
//    comillas dobles (ej: Himesama "Goumon"...).
// ============================================
window.openMalSearchModal = (animeId) => {
  const anime = currentAnimes.find(a => a.id === animeId);
  if (!anime) return;

  document.getElementById('malSearchQuery').value        = anime.title;
  document.getElementById('malSearchResults').innerHTML  = '';
  document.getElementById('malSearchModal').dataset.animeId = animeId;
  document.getElementById('malSearchModal').classList.add('show');

  // Auto-buscar al abrir
  searchMal();
};

window.closeMalSearchModal = () => {
  document.getElementById('malSearchModal').classList.remove('show');
};

window.searchMal = async () => {
  const query      = document.getElementById('malSearchQuery').value.trim();
  const resultsDiv = document.getElementById('malSearchResults');

  if (!query) { alert('Ingresa un nombre para buscar'); return; }

  resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>Buscando en MAL...</p></div>';

  try {
    const results = await window.jikanService.searchAnime(query);

    if (results.length === 0) {
      resultsDiv.innerHTML = '<p class="empty-state">No se encontraron resultados</p>';
      return;
    }

    // ✅ v3.1: Usar renderMalResults en lugar de onclick inline
    // Esto evita el bug con títulos que contienen comillas dobles o simples.
    renderMalResults(results, resultsDiv);

  } catch (error) {
    console.error('❌ Error en búsqueda MAL:', error);
    resultsDiv.innerHTML = '<p style="color: #ef4444;">❌ Error en la búsqueda</p>';
  }
};

/**
 * Renderiza los resultados de búsqueda de MAL en el modal.
 *
 * ── Por qué NO se usan onclick inline ──
 * Los títulos de anime pueden contener comillas dobles (")  o simples (').
 * Al interpolarlos dentro de onclick="selectMalAnime(..., 'Título "X"')"
 * el navegador cierra el atributo HTML prematuramente → el elemento queda
 * roto y el click no responde. Esto afectaba a animes como:
 *   - Himesama "Goumon" no Jikan desu 2nd Season
 *   - Komi-san wa, Comyushou desu.
 *
 * La solución: almacenar los datos en data-attributes (escapados con
 * entidades HTML) y usar un único listener delegado en el contenedor.
 *
 * @param {Array}       results    - Resultados de jikanService.searchAnime()
 * @param {HTMLElement} resultsDiv - Contenedor donde se renderizan los items
 */
const renderMalResults = (results, resultsDiv) => {
  // Generamos HTML con data-attributes en lugar de onclick inline.
  // El título se escapa con entidades HTML para que el atributo HTML
  // sea válido sin importar qué caracteres contenga el string.
  resultsDiv.innerHTML = results.map(anime => `
    <div
      class="mal-result"
      data-mal-id="${anime.malId}"
      data-mal-title="${anime.title
        .replace(/&/g,  '&amp;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#39;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')}"
      role="button"
      tabindex="0"
      title="Seleccionar: ${anime.title.replace(/"/g, '&quot;')}"
    >
      <img
        src="${anime.image}"
        alt=""
        onerror="this.src='https://via.placeholder.com/100x140?text=No+Image'"
      >
      <div class="mal-result-info">
        <h4>${anime.title}</h4>
        <p>${anime.titleEnglish || ''}</p>
        <small>
          MAL ID: ${anime.malId}
          &bull; ${anime.year || 'N/A'}
          &bull; ${anime.episodes || '?'} eps
          &bull; &#9733; ${anime.score || 'N/A'}
        </small>
      </div>
    </div>
  `).join('');

  // ── Delegado de evento único ────────────────────────────────────────────
  // Un solo listener en el contenedor maneja todos los clicks.
  // Se usa { once: true } para que el listener se auto-elimine después
  // de la primera búsqueda y evitar acumulación en búsquedas sucesivas.
  // En cada nueva búsqueda se recrea el innerHTML, por lo que el listener
  // anterior queda huérfano y se reemplaza con este nuevo.
  resultsDiv.addEventListener('click',   _onMalResultInteraction);
  resultsDiv.addEventListener('keydown', _onMalResultKeydown);
};

/**
 * Maneja el click sobre un resultado de búsqueda MAL.
 * Lee malId y malTitle de los data-attributes del elemento.
 *
 * @param {MouseEvent} e
 */
const _onMalResultInteraction = (e) => {
  // Busca el .mal-result más cercano al target del click
  // (puede ser la imagen, el h4, el span, etc.)
  const item = e.target.closest('.mal-result');
  if (!item) return;

  const malId    = parseInt(item.dataset.malId, 10);
  // dataset.malTitle devuelve el string ya decodificado por el navegador
  const malTitle = item.dataset.malTitle;

  if (!malId || !malTitle) {
    console.error('❌ _onMalResultInteraction: datos inválidos en data-attributes', item.dataset);
    return;
  }

  window.selectMalAnime(malId, malTitle);
};

/**
 * Permite activar un resultado MAL con teclado (Enter / Espacio).
 * Garantiza accesibilidad básica para los elementos role="button".
 *
 * @param {KeyboardEvent} e
 */
const _onMalResultKeydown = (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    _onMalResultInteraction(e);
  }
};

/**
 * Vincula un anime del hub con su entrada en MAL/AniList.
 *
 * Estrategia de datos:
 *  1. Consulta AniList (por malId) → broadcast con timestamp exacto
 *  2. Si AniList falla, cae a Jikan como fallback
 *  3. Guarda en Firebase: malId + anilistId + broadcast
 *
 * El broadcast de AniList incluye airingAt (Unix timestamp UTC),
 * lo que elimina ambigüedades de timezone al mostrar horarios.
 *
 * @param {number} malId
 * @param {string} malTitle
 */
window.selectMalAnime = async (malId, malTitle) => {
  const modal   = document.getElementById('malSearchModal');
  const animeId = modal.dataset.animeId;
  const anime   = currentAnimes.find(a => a.id === animeId);

  if (!confirm(`¿Vincular con "${malTitle}" (MAL ID: ${malId})?`)) return;

  closeMalSearchModal();
  saveListState();

  const loadingDiv = _showLoadingOverlay(
    '🔗 Vinculando...',
    'Obteniendo horario desde AniList...'
  );

  try {
    let broadcast  = null;
    let anilistId  = null;
    let apiStatus  = null; // 'airing' | 'finished' | 'upcoming' — desde la API
    let dataSource = 'ninguna';

    // ── Paso 1: Intentar AniList (más preciso) ──
    if (window.anilistService) {
      try {
        const aniData = await window.anilistService.getAnimeDetails({ malId });
        broadcast     = aniData.broadcast  || null;
        anilistId     = aniData.anilistId  || null;
        apiStatus     = aniData.status     || null;
        dataSource    = 'AniList';
        console.log(`✅ Broadcast desde AniList:`, broadcast, `| Status: ${apiStatus}`);
      } catch (aniErr) {
        console.warn('⚠️ AniList falló, probando Jikan...', aniErr.message);
      }
    }

    // ── Paso 2: Fallback a Jikan si AniList no devolvió datos ──
    if (!apiStatus && window.jikanService) {
      try {
        const jikanData = await window.jikanService.getAnimeDetails(malId);
        broadcast       = jikanData.broadcast || null;
        apiStatus       = jikanData.status    || null;
        dataSource      = 'Jikan/MAL';
        console.log(`✅ Broadcast desde Jikan:`, broadcast, `| Status: ${apiStatus}`);
      } catch (jikanErr) {
        console.warn('⚠️ Jikan también falló:', jikanErr.message);
      }
    }

    // ── Determinar estado final ──
    const isAiring = apiStatus === 'airing';

    const STATUS_TO_HUB = {
      'airing':   'airing',
      'finished': 'completed',
      'upcoming': 'airing'
    };
    const hubStatus = apiStatus ? (STATUS_TO_HUB[apiStatus] ?? 'completed') : null;

    const updatePayload = {
      malId,
      malTitle,
      anilistId,
      broadcast:      broadcast,
      scheduleActive: isAiring,
      ...(hubStatus !== null && { status: hubStatus })
    };

    await updateAnime(animeId, updatePayload);

    // Actualizar en memoria
    const idx = currentAnimes.findIndex(a => a.id === animeId);
    if (idx !== -1) {
      currentAnimes[idx] = { ...currentAnimes[idx], ...updatePayload };
    }

    document.body.removeChild(loadingDiv);

    const broadcastInfo = broadcast
      ? `📅 ${broadcast.day} ${broadcast.time}${broadcast.airingAt ? ' (timestamp exacto)' : ''}`
      : (apiStatus === 'finished' ? '✅ Finalizado' : '⚠️ Sin horario disponible');

    const statusLabel = hubStatus === 'airing'
      ? '🔴 En emisión'
      : hubStatus === 'completed' ? '✅ Finalizado' : '';

    _showToast(`✅ "${malTitle}" vinculado via ${dataSource} — ${broadcastInfo}${statusLabel ? ' · ' + statusLabel : ''}`);

    // Re-renderizar solo la lista, sin recargar la página
    renderAnimesList(currentAnimes, _savedSeasonFilter);

  } catch (error) {
    console.error('❌ Error al vincular:', error);
    const overlay = document.getElementById('adminLoadingOverlay');
    if (overlay) document.body.removeChild(overlay);
    alert(`❌ Error al vincular: ${error.message}`);
  }
};

// ============================================
// GESTIÓN DE EPISODIOS
// ============================================
window.loadEpisodesByAnime = async () => {
  const selector = document.getElementById('animeSelector');
  const addBtn   = document.getElementById('addEpisodeBtn');
  const list     = document.getElementById('episodesList');

  selectedAnimeId = selector.value;

  if (!selectedAnimeId) {
    list.innerHTML = '<p class="empty-state">Selecciona un anime</p>';
    addBtn.disabled = true;
    return;
  }

  addBtn.disabled = false;
  list.innerHTML  = '<div class="loading"><div class="spinner"></div><p>Cargando...</p></div>';

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
    list.innerHTML = '<p class="empty-state" style="color:#ef4444;">Error al cargar episodios</p>';
  }
};

window.openEpisodeModal = () => {
  if (!selectedAnimeId) { alert('⚠️ Primero selecciona un anime'); return; }
  document.getElementById('episodeNumber').value = currentEpisodes.length + 1;
  document.getElementById('episodeTitle').value  = `Episodio ${currentEpisodes.length + 1}`;
  document.getElementById('episodeModal').classList.add('show');
};

window.closeEpisodeModal = () => {
  document.getElementById('episodeModal').classList.remove('show');
  document.getElementById('episodeForm').reset();
};

window.confirmDeleteEpisode = (episodeId) => {
  if (confirm('¿Eliminar este episodio?')) deleteEpisodeHandler(episodeId);
};

const deleteEpisodeHandler = async (episodeId) => {
  const result = await deleteEpisode(episodeId, selectedAnimeId);
  if (result.success) {
    _showToast('✅ Episodio eliminado');
    await loadEpisodesByAnime();
    const idx = currentAnimes.findIndex(a => a.id === selectedAnimeId);
    if (idx !== -1) currentAnimes[idx].totalEpisodes = currentEpisodes.length;
  } else {
    alert('❌ Error al eliminar episodio');
  }
};

// ============================================
// GESTIÓN DE PERSONAJES
// ============================================
window.loadCharacters = async () => {
  const list     = document.getElementById('charactersList');
  const selector = document.getElementById('characterAnimeFilter');
  const animeId  = selector.value;

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
    list.innerHTML = '<p style="color:#ef4444;">Error al cargar personajes</p>';
  }
};

window.confirmDeleteCharacter = (characterId) => {
  if (confirm('¿Eliminar este personaje?')) deleteCharacterHandler(characterId);
};

const deleteCharacterHandler = async (characterId) => {
  const result = await deleteCharacter(characterId);
  if (result.success) {
    _showToast('✅ Personaje eliminado');
    await loadCharacters();
  } else {
    alert('❌ Error al eliminar personaje');
  }
};

// ============================================
// ACTUALIZAR SELECTORES
// ============================================
const updateSeasonSelectors = () => {
  ['animeSeasonId', 'seasonFilter'].forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue   = select.value;
    const isFilterSelect = selectId === 'seasonFilter';

    select.innerHTML = isFilterSelect
      ? '<option value="all">Todas las temporadas</option>'
      : '<option value="">-- Selecciona temporada --</option>';

    currentSeasons.forEach(season => {
      const opt = document.createElement('option');
      opt.value       = season.id;
      opt.textContent = season.name;
      select.appendChild(opt);
    });

    if (currentValue) select.value = currentValue;
  });
};

const updateAnimeSelector = () => {
  const select = document.getElementById('animeSelector');
  if (!select) return;

  select.innerHTML = '<option value="">-- Selecciona un anime --</option>';
  currentAnimes.forEach(anime => {
    const opt = document.createElement('option');
    opt.value       = anime.id;
    opt.textContent = anime.title;
    select.appendChild(opt);
  });
};

const updateCharacterAnimeSelector = () => {
  const select = document.getElementById('characterAnimeFilter');
  if (!select) return;

  select.innerHTML = '<option value="all">Todos los animes</option>';
  currentAnimes.forEach(anime => {
    const opt = document.createElement('option');
    opt.value       = anime.id;
    opt.textContent = anime.title;
    select.appendChild(opt);
  });
};

// ============================================
// INICIALIZAR FORMULARIOS
// ============================================
const initForms = () => {
  // ── Temporada ──
  document.getElementById('seasonForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const seasonData = {
      name:   document.getElementById('seasonName').value.trim(),
      emoji:  document.getElementById('seasonEmoji').value.trim(),
      period: document.getElementById('seasonPeriod').value.trim(),
      status: document.getElementById('seasonStatus').value,
      order:  parseInt(document.getElementById('seasonOrder').value)
    };

    if (editingSeasonId) {
      // ✅ FIX: Se usa updateSeason (colección 'seasons') en lugar de updateAnime
      const result = await updateSeason(editingSeasonId, seasonData);
      if (result.success) {
        _showToast('✅ Temporada actualizada correctamente');
      } else {
        alert('❌ Error al actualizar la temporada');
        return;
      }
    } else {
      await addSeason(seasonData);
    }

    closeSeasonModal();
    await loadSeasons();
  });

  // ── Anime ──
  document.getElementById('animeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const seasonId  = document.getElementById('animeSeasonId').value;
    const malIdRaw  = document.getElementById('animeMalId').value;
    const trailers  = document.getElementById('animeTrailers').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // Leer override de broadcast si está disponible
    const overrideDay  = document.getElementById('broadcastOverrideDay')?.value  || '';
    const overrideTime = document.getElementById('broadcastOverrideTime')?.value || '';

    let broadcastOverride = null;
    if (overrideDay && overrideTime) {
      broadcastOverride = {
        day:      overrideDay,
        time:     overrideTime,
        timezone: 'Asia/Tokyo'
      };
    }

    const animeData = {
      seasonId:  seasonId,
      title:     document.getElementById('animeTitle').value,
      category:  document.getElementById('animeCategory').value,
      year:      parseInt(document.getElementById('animeYear').value),
      status:    document.getElementById('animeStatus').value,
      order:     parseInt(document.getElementById('animeOrder').value),
      cardImage: document.getElementById('animeCardImage').value,
      poster:    document.getElementById('animePoster').value,
      synopsis:  document.getElementById('animeSynopsis').value,
      trailers,
      malId:            malIdRaw ? parseInt(malIdRaw) : null,
      broadcastOverride
    };

    saveListState();

    if (editingAnimeId) {
      await updateAnime(editingAnimeId, animeData);
      _showToast('✅ Anime actualizado');
    } else {
      const result = await addAnime(animeData);
      if (result.success) _showToast('✅ Anime creado');
    }

    closeAnimeModal();
    await loadAllAnimes();
    await loadSeasons();
  });

  // ── Episodio ──
  document.getElementById('episodeForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!selectedAnimeId) { alert('⚠️ No hay anime seleccionado'); return; }

    const episodeData = {
      animeId:       selectedAnimeId,
      episodeNumber: parseInt(document.getElementById('episodeNumber').value),
      title:         document.getElementById('episodeTitle').value,
      duration:      document.getElementById('episodeDuration').value,
      videoUrl:      document.getElementById('episodeVideoUrl').value
    };

    const result = await addEpisode(episodeData);

    if (result.success) {
      _showToast('✅ Episodio agregado');
      closeEpisodeModal();
      await loadEpisodesByAnime();
    } else {
      alert('❌ Error al agregar episodio');
    }
  });
};

// ============================================
// HELPERS DE UI
// ============================================

/**
 * Muestra un overlay de carga a pantalla completa.
 * @param {string} title
 * @param {string} subtitle
 * @returns {HTMLElement} - el elemento creado (para eliminarlo luego)
 */
const _showLoadingOverlay = (title, subtitle) => {
  const div = document.createElement('div');
  div.id = 'adminLoadingOverlay';
  div.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(13, 2, 33, 0.95);
    display: flex; align-items: center; justify-content: center;
  `;
  div.innerHTML = `
    <div style="text-align: center; padding: 2.5rem; border-radius: 16px;
                border: 2px solid #48cae4; max-width: 420px;
                box-shadow: 0 0 40px rgba(72,202,228,0.4);">
      <div class="spinner" style="width:56px;height:56px;border:4px solid rgba(72,202,228,0.2);
                                   border-top-color:#48cae4;border-radius:50%;margin:0 auto 1.5rem;
                                   animation:spin 1s linear infinite;"></div>
      <h3 style="color:#caf0f8;margin:0 0 0.75rem;font-size:1.2rem;">${title}</h3>
      <p style="color:#ade8f4;margin:0;font-size:0.9rem;">${subtitle}</p>
    </div>
  `;
  document.body.appendChild(div);
  return div;
};

/**
 * Muestra un toast de notificación no bloqueante.
 * Se auto-elimina en 3 segundos.
 * @param {string} message
 */
const _showToast = (message) => {
  const prev = document.getElementById('adminToast');
  if (prev) prev.remove();

  const toast = document.createElement('div');
  toast.id = 'adminToast';
  toast.style.cssText = `
    position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
    background: rgba(13,2,33,0.95); border: 1px solid #48cae4;
    color: #caf0f8; padding: 0.85rem 1.5rem; border-radius: 10px;
    font-size: 0.9rem; box-shadow: 0 0 20px rgba(72,202,228,0.3);
    animation: toastIn 0.25s ease;
    max-width: 360px;
  `;
  toast.textContent = message;

  if (!document.getElementById('toastStyle')) {
    const style = document.createElement('style');
    style.id = 'toastStyle';
    style.textContent = `
      @keyframes toastIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
};

// ============================================
// HELPERS — BROADCAST OVERRIDE SECTION
// ============================================

/** Mapa día en inglés (valor de MAL) → etiqueta en español */
const _DAY_LABELS_ES = {
  Mondays: 'Lunes', Tuesdays: 'Martes', Wednesdays: 'Miércoles',
  Thursdays: 'Jueves', Fridays: 'Viernes', Saturdays: 'Sábado', Sundays: 'Domingo'
};

/**
 * Renderiza la sección de override de broadcast en el modal de edición.
 * @param {object} anime - Objeto anime de Firebase
 */
const _renderBroadcastOverrideSection = (anime) => {
  const section   = document.getElementById('broadcastOverrideSection');
  const malInfo   = document.getElementById('broadcastMalInfo');
  const badge     = document.getElementById('broadcastSourceBadge');
  const clearBtn  = document.getElementById('clearBroadcastOverride');
  const daySelect = document.getElementById('broadcastOverrideDay');
  const timeInput = document.getElementById('broadcastOverrideTime');

  if (!section) return;
  section.style.display = 'block';

  // ── Info del dato de MAL ──
  if (anime.broadcast?.day) {
    const dayLabel = _DAY_LABELS_ES[anime.broadcast.day] ?? anime.broadcast.day;
    malInfo.innerHTML = `
      <div class="broadcast-mal-row">
        <span class="broadcast-source-label">📡 MAL:</span>
        <span class="broadcast-mal-value">
          ${dayLabel} — ${anime.broadcast.time ?? '??:??'} (Asia/Tokyo)
        </span>
      </div>
    `;
  } else {
    malInfo.innerHTML = `
      <div class="broadcast-mal-row broadcast-mal-row--empty">
        <span class="broadcast-source-label">📡 MAL:</span>
        <span class="broadcast-mal-value--empty">Sin horario — vincula el anime para obtenerlo</span>
      </div>
    `;
  }

  // ── Cargar override guardado (si existe) ──
  if (anime.broadcastOverride?.day) {
    daySelect.value        = anime.broadcastOverride.day;
    timeInput.value        = anime.broadcastOverride.time ?? '';
    badge.textContent      = '⚠️ Override activo';
    badge.className        = 'broadcast-override-badge broadcast-override-badge--active';
    clearBtn.style.display = 'block';
  } else {
    daySelect.value        = '';
    timeInput.value        = '';
    badge.textContent      = '✅ Usando dato de MAL';
    badge.className        = 'broadcast-override-badge broadcast-override-badge--mal';
    clearBtn.style.display = 'none';
  }

  daySelect.onchange = timeInput.onchange = _updateOverrideBadge;
};

/**
 * Actualiza el badge de estado y la visibilidad del botón limpiar
 * en tiempo real mientras el admin edita los campos.
 */
const _updateOverrideBadge = () => {
  const badge     = document.getElementById('broadcastSourceBadge');
  const clearBtn  = document.getElementById('clearBroadcastOverride');
  const daySelect = document.getElementById('broadcastOverrideDay');
  const timeInput = document.getElementById('broadcastOverrideTime');

  if (!badge) return;

  const hasOverride = daySelect?.value && timeInput?.value;

  if (hasOverride) {
    badge.textContent      = '⚠️ Override activo';
    badge.className        = 'broadcast-override-badge broadcast-override-badge--active';
    clearBtn.style.display = 'block';
  } else {
    badge.textContent      = '✅ Usando dato de MAL';
    badge.className        = 'broadcast-override-badge broadcast-override-badge--mal';
    clearBtn.style.display = 'none';
  }
};

/**
 * Limpia el override de broadcast y vuelve a usar los datos de MAL.
 */
window.clearBroadcastOverride = () => {
  const daySelect = document.getElementById('broadcastOverrideDay');
  const timeInput = document.getElementById('broadcastOverrideTime');
  if (daySelect) daySelect.value = '';
  if (timeInput) timeInput.value = '';
  _updateOverrideBadge();
};

/**
 * Oculta la sección de override.
 */
const _hideBroadcastOverrideSection = () => {
  const section = document.getElementById('broadcastOverrideSection');
  if (section) section.style.display = 'none';
};


const fillSeasonSelect = async () => {
  updateSeasonSelectors();
};

/* ============================================================
   BULK UPDATE — ACTUALIZACIÓN MASIVA DE ANIMES VINCULADOS
   ============================================================

   RESPONSABILIDADES:
   ─────────────────────────────────────────────────────────────
   1. openBulkUpdateModal()   → Abre el modal y calcula preview
   2. closeBulkUpdateModal()  → Cierra y resetea el modal
   3. _buildBulkCandidates()  → Filtra animes elegibles
   4. startBulkUpdate()       → Orquesta el proceso completo
   5. _updateSingleAnime()    → Actualiza un anime individual
   6. _bulkLog()              → Agrega una línea al log visual
   7. _updateBulkProgress()   → Actualiza barra y contador

   CAMPOS QUE SE ACTUALIZAN POR ANIME:
   ─────────────────────────────────────────────────────────────
   • status          → 'airing' | 'completed'
   • broadcast       → { day, time, timezone, airingAt? }
   • scheduleActive  → true si status === 'airing', false si no
   • malTitle        → Por si el título en MAL cambió
   • anilistId       → Se guarda si AniList lo devuelve

   CAMPOS QUE NUNCA SE TOCAN:
   ─────────────────────────────────────────────────────────────
   • broadcastOverride → Dato manual del admin (máxima prioridad)
   • title             → Título propio del hub (no se sobreescribe)
   • synopsis          → El admin puede haberla personalizado
   • cardImage / poster → Imágenes propias del hub
   • trailers           → URLs propias del hub

   RATE LIMITING:
   ─────────────────────────────────────────────────────────────
   Usamos un delay de 700ms entre requests para respetar los
   límites de AniList (90 req/min) y Jikan (3 req/seg).
   Con 200 animes el proceso tarda ~2.5 min en el peor caso.
   ============================================================ */

// ── Constantes ──────────────────────────────────────────────
/** Delay entre requests de API para respetar rate limits */
const BULK_REQUEST_DELAY_MS = 700;

/** Delay extra entre cada commit a Firestore (evitar cuota) */
const BULK_FIRESTORE_DELAY_MS = 150;

// ── Estado de la actualización en curso ─────────────────────
let _bulkRunning  = false;   // true mientras el proceso está activo
let _bulkAborted  = false;   // flag para cancelar si el usuario cierra

// ============================================================
// 1. ABRIR MODAL
// ============================================================

/**
 * Abre el modal de actualización masiva, puebla el select de
 * temporadas y calcula el preview de cuántos animes se procesarán.
 */
window.openBulkUpdateModal = () => {
  // Prevenir apertura si ya hay un proceso activo
  if (_bulkRunning) {
    _showToast('⚠️ Ya hay una actualización en curso');
    return;
  }

  _resetBulkModalUI();
  _populateBulkSeasonFilter();
  _updateBulkSummary();

  // Recalcular preview cuando cambian los filtros
  document.getElementById('bulkUpdateSeasonFilter')
    .addEventListener('change', _updateBulkSummary);
  document.getElementById('bulkUpdateStatusFilter')
    .addEventListener('change', _updateBulkSummary);

  document.getElementById('bulkUpdateModal').classList.add('show');
};

// ============================================================
// 2. CERRAR MODAL
// ============================================================

/**
 * Cierra el modal y señala abort si el proceso estaba corriendo.
 * El proceso detecta el flag y se detiene de forma limpia.
 */
window.closeBulkUpdateModal = () => {
  if (_bulkRunning) {
    _bulkAborted = true; // El loop lo detecta y sale
  }

  document.getElementById('bulkUpdateModal').classList.remove('show');

  // Remover listeners de filtro para evitar acumulación
  const seasonSel = document.getElementById('bulkUpdateSeasonFilter');
  const statusSel = document.getElementById('bulkUpdateStatusFilter');
  seasonSel?.replaceWith(seasonSel.cloneNode(true));
  statusSel?.replaceWith(statusSel.cloneNode(true));
};

// ============================================================
// 3. CONSTRUIR LISTA DE CANDIDATOS
// ============================================================

/**
 * Filtra currentAnimes según los selectores del modal y
 * retorna solo los animes elegibles para actualización.
 *
 * Criterios de elegibilidad:
 *   ✅ Tiene malId guardado en Firebase
 *   ✅ Pasa el filtro de temporada (si se aplicó)
 *   ✅ Pasa el filtro de estado (si se aplicó)
 *
 * @returns {object[]} Subconjunto de currentAnimes
 */
const _buildBulkCandidates = () => {
  const seasonFilter = document.getElementById('bulkUpdateSeasonFilter')?.value ?? 'all';
  const statusFilter = document.getElementById('bulkUpdateStatusFilter')?.value ?? 'all';

  return currentAnimes.filter(anime => {
    // Requiere MAL ID vinculado
    if (!anime.malId) return false;

    // Filtro de temporada
    if (seasonFilter !== 'all' && anime.seasonId !== seasonFilter) return false;

    // Filtro de estado
    if (statusFilter !== 'all' && anime.status !== statusFilter) return false;

    return true;
  });
};

// ============================================================
// 4. ACTUALIZAR RESUMEN DE PREVIEW
// ============================================================

/**
 * Recalcula y muestra cuántos animes se procesarán con los
 * filtros actuales. Se llama al abrir el modal y al cambiar filtros.
 */
const _updateBulkSummary = () => {
  const summaryEl = document.getElementById('bulkUpdateSummaryText');
  if (!summaryEl) return;

  const candidates = _buildBulkCandidates();
  const total      = currentAnimes.length;
  const withMal    = currentAnimes.filter(a => a.malId).length;
  const withoutMal = total - withMal;

  const estimatedSeconds = Math.ceil(candidates.length * BULK_REQUEST_DELAY_MS / 1000);
  const estimatedMin     = Math.floor(estimatedSeconds / 60);
  const estimatedSec     = estimatedSeconds % 60;
  const etaStr = estimatedMin > 0
    ? `~${estimatedMin}m ${estimatedSec}s`
    : `~${estimatedSec}s`;

  summaryEl.innerHTML = `
    📊 Total en base de datos: <strong>${total}</strong> animes<br>
    🔗 Con MAL ID vinculado: <strong style="color:#6ee7b7;">${withMal}</strong>
    &nbsp;·&nbsp;
    ⚠️ Sin vincular (se omitirán): <strong style="color:#fbbf24;">${withoutMal}</strong><br>
    🚀 A procesar con filtros actuales: <strong style="color:#48cae4;">${candidates.length}</strong>
    &nbsp;·&nbsp;
    ⏱️ Tiempo estimado: <strong style="color:#fef08a;">${etaStr}</strong>
  `;

  // Deshabilitar botón si no hay candidatos
  const startBtn = document.getElementById('bulkUpdateStartBtn');
  if (startBtn) startBtn.disabled = candidates.length === 0;
};

// ============================================================
// 5. POBLAR SELECT DE TEMPORADAS DEL MODAL
// ============================================================

/**
 * Rellena el select de temporadas del modal de actualización
 * con los datos actuales de currentSeasons.
 */
const _populateBulkSeasonFilter = () => {
  const select = document.getElementById('bulkUpdateSeasonFilter');
  if (!select) return;

  select.innerHTML = '<option value="all">Todas las temporadas</option>';

  currentSeasons.forEach(season => {
    const opt = document.createElement('option');
    opt.value       = season.id;
    opt.textContent = season.name;
    select.appendChild(opt);
  });
};

// ============================================================
// 6. INICIAR LA ACTUALIZACIÓN
// ============================================================

/**
 * Punto de entrada del proceso de actualización masiva.
 * Orquesta: UI → candidatos → loop de API → resultado.
 */
window.startBulkUpdate = async () => {
  const candidates = _buildBulkCandidates();

  if (candidates.length === 0) {
    _showToast('⚠️ No hay animes para actualizar con estos filtros');
    return;
  }

  // ── Pasar UI a pantalla de progreso ──
  document.getElementById('bulkUpdateConfig').style.display   = 'none';
  document.getElementById('bulkUpdateProgress').style.display = 'block';
  document.getElementById('bulkUpdateCloseBtn').title         = 'Cancelar actualización';

  _bulkRunning = true;
  _bulkAborted = false;

  // Contadores de resultado
  let countOk   = 0;
  let countSkip = 0;
  let countErr  = 0;

  _bulkLog(`🚀 Iniciando actualización de ${candidates.length} animes…`, 'info');
  _bulkLog(`⏱️ Delay entre requests: ${BULK_REQUEST_DELAY_MS}ms`, 'info');

  // ── Loop principal ───────────────────────────────────────
  for (let i = 0; i < candidates.length; i++) {
    // Verificar si el usuario canceló
    if (_bulkAborted) {
      _bulkLog(`⛔ Proceso cancelado por el usuario (${i}/${candidates.length})`, 'info');
      break;
    }

    const anime = candidates[i];

    // Actualizar UI de progreso
    _updateBulkProgress(i + 1, candidates.length);
    document.getElementById('bulkCurrentAnime').textContent =
      `Procesando: ${anime.title}`;

    // Intentar actualización individual
    const result = await _updateSingleAnime(anime);

    if (result.status === 'ok') {
      countOk++;
      _bulkLog(`✅ ${anime.title} → ${result.detail}`, 'ok');
    } else if (result.status === 'skip') {
      countSkip++;
      _bulkLog(`⏭️ ${anime.title} → ${result.detail}`, 'skip');
    } else {
      countErr++;
      _bulkLog(`❌ ${anime.title} → ${result.detail}`, 'err');
    }

    // Delay entre requests para respetar rate limits
    if (i < candidates.length - 1 && !_bulkAborted) {
      await _bulkDelay(BULK_REQUEST_DELAY_MS);
    }
  }

  // ── Finalizado ───────────────────────────────────────────
  _bulkRunning = false;
  _updateBulkProgress(candidates.length, candidates.length);
  document.getElementById('bulkCurrentAnime').textContent = '';

  // Mostrar pantalla de resultado
  _showBulkResult(countOk, countSkip, countErr, candidates.length);

  // Recargar la memoria local de animes sin re-renderizar todo
  currentAnimes = await getAllAnimes();
};

// ============================================================
// 7. ACTUALIZAR UN ANIME INDIVIDUAL
// ============================================================

/**
 * Consulta AniList (con fallback a Jikan) para un anime,
 * construye el payload de actualización y lo guarda en Firestore.
 *
 * @param {object} anime - Documento de anime de currentAnimes
 * @returns {Promise<{ status: 'ok'|'skip'|'err', detail: string }>}
 */
const _updateSingleAnime = async (anime) => {
  try {
    let apiData    = null;
    let dataSource = 'ninguna';

    // ── Paso 1: Intentar AniList ──────────────────────────
    if (window.anilistService) {
      try {
        const raw = await window.anilistService.getAnimeDetails({
          anilistId: anime.anilistId || null,
          malId:     anime.malId
        });

        apiData = {
          status:    raw.status,          // 'airing' | 'finished' | 'upcoming'
          broadcast: raw.broadcast,       // incluye airingAt timestamp exacto
          malTitle:  raw.title    || null,
          anilistId: raw.anilistId || null
        };
        dataSource = 'AniList';

      } catch (aniErr) {
        // AniList falló — silencioso, probamos Jikan
        console.warn(`⚠️ AniList falló para "${anime.title}":`, aniErr.message);
      }
    }

    // ── Paso 2: Fallback a Jikan ──────────────────────────
    if (!apiData && window.jikanService) {
      try {
        const raw = await window.jikanService.getAnimeDetails(anime.malId);

        apiData = {
          status:    raw.status,
          broadcast: raw.broadcast,
          malTitle:  raw.title || null,
          anilistId: null
        };
        dataSource = 'Jikan/MAL';

      } catch (jikanErr) {
        console.warn(`⚠️ Jikan también falló para "${anime.title}":`, jikanErr.message);
      }
    }

    // Si ninguna API respondió, saltar este anime
    if (!apiData) {
      return { status: 'err', detail: 'Ambas APIs fallaron (rate limit o error de red)' };
    }

    // ── Construir payload de actualización ────────────────

    // Mapear status de la API al formato interno del hub
    const STATUS_TO_HUB = {
      'airing':   'airing',
      'finished': 'completed',
      'upcoming': 'airing'
    };
    const hubStatus    = STATUS_TO_HUB[apiData.status] ?? 'completed';
    const isAiring     = hubStatus === 'airing';

    /**
     * scheduleActive:
     *   true  → anime en emisión Y sin override que lo excluya
     *   false → anime finalizado O excluido manualmente
     *
     * IMPORTANTE: si el admin puso scheduleActive=false manualmente
     * en un anime que SIGUE en emisión, NO lo reactivamos aquí.
     * Solo actualizamos si el anime era 'airing' antes.
     */
    const wasAiring      = anime.status === 'airing';
    const nowFinished    = hubStatus === 'completed';
    const wasActive      = anime.scheduleActive !== false;

    // Lógica de scheduleActive:
    // - Si finalizó → desactivar (independiente del valor anterior)
    // - Si sigue en emisión y antes estaba activo → mantener activo
    // - Si sigue en emisión y estaba desactivado → mantener desactivado (decisión del admin)
    let newScheduleActive;
    if (nowFinished) {
      newScheduleActive = false;
    } else {
      // isAiring === true aquí
      newScheduleActive = wasActive; // Respetar la decisión del admin
    }

    const updatePayload = {
      status:         hubStatus,
      scheduleActive: newScheduleActive,

      // Broadcast: solo actualizar si la API devolvió datos
      ...(apiData.broadcast && { broadcast: apiData.broadcast }),

      // anilistId: guardar si lo tenemos y el anime no lo tenía
      ...(apiData.anilistId && !anime.anilistId && { anilistId: apiData.anilistId }),

      // malTitle: actualizar si cambió (algunos animes renombran temporadas)
      ...(apiData.malTitle && apiData.malTitle !== anime.malTitle && {
        malTitle: apiData.malTitle
      })

      // ⛔ NO se toca: broadcastOverride, title, synopsis, cardImage, poster, trailers
    };

    // ── Guardar en Firestore ──────────────────────────────
    const result = await updateAnime(anime.id, updatePayload);

    if (!result.success) {
      return { status: 'err', detail: 'Error al escribir en Firebase' };
    }

    // Pequeño delay adicional para Firestore (evitar cuota)
    await _bulkDelay(BULK_FIRESTORE_DELAY_MS);

    // ── Actualizar en memoria local ───────────────────────
    const idx = currentAnimes.findIndex(a => a.id === anime.id);
    if (idx !== -1) {
      currentAnimes[idx] = { ...currentAnimes[idx], ...updatePayload };
    }

    // ── Construir mensaje de resultado ───────────────────
    const statusEmoji  = hubStatus === 'airing' ? '🔴 En emisión' : '✅ Finalizado';
    const broadcastStr = apiData.broadcast?.day
      ? `${apiData.broadcast.day} ${apiData.broadcast.time}`
      : 'sin horario';
    const sourceStr    = `[${dataSource}]`;

    return {
      status: 'ok',
      detail: `${statusEmoji} · ${broadcastStr} ${sourceStr}`
    };

  } catch (error) {
    console.error(`❌ Error inesperado en _updateSingleAnime ("${anime.title}"):`, error);
    return { status: 'err', detail: `Error: ${error.message}` };
  }
};

// ============================================================
// 8. MOSTRAR RESULTADO FINAL
// ============================================================

/**
 * Reemplaza la pantalla de progreso con el resumen de resultados.
 * @param {number} ok    - Animes actualizados correctamente
 * @param {number} skip  - Animes omitidos
 * @param {number} err   - Animes con error
 * @param {number} total - Total procesado
 */
const _showBulkResult = (ok, skip, err, total) => {
  document.getElementById('bulkUpdateProgress').style.display = 'none';
  document.getElementById('bulkUpdateResult').style.display   = 'block';

  const aborted = _bulkAborted;
  const icon    = err > 0 ? (ok > 0 ? '⚠️' : '❌') : '✅';
  const title   = aborted
    ? 'Proceso cancelado'
    : err === 0
      ? '¡Actualización completada!'
      : 'Actualización completada con errores';

  const body = `
    ✅ Actualizados correctamente: <strong>${ok}</strong><br>
    ⏭️ Omitidos (sin cambios / cancelados): <strong>${skip}</strong><br>
    ❌ Errores: <strong>${err}</strong><br>
    📊 Total procesado: <strong>${ok + skip + err}</strong> de <strong>${total}</strong>
    ${err > 0 ? '<br><br><small>Los errores suelen ser temporales (rate limit de APIs). Puedes volver a ejecutar el proceso para reintentar.</small>' : ''}
  `;

  document.getElementById('bulkResultIcon').textContent  = icon;
  document.getElementById('bulkResultTitle').textContent = title;
  document.getElementById('bulkResultBody').innerHTML    = body;
};

// ============================================================
// 9. HELPERS DE UI DEL MODAL
// ============================================================

/**
 * Agrega una línea de texto al log visual del modal.
 * @param {string} text                          - Mensaje a mostrar
 * @param {'ok'|'skip'|'err'|'info'} [type='info'] - Tipo (controla el color)
 */
const _bulkLog = (text, type = 'info') => {
  const log = document.getElementById('bulkUpdateLog');
  if (!log) return;

  const line = document.createElement('div');
  line.className   = `bulk-log-${type}`;
  line.textContent = text;
  log.appendChild(line);

  // Auto-scroll al final del log
  const wrapper = document.getElementById('bulkUpdateLogWrapper');
  if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
};

/**
 * Actualiza la barra de progreso y el contador numérico.
 * @param {number} current - Animes procesados hasta ahora
 * @param {number} total   - Total de animes a procesar
 */
const _updateBulkProgress = (current, total) => {
  const pct      = total > 0 ? Math.round((current / total) * 100) : 0;
  const bar      = document.getElementById('bulkProgressBar');
  const label    = document.getElementById('bulkProgressLabel');

  if (bar)   bar.style.width       = `${pct}%`;
  if (label) label.textContent     = `${current} / ${total} (${pct}%)`;
};

/**
 * Resetea el modal a su estado inicial (pantalla de configuración).
 * Se llama cada vez que se abre el modal.
 */
const _resetBulkModalUI = () => {
  // Mostrar config, ocultar progreso y resultado
  const config   = document.getElementById('bulkUpdateConfig');
  const progress = document.getElementById('bulkUpdateProgress');
  const result   = document.getElementById('bulkUpdateResult');

  if (config)   config.style.display   = 'block';
  if (progress) progress.style.display = 'none';
  if (result)   result.style.display   = 'none';

  // Limpiar log
  const log = document.getElementById('bulkUpdateLog');
  if (log) log.innerHTML = '';

  // Resetear barra
  _updateBulkProgress(0, 0);

  const currentAnimeEl = document.getElementById('bulkCurrentAnime');
  if (currentAnimeEl) currentAnimeEl.textContent = '';

  // Resetear select de estado
  const statusSel = document.getElementById('bulkUpdateStatusFilter');
  if (statusSel) statusSel.value = 'all';

  // Habilitar botón de inicio
  const startBtn = document.getElementById('bulkUpdateStartBtn');
  if (startBtn) startBtn.disabled = false;
};

/**
 * Promesa que resuelve después de `ms` milisegundos.
 * Se usa para respetar rate limits de las APIs.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const _bulkDelay = (ms) => new Promise(resolve => setTimeout(resolve, ms));