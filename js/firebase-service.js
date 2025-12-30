/* ============================================
   FIREBASE SERVICE - CRUD OPERATIONS
   Archivo: js/firebase-service.js
   ============================================ */

/**
 * NOTA PARA PROGRAMADOR: 
 * No declaramos 'const seasonsRef' aquí arriba porque ya existen en el objeto 
 * global window.firebaseDB definido en firebase-config.js. 
 * Accederemos a ellas directamente desde el objeto global.
 */

window.firebaseService = {
  // ============================================
  // SEASONS (TEMPORADAS)
  // ============================================
  // En firebase-service.js, dentro del objeto window.firebaseService
getAnimeById: async (animeId) => {
  try {
    const doc = await window.firebaseDB.animesRef.doc(animeId).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error al obtener anime por ID:', error);
    return null;
  }
},

  getAllSeasons: async () => {
    try {
      const snapshot = await window.firebaseDB.seasonsRef.orderBy('order').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error al obtener temporadas:', error);
      return [];
    }
  },

  addSeason: async (seasonData) => {
    try {
      const docRef = await window.firebaseDB.seasonsRef.add({
        ...seasonData,
        animeCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Temporada agregada:', docRef.id);
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('❌ Error al agregar temporada:', error);
      return { success: false, error };
    }
  },

  deleteSeason: async (seasonId) => {
    try {
      await window.firebaseDB.seasonsRef.doc(seasonId).delete();
      console.log('✅ Temporada eliminada:', seasonId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error al eliminar temporada:', error);
      return { success: false, error };
    }
  },

  // ============================================
  // ANIMES
  // ============================================
  getAllAnimes: async () => {
    try {
      const snapshot = await window.firebaseDB.animesRef.orderBy('order').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error al obtener animes:', error);
      return [];
    }
  },

getAnimesBySeason: async (seasonId) => {
    try {
      const snapshot = await window.firebaseDB.animesRef
        .where('seasonId', '==', seasonId)
        // .orderBy('order')  <-- Comenta o borra esta línea para probar
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error al obtener animes por temporada:', error);
      return [];
    }
  },

  addAnime: async (animeData) => {
    try {
      const docRef = await window.firebaseDB.animesRef.add({
        ...animeData,
        totalEpisodes: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      return { success: false, error };
    }
  },

  updateAnime: async (animeId, animeData) => {
    try {
      await window.firebaseDB.animesRef.doc(animeId).update(animeData);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  },

  deleteAnime: async (animeId) => {
    try {
      await window.firebaseDB.animesRef.doc(animeId).delete();
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  },

  // ============================================
  // EPISODES (EPISODIOS)
  // ============================================
  getEpisodesByAnime: async (animeId) => {
    try {
      const snapshot = await window.firebaseDB.episodesRef
        .where('animeId', '==', animeId)
        .orderBy('episodeNumber')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error al obtener episodios:', error);
      return [];
    }
  },

  addEpisode: async (episodeData) => {
    try {
      const docRef = await window.firebaseDB.episodesRef.add({
        ...episodeData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Actualizar contador en el anime
      const episodes = await window.firebaseService.getEpisodesByAnime(episodeData.animeId);
      await window.firebaseDB.animesRef.doc(episodeData.animeId).update({
        totalEpisodes: episodes.length
      });
      
      return { success: true, id: docRef.id };
    } catch (error) {
      return { success: false, error };
    }
  },

  deleteEpisode: async (episodeId, animeId) => {
    try {
      await window.firebaseDB.episodesRef.doc(episodeId).delete();
      
      // Recalcular totalEpisodes
      const episodes = await window.firebaseService.getEpisodesByAnime(animeId);
      await window.firebaseDB.animesRef.doc(animeId).update({
        totalEpisodes: episodes.length
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }
};