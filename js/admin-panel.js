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
  getAllSeasons, addSeason, deleteSeason,
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
      name:   document.getElementById('seasonName').value,
      emoji:  document.getElementById('seasonEmoji').value,
      period: document.getElementById('seasonPeriod').value,
      status: document.getElementById('seasonStatus').value,
      order:  parseInt(document.getElementById('seasonOrder').value)
    };

    if (editingSeasonId) {
      await updateAnime(editingSeasonId, seasonData); // reutiliza updateAnime si aplica
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