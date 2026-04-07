// src/pages/Admin.tsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  MoreHorizontal,
  X,
} from 'lucide-react';

// Importación de componentes
import MenuTab from './AdminMenu';
import OrdersTab from './AdminOrders';
import DomiciliosTab from './AdminDomicilios';
import ClientesTab from './AdminClientes';
import VariablesTab from './AdminVariables';
import ResultadosTab from './AdminResultados';
import Manual from './Manual';

// --- TIPOS Y CONFIGURACIÓN ---

type UserRole = 'SUPER_ADMIN' | 'WPP_CFG' | 'MESA_MENU';

interface UserConfig {
  pass: string;
  name: string;
  role: UserRole;
}

const USERS_DB: Record<string, UserConfig> = {
  'alfredo@luisres.com': { pass: 'luisres', name: 'Alfredo', role: 'SUPER_ADMIN' },
  'maria@luisres.com': { pass: 'maria', name: 'Maria', role: 'WPP_CFG' },
  'ruby@luisres.com': { pass: 'ruby', name: 'Ruby', role: 'MESA_MENU' },
  'tatiana@luisres.com': { pass: 'tatiana', name: 'Tatiana', role: 'MESA_MENU' },
  'admin@luisres.com': { pass: 'admin', name: 'Admin', role: 'SUPER_ADMIN' },
};

type TabKey =
  | 'orders'
  | 'dictado'
  | 'menu'
  | 'domicilios'
  | 'clientes'
  | 'variables'
  | 'resultados';

// Mapeo tab → segmento URL
const TAB_TO_PATH: Record<TabKey, string> = {
  orders: 'pedidos',
  dictado: 'manual',
  menu: 'menu',
  domicilios: 'zonas',
  clientes: 'clientes',
  variables: 'config',
  resultados: 'reportes',
};

// Mapeo segmento URL → tab
const PATH_TO_TAB: Record<string, TabKey> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([k, v]) => [v, k as TabKey])
);

interface TabDef {
  id: TabKey;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const TABS_CONFIG: TabDef[] = [
  {
    id: 'orders',
    label: 'Pedidos',
    icon: <ShoppingBag size={22} />,
    roles: ['SUPER_ADMIN', 'WPP_CFG', 'MESA_MENU'],
  },
  {
    id: 'dictado',
    label: 'Manual',
    icon: <AudioLines size={22} />,
    roles: ['SUPER_ADMIN', 'MESA_MENU', 'WPP_CFG'],
  },
  {
    id: 'menu',
    label: 'Menú',
    icon: <MenuIcon size={22} />,
    roles: ['SUPER_ADMIN', 'MESA_MENU', 'WPP_CFG'],
  },
  {
    id: 'domicilios',
    label: 'Zonas',
    icon: <MapPin size={22} />,
    roles: ['SUPER_ADMIN', 'WPP_CFG'],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    icon: <Users size={22} />,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'variables',
    label: 'Config',
    icon: <Settings size={22} />,
    roles: ['SUPER_ADMIN', 'WPP_CFG'],
  },
  {
    id: 'resultados',
    label: 'Reportes',
    icon: <BarChart3 size={22} />,
    roles: ['SUPER_ADMIN'],
  },
];

// IDs que se muestran siempre en la barra inferior (Prioridad)
const MAIN_TABS_IDS = ['orders', 'dictado', 'menu'];

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  WPP_CFG: 'WhatsApp',
  MESA_MENU: 'Mesa / Menú',
};

