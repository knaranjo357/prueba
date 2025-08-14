import { CartItem, CustomerInfo, City } from '../types';
import { restaurantConfig } from '../config/restaurantConfig';

// Formatear precio en pesos colombianos
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

// Calcular precio total de un item del carrito
export const calculateItemPrice = (item: CartItem): number => {
  let basePrice = item.valor * item.quantity;
  if (item.isForTakeaway && item.precio_adicional_llevar) {
    basePrice += item.precio_adicional_llevar * item.quantity;
  }
  return basePrice;
};

// Calcular precio total del carrito
export const calculateTotalPrice = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + calculateItemPrice(item), 0);
};

// Formatear mensaje de WhatsApp
export const formatWhatsAppMessage = (
  items: CartItem[],
  customerInfo: CustomerInfo,
  deliveryPrice: number = 0
): string => {
  const total = calculateTotalPrice(items) + deliveryPrice;
  
  let message = `🍽️ *NUEVO PEDIDO - ${restaurantConfig.nombre}*\n\n`;
  message += `👤 *Cliente:* ${customerInfo.name}\n`;
  message += `📱 *Teléfono:* ${customerInfo.phone}\n`;
  
  if (customerInfo.deliveryType === 'delivery') {
    message += `🏠 *Dirección:* ${customerInfo.address}\n`;
    message += `🏙️ *Ciudad:* ${customerInfo.city}\n`;
    if (customerInfo.neighborhood) {
      message += `📍 *Barrio:* ${customerInfo.neighborhood}\n`;
    }
  } else {
    message += `🏪 *Tipo:* Recoger en local\n`;
  }
  
  message += `💳 *Pago:* ${customerInfo.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}\n\n`;
  
  message += `📋 *PEDIDO:*\n`;
  items.forEach((item, index) => {
    message += `${index + 1}. ${item.nombre}\n`;
    message += `   Cantidad: ${item.quantity}\n`;
    message += `   Precio: ${formatPrice(item.valor)}\n`;
    if (item.precio_adicional_llevar && item.precio_adicional_llevar > 0) {
      message += `   Recargo llevar: ${formatPrice(item.precio_adicional_llevar)}\n`;
    }
    if (item.notes && item.notes.trim()) {
      message += `   Notas: ${item.notes}\n`;
    }
    message += `   Subtotal: ${formatPrice(calculateItemPrice(item))}\n\n`;
  });
  
  const subtotal = calculateTotalPrice(items);
  message += `💰 *RESUMEN:*\n`;
  message += `Subtotal: ${formatPrice(subtotal)}\n`;
  
  if (deliveryPrice > 0) {
    message += `Domicilio: ${formatPrice(deliveryPrice)}\n`;
  }
  
  message += `*TOTAL: ${formatPrice(total)}*\n\n`;
  message += `⏰ Pedido realizado: ${new Date().toLocaleString('es-CO')}`;
  
  return encodeURIComponent(message);
};

// Ciudades y barrios con precios de domicilio
export const cities: City[] = [
  {
    name: 'Bucaramanga',
    neighborhoods: [
      { name: 'Centro', price: 5000 },
      { name: 'Cabecera', price: 6000 },
      { name: 'García Rovira', price: 5500 },
      { name: 'San Francisco', price: 6500 },
      { name: 'Ciudadela Real de Minas', price: 7000 },
      { name: 'Morrorico', price: 8000 },
      { name: 'Álamos', price: 7500 },
      { name: 'La Concordia', price: 6000 },
      { name: 'Antonia Santos', price: 5500 },
      { name: 'La Libertad', price: 6000 }
    ]
  },
  {
    name: 'Floridablanca',
    neighborhoods: [
      { name: 'Caldas', price: 3000 },
      { name: 'Centro', price: 4000 },
      { name: 'Cañaveral', price: 5000 },
      { name: 'Villa Helena', price: 4500 },
      { name: 'Bosques de Floridablanca', price: 6000 },
      { name: 'Ruitoque', price: 7000 },
      { name: 'Lagos del Cacique', price: 5500 },
      { name: 'Terrazas', price: 5000 },
      { name: 'San Fernando', price: 4500 },
      { name: 'Ricaurte', price: 4000 }
    ]
  }
];

