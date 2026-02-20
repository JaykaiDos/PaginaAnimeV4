/* ============================================
   ANIME TEMPORADAS - JAVASCRIPT (DINÁMICO)
   Autor: Jaykai2
   ============================================ */

// 1. CONFIGURACIÓN Y SERVICIOS
const { getAnimesBySeason } = window.firebaseService || {};
const animeContainer = document.getElementById('animeContainer');
const SEASON_ID = animeContainer ? animeContainer.getAttribute('data-season-id') : null;

// Estado global de favoritos
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];

// ============================================
// FUNCIONES DE UTILIDAD (BUENAS PRÁCTICAS)
// ============================================

/**
 * Extrae el ID de un video de YouTube y devuelve la URL de incrustación (embed).
 * Soporta formatos: youtube.com/watch?v=..., youtu.be/..., y embeds directos.
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

    // Separar animes por categoría
    const continuaciones = animes.filter(anime => anime.category === 'continuation');
    const nuevos = animes.filter(anime => anime.category === 'new');

    // Limpiar contenedor
    animeContainer.innerHTML = '';

    // SECCIÓN: CONTINUACIONES
    if (continuaciones.length > 0) {
        const seccionContinuaciones = document.createElement('h2');
        seccionContinuaciones.className = 'section-title';
        seccionContinuaciones.innerHTML = '⭐ Continuaciones ⭐';
        animeContainer.appendChild(seccionContinuaciones);

        continuaciones.forEach(anime => {
            animeContainer.appendChild(createAnimeCard(anime));
        });
    }

    // SECCIÓN: NUEVOS ESTRENOS
    if (nuevos.length > 0) {
        const seccionNuevos = document.createElement('h2');
        seccionNuevos.className = 'section-title';
        seccionNuevos.innerHTML = '🆕 Nuevos Estrenos 🆕';
        animeContainer.appendChild(seccionNuevos);

        nuevos.forEach(anime => {
            animeContainer.appendChild(createAnimeCard(anime));
        });
    }

    // RE-INICIALIZAR LÓGICA DINÁMICA
    initCarousels();
    initFavoritesLogic();
    syncSearchCards();
};

// ============================================
// FUNCIÓN AUXILIAR: CREAR TARJETA DE ANIME
// ============================================
const createAnimeCard = (anime) => {
    const article = document.createElement('article');
    article.className = 'anime-card';
    article.id = anime.id;
    article.setAttribute('data-title', anime.title);

    // --------------------------------------------------
    // Atributos extra usados por initFavoritesLogic()
    // para guardar datos enriquecidos en localStorage
    // y que "Control de Animes" pueda mostrar el poster,
    // filtrar por temporada/año y asignar watchStatus.
    // --------------------------------------------------
    article.setAttribute('data-poster', anime.poster || '');

    // Extraer estación y año desde seasonId (ej: "fall_2025")
    const seasonParts = (anime.seasonId || '').split('_');
    const seasonKey   = seasonParts[0] || '';                  // "fall" | "winter" | ...
    const seasonYear  = seasonParts[seasonParts.length - 1] || ''; // "2025"

    article.setAttribute('data-season', seasonKey);
    article.setAttribute('data-year',   seasonYear);

    const trailersHtml = (anime.trailers || [])
        .map(url => {
            if (url.includes('/shorts/')) return '';

            const finalEmbedUrl = getYouTubeEmbedUrl(url);
            if (!finalEmbedUrl) return '';

            return `
            <div class="video-container">
                <iframe
                    src="${finalEmbedUrl}"
                    title="Trailer de ${anime.title}"
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

    article.innerHTML = `
        <div class="carousel">
            <div class="carousel-container">
                <div class="carousel-images">
                    <img src="${anime.cardImage}" alt="${anime.title} 1">
                    <img src="${anime.poster}" alt="${anime.title} 2">
                </div>
                <button class="prev">❮</button>
                <button class="next">❯</button>
            </div>
        </div>
        <div class="details">
            <p><strong>Título:</strong> ${anime.title}</p>
            <p><strong>Sinopsis:</strong> ${anime.synopsis || 'Sin descripción disponible.'}</p>
            <!-- Botón de favoritos dinámico con selector de estado inline -->
            <div class="fav-btn-wrapper" data-id="${anime.id}">
              <button class="fav-btn fav-btn--main" data-id="${anime.id}">
                <span class="fav-btn__icon">☆</span>
                <span class="fav-btn__label">Agregar a Mi Lista</span>
              </button>
              <!-- Dropdown de estados (oculto por defecto) -->
              <div class="fav-status-picker" data-id="${anime.id}">
                <p class="fav-status-picker__title">Selecciona Estado</p>
                <button class="fav-status-option" data-status="watching"  data-id="${anime.id}">👀 Viendo</button>
                <button class="fav-status-option" data-status="pending"   data-id="${anime.id}">⏳ Pendiente</button>
                <button class="fav-status-option" data-status="completed" data-id="${anime.id}">✅ Finalizado</button>
                <button class="fav-status-option fav-status-option--remove" data-status="remove" data-id="${anime.id}">🗑️ Quitar de Mi Lista</button>
              </div>
            </div>
            <div class="trailers">
                ${trailersHtml}
            </div>
            <div style="margin-top: 1rem; text-align: center;">
                <a href="anime-details.html?id=${anime.id}" class="btn-primary" style="text-decoration: none; padding: 10px 20px; background: #48cae4; color: #000; border-radius: 5px; font-weight: bold; display: block;">
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
        const images = container.querySelectorAll('img');
        const prevBtn = carousel.querySelector('.prev');
        const nextBtn = carousel.querySelector('.next');
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
// Cada tarjeta tiene:
//   .fav-btn-wrapper   → contenedor que agrupa botón + picker
//   .fav-btn--main     → botón principal (Agregar / estado activo)
//   .fav-status-picker → dropdown inline con las opciones
//   .fav-status-option → cada opción de estado
// -------------------------------------------------------

/** Configuración de estados: clave → { label, icon, css } */
const STATUS_MAP = {
    watching:  { label: 'Viendo',    icon: '👀', css: 'watching'  },
    pending:   { label: 'Pendiente', icon: '⏳', css: 'pending'   },
    completed: { label: 'Finalizado',icon: '✅', css: 'completed' }
};

