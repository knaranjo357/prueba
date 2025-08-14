export interface RestaurantConfig {
  sopa_dia: string;
  ensalada_dia: string;
  principio_dia: string;
  hora_almuerzo_inicio: string;
  hora_almuerzo_final_entresemana: string;
  hora_almuerzo_final_fds: string;
  hora_comida_inicio: string;
  hora_comida_final: string;
  cerrado_inusual: boolean;
  abierto_inusual: boolean;
  nombre: string;
  direccion: string;
  nequi: string;
  celular: string;
  telefono: string;
  frase: string;
  almuerzo: string;
  comida: string;
  almuerzo_sabado: string;
  almuerzo_domingo: string;
}

export const restaurantConfig: RestaurantConfig = {
  sopa_dia: "arroz",
  ensalada_dia: "cebolla y tomate",
  principio_dia: "lentejas",
  hora_almuerzo_inicio: "11:00",
  hora_almuerzo_final_entresemana: "14:00",
  hora_almuerzo_final_fds: "15:00",
  hora_comida_inicio: "18:00",
  hora_comida_final: "21:30",
  cerrado_inusual: false,
  abierto_inusual: false,
  nombre: "Luis Res",
  direccion: "Cra 37 #109-24, Floridablanca - Barrio Caldas",
  nequi: "3166193963",
  celular: "573166193963",
  telefono: "573166193963",
  frase: "Más de una década sirviendo los sabores auténticos de Santander con ingredientes frescos y recetas tradicionales que pasan de generación en generación.",
  almuerzo: "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO.jpg",
  comida: "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+COMIDA.jpg",
  almuerzo_sabado: "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+SABADO.jpg",
  almuerzo_domingo: "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+DOMINGO.jpg"
};

// URLs de imágenes de menú
export const MENU_IMAGES = {
  ALMUERZO_SEMANA: "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO.png",
  ALMUERZO_SABADO_FESTIVO: "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+SABADO.png",
  ALMUERZO_DOMINGO: "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+ALMUERZO+DOMINGO.png",
  COMIDA: "https://alliasoft.s3.us-east-2.amazonaws.com/restaurante-luisres/MENU+COMIDA.png"
};

export const getCurrentMenuImage = (): string => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const timeInMinutes = currentHour * 60 + currentMinutes;
  const dayOfWeek = now.getDay(); // 0 = domingo, 6 = sábado
  
  // Convertir horas de config a minutos
  const almuerzoInicio = timeToMinutes(restaurantConfig.hora_almuerzo_inicio);
  const comidaInicio = timeToMinutes(restaurantConfig.hora_comida_inicio);
  const comidaFinal = timeToMinutes(restaurantConfig.hora_comida_final);
  
  // Determinar fin de almuerzo según el día
  const almuerzoFinal = (dayOfWeek === 0 || dayOfWeek === 6) ? 
    timeToMinutes(restaurantConfig.hora_almuerzo_final_fds) : 
    timeToMinutes(restaurantConfig.hora_almuerzo_final_entresemana);
  
  // Si estamos en horario de almuerzo
  if (timeInMinutes >= almuerzoInicio && timeInMinutes <= almuerzoFinal) {
    if (dayOfWeek === 0) { // Domingo
      return MENU_IMAGES.ALMUERZO_DOMINGO;
    } else if (dayOfWeek === 6) { // Sábado
      return MENU_IMAGES.ALMUERZO_SABADO_FESTIVO;
    } else { // Lunes a viernes
      return MENU_IMAGES.ALMUERZO_SEMANA;
    }
  }
  
  // Si estamos en horario de comida
  if (timeInMinutes >= comidaInicio && timeInMinutes <= comidaFinal) {
    return MENU_IMAGES.COMIDA;
  }
  
  // Fuera de horario, mostrar el próximo menú disponible
  if (timeInMinutes < almuerzoInicio) {
    // Es muy temprano, mostrar almuerzo
    if (dayOfWeek === 0) return MENU_IMAGES.ALMUERZO_DOMINGO;
    if (dayOfWeek === 6) return MENU_IMAGES.ALMUERZO_SABADO_FESTIVO;
    return MENU_IMAGES.ALMUERZO_SEMANA;
  } else if (timeInMinutes > almuerzoFinal && timeInMinutes < comidaInicio) {
    // Entre almuerzo y comida, mostrar comida
    return MENU_IMAGES.COMIDA;
  } else {
    // Después de la comida, mostrar almuerzo del día siguiente
    return MENU_IMAGES.ALMUERZO_SEMANA;
  }
};

export const getCurrentServiceType = (): 'almuerzo' | 'comida' => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const timeInMinutes = currentHour * 60 + currentMinutes;
  
  const almuerzoInicio = timeToMinutes(restaurantConfig.hora_almuerzo_inicio);
  const comidaInicio = timeToMinutes(restaurantConfig.hora_comida_inicio);
  
  if (timeInMinutes >= comidaInicio) {
    return 'comida';
  }
  return 'almuerzo';
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}