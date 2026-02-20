/* ============================================
   MY-LIST.JS — Control de Animes
   Autor: Jaykai2

   Responsabilidades:
   - Leer favoritos del localStorage
   - Renderizar tarjetas con filtros en tiempo real
   - Cambiar estado de un anime (Viendo / Pendiente / Finalizado)
   - Eliminar animes de la lista
   - Sincronizar cambios al localStorage
   ============================================ */

'use strict';

/* --------------------------------------------------
   CONSTANTES Y ESTADO DE LA APLICACIÓN
-------------------------------------------------- */

/** Clave de localStorage donde se persiste la lista */
const LS_KEY = 'favorites';

/**
 * Labels y clases CSS para cada estado.
 * Añadir un estado nuevo aquí es suficiente para
 * que aparezca en badge + select automáticamente.
 */
const STATUS_CONFIG = {
  watching:  { label: 'Viendo',     cssClass: 'watching'  },
  pending:   { label: 'Pendiente',  cssClass: 'pending'   },
  completed: { label: 'Finalizado', cssClass: 'completed' }
};

/** Estado reactivo del módulo */
const state = {
  /** @type {Array<Object>} Lista completa de favoritos */
  favorites: [],

  /** @type {string} Texto de búsqueda actual */
  searchQuery: '',

  /** @type {string} Filtro de estado seleccionado  */
  filterStatus: 'all',

  /** @type {string} Filtro de año seleccionado */
  filterYear: 'all',

  /** @type {string} Filtro de estación seleccionado */
  filterSeason: 'all'
};

/* --------------------------------------------------
   ACCESO AL DOM (resuelto una sola vez en init)
-------------------------------------------------- */
const DOM = {};

const resolveDOMRefs = () => {
  DOM.animeGrid      = document.getElementById('animeGrid');
  DOM.emptyState     = document.getElementById('emptyState');
  DOM.noResultsState = document.getElementById('noResultsState');
  DOM.countVisible   = document.getElementById('countVisible');
  DOM.countTotal     = document.getElementById('countTotal');
  DOM.searchInput    = document.getElementById('searchInput');
  DOM.clearSearchBtn = document.getElementById('clearSearchBtn');
  DOM.statusFilter   = document.getElementById('statusFilter');
  DOM.yearFilter     = document.getElementById('yearFilter');
  DOM.seasonFilter   = document.getElementById('seasonFilter');
  DOM.clearFiltersBtn= document.getElementById('clearFiltersBtn');
  DOM.toastContainer = document.getElementById('toastContainer');
};

/* --------------------------------------------------
   PERSISTENCIA: localStorage
-------------------------------------------------- */

/**
 * Lee la lista de favoritos del localStorage.
 * @returns {Array<Object>}
 */
const readFavorites = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('❌ Error al leer favoritos:', err);
    return [];
  }
};

/**
 * Persiste la lista actual de favoritos en localStorage.
 * @param {Array<Object>} list
 */
const writeFavorites = (list) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('❌ Error al guardar favoritos:', err);
    showToast('Error al guardar cambios', 'error');
  }
};

/* --------------------------------------------------
   SANITIZACIÓN (prevención XSS)
-------------------------------------------------- */

/**
 * Escapa caracteres peligrosos en cadenas de texto
 * antes de inyectarlos en el DOM mediante innerHTML.
 * @param {string} str
 * @returns {string}
 */
const escapeHTML = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Valida que un ID de anime sea una cadena no vacía sin
 * caracteres especiales que puedan causar inyección.
 * @param {string} id
 * @returns {boolean}
 */
const isValidId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_\-]+$/.test(id);

/* --------------------------------------------------
   FILTRADO Y BÚSQUEDA
-------------------------------------------------- */

/**
 * Aplica los filtros activos sobre state.favorites
 * y devuelve el subconjunto visible.
 * @returns {Array<Object>}
 */
