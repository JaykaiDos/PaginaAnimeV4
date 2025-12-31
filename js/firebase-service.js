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

  getAnimeById: async (animeId) => {
    try {
      const doc = await window.firebaseDB.animesRef.doc(animeId).get();
      if (!doc.exists) {
        console.warn('⚠️ Anime no encontrado:', animeId);
        return null;
      }
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('❌ Error al obtener anime por ID:', error);
      return null;
    }
  },

  getAnimesBySeason: async (seasonId) => {
    try {
      const snapshot = await window.firebaseDB.animesRef
        .where('seasonId', '==', seasonId)
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
      console.log('✅ Anime agregado:', docRef.id);
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('❌ Error al agregar anime:', error);
      return { success: false, error };
    }
  },

  updateAnime: async (animeId, animeData) => {
    try {
      await window.firebaseDB.animesRef.doc(animeId).update(animeData);
      console.log('✅ Anime actualizado:', animeId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error al actualizar anime:', error);
      return { success: false, error };
    }
  },

  deleteAnime: async (animeId) => {
    try {
      await window.firebaseDB.animesRef.doc(animeId).delete();
      console.log('✅ Anime eliminado:', animeId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error al eliminar anime:', error);
      return { success: false, error };
    }
  },

  // ============================================
  // EPISODES (EPISODIOS) - CORREGIDO
  // ============================================
  getEpisodesByAnime: async (animeId) => {
    try {
      console.log('🔍 Buscando episodios para anime:', animeId);
      
      const snapshot = await window.firebaseDB.episodesRef
        .where('animeId', '==', animeId)
        .orderBy('episodeNumber')
        .get();
      
      console.log('📊 Episodios encontrados:', snapshot.size);
      
      const episodes = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        console.log('📺 Episodio:', data.episodeNumber, '-', data.title);
        return data;
      });
      
      return episodes;
    } catch (error) {
      console.error('❌ Error al obtener episodios:', error);
      console.error('Detalles:', error.code, error.message);
      return [];
    }
  },

  addEpisode: async (episodeData) => {
    try {
      console.log('📤 Agregando episodio:', episodeData);
      
      // 1. Agregar el episodio a Firestore
      const docRef = await window.firebaseDB.episodesRef.add({
        ...episodeData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Episodio agregado con ID:', docRef.id);
      
      // 2. Obtener todos los episodios del anime para recalcular el total
      const episodesSnapshot = await window.firebaseDB.episodesRef
        .where('animeId', '==', episodeData.animeId)
        .get();
      
      const totalEpisodes = episodesSnapshot.size;
      
      // 3. Actualizar el contador en el documento del anime
      await window.firebaseDB.animesRef.doc(episodeData.animeId).update({
        totalEpisodes: totalEpisodes
      });
      
      console.log(`✅ Contador actualizado: ${totalEpisodes} episodios`);
      
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('❌ Error al agregar episodio:', error);
      console.error('Detalles completos:', error);
      return { success: false, error };
    }
  },

  deleteEpisode: async (episodeId, animeId) => {
    try {
      console.log('🗑️ Eliminando episodio:', episodeId);
      
      // 1. Eliminar el episodio
      await window.firebaseDB.episodesRef.doc(episodeId).delete();
      
      console.log('✅ Episodio eliminado');
      
      // 2. Recalcular total de episodios
      const episodesSnapshot = await window.firebaseDB.episodesRef
        .where('animeId', '==', animeId)
        .get();
      
      const totalEpisodes = episodesSnapshot.size;
      
      // 3. Actualizar contador en el anime
      await window.firebaseDB.animesRef.doc(animeId).update({
        totalEpisodes: totalEpisodes
      });
      
      console.log(`✅ Contador actualizado: ${totalEpisodes} episodios`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error al eliminar episodio:', error);
      return { success: false, error };
    }
  }
};

console.log('🔥 Firebase Service cargado correctamente');