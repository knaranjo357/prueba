// src/pages/Admin.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  Settings,
  LogOut,
  Menu as MenuIcon,
  ShoppingBag,
  MapPin,
  Users,
  BarChart3,
  AudioLines,
  ChefHat,
  Lock,
  UserCircle
} from 'lucide-react';

// Importación de componentes (asegúrate de que las rutas sean correctas)
import MenuTab from './AdminMenu';
import OrdersTab from './AdminOrders';
import DomiciliosTab from './AdminDomicilios';
import ClientesTab from './AdminClientes';
import VariablesTab from './AdminVariables';
import ResultadosTab from './AdminResultados';
import DictadoTab from './DictadoPage'; // Asumimos que este es el componente de Dictado

// --- TIPOS Y CONFIGURACIÓN ---

type UserRole = 'SUPER_ADMIN' | 'WPP_CFG' | 'MESA_MENU';

interface UserConfig {
  pass: string;
  name: string;
  role: UserRole;
}

// Base de datos de usuarios local
const USERS_DB: Record<string, UserConfig> = {
  'alfredo@luisres.com': { pass: 'luisres', name: 'Alfredo', role: 'SUPER_ADMIN' },
  'maria@luisres.com':   { pass: 'maria',   name: 'Maria',   role: 'WPP_CFG' },
  'ruby@luisres.com':    { pass: 'ruby',    name: 'Ruby',    role: 'MESA_MENU' },
  'tatiana@luisres.com': { pass: 'tatiana', name: 'Tatiana', role: 'MESA_MENU' },
  // Usuario extra por si acaso
  'admin@luisres.com':   { pass: 'admin',   name: 'Admin',   role: 'SUPER_ADMIN' }, 
};

type TabKey =
  | 'orders'      // PedidosWpp
  | 'dictado'     // PedidosMesa
  | 'menu'
  | 'domicilios'
  | 'clientes'
  | 'variables'   // Config
  | 'resultados';

interface TabDef {
  id: TabKey;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[]; // Roles que pueden ver este tab
}

// Configuración de las pestañas y sus permisos
const TABS_CONFIG: TabDef[] = [
  { 
    id: 'orders', 
    label: 'PedidosWpp', // RENOMBRADO
    icon: <ShoppingBag size={18} />, 
    roles: ['SUPER_ADMIN', 'WPP_CFG'] 
  },
  { 
    id: 'dictado', 
    label: 'PedidosMesa', // RENOMBRADO
    icon: <AudioLines size={18} />, 
    roles: ['SUPER_ADMIN', 'MESA_MENU','WPP_CFG'] 
  },
  { 
    id: 'menu', 
    label: 'Menú', 
    icon: <MenuIcon size={18} />, 
    roles: ['SUPER_ADMIN', 'MESA_MENU','WPP_CFG'] 
  },
  { 
    id: 'domicilios', 
    label: 'Zonas', 
    icon: <MapPin size={18} />, 
    roles: ['SUPER_ADMIN','WPP_CFG'] 
  },
  { 
    id: 'clientes', 
    label: 'Clientes', 
    icon: <Users size={18} />, 
    roles: ['SUPER_ADMIN'] 
  },
  { 
    id: 'variables', 
    label: 'Config', 
    icon: <Settings size={18} />, 
    roles: ['SUPER_ADMIN', 'WPP_CFG'] 
  },
  { 
    id: 'resultados', 
    label: 'Reportes', 
    icon: <BarChart3 size={18} />, 
    roles: ['SUPER_ADMIN'] 
  },
];

