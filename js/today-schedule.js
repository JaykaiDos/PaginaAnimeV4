/* ============================================
   TODAY SCHEDULE - ESTRENOS DE HOY
   Archivo: js/today-schedule.js
   Autor: Jaykai2
   Versión: 4.0

   CORRECCIÓN v4:
   ─────────────────────────────────────────────
   Bug anterior: el filtro comparaba el nombre del
   día de broadcast (JST) con el día actual del
   navegador (timezone local), sin convertir.

   El problema concreto:
   • Anime "Osananajimi" emite "Mondays 00:00 JST"
   • En Argentina (GMT-3): 00:00 JST = 12:00 del día
     ANTERIOR (domingo). O sea, para AR ese anime
     "emite" el domingo local.
   • Si el filtro solo compara "monday" con "tuesday"
     puede dar falsos positivos dependiendo del caso.

   Solución: una única función broadcastToUTC() que
   convierte el broadcast JST a un Date UTC real.
   Tanto el filtro como el display usan esa misma
   conversión → resultados 100% consistentes.
   ============================================ */

// -----------------------------------------------
// CONSTANTES
// -----------------------------------------------

const DAY_LABELS_ES = {
  sunday:    'Domingo', monday:    'Lunes',
  tuesday:   'Martes',  wednesday: 'Miércoles',
  thursday:  'Jueves',  friday:    'Viernes',
  saturday:  'Sábado'
};

const NORMALIZE_DAYS = {
  mondays:    'monday',    tuesdays:   'tuesday',
  wednesdays: 'wednesday', thursdays:  'thursday',
  fridays:    'friday',    saturdays:  'saturday',
  sundays:    'sunday',
  monday:     'monday',    tuesday:    'tuesday',
  wednesday:  'wednesday', thursday:   'thursday',
  friday:     'friday',    saturday:   'saturday',
  sunday:     'sunday'
};

const DAY_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6
};

// -----------------------------------------------
// HELPERS
// -----------------------------------------------

const _sanitizeSchedule = (str) => {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
};

/**
 * Calcula el offset en minutos de un timezone IANA.
 * Maneja DST (horario de verano) correctamente.
 */
const _getTZOffset = (timezone, date) => {
  const tzDate  = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (tzDate - utcDate) / 60000;
};

// -----------------------------------------------
// NÚCLEO: broadcastToUTC
// -----------------------------------------------

/**
 * Convierte el broadcast de un anime (día + hora en TZ fuente,
 * normalmente Asia/Tokyo) al Date UTC equivalente de esta semana.
 *
 * Esta función es el núcleo de todo el sistema de horarios.
 * Tanto el filtro como el display la usan, garantizando
 * resultados consistentes para cualquier timezone del mundo.
 *
 * @param {object} broadcast - { day, time, timezone }
 * @returns {Date|null} - Date en UTC o null si faltan datos
 */
