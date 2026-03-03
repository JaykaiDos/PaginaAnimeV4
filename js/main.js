/* ============================================
   ANIME HUB - JAVASCRIPT PRINCIPAL
   Autor: Jaykai2
   ============================================ */

// ============================================
// CARGAR TEMPORADAS DESDE FIREBASE
// ============================================
const loadSeasonsFromFirebase = async () => {
  const seasonsGrid = document.querySelector('.seasons-grid');
  if (!seasonsGrid) return;
  
  // Mostrar loading
  seasonsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;"><div class="spinner" style="width: 50px; height: 50px; border: 4px solid rgba(72, 202, 228, 0.2); border-top-color: #48cae4; border-radius: 50%; margin: 0 auto 1rem; animation: spin 1s linear infinite;"></div><p style="color: #48cae4;">Cargando temporadas...</p></div>';
  
  try {
    // Obtener temporadas desde Firebase
    const seasons = await window.firebaseService.getAllSeasons();
    
    if (seasons.length === 0) {
      seasonsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #48cae480; padding: 3rem;">No hay temporadas disponibles</p>';
      return;
    }
    
    // Mapeo de colores por temporada
    const seasonClasses = {
      fall: 'fall',
      winter: 'winter',
      spring: 'spring',
      summer: 'summer'
    };
    
    // Para cada temporada, contar sus animes
    const seasonsWithCounts = await Promise.all(
      seasons.map(async (season) => {
        const animes = await window.firebaseService.getAnimesBySeason(season.id);
        return {
          ...season,
          animeCount: animes.length // Contador real de animes
        };
      })
    );

    /**
     * Extrae el año de un period string (ej: "fall-2025" → 2025).
     * @param {string} period
     * @returns {number}
     */
    const extractYear = (period) => {
      const parts = (period || '').split('-');
      const year  = parseInt(parts[parts.length - 1]);
      return isNaN(year) ? 0 : year;
    };

    /**
     * Extrae la clave de estación de un period string (ej: "fall-2025" → "fall").
     * @param {string} period
     * @returns {string}
     */
    const extractSeason = (period) => (period || '').split('-')[0] || 'fall';

    // Agrupar en un Map { año → [temporadas] }, ordenado descendente por año
    const byYear = new Map();
    seasonsWithCounts.forEach(season => {
      const year = extractYear(season.period);
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(season);
    });

    // Ordenar años de mayor a menor (2026 primero, luego 2025…)
    const sortedYears = [...byYear.keys()].sort((a, b) => b - a);

    // Orden deseado dentro de cada año
    const SEASON_ORDER = { winter: 0, spring: 1, summer: 2, fall: 3 };

    // Construir el HTML agrupado
    let html = '';

    sortedYears.forEach(year => {
      const group = byYear.get(year);

      // Ordenar temporadas dentro del año: invierno → primavera → verano → otoño
      group.sort((a, b) => {
        const keyA = SEASON_ORDER[extractSeason(a.period)] ?? 99;
        const keyB = SEASON_ORDER[extractSeason(b.period)] ?? 99;
        return keyA - keyB;
      });

      // Encabezado del grupo de año
      html += `<div class="year-group-header">
        <span class="year-label">${year}</span>
        <span class="year-divider"></span>
      </div>`;

      // Grid de tarjetas del año
      html += '<div class="year-seasons-grid">';

      group.forEach(season => {
        const seasonKey   = extractSeason(season.period);
        const seasonClass = seasonClasses[seasonKey] || 'fall';
        const seasonPage  = `pages/${season.period}.html`;

        html += `
          <article class="season-card ${seasonClass}">
            <div class="season-icon">${season.emoji || '📅'}</div>
            <div class="season-content">
              <h3 class="season-name">${season.name}</h3>
              <p class="season-period">${season.period}</p>
              <div class="season-stats">
                <span class="anime-count">${season.animeCount} Animes</span>
                <span class="status-badge ${season.status === 'active' ? 'active' : 'completed'}">
                  ${season.status === 'active' ? 'Activo' : 'Finalizado'}
                </span>
              </div>
              <p class="season-description">
                ${season.status === 'active'
                  ? 'Temporada actualmente en emisión'
                  : 'Temporada finalizada'}
              </p>
              <a href="${seasonPage}" class="season-btn">
                Ver Animes
                <span class="arrow">→</span>
              </a>
            </div>
          </article>
        `;
      });

      html += '</div>'; // cierra .year-seasons-grid
    });

    seasonsGrid.innerHTML = html;
    
    // Actualizar estadísticas globales
    updateGlobalStats(seasonsWithCounts);
    
  } catch (error) {
    console.error('Error al cargar temporadas:', error);
    seasonsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 3rem;">❌ Error al cargar temporadas</p>';
  }
};

