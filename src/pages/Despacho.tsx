import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Phone, 
  User, 
  Store, 
  DollarSign, 
  CreditCard,
  CheckCircle,
  Clock,
  Truck,
  Package
} from 'lucide-react';
import { KitchenOrder } from '../types';
import { formatPrice } from '../utils/dateUtils';

// Datos simulados de pedidos listos para despacho
const mockOrders: KitchenOrder[] = [
  {
    id: '1',
    orderNumber: 101,
    customerName: 'María González',
    customerPhone: '300 123 4567',
    deliveryType: 'delivery',
    address: 'Calle 45 #23-67, Cabecera',
    items: [
      { id: '1', nombre: 'Carne fresca', quantity: 2, notes: 'Sin ensalada', categorias: ['almuerzo', 'carnes'] },
      { id: '2', nombre: 'Bolsa de Limonada de panela', quantity: 1, categorias: ['bebidas'] }
    ],
    totalPrice: 31000,
    orderTime: new Date(Date.now() - 25 * 60 * 1000),
    estimatedTime: 25,
    status: 'ready',
    paymentMethod: 'efectivo'
  },
  {
    id: '2',
    orderNumber: 102,
    customerName: 'Carlos Rodríguez',
    customerPhone: '301 987 6543',
    deliveryType: 'pickup',
    items: [
      { id: '4', nombre: 'Gallina', quantity: 1, notes: 'Pechuga', categorias: ['almuerzo', 'carnes'] },
      { id: '5', nombre: 'Mojarra frita', quantity: 1, categorias: ['almuerzo', 'pescados'] }
    ],
    totalPrice: 34000,
    orderTime: new Date(Date.now() - 20 * 60 * 1000),
    estimatedTime: 20,
    status: 'ready',
    paymentMethod: 'transferencia'
  },
  {
    id: '3',
    orderNumber: 103,
    customerName: 'Ana Martínez',
    customerPhone: '302 456 7890',
    deliveryType: 'delivery',
    address: 'Carrera 27 #15-34, Centro',
    items: [
      { id: '6', nombre: 'Pechuga de pollo', quantity: 1, categorias: ['almuerzo', 'carnes'] },
      { id: '7', nombre: 'Lomo de cerdo', quantity: 1, categorias: ['almuerzo', 'carnes'] }
    ],
    totalPrice: 28000,
    orderTime: new Date(Date.now() - 30 * 60 * 1000),
    estimatedTime: 30,
    status: 'ready',
    paymentMethod: 'efectivo'
  }
];

const Despacho: React.FC = () => {
  const [orders, setOrders] = useState<KitchenOrder[]>(mockOrders);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  const readyOrders = useMemo(() => {
    return orders.filter(order => order.status === 'ready')
                 .sort((a, b) => a.orderTime.getTime() - b.orderTime.getTime());
  }, [orders]);

  const deliveredOrders = useMemo(() => {
    return orders.filter(order => order.status === 'delivered')
                 .sort((a, b) => b.orderTime.getTime() - a.orderTime.getTime());
  }, [orders]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const markAsDelivered = () => {
    setOrders(prev => 
      prev.map(order => 
        selectedOrders.includes(order.id) 
          ? { ...order, status: 'delivered' }
          : order
      )
    );
    setSelectedOrders([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getElapsedTime = (orderTime: Date) => {
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - orderTime.getTime()) / (1000 * 60));
    return elapsed;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Truck className="text-blue-600" size={32} />
                Despacho
              </h1>
              <p className="text-gray-600 mt-1">
                {readyOrders.length} pedidos listos para entregar
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {formatTime(new Date())}
              </div>
              <div className="text-sm text-gray-600">
                {selectedOrders.length} seleccionados
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pedidos Listos */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Pedidos Listos</h2>
            
            <div className="space-y-4">
              <AnimatePresence>
                {readyOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`bg-white rounded-xl shadow-lg border-2 transition-all cursor-pointer ${
                      selectedOrders.includes(order.id) 
                        ? 'border-blue-400 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleOrderSelection(order.id)}
                  >
                    <div className="p-6">
                      {/* Header del pedido */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                            #{order.orderNumber}
                          </div>
                          <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium border border-green-200">
                            <div className="flex items-center gap-1">
                              <CheckCircle size={16} />
                              Listo
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            Hace {getElapsedTime(order.orderTime)} min
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatTime(order.orderTime)}
                          </div>
                        </div>
                      </div>

                      {/* Información del cliente */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-500" />
                          <span className="font-medium">{order.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone size={16} className="text-gray-500" />
                          <span className="text-sm">{order.customerPhone}</span>
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                          {order.deliveryType === 'delivery' ? (
                            <>
                              <MapPin size={16} className="text-gray-500" />
                              <span className="text-sm">{order.address}</span>
                            </>
                          ) : (
                            <>
                              <Store size={16} className="text-gray-500" />
                              <span className="text-sm">Recoger en local</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Items del pedido */}
                      <div className="space-y-2 mb-4">
                        <h4 className="font-medium text-gray-900">Productos:</h4>
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                            <div>
                              <span className="font-medium">{item.quantity}x {item.nombre}</span>
                              {item.notes && (
                                <div className="text-sm text-blue-600 font-medium">
                                  Nota: {item.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Total y método de pago */}
                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            {order.paymentMethod === 'efectivo' ? (
                              <DollarSign size={16} className="text-gray-500" />
                            ) : (
                              <CreditCard size={16} className="text-gray-500" />
                            )}
                            <span className="text-sm">
                              {order.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                            </span>
                          </div>
                          <span className="font-bold text-lg text-blue-600">
                            {formatPrice(order.totalPrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Panel de acciones */}
          <div className="space-y-6">
            {selectedOrders.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Acciones ({selectedOrders.length} pedidos)
                </h3>
                
                <button
                  onClick={markAsDelivered}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Package size={20} />
                  Marcar como Entregado
                </button>
              </div>
            )}

            {/* Pedidos entregados recientes */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Entregados Hoy
              </h3>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {deliveredOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-sm">#{order.orderNumber}</span>
                      <div className="text-xs text-gray-600">{order.customerName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-600">
                        {formatPrice(order.totalPrice)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTime(order.orderTime)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedOrders.length === 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 text-center">
                <Truck size={48} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Selecciona Pedidos
                </h3>
                <p className="text-gray-600 text-sm">
                  Haz clic en los pedidos listos para marcarlos como entregados.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Despacho;