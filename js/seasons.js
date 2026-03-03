/* ============================================
   ANIME TEMPORADAS - JAVASCRIPT (DINÁMICO)
   Autor: Jaykai2
   
   CHANGELOG v2.0 — Refactor de Seguridad:
   - [NUEVO]     Agregada función escapeHTML() para prevención XSS
   - [NUEVO]     Agregada función sanitizeUrl() para prevención de URL injection
   - [OPTIMIZADO] createAnimeCard() — todos los campos dinámicos ahora escapados
   - [OPTIMIZADO] renderFavoritesList() — fav.title ahora escapado
   - [OPTIMIZADO] trailersHtml — anime.title en atributo title="" ahora escapado
   ============================================ */

// 1. CONFIGURACIÓN Y SERVICIOS
const { getAnimesBySeason } = window.firebaseService || {};
const animeContainer = document.getElementById('animeContainer');
const SEASON_ID = animeContainer ? animeContainer.getAttribute('data-season-id') : null;

// Estado global de favoritos
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];


// ============================================
// UTILIDADES DE SEGURIDAD — PREVENCIÓN XSS
// ============================================

/**
 * Escapa caracteres HTML peligrosos en una cadena de texto.
 * Debe aplicarse a CUALQUIER dato externo antes de inyectarlo
 * en el DOM mediante innerHTML.
 *
 * @param {*} str - Valor a sanitizar (se convierte a string si no lo es)
 * @returns {string} Cadena con caracteres especiales escapados
 */
// [NUEVO] Función centralizada de escape — antes no existía en este archivo
const escapeHTML = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#39;');
};

/**
 * Valida que una URL sea segura (http o https) antes de usarla
 * en atributos src/href. Previene inyección de protocolos
 * peligrosos como javascript: o data:.
 *
 * @param {string} url - URL a validar
 * @param {string} [fallback=''] - Valor a retornar si la URL es inválida
 * @returns {string} URL validada o fallback
 */
// [NUEVO] Validación de URLs — antes se usaban directamente sin verificar
const sanitizeUrl = (url, fallback = '') => {
    if (typeof url !== 'string' || url.trim() === '') return fallback;
    try {
        const parsed = new URL(url, window.location.origin);
        // Solo permitir protocolos seguros
        if (!['https:', 'http:'].includes(parsed.protocol)) return fallback;
        return url;
    } catch {
        return fallback;
    }
};


// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

/**
 * Extrae el ID de un video de YouTube y devuelve la URL de incrustación (embed).
 * Soporta formatos: youtube.com/watch?v=..., youtu.be/..., y embeds directos.
 *
 * @param {string} url - URL de YouTube en cualquier formato
 * @returns {string} URL de embed o cadena vacía si no es válida
 */
const getYouTubeEmbedUrl = (url) => {
    let videoId = '';
    if (url.includes('v=')) {
        videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
    } else {
        videoId = url.split('/').pop().split('?')[0];
    }
    return `https://www.youtube.com/embed/${videoId}`;
};


// ============================================
// CARGA DINÁMICA DESDE FIREBASE
// ============================================

const loadSeasonAnimes = async () => {
    if (!SEASON_ID) {
        console.error("❌ No se encontró el data-season-id en el contenedor");
        return;
    }

    try {
        const animes = await getAnimesBySeason(SEASON_ID);
        renderSeasonAnimes(animes);
    } catch (error) {
        console.error("❌ Error cargando animes:", error);
        // [SEGURIDAD] Mensaje de error estático — sin datos externos en el DOM
        animeContainer.innerHTML = `<p style="color:red; text-align:center;">Error al cargar los datos</p>`;
    }
};


// ============================================
// RENDERIZAR ANIMES AGRUPADOS POR CATEGORÍA
// ============================================

const renderSeasonAnimes = (animes) => {
    if (!animes || animes.length === 0) {
        animeContainer.innerHTML = `<p style="text-align:center; color:#48cae480; padding:3rem;">No hay animes registrados para esta temporada aún.</p>`;
        return;
    }

    const continuaciones = animes.filter(anime => anime.category === 'continuation');
    const nuevos         = animes.filter(anime => anime.category === 'new');

    animeContainer.innerHTML = '';

    // SECCIÓN: CONTINUACIONES
    if (continuaciones.length > 0) {
        const seccionContinuaciones = document.createElement('h2');
        seccionContinuaciones.className   = 'section-title';
        // [SEGURIDAD] Usando textContent para texto estático con emojis — sin riesgo
        seccionContinuaciones.textContent = '⭐ Continuaciones ⭐';
        animeContainer.appendChild(seccionContinuaciones);
        continuaciones.forEach(anime => animeContainer.appendChild(createAnimeCard(anime)));
    }

    // SECCIÓN: NUEVOS ESTRENOS
    if (nuevos.length > 0) {
        const seccionNuevos = document.createElement('h2');
        seccionNuevos.className   = 'section-title';
        // [SEGURIDAD] Usando textContent para texto estático con emojis — sin riesgo
        seccionNuevos.textContent = '🆕 Nuevos Estrenos 🆕';
        animeContainer.appendChild(seccionNuevos);
        nuevos.forEach(anime => animeContainer.appendChild(createAnimeCard(anime)));
    }

    initCarousels();
    initFavoritesLogic();
    syncSearchCards();
};