const getFilteredFavorites = () => {
  const query = state.searchQuery.toLowerCase().trim();

  return state.favorites.filter((fav) => {
    /* Búsqueda por nombre */
    if (query && !fav.title.toLowerCase().includes(query)) return false;

    /* Filtro de estado */
    if (state.filterStatus !== 'all' && fav.watchStatus !== state.filterStatus) return false;

    /* Filtro de año */
    if (state.filterYear !== 'all' && String(fav.year || '') !== state.filterYear) return false;

    /* Filtro de estación */
    if (state.filterSeason !== 'all') {
      const favSeason = (fav.season || '').toLowerCase();
      if (favSeason !== state.filterSeason) return false;
    }

    return true;
  });
};

/* --------------------------------------------------
   RENDERIZADO
-------------------------------------------------- */

/**
 * Construye el HTML de una opción del <select> de estado.
 * @param {string} value
 * @param {string} label
 * @param {string} currentStatus
 * @returns {string}
 */
const buildStatusOption = (value, label, currentStatus) =>
  `<option value="${value}" ${currentStatus === value ? 'selected' : ''}>${label}</option>`;

/**
 * Genera el HTML completo de una tarjeta de anime.
 * Usa escapeHTML en todos los datos dinámicos para prevenir XSS.
 * @param {Object} fav - Objeto de favorito del localStorage
 * @returns {string} HTML de la tarjeta
 */
const buildCardHTML = (fav) => {
  const safeId      = escapeHTML(fav.id);
  const safeTitle   = escapeHTML(fav.title || 'Sin título');
  const safePoster  = escapeHTML(fav.poster || '');
  const safeStatus  = fav.watchStatus in STATUS_CONFIG ? fav.watchStatus : 'pending';
  const badgeLabel  = STATUS_CONFIG[safeStatus].label;
  const badgeClass  = STATUS_CONFIG[safeStatus].cssClass;
  // Convertir el codigo de estacion al nombre legible en español
  const SEASON_LABELS = { fall: 'Otoño', winter: 'Invierno', spring: 'Primavera', summer: 'Verano' };
  const seasonRaw     = fav.seasonName || fav.season || '';
  const safeSeason    = escapeHTML(SEASON_LABELS[seasonRaw] || '');
  const safeYear    = escapeHTML(String(fav.year || ''));

  const posterSrc   = safePoster
    ? safePoster
    : 'https://via.placeholder.com/200x300?text=Sin+Imagen';

  const detailsUrl  = `anime-details.html?id=${encodeURIComponent(fav.id)}`;

  /* Opciones del select de estado */
  const statusOptions = Object.entries(STATUS_CONFIG)
    .map(([val, cfg]) => buildStatusOption(val, cfg.label, safeStatus))
    .join('');

  return `
    <div class="anime-card" data-id="${safeId}">

      <!-- Poster con enlace a detalles -->
      <a href="${escapeHTML(detailsUrl)}" class="card-poster-link" title="Ver detalles de ${safeTitle}">
        <img
          src="${posterSrc}"
          alt="${safeTitle}"
          class="card-poster"
          loading="lazy"
          onerror="this.src='https://via.placeholder.com/200x300?text=Sin+Imagen'"
        >
        <!-- Badge de estado sobre la imagen -->
        <span class="status-badge ${badgeClass}">${escapeHTML(badgeLabel)}</span>
      </a>

      <!-- Cuerpo de la tarjeta -->
      <div class="card-body">

        <!-- Título clickeable -->
        <a href="${escapeHTML(detailsUrl)}" class="card-title-link" title="${safeTitle}">
          <h2 class="card-title">${safeTitle}</h2>
        </a>

        <!-- Metadatos opcionales (temporada / año) -->
        ${safeSeason || safeYear ? `<p class="card-meta">${[safeSeason, safeYear].filter(Boolean).join(' · ')}</p>` : ''}

        <!-- Acciones -->
        <div class="card-actions">

          <!-- Selector de cambio rápido de estado -->
          <select
            class="status-select ${badgeClass}"
            data-id="${safeId}"
            aria-label="Cambiar estado de ${safeTitle}"
          >
            ${statusOptions}
          </select>

          <!-- Botón eliminar -->
          <button
            class="delete-btn"
            data-id="${safeId}"
            title="Eliminar de favoritos"
            aria-label="Eliminar ${safeTitle} de favoritos"
          >🗑️</button>

        </div>
      </div>
    </div>
  `;
};

