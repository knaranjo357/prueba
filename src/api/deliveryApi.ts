interface DeliveryArea {
  row_number: number;
  barrio: string;
  precio: number;
}

const API_URL = 'https://n8n.alliasoft.com/webhook/luis-res/domicilios';

// Cache para mejorar rendimiento
let cachedDeliveryAreas: DeliveryArea[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

export const fetchDeliveryAreas = async (): Promise<DeliveryArea[]> => {
  try {
    // Verificar cache primero
    const now = Date.now();
    if (cachedDeliveryAreas && (now - lastFetchTime) < CACHE_DURATION) {
      return cachedDeliveryAreas;
    }

    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Ensure data is an array and has the correct structure
    if (!Array.isArray(data)) {
      throw new Error('Invalid data format received from API');
    }
    
    // Map and sort alphabetically
    const deliveryAreas: DeliveryArea[] = data
      .filter((item: any) => item && typeof item === 'object' && item.barrio && item.precio)
      .map((item: any) => ({
        row_number: item.row_number || 0,
        barrio: item.barrio.trim(),
        precio: Number(item.precio) || 0
      }))
      .sort((a, b) => a.barrio.localeCompare(b.barrio, 'es', { sensitivity: 'base' }));
    
    // Actualizar cache
    cachedDeliveryAreas = deliveryAreas;
    lastFetchTime = now;
    
    return deliveryAreas;
  } catch (error) {
    console.error('Error fetching delivery areas:', error);
    
    // Si hay datos en cache, usarlos como fallback
    if (cachedDeliveryAreas) {
      return cachedDeliveryAreas;
    }
    
    throw new Error('Error al cargar las zonas de domicilio. Por favor, verifique su conexión e intente nuevamente.');
  }
};

// Función para limpiar cache manualmente si es necesario
export const clearDeliveryCache = () => {
  cachedDeliveryAreas = null;
  lastFetchTime = 0;
};