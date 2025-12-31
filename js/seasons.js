/* ============================================
   ANIME TEMPORADAS - JAVASCRIPT (DINÁMICO)
   Autor: Jaykai2
   Funcionalidades: Firebase, Carousel, Favoritos, Búsqueda, Dark Mode
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
            <button class="fav-btn" data-id="${anime.id}">Agregar a Favoritos</button>
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

// 2. FAVORITOS
const initFavoritesLogic = () => {
    const favButtons = document.querySelectorAll('.fav-btn');
    
    const updateFavButtons = () => {
        favButtons.forEach(btn => {
            const id = btn.dataset.id;
            const isFavorite = favorites.some(fav => fav.id === id);
            btn.classList.toggle('active', isFavorite);
            btn.textContent = isFavorite ? 'En Favoritos ★' : 'Agregar a Favoritos';
        });
    };

    favButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            const id = newBtn.dataset.id;
            const card = newBtn.closest('.anime-card');
            const title = card ? card.dataset.title : id;

            const favIndex = favorites.findIndex(fav => fav.id === id);
            if (favIndex !== -1) {
                favorites.splice(favIndex, 1);
            } else {
                favorites.push({ id, title });
            }
            
            localStorage.setItem('favorites', JSON.stringify(favorites));
            updateFavButtons();
            renderFavoritesList();
        });
    });

    updateFavButtons();
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