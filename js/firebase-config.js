/* ============================================
   FIREBASE Configuracion - Inicialización
   Author: Jaykai2
   ============================================ */

const firebaseConfig = {
  apiKey: "AIzaSyAH4y1YBvB2wf8fHnHzO3XBwlyo3rFyVeg",
  authDomain: "anime-hub-9e816.firebaseapp.com",
  projectId: "anime-hub-9e816",
  storageBucket: "anime-hub-9e816.firebasestorage.app",
  messagingSenderId: "876560825402",
  appId: "1:876560825402:web:0923b0b7912dda0de10903",
  measurementId: "G-GPR4N94LE2"
};

// ============================================
// INICIALIZAR FIREBASE
// ============================================
let app, db, auth;

try {
  // Inicializar Firebase
  app = firebase.initializeApp(firebaseConfig);
  
  // Inicializar Firestore (Base de Datos)
  db = firebase.firestore();
  
  // Inicializar Authentication
  auth = firebase.auth();
  
// EXPORTAR PARA USO EN OTROS ARCHIVOS
window.firebaseDB = {
  db,
  auth,
  seasonsRef: db.collection('seasons'),
  animesRef: db.collection('animes'),
  episodesRef: db.collection('episodes'),
  checkAuth
};

  console.log('✅ Firebase inicializado correctamente');
  
} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error);
}

// ============================================
// REFERENCIAS A COLECCIONES
// ============================================
const seasonsRef = db.collection('seasons');
const animesRef = db.collection('animes');
const episodesRef = db.collection('episodes');

// ============================================
// HELPER: VERIFICAR SI HAY USUARIO LOGUEADO
// ============================================
const checkAuth = () => {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged((user) => {
      resolve(user);
    });
  });
};

// ============================================
// EXPORTAR PARA USO EN OTROS ARCHIVOS
// ============================================
window.firebaseDB = {
  db,
  auth,
  seasonsRef,
  animesRef,
  episodesRef,
  checkAuth
};

console.log('🔥 Firebase Config cargado');