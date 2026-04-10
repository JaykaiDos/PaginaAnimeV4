/* ============================================
   UTILS.JS — Utilidades Compartidas
   Autor: Jaykai2
   Versión: 1.0

   Responsabilidad única: centralizar helpers
   que son consumidos por más de un módulo JS

   Orden de carga requerido en HTML:
     1. firebase-config.js
     2. firebase-service.js
     3. utils.js          ← ESTE ARCHIVO
     4. anime-details.js / watch.js
   ============================================ */

'use strict';

/* --------------------------------------------------
   YOUTUBE EMBED CONVERTER
   
   Convierte cualquier variante de URL de YouTube
   al formato /embed/ requerido por iframes.
   
   Soporta:
     · https://www.youtube.com/watch?v=VIDEO_ID
     · https://youtu.be/VIDEO_ID
     · URLs ya en formato /embed/ (las retorna igual)
   
   @param {string} url - URL de YouTube en cualquier formato
   @returns {string}   - URL en formato embed, o '' si inválida
-------------------------------------------------- */
const _toYouTubeEmbed = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('/embed/')) return url;

  let videoId = '';

  if (url.includes('v=')) {
    videoId = url.split('v=')[1].split('&')[0];
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1].split('?')[0];
  } else {
    videoId = url.split('/').pop().split('?')[0];
  }

  if (!videoId) return url;
  return `https://www.youtube.com/embed/${videoId}`;
};

/* --------------------------------------------------
   WATCHED EPISODES — LOCALSTORAGE
   
   Persistencia de episodios vistos por anime.
-------------------------------------------------- */

/**
 * Lee los episodios marcados como vistos para un anime.
 * Retorna array vacío si no hay datos o el JSON está corrupto.
 *
 * @param {string} animeId - ID del documento en Firestore
 * @returns {number[]}     - Array de números de episodios vistos
 */
const loadWatchedEpisodes = (animeId) => {
  try {
    const stored = localStorage.getItem(`watched_${animeId}`);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Validar que el resultado sea un array antes de retornarlo
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('❌ Error al leer episodios vistos:', err);
    return [];
  }
};

/**
 * Persiste el array de episodios vistos en localStorage.
 * Falla silenciosamente si localStorage no está disponible.
 *
 * @param {string}   animeId  - ID del documento en Firestore
 * @param {number[]} episodes - Array de números de episodio
 */
const saveWatchedEpisodes = (animeId, episodes) => {
  try {
    localStorage.setItem(`watched_${animeId}`, JSON.stringify(episodes));
  } catch (err) {
    console.error('❌ Error al guardar episodios vistos:', err);
  }
};

/* --------------------------------------------------
   EXPORTAR AL SCOPE GLOBAL
-------------------------------------------------- */
window.AnimeUtils = {
  toYouTubeEmbed:      _toYouTubeEmbed,
  loadWatchedEpisodes,
  saveWatchedEpisodes
};

console.log('🛠️ AnimeUtils cargado');