/**
 * Renderiza el grid de tarjetas según los filtros activos
 * y actualiza el contador de resultados y los estados vacíos.
 */
const render = () => {
  const filtered = getFilteredFavorites();
  const total    = state.favorites.length;
  const visible  = filtered.length;

  /* Actualizar contador */
  DOM.countTotal.textContent   = total;
  DOM.countVisible.textContent = visible;

  /* Ocultar todos los estados vacíos */
  DOM.emptyState.style.display     = 'none';
  DOM.noResultsState.style.display = 'none';
  DOM.animeGrid.style.display      = 'grid';

  if (total === 0) {
    /* La lista está completamente vacía */
    DOM.animeGrid.style.display  = 'none';
    DOM.emptyState.style.display = 'flex';
    return;
  }

  if (visible === 0) {
    /* Hay favoritos pero los filtros no devuelven nada */
    DOM.animeGrid.style.display      = 'none';
    DOM.noResultsState.style.display = 'flex';
    return;
  }

  /* Renderizar tarjetas */
  DOM.animeGrid.innerHTML = filtered.map(buildCardHTML).join('');
};

/* --------------------------------------------------
   POBLAR FILTRO DE AÑOS DINÁMICAMENTE
-------------------------------------------------- */

/**
 * Lee los años distintos de la lista de favoritos y
 * crea <option> para cada uno en el select de año.
 */
const populateYearFilter = () => {
  const years = [...new Set(
    state.favorites
      .map(f => f.year)
      .filter(y => y && !isNaN(Number(y)))
  )].sort((a, b) => b - a); /* descendente */

  /* Conservar la opción "Todos" y añadir años */
  DOM.yearFilter.innerHTML = '<option value="all">Todos</option>';
  years.forEach(year => {
    const opt = document.createElement('option');
    opt.value       = year;
    opt.textContent = year;
    DOM.yearFilter.appendChild(opt);
  });
};

/* --------------------------------------------------
   MUTACIONES DE ESTADO
-------------------------------------------------- */

/**
 * Cambia el watchStatus de un anime y persiste.
 * @param {string} animeId
 * @param {string} newStatus - 'watching' | 'pending' | 'completed'
 */
const changeStatus = (animeId, newStatus) => {
  if (!isValidId(animeId)) return;
  if (!(newStatus in STATUS_CONFIG)) return;

  const fav = state.favorites.find(f => f.id === animeId);
  if (!fav) return;

  fav.watchStatus = newStatus;
  writeFavorites(state.favorites);

  /* Actualizar badge y clase del select en el DOM sin re-renderizar todo */
  const card   = DOM.animeGrid.querySelector(`.anime-card[data-id="${animeId}"]`);
  if (!card) return;

  const badge  = card.querySelector('.status-badge');
  const select = card.querySelector('.status-select');

  /* Remover clases previas */
  Object.values(STATUS_CONFIG).forEach(cfg => {
    badge.classList.remove(cfg.cssClass);
    select.classList.remove(cfg.cssClass);
  });

  const cfg = STATUS_CONFIG[newStatus];
  badge.classList.add(cfg.cssClass);
  badge.textContent = cfg.label;
  select.classList.add(cfg.cssClass);

  showToast(`Estado actualizado: ${cfg.label}`, 'success');
};

/**
 * Elimina un anime de la lista de favoritos.
 * @param {string} animeId
 */
const removeFavorite = (animeId) => {
  if (!isValidId(animeId)) return;

  const idx = state.favorites.findIndex(f => f.id === animeId);
  if (idx === -1) return;

  const title = state.favorites[idx].title || 'Anime';
  state.favorites.splice(idx, 1);
  writeFavorites(state.favorites);

  populateYearFilter();
  render();

  showToast(`"${title}" eliminado de tu lista`, 'info');
};

/* --------------------------------------------------
   DELEGACIÓN DE EVENTOS EN EL GRID
-------------------------------------------------- */

/**
 * Listener único sobre el grid que detecta:
 * - Cambios en el select de estado
 * - Clicks en el botón de eliminar
 * Usa delegación para no adjuntar listeners a cada tarjeta.
 */