// ============================================
// FUNCIÓN AUXILIAR: CREAR TARJETA DE ANIME
// ============================================

/**
 * Construye y retorna un elemento <article> con toda la información
 * de un anime. Aplica escapeHTML() y sanitizeUrl() a TODOS los
 * campos provenientes de Firestore para prevenir XSS e inyección.
 *
 * @param {Object} anime - Documento de anime proveniente de Firestore
 * @returns {HTMLElement} Elemento article listo para insertar en el DOM
 */
const createAnimeCard = (anime) => {
    const article = document.createElement('article');
    article.className = 'anime-card';

    // --------------------------------------------------
    // [SEGURIDAD] Sanitizar todos los campos del anime
    // ANTES de usarlos en cualquier atributo o innerHTML
    // --------------------------------------------------
    // [OPTIMIZADO] Antes: anime.id, anime.title, etc. se usaban directamente sin escapar
    const safeId       = escapeHTML(anime.id);
    const safeTitle    = escapeHTML(anime.title);
    const safeSynopsis = escapeHTML(anime.synopsis || 'Sin descripción disponible.');
    const safeCardImg  = sanitizeUrl(anime.cardImage);
    const safePoster   = sanitizeUrl(anime.poster);

    // Atributos de datos — también escapados
    article.id = safeId;
    article.setAttribute('data-title',  safeTitle);
    article.setAttribute('data-poster', safePoster);

    // --------------------------------------------------
    // season → del nombre del archivo HTML actual.
    // year   → campo directo del anime en Firestore
    // --------------------------------------------------
    const _pageFile  = window.location.pathname.split('/').pop();
    const _seasonKey = escapeHTML(_pageFile.split('-')[0] || '');
    article.setAttribute('data-season', _seasonKey);
    article.setAttribute('data-year',   escapeHTML(String(anime.year || '')));

    // --------------------------------------------------
    // Construir HTML de trailers
    // [OPTIMIZADO] anime.title en title="" ahora escapado con escapeHTML
    // --------------------------------------------------
    const trailersHtml = (anime.trailers || [])
        .map(url => {
            if (url.includes('/shorts/')) return '';
            const finalEmbedUrl = getYouTubeEmbedUrl(url);
            if (!finalEmbedUrl) return '';

            return `
            <div class="video-container">
                <iframe
                    src="${escapeHTML(finalEmbedUrl)}"
                    title="Trailer de ${safeTitle}"
                    frameborder="0"
                    referrerpolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    loading="lazy">
                </iframe>
            </div>`;
        })
        .filter(Boolean)
        .join('') || '<p class="no-trailers">No hay trailers disponibles</p>';

    // --------------------------------------------------
    // [SEGURIDAD] Construir innerHTML usando SOLO variables
    // ya sanitizadas. NINGÚN dato de Firestore se inyecta
    // directamente — todo pasa por escapeHTML o sanitizeUrl.
    // --------------------------------------------------
    // [OPTIMIZADO] Antes: anime.title, anime.id, anime.poster, etc.
    //              sin escapar. Ahora: todas las variables son "safe*"
    article.innerHTML = `
        <div class="carousel">
            <div class="carousel-container">
                <div class="carousel-images">
                    <img src="${safeCardImg}" alt="${safeTitle} 1">
                    <img src="${safePoster}"  alt="${safeTitle} 2">
                </div>
                <button class="prev">❮</button>
                <button class="next">❯</button>
            </div>
        </div>
        <div class="details">
            <p><strong>Título:</strong> ${safeTitle}</p>
            <p><strong>Sinopsis:</strong> ${safeSynopsis}</p>

            <!-- Botón de favoritos dinámico con selector de estado inline -->
            <div class="fav-btn-wrapper" data-id="${safeId}">
              <button class="fav-btn fav-btn--main" data-id="${safeId}">
                <span class="fav-btn__icon">☆</span>
                <span class="fav-btn__label">Agregar a Mi Lista</span>
              </button>
              <!-- Dropdown de estados (oculto por defecto) -->
              <div class="fav-status-picker" data-id="${safeId}">
                <p class="fav-status-picker__title">Selecciona Estado</p>
                <button class="fav-status-option" data-status="watching"  data-id="${safeId}">👀 Viendo</button>
                <button class="fav-status-option" data-status="pending"   data-id="${safeId}">⏳ Pendiente</button>
                <button class="fav-status-option" data-status="completed" data-id="${safeId}">✅ Finalizado</button>
                <button class="fav-status-option fav-status-option--remove" data-status="remove" data-id="${safeId}">🗑️ Quitar de Mi Lista</button>
              </div>
            </div>

            <div class="trailers">
                ${trailersHtml}
            </div>
            <div style="margin-top: 1rem; text-align: center;">
                <a href="anime-details.html?id=${encodeURIComponent(anime.id)}"
                   class="btn-primary"
                   style="text-decoration: none; padding: 10px 20px; background: #48cae4; color: #000; border-radius: 5px; font-weight: bold; display: block;">
                    🎬 Ver Episodios
                </a>
            </div>
        </div>
    `;

    return article;
};


