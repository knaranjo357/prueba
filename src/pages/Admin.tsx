import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Users, 
  Clock, 
  DollarSign,
  CheckCircle,
  AlertCircle,
  Printer,
  Filter,
  RefreshCw,
  Edit3,
  Save,
  X,
  LogOut,
  Menu as MenuIcon,
  ShoppingBag
} from 'lucide-react';
import { fetchMenuItems } from '../api/menuApi';
import { MenuItem } from '../types';
import { formatPrice } from '../utils/dateUtils';

interface Order {
  row_number: number;
  fecha: string;
  nombre?: string;
  numero: string;
  direccion: string;
  "detalle pedido": string;
  valor_restaurante: number;
  valor_domicilio: number;
  metodo_pago: string;
  estado: string;
}

const ORDERS_API = '/api-proxy/webhook/luis-res/pedidos';

const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [filterPayment, setFilterPayment] = useState<string>('todos');

  // Auto refresh orders every 20 seconds
  useEffect(() => {
    if (isAuthenticated && activeTab === 'orders') {
      const interval = setInterval(fetchOrders, 20000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, activeTab]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'alfredo@luisres.com' && password === 'luisres') {
      setIsAuthenticated(true);
      loadMenuItems();
      fetchOrders();
    } else {
      alert('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
  };

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const items = await fetchMenuItems();
      setMenuItems(items.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
    } catch (error) {
      console.error('Error loading menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(ORDERS_API);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const sortedOrders = data.sort((a, b) => {
          const dateA = new Date(a.fecha);
          const dateB = new Date(b.fecha);
          return dateB.getTime() - dateA.getTime();
        });
        setOrders(sortedOrders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const updateMenuItemAvailability = async (itemId: string, disponible: boolean) => {
    try {
      // Aquí harías el POST a tu API para actualizar disponibilidad
      // Por ahora solo actualizamos localmente
      setMenuItems(prev => 
        prev.map(item => 
          item.id === itemId ? { ...item, disponible } : item
        )
      );
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const updateOrderStatus = async (orderNumber: number, newStatus: string) => {
    try {
      const response = await fetch(ORDERS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          row_number: orderNumber,
          estado: newStatus
        })
      });

      if (response.ok) {
        setOrders(prev => 
          prev.map(order => 
            order.row_number === orderNumber ? { ...order, estado: newStatus } : order
          )
        );
        setEditingOrder(null);
      }
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const printOrder = async (order: Order) => {
    // Generar contenido de factura térmica para POS80C
    const customerName = order.nombre || 'Cliente';
    const customerPhone = order.numero.replace('@s.whatsapp.net', '');
    
    // Parsear detalle del pedido
    const orderItems = order["detalle pedido"].split(';').filter(item => item.trim()).map(item => {
      const parts = item.trim().split(',');
      if (parts.length >= 3) {
        const quantity = parts[0].replace('-', '').trim();
        const name = parts[1].trim();
        const price = parts[2].trim();
        return `${quantity} ${name} - $${parseInt(price).toLocaleString()}`;
      }
      return item.trim();
    });
    
    const total = order.valor_restaurante + order.valor_domicilio;
    
    const receiptContent = `
================================
        LUIS RES
    Cra 37 #109-24
  Floridablanca - Caldas
================================

PEDIDO #${order.row_number}
Fecha: ${order.fecha}
Cliente: ${customerName}
Teléfono: ${customerPhone}
Dirección: ${order.direccion}

--------------------------------
DETALLE DEL PEDIDO:
${orderItems.join('\n')}

--------------------------------
Subtotal: $${order.valor_restaurante.toLocaleString()}
Domicilio: $${order.valor_domicilio.toLocaleString()}
TOTAL: $${total.toLocaleString()}

Método de pago: ${order.metodo_pago}
Estado: ${order.estado}

================================
    ¡Gracias por su compra!
================================
    `;

    // Crear ventana de impresión optimizada para POS80C
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Factura #${order.row_number}</title>
            <style>
              @media print {
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
              }
              body { 
                font-family: 'Courier New', monospace; 
                font-size: 11px; 
                width: 58mm; 
                margin: 0; 
                padding: 2mm;
                line-height: 1.2;
              }
              pre { 
                white-space: pre-wrap; 
                margin: 0; 
                font-size: 11px;
              }
            </style>
          </head>
          <body>
            <pre>${receiptContent}</pre>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 1000);
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      
      // Cambiar estado a impreso después de imprimir
      updateOrderStatus(order.row_number, 'impreso');
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const statusMatch = filterStatus === 'todos' || order.estado === filterStatus;
      const paymentMatch = filterPayment === 'todos' || order.metodo_pago.includes(filterPayment);
      return statusMatch && paymentMatch;
    });
  }, [orders, filterStatus, filterPayment]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-800';
      case 'preparando': return 'bg-blue-100 text-blue-800';
      case 'listo': return 'bg-green-100 text-green-800';
      case 'en camino': return 'bg-purple-100 text-purple-800';
      case 'entregado': return 'bg-gray-100 text-gray-800';
      case 'impreso': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentColor = (payment: string) => {
    if (payment.includes('confirmada')) return 'bg-green-100 text-green-800';
    if (payment.includes('espera')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <Settings size={48} className="text-gold mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
            <p className="text-gray-600">Luis Res</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold/50"
                placeholder="alfredo@luisres.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold/50"
                placeholder="••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-gold hover:bg-gold/90 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Settings className="text-gold" size={32} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Administración</h1>
                <p className="text-gray-600">Luis Res</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('menu')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'menu' 
                      ? 'bg-white text-gold shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <MenuIcon size={16} className="inline mr-2" />
                  Menú
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    activeTab === 'orders' 
                      ? 'bg-white text-gold shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <ShoppingBag size={16} className="inline mr-2" />
                  Pedidos
                </button>
              </div>
              
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 p-2"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'menu' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Gestión de Menú</h2>
              <button
                onClick={loadMenuItems}
                className="bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
              >
                <RefreshCw size={16} />
                Actualizar
              </button>
            </div>

            <div className="grid gap-4">
              {menuItems.map((item) => (
                <div key={item.id} className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{item.nombre}</h3>
                      <p className="text-sm text-gray-600 mb-2">{item.descripcion}</p>
                      <div className="flex items-center gap-2 mb-2">
                        {item.categorias?.map((categoria) => (
                          <span
                            key={categoria}
                            className="bg-gold/20 text-gold px-2 py-1 rounded-full text-xs font-medium"
                          >
                            {categoria}
                          </span>
                        ))}
                      </div>
                      <p className="font-bold text-gold">{formatPrice(item.valor)}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        item.disponible 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {item.disponible ? 'Disponible' : 'Agotado'}
                      </div>
                      
                      {editingItem === item.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateMenuItemAvailability(item.id, !item.disponible)}
                            className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingItem(null)}
                            className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-lg"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingItem(item.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Gestión de Pedidos</h2>
              <div className="flex items-center gap-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="preparando">Preparando</option>
                  <option value="listo">Listo</option>
                  <option value="en camino">En camino</option>
                  <option value="entregado">Entregado</option>
                </select>
                
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="todos">Todos los pagos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="espera">Transferencia en espera</option>
                  <option value="confirmada">Transferencia confirmada</option>
                </select>
                
                <button
                  onClick={fetchOrders}
                  className="bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  Actualizar
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {filteredOrders.map((order) => (
                <div key={order.row_number} className="bg-white rounded-lg shadow-sm border p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900">Pedido #{order.row_number}</h3>
                      <p className="text-sm text-gray-600">{order.fecha}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.estado)}`}>
                        {order.estado}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPaymentColor(order.metodo_pago)}`}>
                        {order.metodo_pago}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="font-medium text-gray-900">{order.nombre}</p>
                      <p className="text-sm text-gray-600">{order.numero}</p>
                      <p className="text-sm text-gray-600">{order.direccion}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Detalle del pedido:</p>
                      <div className="bg-gray-50 p-3 rounded-lg text-sm">
                        {(order["detalle pedido"] || '').split(';').filter(item => item.trim()).map((item, index) => {
                          const cleanItem = item.trim();
                          if (cleanItem.startsWith('- ')) {
                            const parts = cleanItem.substring(2).split(',');
                            if (parts.length >= 3) {
                              const quantity = parts[0].trim();
                              const name = parts[1].trim();
                              const price = parseInt(parts[2].trim());
                              return (
                                <div key={index} className="flex justify-between items-center py-1">
                                  <span>{quantity} x {name}</span>
                                  <span className="font-medium">${price.toLocaleString()}</span>
                                </div>
                              );
                            }
                          }
                          return <div key={index}>{cleanItem}</div>;
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-gray-900">
                        Total: ${order.valor_restaurante.toLocaleString()}
                      </span>
                      {order.valor_domicilio > 0 && (
                        <span className="text-sm text-gray-600">
                          + Domicilio: ${order.valor_domicilio.toLocaleString()}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printOrder(order)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-2"
                      >
                        <Printer size={16} />
                        Imprimir
                      </button>
                      
                      <select
                        value={order.estado}
                        onChange={(e) => updateOrderStatus(order.row_number, e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="preparando">Preparando</option>
                        <option value="listo">Listo</option>
                        <option value="en camino">En camino</option>
                        <option value="entregado">Entregado</option>
                        <option value="impreso">Impreso</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;