// Verificar si un servicio está disponible en el horario actual
export const isServiceAvailable = (service: 'lunch' | 'dinner', date: Date = new Date()): boolean => {
  const now = date;
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const timeInMinutes = currentHour * 60 + currentMinutes;
  const dayOfWeek = now.getDay();
  
  if (service === 'lunch') {
    const startTime = timeToMinutes(restaurantConfig.hora_almuerzo_inicio);
    const endTime = (dayOfWeek === 0 || dayOfWeek === 6) ? 
      timeToMinutes(restaurantConfig.hora_almuerzo_final_fds) : 
      timeToMinutes(restaurantConfig.hora_almuerzo_final_entresemana);
    
    return timeInMinutes >= startTime && timeInMinutes <= endTime;
  } else {
    const startTime = timeToMinutes(restaurantConfig.hora_comida_inicio);
    const endTime = timeToMinutes(restaurantConfig.hora_comida_final);
    
    return timeInMinutes >= startTime && timeInMinutes <= endTime;
  }
};

// Obtener el próximo servicio disponible
export const getNextAvailableService = (date: Date = new Date()): {
  service: 'lunch' | 'dinner';
  day: string;
  schedule: { start: string; end: string };
} | null => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  // Check today first
  if (isServiceAvailable('lunch', date)) {
    return {
      service: 'lunch',
      day: 'hoy',
      schedule: {
        start: restaurantConfig.hora_almuerzo_inicio,
        end: date.getDay() === 0 || date.getDay() === 6 ? 
          restaurantConfig.hora_almuerzo_final_fds : 
          restaurantConfig.hora_almuerzo_final_entresemana
      }
    };
  }
  
  if (isServiceAvailable('dinner', date)) {
    return {
      service: 'dinner',
      day: 'hoy',
      schedule: {
        start: restaurantConfig.hora_comida_inicio,
        end: restaurantConfig.hora_comida_final
      }
    };
  }
  
  // Check next available service
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(11, 0, 0, 0); // Set to lunch time
  
  return {
    service: 'lunch',
    day: days[tomorrow.getDay()],
    schedule: {
      start: restaurantConfig.hora_almuerzo_inicio,
      end: tomorrow.getDay() === 0 || tomorrow.getDay() === 6 ? 
        restaurantConfig.hora_almuerzo_final_fds : 
        restaurantConfig.hora_almuerzo_final_entresemana
    }
  };
};

// Obtener estado del restaurante
export const getRestaurantStatus = (date: Date = new Date()): {
  isClosed: boolean;
  reason?: string;
  isSpecialDay?: boolean;
} => {
  if (restaurantConfig.cerrado_inusual) {
    return {
      isClosed: true,
      reason: 'Cerrado temporalmente por motivos especiales',
      isSpecialDay: true
    };
  }
  
  if (restaurantConfig.abierto_inusual) {
    return {
      isClosed: false,
      reason: 'Abierto en horario especial',
      isSpecialDay: true
    };
  }
  
  const dayOfWeek = date.getDay();
  
  // Cerrado los lunes por defecto
  if (dayOfWeek === 1) {
    return {
      isClosed: true,
      reason: 'Cerrado los lunes - Día de descanso'
    };
  }
  
  const lunchAvailable = isServiceAvailable('lunch', date);
  const dinnerAvailable = isServiceAvailable('dinner', date);
  
  if (!lunchAvailable && !dinnerAvailable) {
    return {
      isClosed: true,
      reason: 'Fuera del horario de atención'
    };
  }
  
  return {
    isClosed: false
  };
};

// Convertir tiempo en formato HH:MM a minutos
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}