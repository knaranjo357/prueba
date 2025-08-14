import { MenuItem } from '../types';

const API_URL = '/api-proxy/webhook/luis-res/menu';

// Cache para mejorar rendimiento
let cachedMenuItems: MenuItem[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Simulamos delay de red mínimo para realismo pero optimizado
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchMenuItems = async (): Promise<MenuItem[]> => {
  try {
    // Verificar cache primero
    const now = Date.now();
    if (cachedMenuItems && (now - lastFetchTime) < CACHE_DURATION) {
      // Delay mínimo para simular red pero muy rápido
      await delay(150);
      return cachedMenuItems;
    }

    // Delay de red optimizado - mucho más rápido que antes
    await delay(300);
    
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Ensure data is an array and has the correct structure
    if (!Array.isArray(data)) {
      throw new Error('Invalid data format received from API');
    }
    
    // Map the API data to our MenuItem interface with better validation
    const menuItems: MenuItem[] = data
      .filter((item: any) => item && typeof item === 'object') // Filter out invalid items
      .map((item: any) => ({
        id: String(item.id) || String(Math.random()),
        nombre: item.nombre || item.name || 'Sin nombre',
        descripcion: item.descripcion || item.description || 'Delicioso platillo preparado con ingredientes frescos',
        servicios: Array.isArray(item.servicios) ? item.servicios : ['almuerzo'],
        categorias: Array.isArray(item.categorias) ? item.categorias : ['general'],
        disponible: item.disponible !== false,
        para_llevar: item.para_llevar !== false,
        url_imagen: item.url_imagen || item.imagen || item.image || null,
        precio_adicional_llevar: Number(item.precio_adicional_llevar) || 0,
        dias: Array.isArray(item.dias) ? item.dias : [2, 3, 4, 5, 6, 7], // Default: Tuesday to Sunday
        valor: Number(item.valor || item.precio || item.price || 0)
      }))
      .filter(item => item.valor > 0 && item.nombre.trim() !== ''); // Filter out items with no price or name
    
    // Actualizar cache
    cachedMenuItems = menuItems;
    lastFetchTime = now;
    
    return menuItems;
  } catch (error) {
    console.error('Error fetching menu items:', error);
    
    // Si hay datos en cache, usarlos como fallback
    if (cachedMenuItems) {
      return cachedMenuItems;
    }
    
    throw new Error('Error al cargar el menú. Por favor, verifique su conexión e intente nuevamente.');
  }
};

// Función para limpiar cache manualmente si es necesario
export const clearMenuCache = () => {
  cachedMenuItems = null;
  lastFetchTime = 0;
};