const bindGridEvents = () => {
  DOM.animeGrid.addEventListener('change', (e) => {
    const select = e.target.closest('.status-select');
    if (!select) return;
    changeStatus(select.dataset.id, select.value);
  });

  DOM.animeGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;

    /* Confirmación suave antes de eliminar */
    const card  = btn.closest('.anime-card');
    const title = card?.querySelector('.card-title')?.textContent || 'este anime';
    if (confirm(`¿Eliminar "${title}" de tu lista?`)) {
      removeFavorite(btn.dataset.id);
    }
  });
};

/* --------------------------------------------------
   LISTENERS DE LA BARRA DE HERRAMIENTAS
-------------------------------------------------- */

const bindToolbarEvents = () => {
  /* Búsqueda en tiempo real */
  DOM.searchInput.addEventListener('input', () => {
    /* Sanitizar: solo actualizar si cambió el valor */
    state.searchQuery = DOM.searchInput.value.slice(0, 100);

    /* Mostrar/ocultar botón de limpiar */
    DOM.clearSearchBtn.classList.toggle('visible', state.searchQuery.length > 0);

    render();
  });

  /* Limpiar búsqueda */
  DOM.clearSearchBtn.addEventListener('click', () => {
    DOM.searchInput.value = '';
    state.searchQuery     = '';
    DOM.clearSearchBtn.classList.remove('visible');
    render();
    DOM.searchInput.focus();
  });

  /* Filtro de estado */
  DOM.statusFilter.addEventListener('change', () => {
    state.filterStatus = DOM.statusFilter.value;
    render();
  });

  /* Filtro de año */
  DOM.yearFilter.addEventListener('change', () => {
    state.filterYear = DOM.yearFilter.value;
    render();
  });

  /* Filtro de estación */
  DOM.seasonFilter.addEventListener('change', () => {
    state.filterSeason = DOM.seasonFilter.value;
    render();
  });

  /* Botón "Limpiar Filtros" del estado sin resultados */
  DOM.clearFiltersBtn.addEventListener('click', resetFilters);
};

/**
 * Resetea todos los filtros y la búsqueda a su estado inicial.
 */
const resetFilters = () => {
  state.searchQuery  = '';
  state.filterStatus = 'all';
  state.filterYear   = 'all';
  state.filterSeason = 'all';

  DOM.searchInput.value   = '';
  DOM.statusFilter.value  = 'all';
  DOM.yearFilter.value    = 'all';
  DOM.seasonFilter.value  = 'all';
  DOM.clearSearchBtn.classList.remove('visible');

  render();
};

/* --------------------------------------------------
   TOAST DE NOTIFICACIONES
-------------------------------------------------- */

/**
 * Muestra un mensaje temporal tipo toast.
 * @param {string} message - Texto a mostrar (se escapa automáticamente)
 * @param {'success'|'error'|'info'} type
 * @param {number} [duration=3000] - Duración en ms
 */
const showToast = (message, type = 'info', duration = 3000) => {
  const toast = document.createElement('div');
  toast.className   = `toast ${type}`;
  toast.textContent = message; /* textContent previene XSS */

  DOM.toastContainer.appendChild(toast);

  /* Auto-remover con animación de salida */
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease both';
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
};

/* --------------------------------------------------
   INICIALIZACIÓN
-------------------------------------------------- */

/**
 * Punto de entrada del módulo.
 * Se ejecuta cuando el DOM está completamente cargado.
 */
const init = () => {
  resolveDOMRefs();

  /* Cargar datos */
  state.favorites = readFavorites();

  /* Poblar filtro de años con los datos reales */
  populateYearFilter();

  /* Registrar eventos */
  bindToolbarEvents();
  bindGridEvents();

  /* Primer render */
  render();

  console.log(`🗂️ Control de Animes inicializado. Total de animes: ${state.favorites.length}`);
};

document.addEventListener('DOMContentLoaded', init);

console.log(`
╔═══════════════════════════════════════╗
║   🗂️ CONTROL DE ANIMES 🗂️            ║
║   Central de mando del usuario       ║
║   Hecho por: Jaykai2                 ║
╚═══════════════════════════════════════╝
`);