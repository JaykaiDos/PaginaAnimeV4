/* ============================================
   FIREBASE Configuracion - Inicialización
   Author: Jaykai2
   ============================================ */

/* --------------------------------------------------
   CONFIGURACIÓN DE FIREBASE
   Credenciales del proyecto en Firebase Console.
-------------------------------------------------- */
const firebaseConfig = {
  apiKey:            "AIzaSyDen1wLGz-ZN-9RO2-By18EXtyz8zuoR6k",
  authDomain:        "anime-hub-9e816.firebaseapp.com",
  projectId:         "anime-hub-9e816",
  storageBucket:     "anime-hub-9e816.firebasestorage.app",
  messagingSenderId: "876560825402",
  appId:             "1:876560825402:web:0923b0b7912dda0de10903",
  measurementId:     "G-GPR4N94LE2"
};

/* --------------------------------------------------
   HELPER: VERIFICAR SI HAY USUARIO LOGUEADO
   -------------------------------------------------- */
const checkAuth = () => {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged((user) => {
      resolve(user);
    });
  });
};

/* --------------------------------------------------
   INICIALIZACIÓN DE FIREBASE
   -------------------------------------------------- */
let app, db, auth;

try {
  // Inicializar la app de Firebase
  app  = firebase.initializeApp(firebaseConfig);

  // Inicializar Firestore (Base de Datos)
  db   = firebase.firestore();

  // Inicializar Authentication
  auth = firebase.auth();

  console.log('✅ Firebase inicializado correctamente');

} catch (error) {
  console.error('❌ Error al inicializar Firebase:', error);
}

window.firebaseDB = {
  db,
  auth,
  seasonsRef:  db.collection('seasons'),
  animesRef:   db.collection('animes'),
  episodesRef: db.collection('episodes'),
  checkAuth 
};

console.log('🔥 Firebase Config cargado');