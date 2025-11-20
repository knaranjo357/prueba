// src/pages/Admin.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  UserCircle,
  MoreHorizontal, // Icono para el botón "Más"
  X
} from 'lucide-react';

// Importación de componentes
import MenuTab from './AdminMenu';
import OrdersTab from './AdminOrders';
import DomiciliosTab from './AdminDomicilios';
import ClientesTab from './AdminClientes';
import VariablesTab from './AdminVariables';
import ResultadosTab from './AdminResultados';
import DictadoTab from './DictadoPage';

// --- TIPOS Y CONFIGURACIÓN ---

type UserRole = 'SUPER_ADMIN' | 'WPP_CFG' | 'MESA_MENU';

interface UserConfig {
  pass: string;
  name: string;
  role: UserRole;
}

const USERS_DB: Record<string, UserConfig> = {
  'alfredo@luisres.com': { pass: 'luisres', name: 'Alfredo', role: 'SUPER_ADMIN' },
  'maria@luisres.com':   { pass: 'maria',   name: 'Maria',   role: 'WPP_CFG' },
  'ruby@luisres.com':    { pass: 'ruby',    name: 'Ruby',    role: 'MESA_MENU' },
  'tatiana@luisres.com': { pass: 'tatiana', name: 'Tatiana', role: 'MESA_MENU' },
  'admin@luisres.com':   { pass: 'admin',   name: 'Admin',   role: 'SUPER_ADMIN' }, 
};

type TabKey =
  | 'orders'
  | 'dictado'
  | 'menu'
  | 'domicilios'
  | 'clientes'
  | 'variables'
  | 'resultados';

