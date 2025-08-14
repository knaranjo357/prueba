@@ .. @@
 export interface City {
   name: string;
   neighborhoods: {
     name: string;
     price: number;
   }[];
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