const Admin: React.FC = () => {
  const [user, setUser] = useState<UserConfig | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  
  // Estado de la pestaña activa
  const [activeTab, setActiveTab] = useState<TabKey>('orders');

  // Recuperar sesión al cargar
  useEffect(() => {
    const savedEmail = localStorage.getItem('admin_email');
    if (savedEmail && USERS_DB[savedEmail]) {
      const userData = USERS_DB[savedEmail];
      setUser(userData);
      // Establecer la pestaña inicial permitida
      const initialTab = TABS_CONFIG.find(t => t.roles.includes(userData.role));
      if (initialTab) setActiveTab(initialTab.id);
    }
  }, []);

  // Filtrar tabs según el usuario logueado
  const availableTabs = useMemo(() => {
    if (!user) return [];
    return TABS_CONFIG.filter(tab => tab.roles.includes(user.role));
  }, [user]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.toLowerCase().trim();
    const foundUser = USERS_DB[cleanEmail];

    if (foundUser && foundUser.pass === passInput) {
      setUser(foundUser);
      localStorage.setItem('admin_email', cleanEmail);
      
      // Redirigir a la primera pestaña válida para este usuario
      const firstValidTab = TABS_CONFIG.find(t => t.roles.includes(foundUser.role));
      if (firstValidTab) {
        setActiveTab(firstValidTab.id);
      }
    } else {
      alert('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('admin_email');
    setEmailInput('');
    setPassInput('');
  };

  // --- PANTALLA DE LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-orange-300/20 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/50 relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4 rotate-3">
              <ChefHat className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Luis Res Admin</h1>
            <p className="text-gray-500 text-sm mt-1">Sistema Unificado de Gestión</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Email</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                placeholder="usuario@luisres.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Contraseña</label>
              <div className="relative">
                <input
                  type="password"
                  value={passInput}
                  onChange={(e) => setPassInput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg"
            >
              Ingresar al Sistema
            </button>
          </form>
        </div>
        
        <p className="mt-6 text-xs text-gray-400 font-medium">© {new Date().getFullYear()} Alliasoft System</p>
      </div>
    );
  }

  // --- BOTÓN DE NAVEGACIÓN ---
  const TabButton: React.FC<{
    id: TabKey;
    active: TabKey;
    onClick: (id: TabKey) => void;
    label: string;
    icon: React.ReactNode;
  }> = ({ id, active, onClick, label, icon }) => {
    const isActive = active === id;
    return (
      <button
        onClick={() => onClick(id)}
        className={`
          relative px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-200 whitespace-nowrap select-none
          ${isActive 
            ? 'bg-gray-900 text-white shadow-md shadow-gray-900/20 scale-105' 
            : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-transparent hover:border-gray-200'}
        `}
      >
        {icon}
        {label}
      </button>
    );
  };

  // --- LAYOUT PRINCIPAL ---
  return (
    <div className="min-h-screen bg-gray-50/50 overflow-x-hidden flex flex-col">
      
      {/* Header de Navegación Sticky */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            
            {/* Logo / Título (Visible en Desktop) */}
            <div className="hidden md:flex items-center gap-2 shrink-0 mr-4">
               <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shadow-sm">
                 <ChefHat size={18} />
               </div>
               <div className="flex flex-col">
                 <span className="font-bold text-gray-800 tracking-tight leading-none">Luis Res</span>
                 <span className="text-[10px] text-gray-500 font-medium">Hola, {user.name}</span>
               </div>
            </div>

            {/* Barra de Tabs (Scroll Horizontal en Móvil) */}
            <div className="flex-1 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 py-1">
              <div className="flex items-center gap-2 w-max mx-auto md:mx-0">
                {availableTabs.map((tab) => (
                  <TabButton
                    key={tab.id}
                    id={tab.id}
                    active={activeTab}
                    onClick={setActiveTab}
                    label={tab.label}
                    icon={tab.icon}
                  />
                ))}
              </div>
            </div>

            {/* Perfil y Salir */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Icono de usuario en móvil que reemplaza al texto */}
                <div className="md:hidden w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                   <UserCircle size={20} />
                </div>
                
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut size={20} />
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 animate-in fade-in duration-500">
        <div className="min-h-[calc(100vh-8rem)]">
          {/* Renderizado condicional basado en pestaña activa y permisos */}
          {activeTab === 'orders' && availableTabs.some(t => t.id === 'orders') && <OrdersTab />}
          
          {/* AQUI PASAMOS EL NOMBRE DEL USUARIO LOGUEADO AL COMPONENTE DICTADO */}
          {activeTab === 'dictado' && availableTabs.some(t => t.id === 'dictado') && (
            <DictadoTab meseroName={user.name} /> 
          )}
          
          {activeTab === 'menu' && availableTabs.some(t => t.id === 'menu') && <MenuTab />}
          {activeTab === 'domicilios' && availableTabs.some(t => t.id === 'domicilios') && <DomiciliosTab />}
          {activeTab === 'clientes' && availableTabs.some(t => t.id === 'clientes') && <ClientesTab />}
          {activeTab === 'variables' && availableTabs.some(t => t.id === 'variables') && <VariablesTab />}
          {activeTab === 'resultados' && availableTabs.some(t => t.id === 'resultados') && <ResultadosTab />}
        </div>
      </main>
      
    </div>
  );
};

export default Admin;