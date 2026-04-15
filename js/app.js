import { state, subscribe } from './state.js';
import { initSupabase, fetchAllData } from './supabase.js';
import { setupNavigation, navigateTo } from './navigation.js';
import { showLoader, hideLoader, toast } from './ui.js';
import { applyPermissions } from './modules/usuarios.js';

async function initApp() {
  showLoader('Conectando con Supabase...');
  
  try {
    await initSupabase();
    await fetchAllData();
    hideLoader();
    
    setupNavigation();
    await applyPermissions();
    
    document.getElementById('buildTag').textContent = `v19 · Modular`;
    navigateTo('list');
  } catch (error) {
    hideLoader();
    console.error('Error inicializando la app:', error);
    toast('Error al conectar con la base de datos', 'er');
    navigateTo('list');
  }
}

document.addEventListener('DOMContentLoaded', initApp);

window.app = {
  navigateTo,
  toast,
  showLoader,
  hideLoader,
};