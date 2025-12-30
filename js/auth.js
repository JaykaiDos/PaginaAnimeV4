/* ============================================
   AUTHENTICATION SYSTEM
   Archivo: js/auth.js
   ============================================ */

// ============================================
// VERIFICAR SI EL USUARIO ESTÁ LOGUEADO
// ============================================
const checkIfAdmin = async () => {
  const user = await window.firebaseDB.checkAuth();
  return user !== null;
};

// ============================================
// LOGIN DEL ADMINISTRADOR
// ============================================
const loginAdmin = async (email, password) => {
  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    console.log('✅ Login exitoso:', userCredential.user.email);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('❌ Error en login:', error.message);
    return { success: false, error: error.message };
  }
};

// ============================================
// LOGOUT
// ============================================
const logoutAdmin = async () => {
  try {
    await firebase.auth().signOut();
    console.log('✅ Sesión cerrada');
    window.location.href = '../index.html';
  } catch (error) {
    console.error('❌ Error al cerrar sesión:', error);
  }
};

// ============================================
// MOSTRAR/OCULTAR BOTONES DE ADMIN
// ============================================
const toggleAdminButtons = async () => {
  const isAdmin = await checkIfAdmin();
  const adminButtons = document.querySelectorAll('.admin-only');
  
  adminButtons.forEach(btn => {
    btn.style.display = isAdmin ? 'block' : 'none';
  });
  
  return isAdmin;
};

// ============================================
// PROTEGER PÁGINA DE ADMIN
// ============================================
const protectAdminPage = async () => {
  const isAdmin = await checkIfAdmin();
  
  if (!isAdmin) {
    alert('⛔ Acceso denegado. Debes iniciar sesión como administrador.');
    window.location.href = 'login.html';
  }
};

// ============================================
// EXPORTAR FUNCIONES
// ============================================
window.authSystem = {
  checkIfAdmin,
  loginAdmin,
  logoutAdmin,
  toggleAdminButtons,
  protectAdminPage
};

console.log('🔐 Sistema de autenticación cargado');