const broadcastToUTC = (broadcast) => {
  if (!broadcast?.day || !broadcast?.time) return null;

  try {
    const sourceTimezone = broadcast.timezone ?? 'Asia/Tokyo';
    const normalizedDay  = NORMALIZE_DAYS[broadcast.day.toLowerCase().trim()];
    if (!normalizedDay) return null;

    const targetDayIdx   = DAY_INDEX[normalizedDay];
    const [hours, minutes] = broadcast.time.split(':').map(Number);
    const now            = new Date();

    // 1. Día actual en el TZ fuente
    const nowInSource        = new Date(now.toLocaleString('en-US', { timeZone: sourceTimezone }));
    const currentDayInSource = nowInSource.getDay();

    // 2. Diferencia de días: cuántos días antes/después es el broadcast
    //    respecto a hoy (en el TZ fuente)
    let daysOffset = targetDayIdx - currentDayInSource;
    // Mantenerlo en el rango [-6, 0] para buscar la emisión más reciente
    // (ya sea hoy o en días anteriores de esta semana)
    if (daysOffset > 0) daysOffset -= 7;

    // 3. Fecha de hoy en el TZ fuente (año/mes/día)
    const partsSource = new Intl.DateTimeFormat('en-US', {
      timeZone: sourceTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);

    const ps = {};
    partsSource.forEach(({ type, value }) => { ps[type] = value; });

    // 4. Construir ISO con la hora de broadcast (tratada como UTC provisionalmente)
    const isoRef  = `${ps.year}-${ps.month}-${ps.day}T` +
                    `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00Z`;
    const refDate = new Date(isoRef);

    // 5. Calcular offset real del TZ fuente y corregir a UTC verdadero
    const tzOffset    = _getTZOffset(sourceTimezone, refDate);
    let broadcastUTC  = new Date(refDate.getTime() - tzOffset * 60000);

    // 6. Ajustar al día de la semana correcto
    broadcastUTC = new Date(broadcastUTC.getTime() + daysOffset * 86400000);

    return broadcastUTC;

  } catch (err) {
    console.warn('⚠️ broadcastToUTC error:', err.message, broadcast);
    return null;
  }
};

// -----------------------------------------------
// FILTRADO — TIMEZONE-AWARE
// -----------------------------------------------

/**
 * Comprueba si el broadcast de un anime ocurre HOY
 * en el timezone LOCAL del navegador del usuario.
 *
 * Convierte el broadcast JST → UTC → día local del usuario
 * y lo compara con el día actual local.
 *
 * @param {object} broadcast
 * @returns {boolean}
 */
const broadcastIsToday = (broadcast) => {
  const utc = broadcastToUTC(broadcast);
  if (!utc) return false;

  const now = new Date();

  // Día del broadcast en el timezone local del usuario
  const broadcastLocalDay = utc.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  // Día actual en el timezone local del usuario
  const todayLocal = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  const match = broadcastLocalDay === todayLocal;

  console.log(`📡 ${broadcast.day} ${broadcast.time} JST → local: ${broadcastLocalDay} | hoy: ${todayLocal} | match: ${match}`);

  return match;
};

/**
 * Resuelve el broadcast efectivo de un anime.
 *
 * Prioridad:
 *   1. broadcastOverride (campo manual del admin)  ← máxima prioridad
 *   2. broadcast         (dato guardado desde MAL)
 *   3. null              (sin datos — excluir del carrusel)
 *
 * El override permite al admin corregir retrasos o cambios
 * de horario sin esperar a que MAL se actualice.
 *
 * @param {object} anime
 * @returns {object|null} broadcast efectivo { day, time, timezone }
 */
const resolveEffectiveBroadcast = (anime) => {
  // Override manual tiene prioridad absoluta
  if (anime.broadcastOverride?.day && anime.broadcastOverride?.time) {
    return {
      ...anime.broadcastOverride,
      timezone: anime.broadcastOverride.timezone ?? 'Asia/Tokyo'
    };
  }
  // Fallback: dato original de MAL
  if (anime.broadcast?.day) {
    return anime.broadcast;
  }
  return null;
};

/**
 * Filtra los animes del hub que emiten HOY en el timezone
 * local del usuario. Usa broadcastOverride si está definido,
 * sino usa el broadcast de MAL/AniList.
 *
 * Barreras de seguridad (en orden):
 *  1. status === 'completed'/'finished' → excluir siempre
 *  2. scheduleActive === false → excluido manualmente por admin
 *  3. Sin datos de broadcast → no hay horario guardado
 *  4. broadcastIsToday → el día de emisión coincide con hoy
 *
 * @param {object[]} hubAnimes
 * @returns {object[]}
 */
const filterAnimesForToday = (hubAnimes) => {
  return hubAnimes.filter(anime => {
    // Barrera 1: estado finalizado — nunca en el carrusel
    if (anime.status === 'completed' || anime.status === 'finished') return false;

    // Barrera 2: excluido manualmente desde el admin
    if (anime.scheduleActive === false) return false;

    // Barrera 3: sin datos de broadcast
    const effective = resolveEffectiveBroadcast(anime);
    if (!effective) return false;

    // Barrera 4: verificar que el día de emisión sea hoy
    return broadcastIsToday(effective);
  });
};

// -----------------------------------------------
// CONVERSIÓN DE HORA PARA DISPLAY
// -----------------------------------------------

/**
 * Convierte el horario de broadcast al timezone local del usuario.
 *
 * Prioridad:
 *  1. broadcast.airingAt (Unix timestamp de AniList) → conversión directa, exacta
 *  2. broadcast.day + time (MAL/Jikan) → cálculo via broadcastToUTC()
 *
 * @param {object} broadcast
 * @returns {string} - e.g. "21:00 (GMT-3)"
 */
const convertBroadcastToLocal = (broadcast) => {
  // ✅ Prioridad 1: timestamp exacto de AniList (sin cálculos de offset)
  if (broadcast?.airingAt) {
    try {
      const date = new Date(broadcast.airingAt * 1000);

      const localTime = date.toLocaleTimeString('es-ES', {
        hour: '2-digit', minute: '2-digit'
      });

      const tzName = new Intl.DateTimeFormat('es-ES', { timeZoneName: 'short' })
        .formatToParts(date)
        .find(p => p.type === 'timeZoneName')?.value ?? '';

      return `${localTime} (${tzName})`;
    } catch (_) { /* fallthrough */ }
  }

  // Prioridad 2: calcular desde day + time (Jikan/MAL)
  const utc = broadcastToUTC(broadcast);

  if (!utc) {
    return broadcast?.time
      ? `${broadcast.time} (${broadcast.timezone ?? 'JST'})`
      : '';
  }

  try {
    const localTime = utc.toLocaleTimeString('es-ES', {
      hour: '2-digit', minute: '2-digit'
    });

    const localTZName = new Intl.DateTimeFormat('es-ES', { timeZoneName: 'short' })
      .formatToParts(utc)
      .find(p => p.type === 'timeZoneName')?.value ?? '';

    return `${localTime} (${localTZName})`;

  } catch (_) {
    return broadcast?.time
      ? `${broadcast.time} (${broadcast.timezone ?? 'JST'})`
      : '';
  }
};

// -----------------------------------------------
// RENDER
// -----------------------------------------------

const buildScheduleCard = (anime) => {
  const title     = _sanitizeSchedule(anime.title);
  const poster    = _sanitizeSchedule(anime.poster || anime.cardImage || '');
  const hubUrl    = _sanitizeSchedule(`pages/anime-details.html?id=${anime.id}`);

  // Usar el mismo broadcast efectivo que el filtro
  const effective = resolveEffectiveBroadcast(anime);

  // Badge que indica si se está usando override o dato de MAL
  const isOverride = !!(anime.broadcastOverride?.day && anime.broadcastOverride?.time);
  const sourceBadge = isOverride ? '⚠️ Horario ajustado' : '';

  const time = effective?.time
    ? `🕐 ${_sanitizeSchedule(convertBroadcastToLocal(effective))}`
    : '';

  return `
    <a href="${hubUrl}" class="schedule-card schedule-card--in-hub" title="Ver ${title}">
      <div class="schedule-card__poster-wrap">
        <img
          src="${poster}" alt="${title}"
          class="schedule-card__poster" loading="lazy"
          onerror="this.src='https://via.placeholder.com/150x220?text=Sin+Imagen'"
        >
        <span class="schedule-badge schedule-badge--hub">📺 Nuevo Hoy</span>
      </div>
      <div class="schedule-card__body">
        <h4 class="schedule-card__title">${title}</h4>
        ${time ? `<p class="schedule-card__meta">${time}</p>` : ''}
        ${sourceBadge ? `<p class="schedule-card__override-badge">${sourceBadge}</p>` : ''}
      </div>
    </a>
  `;
};

const renderScheduleLoading = (container) => {
  container.innerHTML = `
    <div class="schedule-loading">
      <div class="schedule-spinner"></div>
      <p>Cargando estrenos de hoy…</p>
    </div>
  `;
};

const renderScheduleError = (container, message) => {
  container.innerHTML = `
    <div class="schedule-empty">
      <span style="font-size:2rem;">😕</span>
      <p>No se pudieron cargar los estrenos.</p>
      <small>${_sanitizeSchedule(message)}</small>
    </div>
  `;
};

const renderScheduleEmpty = (container, dayLabel) => {
  container.innerHTML = `
    <div class="schedule-empty">
      <span style="font-size:2rem;">📅</span>
      <p>Ningún anime de tu hub estrena hoy (${_sanitizeSchedule(dayLabel)}).</p>
      <small>Vincula los animes con MAL desde el panel de admin para activar esta función.</small>
    </div>
  `;
};

// -----------------------------------------------
// SCROLL
// -----------------------------------------------

const scrollCarousel = (direction) => {
  const carousel = document.getElementById('scheduleCarousel');
  if (!carousel) return;
  carousel.scrollBy({ left: direction * 450, behavior: 'smooth' });
};

// -----------------------------------------------
// INICIALIZACIÓN
// -----------------------------------------------

const initTodaySchedule = async () => {
  const container = document.getElementById('scheduleCarousel');
  const titleEl   = document.getElementById('scheduleDayTitle');

  if (!container) {
    console.warn('⚠️ today-schedule: no se encontró #scheduleCarousel');
    return;
  }

  // Título con el día actual del timezone local del usuario
  const now        = new Date();
  const todayLocal = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayLabel = DAY_LABELS_ES[todayLocal] ?? todayLocal;

  if (titleEl) titleEl.textContent = `📅 Estrenos de Hoy — ${todayLabel}`;

  renderScheduleLoading(container);

  try {
    if (!window.firebaseService) throw new Error('Firebase no disponible');

    const hubAnimes   = await window.firebaseService.getAllAnimes();
    console.log(`📚 Hub: ${hubAnimes.length} animes cargados`);

    // Filtrado timezone-aware
    const todayAnimes = filterAnimesForToday(hubAnimes);
    console.log(`✅ Estrenos hoy (${todayLabel}): ${todayAnimes.length}`);

    if (todayAnimes.length === 0) {
      renderScheduleEmpty(container, todayLabel);
      return;
    }

    container.innerHTML = todayAnimes.map(buildScheduleCard).join('');

  } catch (error) {
    console.error('❌ Error al cargar estrenos de hoy:', error);
    renderScheduleError(container, error.message);
  }
};

// ============================================
// AUTO-INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  if (window.firebaseService) {
    initTodaySchedule();
  } else {
    window.addEventListener('load', initTodaySchedule);
  }
});

// ============================================
// EXPORTAR
// ============================================
window.todaySchedule = { init: initTodaySchedule, scrollCarousel };

console.log('📅 Today Schedule v4.1 — AniList timestamps + timezone-aware filtering');