// ============================================
// ACTUALIZAR ESTADÍSTICAS GLOBALES
// ============================================
const updateGlobalStats = (seasons) => {
  // Contar total de temporadas
  const totalSeasons = seasons.length;
  
  // Contar total de animes (sumando todos)
  const totalAnimes = seasons.reduce((sum, season) => sum + season.animeCount, 0);
  
  // Actualizar en el DOM
  const seasonsStatElement = document.querySelector('.stat-number[data-stat="seasons"]');
  const animesStatElement = document.querySelector('.stat-number[data-stat="animes"]');
  
  if (seasonsStatElement) {
    seasonsStatElement.textContent = totalSeasons + '+';
  }
  
  if (animesStatElement) {
    animesStatElement.textContent = totalAnimes + '+';
  }
  
  // Si tienes otros contadores en la página, actualízalos aquí
  const seasonCountElements = document.querySelectorAll('.season-count');
  seasonCountElements.forEach(el => {
    el.textContent = totalSeasons;
  });
  
  const animeCountElements = document.querySelectorAll('.anime-count-total');
  animeCountElements.forEach(el => {
    el.textContent = totalAnimes;
  });
};

// ============================================
// CARGAR FAVORITOS GLOBALES (MANTENER IGUAL)
// ============================================
function loadGlobalFavorites() {
  const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
  const favCount = document.getElementById('favCount');
  const favGrid = document.getElementById('globalFavorites');
  
  if (favCount) {
    favCount.textContent = favorites.length;
  }
  
  if (!favGrid) return;
  
  if (favorites.length === 0) {
    favGrid.innerHTML = '<p class="no-favorites">No tienes favoritos aún. ¡Explora las temporadas y agrega tus animes favoritos!</p>';
  } else {
    favGrid.innerHTML = favorites.map(fav => {
      return `
        <div class="fav-card">
          <div class="fav-icon">⭐</div>
          <p>${fav.title}</p> 
        </div>
      `;
    }).join('');
  }
}

// ============================================
// SMOOTH SCROLL PARA NAVEGACIÓN
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
      });
      this.classList.add('active');
    }
  });
});

// ============================================
// INTERSECTION OBSERVER PARA ANIMACIONES
// ============================================
const observerOptions = {
  threshold: 0.2,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, observerOptions);

// Aplicar a elementos cuando se carguen
const applyAnimations = () => {
  document.querySelectorAll('.season-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'all 0.6s ease-out';
    observer.observe(card);
  });

  document.querySelectorAll('.about-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'all 0.6s ease-out';
    observer.observe(card);
  });
};

// ============================================
// ACTUALIZAR NAVEGACIÓN AL HACER SCROLL
// ============================================
window.addEventListener('scroll', () => {
  const sections = document.querySelectorAll('section[id]');
  const scrollY = window.pageYOffset;

  sections.forEach(section => {
    const sectionHeight = section.offsetHeight;
    const sectionTop = section.offsetTop - 100;
    const sectionId = section.getAttribute('id');
    
    if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
          link.classList.add('active');
        }
      });
    }
  });
});

// ============================================
// ESTADÍSTICAS ANIMADAS
// ============================================
function animateStats() {
  const stats = document.querySelectorAll('.stat-number');
  
  stats.forEach(stat => {
    const targetText = stat.textContent;
    const target = parseInt(targetText);
    
    if (isNaN(target)) return;
    
    let current = 0;
    const increment = target / 50;
    const hasPlus = targetText.includes('+');
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        stat.textContent = target + (hasPlus ? '+' : '');
        clearInterval(timer);
      } else {
        stat.textContent = Math.floor(current) + (hasPlus ? '+' : '');
      }
    }, 30);
  });
}

// ============================================
// EFECTO PARALLAX EN HERO
// ============================================
window.addEventListener('scroll', () => {
  const heroSection = document.querySelector('.hero-section');
  if (heroSection) {
    const scrolled = window.pageYOffset;
    heroSection.style.transform = `translateY(${scrolled * 0.3}px)`;
    heroSection.style.opacity = 1 - (scrolled / 600);
  }
});

// ============================================
// AGREGAR RIPPLE EFFECT A BOTONES
// ============================================
const addRippleEffect = () => {
  document.querySelectorAll('.season-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');
      
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  });
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  
  // Esperar a que Firebase esté listo
  if (window.firebaseService) {
    // Cargar temporadas desde Firebase (esto actualiza los contadores)
    await loadSeasonsFromFirebase();
    
    // Aplicar animaciones después de cargar
    setTimeout(() => {
      applyAnimations();
      addRippleEffect();
    }, 100);
  } else {
    console.error('❌ Firebase Service no está disponible');
  }
  
  // Cargar favoritos desde localStorage
  loadGlobalFavorites();
  
  // Animar estadísticas después de 500ms
  setTimeout(() => {
    animateStats();
  }, 500);
  
});

// ============================================
// GUARDAR SCROLL POSITION
// ============================================
window.addEventListener('beforeunload', () => {
  localStorage.setItem('scrollPosition', window.scrollY);
});

window.addEventListener('load', () => {
  const scrollPosition = localStorage.getItem('scrollPosition');
  if (scrollPosition) {
    window.scrollTo(0, parseInt(scrollPosition));
    localStorage.removeItem('scrollPosition');
  }
});