/* ============================================
   FIREBASE SERVICIOS - CRUD OPERATIONS
   Author: Jaykai2
   ✅ ACTUALIZADO: Agregado soporte para personajes
   ============================================ */

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
  // EPISODES (EPISODIOS)
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
      
      const docRef = await window.firebaseDB.episodesRef.add({
        ...episodeData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Episodio agregado con ID:', docRef.id);
      
      const episodesSnapshot = await window.firebaseDB.episodesRef
        .where('animeId', '==', episodeData.animeId)
        .get();
      
      const totalEpisodes = episodesSnapshot.size;
      
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
      
      await window.firebaseDB.episodesRef.doc(episodeId).delete();
      
      console.log('✅ Episodio eliminado');
      
      const episodesSnapshot = await window.firebaseDB.episodesRef
        .where('animeId', '==', animeId)
        .get();
      
      const totalEpisodes = episodesSnapshot.size;
      
      await window.firebaseDB.animesRef.doc(animeId).update({
        totalEpisodes: totalEpisodes
      });
      
      console.log(`✅ Contador actualizado: ${totalEpisodes} episodios`);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error al eliminar episodio:', error);
      return { success: false, error };
    }
  },

  // ============================================
  // ✅ CHARACTERS (PERSONAJES) - NUEVO
  // ============================================
  
  /**
   * Obtener todos los personajes
   */
  getAllCharacters: async () => {
    try {
      const snapshot = await window.firebaseDB.db.collection('characters').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('❌ Error al obtener personajes:', error);
      return [];
    }
  },

  /**
   * Obtener personajes de un anime específico
   */
  getCharactersByAnime: async (animeId) => {
    try {
      const snapshot = await window.firebaseDB.db.collection('characters')
        .where('animeId', '==', animeId)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('❌ Error al obtener personajes del anime:', error);
      return [];
    }
  },

  /**
   * Agregar un personaje
   */
  addCharacter: async (characterData) => {
    try {
      const docRef = await window.firebaseDB.db.collection('characters').add({
        ...characterData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Personaje agregado:', docRef.id);
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('❌ Error al agregar personaje:', error);
      return { success: false, error };
    }
  },

  /**
   * Agregar múltiples personajes (para importación desde Jikan)
   */
  addMultipleCharacters: async (charactersArray) => {
    try {
      const batch = window.firebaseDB.db.batch();
      const charactersRef = window.firebaseDB.db.collection('characters');
      
      charactersArray.forEach(char => {
        const newCharRef = charactersRef.doc();
        batch.set(newCharRef, {
          ...char,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`✅ ${charactersArray.length} personajes agregados en batch`);
      return { success: true, count: charactersArray.length };
    } catch (error) {
      console.error('❌ Error al agregar personajes en batch:', error);
      return { success: false, error };
    }
  },

  /**
   * Actualizar un personaje
   */
  updateCharacter: async (characterId, characterData) => {
    try {
      await window.firebaseDB.db.collection('characters').doc(characterId).update(characterData);
      console.log('✅ Personaje actualizado:', characterId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error al actualizar personaje:', error);
      return { success: false, error };
    }
  },

  /**
   * Eliminar un personaje
   */
  deleteCharacter: async (characterId) => {
    try {
      await window.firebaseDB.db.collection('characters').doc(characterId).delete();
      console.log('✅ Personaje eliminado:', characterId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error al eliminar personaje:', error);
      return { success: false, error };
    }
  },

  /**
   * Eliminar todos los personajes de un anime
   */
  deleteCharactersByAnime: async (animeId) => {
    try {
      const snapshot = await window.firebaseDB.db.collection('characters')
        .where('animeId', '==', animeId)
        .get();
      
      const batch = window.firebaseDB.db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`✅ ${snapshot.size} personajes eliminados del anime`);
      return { success: true, count: snapshot.size };
    } catch (error) {
      console.error('❌ Error al eliminar personajes del anime:', error);
      return { success: false, error };
    }
  },

  /**
   * Verificar si un anime ya tiene personajes importados
   */
  hasCharacters: async (animeId) => {
    try {
      const snapshot = await window.firebaseDB.db.collection('characters')
        .where('animeId', '==', animeId)
        .limit(1)
        .get();
      return !snapshot.empty;
    } catch (error) {
      console.error('❌ Error al verificar personajes:', error);
      return false;
    }
  }
};

console.log('🔥 Firebase Service cargado correctamente');
console.log('✅ Soporte para personajes agregado');