import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  User, 
  CheckCircle,
  AlertCircle,
  Utensils,
  Beef,
  Play,
  Package,
  Truck
} from 'lucide-react';
import { KitchenOrder, OrderItem } from '../types';

// Datos simulados de pedidos
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
    totalPrice: 45000,
    orderTime: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
    estimatedTime: 25,
    status: 'pending',
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
    totalPrice: 28000,
    orderTime: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    estimatedTime: 20,
    status: 'pending',
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
      { id: '7', nombre: 'Lomo de cerdo', quantity: 1, categorias: ['almuerzo', 'carnes'] },
      { id: '8', nombre: 'Bolsa de Limonada de panela', quantity: 2, categorias: ['bebidas'] }
    ],
    totalPrice: 32000,
    orderTime: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
    estimatedTime: 30,
    status: 'preparing',
    paymentMethod: 'efectivo'
  }
];

const Kitchen: React.FC = () => {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [orders, setOrders] = useState<KitchenOrder[]>(mockOrders);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => a.orderTime.getTime() - b.orderTime.getTime());
  }, [orders]);

  const selectedOrdersData = useMemo(() => {
    return orders.filter(order => selectedOrders.includes(order.id));
  }, [orders, selectedOrders]);

  const meatSummary = useMemo(() => {
    const meats: { [key: string]: { quantity: number; notes: string[] } } = {};
    
    selectedOrdersData.forEach(order => {
      order.items.forEach(item => {
        if (item.categorias.includes('carnes')) {
          if (!meats[item.nombre]) {
            meats[item.nombre] = { quantity: 0, notes: [] };
          }
          meats[item.nombre].quantity += item.quantity;
          if (item.notes) {
            meats[item.nombre].notes.push(item.notes);
          }
        }
      });
    });
    
    return meats;
  }, [selectedOrdersData]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const updateOrderStatus = (newStatus: 'pending' | 'preparing' | 'ready' | 'delivered') => {
    setOrders(prev => 
      prev.map(order => 
        selectedOrders.includes(order.id) 
          ? { ...order, status: newStatus }
          : order
      )
    );
    setSelectedOrders([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'preparing': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ready': return 'bg-green-100 text-green-800 border-green-300';
      case 'delivered': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle size={14} />;
      case 'preparing': return <Clock size={14} />;
      case 'ready': return <CheckCircle size={14} />;
      case 'delivered': return <CheckCircle size={14} />;
      default: return <Clock size={14} />;
    }
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
    <div className="min-h-screen bg-gray-50 p-3">
      <div className="max-w-7xl mx-auto">
        {/* Header compacto */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Utensils className="text-orange-600" size={24} />
                Cocina
              </h1>
              <p className="text-gray-600 text-sm">
                {orders.filter(o => o.status === 'pending').length} pendientes
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">
                {formatTime(new Date())}
              </div>
              <div className="text-xs text-gray-600">
                {selectedOrders.length} seleccionados
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Orders List - más compacto */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <AnimatePresence>
                {sortedOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer text-xs ${
                      selectedOrders.includes(order.id) 
                        ? 'border-orange-400 ring-1 ring-orange-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleOrderSelection(order.id)}
                  >
                    <div className="p-3">
                      {/* Header compacto */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold">
                          #{order.orderNumber}
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(order.status)}`}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(order.status)}
                            {order.status === 'pending' ? 'Pendiente' : 
                             order.status === 'preparing' ? 'Preparando' :
                             order.status === 'ready' ? 'Listo' : 'Entregado'}
                          </div>
                        </div>
                      </div>

                      {/* Customer Info compacto */}
                      <div className="mb-2">
                        <div className="flex items-center gap-1 mb-1">
                          <User size={12} className="text-gray-500" />
                          <span className="font-medium text-xs">{order.customerName}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Hace {getElapsedTime(order.orderTime)} min - {formatTime(order.orderTime)}
                        </div>
                      </div>

                      {/* Order Items compacto */}
                      <div className="space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="bg-gray-50 rounded p-2">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <span className="font-medium text-xs">{item.quantity}x {item.nombre}</span>
                                {item.notes && (
                                  <div className="text-xs text-orange-600 font-medium">
                                    {item.notes}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 ml-2">
                                {item.categorias.includes('carnes') && (
                                  <span className="bg-red-100 text-red-800 px-1 py-0.5 rounded text-xs">
                                    Carne
                                  </span>
                                )}
                                {item.categorias.includes('pescados') && (
                                  <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded text-xs">
                                    Pescado
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Summary Panel compacto */}
          <div className="space-y-4">
            {selectedOrders.length > 0 && (
              <>
                {/* Resumen para parrillero */}
                {Object.keys(meatSummary).length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-1">
                      <Beef className="text-red-600" size={16} />
                      Para Parrillero
                    </h3>
                    
                    <div className="space-y-2">
                      {Object.entries(meatSummary).map(([meat, data]) => (
                        <div key={meat} className="bg-white rounded p-2 border border-red-200">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-red-800 text-xs">{meat}</span>
                            <span className="bg-red-600 text-white px-2 py-0.5 rounded text-xs font-bold">
                              {data.quantity}x
                            </span>
                          </div>
                          {data.notes.length > 0 && (
                            <div className="text-xs text-red-700">
                              <strong>Notas:</strong> {[...new Set(data.notes)].join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons compactos */}
                <div className="space-y-2">
                  <button 
                    onClick={() => updateOrderStatus('preparing')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Play size={14} />
                    Preparando
                  </button>
                  <button 
                    onClick={() => updateOrderStatus('ready')}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Package size={14} />
                    Listo
                  </button>
                </div>
              </>
            )}

            {selectedOrders.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4 text-center">
                <Utensils size={32} className="text-gray-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  Selecciona Pedidos
                </h3>
                <p className="text-gray-600 text-xs">
                  Haz clic en los pedidos para preparar
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kitchen;