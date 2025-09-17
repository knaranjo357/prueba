import React, { useEffect, useState } from 'react';
import { Settings, LogOut, Menu as MenuIcon, ShoppingBag, MapPin, Users } from 'lucide-react';
import MenuTab from './AdminMenu';
import OrdersTab from './AdminOrders';
import DomiciliosTab from './AdminDomicilios';
import ClientesTab from './AdminClientes';

type TabKey = 'menu' | 'orders' | 'domicilios' | 'clientes';

const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('menu');

  useEffect(() => {
    const saved = localStorage.getItem('admin_auth');
    if (saved === '1') setIsAuthenticated(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'alfredo@luisres.com' && password === 'luisres') {
      setIsAuthenticated(true);
      localStorage.setItem('admin_auth', '1');
    } else {
      alert('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('admin_auth');
    setEmail('');
    setPassword('');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-100">


          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/40 focus:border-gold/40"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/40 focus:border-gold/40"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gold hover:bg-gold/90 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-sm"
            >
              Iniciar Sesión
            </button>
          </form>
        </div>
      </div>
    );
  }

  const TabButton: React.FC<{
    id: TabKey;
    active: TabKey;
    onClick: (id: TabKey) => void;
    label: string;
    icon: React.ReactNode;
  }> = ({ id, active, onClick, label, icon }) => (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
        active === id
          ? 'bg-white text-gold shadow-sm border border-gray-200'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <Settings className="text-gold" size={32} />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 truncate">Panel de Administración</h1>
                <p className="text-gray-600">Luis Res</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1 border border-gray-200">
                <TabButton id="menu" active={activeTab} onClick={setActiveTab} label="Menú" icon={<MenuIcon size={16} />} />
                <TabButton id="orders" active={activeTab} onClick={setActiveTab} label="Pedidos" icon={<ShoppingBag size={16} />} />
                <TabButton id="domicilios" active={activeTab} onClick={setActiveTab} label="Domicilios" icon={<MapPin size={16} />} />
                <TabButton id="clientes" active={activeTab} onClick={setActiveTab} label="Clientes" icon={<Users size={16} />} />
              </div>

              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                title="Cerrar sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'menu' && <MenuTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'domicilios' && <DomiciliosTab />}
        {activeTab === 'clientes' && <ClientesTab />}
      </div>
    </div>
  );
};

export default Admin;