/**
 * Actualiza el aspecto visual del botón principal
 * según si el anime está en favoritos y su watchStatus.
 * @param {HTMLElement} mainBtn  - .fav-btn--main
 * @param {string|null} status   - watchStatus actual o null si no está en favoritos
 */
const applyBtnState = (mainBtn, status) => {
    const iconEl  = mainBtn.querySelector('.fav-btn__icon');
    const labelEl = mainBtn.querySelector('.fav-btn__label');

    // Limpiar clases de estado previas
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
 * @param {string} [exceptId]  - ID del picker que debe quedar abierto
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

    // Actualizar estado visual de todos los botones al iniciar
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
            // Cerrar cualquier otro picker abierto
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

    // ── Cerrar picker al clic fuera — usando closest() en fase de burbuja
    // NO usamos capture:true para no interferir con stopPropagation() del botón.
    document.addEventListener('click', (e) => {
        // Si el clic NO fue dentro de ningún .fav-btn-wrapper, cerrar todos
        if (!e.target.closest('.fav-btn-wrapper')) {
            closeAllPickers();
        }
    });

    updateAllButtons();
};

const renderFavoritesList = () => {
    const favList = document.querySelector('.fav-list:not(.none)');
    const favNone = document.querySelector('.fav-list.none');
    
    if (!favList || !favNone) return;

    if (favorites.length === 0) {
        favNone.style.display = 'block';
        favList.style.display = 'none';
        favList.innerHTML = '';
    } else {
        favNone.style.display = 'none';
        favList.style.display = 'block';
        favList.innerHTML = favorites.map(fav => `<li>${fav.title}</li>`).join('');
    }
};

// 3. BÚSQUEDA (MEJORADA PARA SECCIONES)
let currentAnimeCards = [];
const syncSearchCards = () => {
    currentAnimeCards = document.querySelectorAll('.anime-card');
};

const searchBar = document.getElementById('searchBar');
searchBar?.addEventListener('input', () => {
    const query = searchBar.value.toLowerCase().trim();
    let hasResults = false;

    // Filtrar tarjetas
    currentAnimeCards.forEach(card => {
        const title = card.dataset.title.toLowerCase();
        if (title.includes(query)) {
            card.style.display = '';
            hasResults = true;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Ocultar títulos de sección si no hay resultados en esa categoría
    const sectionTitles = document.querySelectorAll('.section-title');
    sectionTitles.forEach(title => {
        const nextCards = [];
        let sibling = title.nextElementSibling;
        
        // Recopilar todas las tarjetas después del título hasta el próximo título
        while (sibling && !sibling.classList.contains('section-title')) {
            if (sibling.classList.contains('anime-card')) {
                nextCards.push(sibling);
            }
            sibling = sibling.nextElementSibling;
        }
        
        // Mostrar título solo si hay tarjetas visibles
        const hasVisibleCards = nextCards.some(card => card.style.display !== 'none');
        title.style.display = hasVisibleCards ? '' : 'none';
    });
});

// 4. DARK MODE
const darkModeToggle = document.getElementById('darkModeToggle');
const body = document.body;

const applyDarkMode = (isOn) => {
    body.style.filter = isOn ? 'invert(1) hue-rotate(180deg)' : '';
    if (darkModeToggle) darkModeToggle.textContent = isOn ? 'Modo Normal' : 'Modo Alternativo';
};

darkModeToggle?.addEventListener('click', () => {
    const isNowOn = body.style.filter === '';
    applyDarkMode(isNowOn);
    localStorage.setItem('darkMode', isNowOn ? 'on' : 'off');
});

// ============================================
// INICIALIZACIÓN GLOBAL
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar Preferencias
    if (localStorage.getItem('darkMode') === 'on') applyDarkMode(true);
    renderFavoritesList();

    // 2. Iniciar carga desde Firebase
    if (window.firebaseService) {
        loadSeasonAnimes();
    } else {
        console.error("❌ Firebase Service no detectado");
    }

    // 3. Limpiar favoritos
    document.getElementById('clearFavoritesBtn')?.addEventListener('click', () => {
        if (favorites.length > 0 && confirm('¿Eliminar todos los favoritos?')) {
            favorites = [];
            localStorage.removeItem('favorites');
            renderFavoritesList();
            initFavoritesLogic();
        }
    });
});