interface TabDef {
  id: TabKey;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const TABS_CONFIG: TabDef[] = [
  { 
    id: 'orders', 
    label: 'Pedidos', // Texto corto para mobile
    icon: <ShoppingBag size={24} />, 
    roles: ['SUPER_ADMIN', 'WPP_CFG'] 
  },
  { 
    id: 'dictado', 
    label: 'Mesa', 
    icon: <AudioLines size={24} />, 
    roles: ['SUPER_ADMIN', 'MESA_MENU','WPP_CFG'] 
  },
  { 
    id: 'menu', 
    label: 'Menú', 
    icon: <MenuIcon size={24} />, 
    roles: ['SUPER_ADMIN', 'MESA_MENU','WPP_CFG'] 
  },
  // --- GRUPO SECUNDARIO (Irán al menú "Más" en mobile) ---
  { 
    id: 'domicilios', 
    label: 'Zonas', 
    icon: <MapPin size={24} />, 
    roles: ['SUPER_ADMIN','WPP_CFG'] 
  },
  { 
    id: 'clientes', 
    label: 'Clientes', 
    icon: <Users size={24} />, 
    roles: ['SUPER_ADMIN'] 
  },
  { 
    id: 'variables', 
    label: 'Config', 
    icon: <Settings size={24} />, 
    roles: ['SUPER_ADMIN', 'WPP_CFG'] 
  },
  { 
    id: 'resultados', 
    label: 'Reportes', 
    icon: <BarChart3 size={24} />, 
    roles: ['SUPER_ADMIN'] 
  },
];

// IDs que queremos mostrar siempre en la barra inferior (Prioridad)
const MAIN_TABS_IDS = ['orders', 'dictado', 'menu'];

const Admin: React.FC = () => {
  const [user, setUser] = useState<UserConfig | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('orders');
  
  // Estado para el menú desplegable en mobile
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  // Referencia para cerrar menú al hacer click fuera (opcional)
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('admin_email');
    if (savedEmail && USERS_DB[savedEmail]) {
      const userData = USERS_DB[savedEmail];
      setUser(userData);
      const initialTab = TABS_CONFIG.find(t => t.roles.includes(userData.role));
      if (initialTab) setActiveTab(initialTab.id);
    }
  }, []);

  // Separar tabs disponibles entre Principales y Secundarias
  const { mainTabs, secondaryTabs, allAvailable } = useMemo(() => {
    if (!user) return { mainTabs: [], secondaryTabs: [], allAvailable: [] };
    
    const available = TABS_CONFIG.filter(tab => tab.roles.includes(user.role));
    
    const main = available.filter(t => MAIN_TABS_IDS.includes(t.id));
    const secondary = available.filter(t => !MAIN_TABS_IDS.includes(t.id));
    
    return { mainTabs: main, secondaryTabs: secondary, allAvailable: available };
  }, [user]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.toLowerCase().trim();
    const foundUser = USERS_DB[cleanEmail];

    if (foundUser && foundUser.pass === passInput) {
      setUser(foundUser);
      localStorage.setItem('admin_email', cleanEmail);
      const firstValidTab = TABS_CONFIG.find(t => t.roles.includes(foundUser.role));
      if (firstValidTab) setActiveTab(firstValidTab.id);
    } else {
      alert('Credenciales incorrectas');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('admin_email');
    setEmailInput('');
    setPassInput('');
    setShowMobileMenu(false);
  };

  const handleTabChange = (id: TabKey) => {
    setActiveTab(id);
    setShowMobileMenu(false); // Cerrar menú al seleccionar
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- LOGIN VIEW ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
         {/* (Mismo código de login que tenías...) */}
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
              <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all" placeholder="usuario@luisres.com" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Contraseña</label>
              <div className="relative">
                <input type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all" placeholder="••••••••" required />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
              </div>
            </div>
            <button type="submit" className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-xl transition-all transform hover:scale-[1.02] shadow-lg">Ingresar al Sistema</button>
          </form>
        </div>
        <p className="mt-6 text-xs text-gray-400 font-medium">© {new Date().getFullYear()} Alliasoft System</p>
      </div>
    );
  }

  // --- COMPONENTE DE PESTAÑA (BOTÓN) PARA DESKTOP ---
  const DesktopTabButton = ({ tab, isActive }: { tab: TabDef, isActive: boolean }) => (
    <button
      onClick={() => handleTabChange(tab.id)}
      className={`
        relative px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-200 whitespace-nowrap select-none
        ${isActive 
          ? 'bg-gray-900 text-white shadow-md shadow-gray-900/20' 
          : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 border border-transparent hover:border-gray-200'}
      `}
    >
      {React.cloneElement(tab.icon as React.ReactElement, { size: 18 })}
      {tab.label}
    </button>
  );

  // --- COMPONENTE DE PESTAÑA ESTILO INSTAGRAM (MOBILE) ---
  const MobileTabItem = ({ tab, isActive, onClick }: { tab: TabDef, isActive: boolean, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center py-2 active:scale-95 transition-transform"
    >
      <div className={`transition-colors duration-200 ${isActive ? 'text-black' : 'text-gray-400'}`}>
        {/* Instagram usa stroke-width más grueso para activo */}
        {React.cloneElement(tab.icon as React.ReactElement, { 
          size: 26, 
          strokeWidth: isActive ? 2.5 : 1.5,
          fill: isActive ? 'currentColor' : 'none', // Opcional: relleno sólido estilo IG moderno
          className: isActive ? 'text-gray-900' : 'text-gray-400'
        })}
      </div>
      {/* Etiqueta pequeña opcional, IG no la usa siempre pero ayuda en Admin */}
      {/* <span className={`text-[10px] mt-1 font-medium ${isActive ? 'text-black' : 'text-gray-400'}`}>
        {tab.label}
      </span> */}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 overflow-x-hidden flex flex-col pb-20 md:pb-0">
      
      {/* --- HEADER DESKTOP (Oculto en Mobile) --- */}
      <header className="hidden md:block sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0 mr-4">
             <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white shadow-sm">
               <ChefHat size={18} />
             </div>
             <div className="flex flex-col">
               <span className="font-bold text-gray-800 tracking-tight leading-none">Luis Res</span>
               <span className="text-[10px] text-gray-500 font-medium">Hola, {user.name}</span>
             </div>
          </div>
          <div className="flex items-center gap-2">
            {allAvailable.map((tab) => (
              <DesktopTabButton key={tab.id} tab={tab} isActive={activeTab === tab.id} />
            ))}
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* --- HEADER MOBILE (Solo info usuario, sin tabs) --- */}
      <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center sticky top-0 z-30">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-white">
              <ChefHat size={18} />
            </div>
            <span className="font-bold text-gray-800">Luis Res</span>
         </div>
         <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-medium">{user.name}</span>
            <button onClick={handleLogout} className="text-gray-400">
              <LogOut size={20} />
            </button>
         </div>
      </header>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 animate-in fade-in duration-500">
        {activeTab === 'orders' && allAvailable.some(t => t.id === 'orders') && <OrdersTab />}
        {activeTab === 'dictado' && allAvailable.some(t => t.id === 'dictado') && <DictadoTab meseroName={user.name} />}
        {activeTab === 'menu' && allAvailable.some(t => t.id === 'menu') && <MenuTab />}
        {activeTab === 'domicilios' && allAvailable.some(t => t.id === 'domicilios') && <DomiciliosTab />}
        {activeTab === 'clientes' && allAvailable.some(t => t.id === 'clientes') && <ClientesTab />}
        {activeTab === 'variables' && allAvailable.some(t => t.id === 'variables') && <VariablesTab />}
        {activeTab === 'resultados' && allAvailable.some(t => t.id === 'resultados') && <ResultadosTab />}
      </main>

      {/* --- MOBILE BOTTOM NAVIGATION (Estilo Instagram) --- */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-1 px-2 z-50 flex justify-around items-center h-[60px]">
        
        {/* Renderizar Tabs Principales */}
        {mainTabs.map((tab) => (
          <MobileTabItem 
            key={tab.id} 
            tab={tab} 
            isActive={activeTab === tab.id} 
            onClick={() => handleTabChange(tab.id)} 
          />
        ))}

        {/* Renderizar Botón "Más" si hay tabs secundarios */}
        {secondaryTabs.length > 0 && (
          <div className="relative flex-1 flex justify-center" ref={menuRef}>
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="flex flex-col items-center justify-center py-2 active:scale-95 transition-transform"
            >
               {/* Si la tab activa está dentro de las secundarias, iluminar el botón Menú */}
               <div className={`transition-colors duration-200 ${secondaryTabs.some(t => t.id === activeTab) ? 'text-black' : 'text-gray-400'}`}>
                 {showMobileMenu ? <X size={28} strokeWidth={2} /> : <MoreHorizontal size={28} strokeWidth={2} />}
               </div>
               {/* Indicador de punto si hay algo activo dentro */}
               {secondaryTabs.some(t => t.id === activeTab) && !showMobileMenu && (
                  <div className="absolute bottom-2 w-1 h-1 bg-red-500 rounded-full"></div>
               )}
            </button>

            {/* --- MENU FLOTANTE DE OPCIONES SECUNDARIAS --- */}
            {showMobileMenu && (
              <div className="absolute bottom-[70px] right-0 w-48 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
                <div className="py-2">
                  {secondaryTabs.map((tab) => {
                     const isActive = activeTab === tab.id;
                     return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${isActive ? 'bg-amber-50 text-amber-600 font-semibold' : 'text-gray-600'}`}
                      >
                        {React.cloneElement(tab.icon as React.ReactElement, { size: 20, strokeWidth: isActive ? 2.5 : 2 })}
                        <span className="text-sm">{tab.label}</span>
                      </button>
                     );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </nav>
      
    </div>
  );
};

export default Admin;