// ============================================
// FUNCIONALIDADES DE UI (Módulos)
// ============================================

// 1. CAROUSEL
const initCarousels = () => {
    document.querySelectorAll('.carousel-container').forEach(carousel => {
        const container = carousel.querySelector('.carousel-images');
        const images    = container.querySelectorAll('img');
        const prevBtn   = carousel.querySelector('.prev');
        const nextBtn   = carousel.querySelector('.next');
        let currentIndex = 0;

        const updateCarousel = () => {
            container.style.transform = `translateX(-${currentIndex * 100}%)`;
        };

        prevBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex - 1 + images.length) % images.length;
            updateCarousel();
        });

        nextBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            currentIndex = (currentIndex + 1) % images.length;
            updateCarousel();
        });
    });
};

// 2. FAVORITOS — Sistema dinámico con selector de estado
// -------------------------------------------------------

/** Configuración de estados: clave → { label, icon, css } */
const STATUS_MAP = {
    watching:  { label: 'Viendo',     icon: '👀', css: 'watching'  },
    pending:   { label: 'Pendiente',  icon: '⏳', css: 'pending'   },
    completed: { label: 'Finalizado', icon: '✅', css: 'completed' }
};

/**
 * Actualiza el aspecto visual del botón principal
 * según si el anime está en favoritos y su watchStatus.
 * @param {HTMLElement} mainBtn - .fav-btn--main
 * @param {string|null} status  - watchStatus actual o null si no está en favoritos
 */
const applyBtnState = (mainBtn, status) => {
    const iconEl  = mainBtn.querySelector('.fav-btn__icon');
    const labelEl = mainBtn.querySelector('.fav-btn__label');

    Object.values(STATUS_MAP).forEach(s => mainBtn.classList.remove('fav-btn--' + s.css));
    mainBtn.classList.remove('fav-btn--active');

    if (status && STATUS_MAP[status]) {
        const cfg = STATUS_MAP[status];
        mainBtn.classList.add('fav-btn--active', 'fav-btn--' + cfg.css);
        iconEl.textContent  = cfg.icon;
        labelEl.textContent = cfg.label;
    } else {
        iconEl.textContent  = '☆';
        labelEl.textContent = 'Agregar a Mi Lista';
    }
};

/**
 * Cierra todos los pickers abiertos excepto el indicado.
 * @param {string} [exceptId] - ID del picker que debe quedar abierto
 */
const closeAllPickers = (exceptId) => {
    document.querySelectorAll('.fav-status-picker.open').forEach(p => {
        if (p.dataset.id !== exceptId) p.classList.remove('open');
    });
};

/**
 * Inicializa la lógica de favoritos en todas las tarjetas renderizadas.
 * Se llama desde renderSeasonAnimes() después de crear el DOM.
 */