const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-amber-100 text-amber-800',
  WPP_CFG: 'bg-green-100 text-green-800',
  MESA_MENU: 'bg-blue-100 text-blue-800',
};

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<UserConfig | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Determinar tab activa desde la URL
  const activeTab = useMemo<TabKey>(() => {
    const segment = location.pathname.replace(/^\/admin\/?/, '').split('/')[0];
    return PATH_TO_TAB[segment] ?? 'orders';
  }, [location.pathname]);

  // Al montar: restaurar sesión
  useEffect(() => {
    const savedEmail = localStorage.getItem('admin_email');
    if (savedEmail && USERS_DB[savedEmail]) {
      const userData = USERS_DB[savedEmail];
      setUser(userData);
      // Si la URL es exactamente /admin, redirigir al primer tab disponible
      const segment = location.pathname.replace(/^\/admin\/?/, '').split('/')[0];
      if (!segment || !PATH_TO_TAB[segment]) {
        const firstTab = TABS_CONFIG.find(t => t.roles.includes(userData.role));
        if (firstTab) navigate(`/admin/${TAB_TO_PATH[firstTab.id]}`, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (firstValidTab) navigate(`/admin/${TAB_TO_PATH[firstValidTab.id]}`);
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
    navigate('/admin', { replace: true });
  };

  const handleTabChange = (id: TabKey) => {
    setShowMobileMenu(false);
    navigate(`/admin/${TAB_TO_PATH[id]}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- LOGIN VIEW ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-amber-50/30 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Blobs decorativos */}
        <div className="absolute top-[-15%] left-[-10%] w-[480px] h-[480px] bg-amber-300/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[480px] h-[480px] bg-orange-300/15 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-white/85 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/60 relative z-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4">
              <ChefHat className="text-white" size={30} />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Luis Res</h1>
            <p className="text-gray-400 text-sm mt-1 font-medium">Panel de Administración</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                Correo electrónico
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none transition-all text-gray-800 font-medium placeholder:text-gray-400"
                placeholder="usuario@luisres.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passInput}
                  onChange={(e) => setPassInput(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none transition-all pr-11 text-gray-800 font-medium placeholder:text-gray-400"
                  placeholder="••••••••"
                  required
                />
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3.5 px-4 rounded-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-gray-900/20 mt-2"
            >
              Ingresar al Sistema
            </button>
          </form>
        </div>
        <p className="mt-6 text-xs text-gray-400 font-medium">
          © {new Date().getFullYear()} Alliasoft · Luis Res
        </p>
      </div>
    );
  }

  // --- COMPONENTE DE PESTAÑA (BOTÓN) PARA DESKTOP ---
  const DesktopTabButton = ({ tab, isActive }: { tab: TabDef; isActive: boolean }) => (
    <button
      onClick={() => handleTabChange(tab.id)}
      className={`
        relative px-3.5 py-2 rounded-xl font-semibold text-sm flex items-center gap-2
        transition-all duration-150 whitespace-nowrap select-none
        ${isActive
          ? 'bg-gray-900 text-white shadow-md shadow-gray-900/25'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}
      `}
    >
      {React.cloneElement(tab.icon as React.ReactElement, { size: 16 })}
      {tab.label}
    </button>
  );

  // --- COMPONENTE DE PESTAÑA MOBILE (con label) ---
  const MobileTabItem = ({
    tab,
    isActive,
    onClick,
  }: { tab: TabDef; isActive: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 active:scale-95 transition-transform"
    >
      <div
        className={`transition-all duration-200 ${isActive ? 'text-gray-900' : 'text-gray-400'
          }`}
      >
        {React.cloneElement(tab.icon as React.ReactElement, {
          size: 23,
          strokeWidth: isActive ? 2.5 : 1.8,
        })}
      </div>
      <span
        className={`text-[10px] font-semibold transition-colors duration-200 leading-none ${isActive ? 'text-gray-900' : 'text-gray-400'
          }`}
      >
        {tab.label}
      </span>
      {/* Dot indicator */}
      {isActive && (
        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500" />
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-[65px] md:pb-0">

      {/* ── HEADER DESKTOP ─────────────────────── */}
      <header className="hidden md:block sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200/70 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          {/* Logo + nombre */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-white shadow-sm shadow-amber-400/30">
              <ChefHat size={17} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-gray-900 text-sm tracking-tight">Luis Res</span>
              <span className="text-[10px] text-gray-400 font-medium">Admin</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 flex-1 justify-center">
            {allAvailable.map((tab) => (
              <DesktopTabButton key={tab.id} tab={tab} isActive={activeTab === tab.id} />
            ))}
          </div>

          {/* Usuario + Logout */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-col items-end leading-none">
              <span className="text-xs font-bold text-gray-800">{user.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${ROLE_COLORS[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ── HEADER MOBILE ──────────────────────── */}
      <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex justify-between items-center sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-white shadow-sm">
            <ChefHat size={16} />
          </div>
          <span className="font-black text-gray-900 text-sm tracking-tight">Luis Res</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right leading-none">
            <p className="text-xs font-bold text-gray-800">{user.name}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL ────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div key={activeTab} className="tab-fade-in">
          {activeTab === 'orders' && allAvailable.some(t => t.id === 'orders') && <OrdersTab />}
          {activeTab === 'dictado' && allAvailable.some(t => t.id === 'dictado') && (
            <Manual onOrderSaved={() => handleTabChange('orders')} />
          )}
          {activeTab === 'menu' && allAvailable.some(t => t.id === 'menu') && <MenuTab />}
          {activeTab === 'domicilios' && allAvailable.some(t => t.id === 'domicilios') && <DomiciliosTab />}
          {activeTab === 'clientes' && allAvailable.some(t => t.id === 'clientes') && <ClientesTab />}
          {activeTab === 'variables' && allAvailable.some(t => t.id === 'variables') && <VariablesTab />}
          {activeTab === 'resultados' && allAvailable.some(t => t.id === 'resultados') && <ResultadosTab />}
        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV ──────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200/80 flex justify-around items-stretch h-[65px] px-1">

        {/* Tabs principales */}
        {mainTabs.map((tab) => (
          <MobileTabItem
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
          />
        ))}

        {/* Botón "Más" */}
        {secondaryTabs.length > 0 && (
          <div className="relative flex-1 flex justify-center" ref={menuRef}>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="flex flex-col items-center justify-center py-1.5 gap-0.5 w-full active:scale-95 transition-transform"
            >
              <div
                className={`transition-colors duration-200 ${secondaryTabs.some(t => t.id === activeTab) || showMobileMenu
                    ? 'text-gray-900'
                    : 'text-gray-400'
                  }`}
              >
                {showMobileMenu
                  ? <X size={23} strokeWidth={2.2} />
                  : <MoreHorizontal size={23} strokeWidth={1.8} />}
              </div>
              <span
                className={`text-[10px] font-semibold leading-none transition-colors duration-200 ${secondaryTabs.some(t => t.id === activeTab) || showMobileMenu
                    ? 'text-gray-900'
                    : 'text-gray-400'
                  }`}
              >
                Más
              </span>
              {/* Dot si hay tab secundaria activa */}
              {secondaryTabs.some(t => t.id === activeTab) && !showMobileMenu && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500" />
              )}
            </button>

            {/* Menú flotante */}
            {showMobileMenu && (
              <div className="absolute bottom-[72px] right-0 w-52 bg-white rounded-2xl shadow-2xl shadow-gray-900/15 border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-3 fade-in duration-150">
                <div className="py-2">
                  {secondaryTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${isActive
                            ? 'bg-amber-50 text-amber-700 font-bold'
                            : 'text-gray-600 hover:bg-gray-50 font-medium'
                          }`}
                      >
                        {React.cloneElement(tab.icon as React.ReactElement, {
                          size: 19,
                          strokeWidth: isActive ? 2.5 : 2,
                        })}
                        <span className="text-sm">{tab.label}</span>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
                        )}
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