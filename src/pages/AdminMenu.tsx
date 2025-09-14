import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, X as XIcon } from 'lucide-react';
import { fetchMenuItems } from '../api/menuApi';
import { MenuItem } from '../types';
import { formatPrice } from '../utils/dateUtils';

/** APIs */
const MENU_API = 'https://n8n.alliasoft.com/webhook/luis-res/menu';

/** Tipos */
type MenuItemWithRow = MenuItem & { row_number?: number };

/** Grid responsivo (igual al original) */
const GRID_COLS_MOBILE = 1;
const GRID_COLS_MD = 2;
const GRID_COLS_DESKTOP = 4;

const GRID_MAP: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

const gridColsClass =
  `${GRID_MAP[GRID_COLS_MOBILE] || 'grid-cols-1'} ` +
  `md:${GRID_MAP[GRID_COLS_MD] || 'grid-cols-2'} ` +
  `lg:${GRID_MAP[GRID_COLS_DESKTOP] || 'grid-cols-4'}`;

const MenuTab: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItemWithRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Búsqueda / categoría
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  useEffect(() => {
    forceFetchMenuItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forceFetchMenuItems = async () => {
    try {
      setLoading(true);
      const res = await fetch(MENU_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = await res.json();
      setMenuItems(
        (items as MenuItemWithRow[]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      );
    } catch (error) {
      console.error('Error fetching menu items:', error);
      try {
        const items = await fetchMenuItems();
        setMenuItems(
          (items as MenuItemWithRow[]).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        );
      } catch (e) {
        console.error('Fallback fetchMenuItems failed:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const postAvailability = async (payload: { row_number: number | null; id: number | string; disponible: boolean }) => {
    const res = await fetch(MENU_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('No se pudo actualizar la disponibilidad');
  };

  const updateMenuItemAvailability = async (item: MenuItemWithRow, nuevoValor: boolean) => {
    const payload = {
      row_number: item.row_number ?? null,
      id: (item as any).id,
      disponible: nuevoValor,
    };

    setMenuItems(prev => prev.map(i => (i.id === item.id ? { ...i, disponible: nuevoValor } : i)));
    try {
      await postAvailability(payload);
    } catch (err) {
      console.error(err);
      setMenuItems(prev => prev.map(i => (i.id === item.id ? { ...i, disponible: !nuevoValor } : i)));
      alert('No se pudo guardar el cambio. Intenta de nuevo.');
    }
  };

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      (item.categorias || []).forEach((c: string) => set.add(c));
    });
    return ['Todas', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))];
  }, [menuItems]);

  const visibleMenuItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return menuItems.filter((item) => {
      const inCategory =
        selectedCategory === 'Todas' ||
        (item.categorias || []).includes(selectedCategory);
      const inName =
        term === '' ||
        (item.nombre || '').toLowerCase().includes(term);
      return inCategory && inName;
    });
  }, [menuItems, selectedCategory, searchTerm]);

  const clearSearch = () => setSearchTerm('');

  return (
    <div className="flex gap-6">
      {/* Sidebar categorías (fijo) */}
      <aside className="fixed top-24 left-0 z-20 w-28 sm:w-40 lg:w-64 h-[calc(100vh-6rem)] shrink-0">
        <div className="h-full">
          <div className="flex items-center justify-between mb-3 px-2">
            <h3 className="text-sm font-semibold text-gray-700">Categorías</h3>
          </div>

          {/* Buscador */}
          <div className="relative mb-3 px-2">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold/40 text-sm"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
                title="Limpiar"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          {/* Lista vertical */}
          <div className="rounded-xl border border-gray-200 bg-white p-2 max-h-[calc(100vh-180px)] overflow-y-auto mx-2">
            <div className="grid grid-cols-1 gap-2">
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg border text-xs md:text-sm px-2.5 py-2 transition shadow-sm hover:shadow ${
                    selectedCategory === cat
                      ? 'bg-gold text-white border-gold'
                      : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                  title={cat}
                >
                  <span className="block truncate">{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Botón actualizar menú */}
          <div className="px-2">
            <button
              onClick={forceFetchMenuItems}
              className="mt-3 w-full bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 shadow-sm"
              title="Actualizar menú"
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>
        </div>
      </aside>

      {/* Contenido Menú */}
      <div className="flex-1 min-w-0 ml-28 sm:ml-40 lg:ml-64">
        <div className={`grid ${gridColsClass} gap-4`}>
          {visibleMenuItems.map((item) => (
            <div
              key={item.id as any}
              className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1 leading-tight break-words">
                  {item.nombre}
                </h3>

                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {item.categorias?.map((categoria: string) => (
                    <span
                      key={categoria}
                      className="bg-gold/10 text-gold px-2 py-0.5 rounded-full text-[11px] font-medium border border-gold/20"
                    >
                      {categoria}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="font-bold text-gold text-lg tracking-tight">{formatPrice(item.valor)}</p>

                <div className="flex items-center gap-2">
                  <div
                    className={`px-2 py-0.5 rounded-full text-[12px] font-medium border ${
                      item.disponible
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {item.disponible ? 'Disponible' : 'Agotado'}
                  </div>

                  {/* Switch disponibilidad */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.disponible}
                    onClick={() => updateMenuItemAvailability(item, !item.disponible)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gold/40 ${
                      item.disponible ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                    title={item.disponible ? 'Marcar como agotado' : 'Marcar como disponible'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        item.disponible ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {loading && <div className="text-sm text-gray-500 mt-4">Cargando menú…</div>}
      </div>
    </div>
  );
};

export default MenuTab;