const initFavoritesLogic = () => {

    const updateAllButtons = () => {
        document.querySelectorAll('.fav-btn--main').forEach(mainBtn => {
            const id  = mainBtn.dataset.id;
            const fav = favorites.find(f => f.id === id);
            applyBtnState(mainBtn, fav ? fav.watchStatus : null);
        });
    };

    // ── Botón principal: abre/cierra el picker ──
    document.querySelectorAll('.fav-btn--main').forEach(mainBtn => {
        mainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id     = mainBtn.dataset.id;
            const picker = document.querySelector(`.fav-status-picker[data-id="${id}"]`);
            if (!picker) return;

            const isOpen = picker.classList.contains('open');
            document.querySelectorAll('.fav-status-picker.open').forEach(p => {
                if (p !== picker) p.classList.remove('open');
            });
            picker.classList.toggle('open', !isOpen);
        });
    });

    // ── Opciones del picker: guardar estado o eliminar ──
    document.querySelectorAll('.fav-status-option').forEach(optBtn => {
        optBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id      = optBtn.dataset.id;
            const status  = optBtn.dataset.status;
            const card    = optBtn.closest('.anime-card');
            const picker  = document.querySelector(`.fav-status-picker[data-id="${id}"]`);
            const mainBtn = document.querySelector(`.fav-btn--main[data-id="${id}"]`);

            if (status === 'remove') {
                const idx = favorites.findIndex(f => f.id === id);
                if (idx !== -1) favorites.splice(idx, 1);
            } else {
                const existing = favorites.find(f => f.id === id);
                if (existing) {
                    existing.watchStatus = status;
                } else {
                    favorites.push({
                        id,
                        title:       card ? card.dataset.title  : id,
                        poster:      card ? card.dataset.poster : '',
                        season:      card ? card.dataset.season : '',
                        year:        card ? card.dataset.year   : '',
                        watchStatus: status
                    });
                }
            }

            localStorage.setItem('favorites', JSON.stringify(favorites));
            const fav = favorites.find(f => f.id === id);
            applyBtnState(mainBtn, fav ? fav.watchStatus : null);
            picker.classList.remove('open');
            renderFavoritesList();
        });
    });

    // ── Cerrar picker al clic fuera ──
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.fav-btn-wrapper')) closeAllPickers();
    });

    updateAllButtons();
};

/**
 * Renderiza la lista de favoritos en el sidebar/sección de favoritos.
 * [OPTIMIZADO] fav.title ahora escapado con escapeHTML — antes era vulnerable a XSS
 */
const renderFavoritesList = () => {
    const favList = document.querySelector('.fav-list:not(.none)');
    const favNone = document.querySelector('.fav-list.none');

    if (!favList || !favNone) return;

    if (favorites.length === 0) {
        favNone.style.display = 'block';
        favList.style.display = 'none';
        favList.innerHTML     = '';
    } else {
        favNone.style.display = 'none';
        favList.style.display = 'block';
        // [OPTIMIZADO] Antes: `<li>${fav.title}</li>` — sin escape
        //              Ahora: escapeHTML() protege contra XSS en títulos maliciosos
        favList.innerHTML = favorites
            .map(fav => `<li>${escapeHTML(fav.title)}</li>`)
            .join('');
    }
};


// 3. BÚSQUEDA
let currentAnimeCards = [];

const syncSearchCards = () => {
    currentAnimeCards = document.querySelectorAll('.anime-card');
};

const searchBar = document.getElementById('searchBar');
searchBar?.addEventListener('input', () => {
    const query = searchBar.value.toLowerCase().trim();

    currentAnimeCards.forEach(card => {
        const title = card.dataset.title.toLowerCase();
        card.style.display = title.includes(query) ? '' : 'none';
    });

    // Ocultar título de sección si no hay tarjetas visibles en esa sección
    document.querySelectorAll('.section-title').forEach(sectionTitle => {
        let sibling       = sectionTitle.nextElementSibling;
        let hasVisible    = false;

        while (sibling && !sibling.classList.contains('section-title')) {
            if (sibling.classList.contains('anime-card') && sibling.style.display !== 'none') {
                hasVisible = true;
            }
            sibling = sibling.nextElementSibling;
        }

        sectionTitle.style.display = hasVisible ? '' : 'none';
    });
});


// 4. DARK MODE
const darkModeToggle = document.getElementById('darkModeToggle');
const body           = document.body;

/**
 * Aplica o remueve el modo oscuro.
 * @param {boolean} isOn - true para activar modo oscuro
 */
const applyDarkMode = (isOn) => {
    body.classList.toggle('dark-mode', isOn);
    if (darkModeToggle) {
        darkModeToggle.textContent = isOn ? 'Modo Normal' : 'Modo Oscuro';
        darkModeToggle.classList.toggle('dark-active', isOn);
    }
};

darkModeToggle?.addEventListener('click', () => {
    const isNowOn = !body.classList.contains('dark-mode');
    applyDarkMode(isNowOn);
    localStorage.setItem('darkMode', isNowOn ? 'on' : 'off');
});


// ============================================
// INICIALIZACIÓN GLOBAL
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('darkMode') === 'on') applyDarkMode(true);
    renderFavoritesList();

    if (window.firebaseService) {
        loadSeasonAnimes();
    } else {
        console.error("❌ Firebase Service no detectado");
    }

    document.getElementById('clearFavoritesBtn')?.addEventListener('click', () => {
        if (favorites.length > 0 && confirm('¿Eliminar todos los favoritos?')) {
            favorites = [];
            localStorage.removeItem('favorites');
            renderFavoritesList();
            initFavoritesLogic();
        }
    });
});