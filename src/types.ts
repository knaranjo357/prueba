export type MenuItem = {
  id: number | string;
  nombre: string;
  valor: number;
  categorias: string[];
  disponible: boolean;
  descripcion?: string;
  url_imagen?: string;
  isForTakeaway?: boolean;
  precio_adicional_llevar?: number;
};

export interface City {
   name: string;
   neighborhoods: {
     name: string;
     price: number;
   }[];
}

export type CartItem = MenuItem & {
  quantity: number;
  notes?: string;
  isForTakeaway?: boolean;
};

export interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  city: string;
  paymentMethod: string;
  deliveryType: 'delivery' | 'pickup';
  neighborhood?: string;
}

// Kitchen Order Types
export interface OrderItem {
  id: string;
  nombre: string;
  quantity: number;
  notes?: string;
  categorias: string[];
}

export interface KitchenOrder {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address?: string;
  items: OrderItem[];
  totalPrice: number;
  orderTime: Date;
  estimatedTime: number; // minutes
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  paymentMethod: 'efectivo' | 'transferencia';
  notes?: string;
}