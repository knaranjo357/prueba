// src/pages/AdminMenu.tsx (o donde tengas MenuTab)
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, X as XIcon, Tag, UtensilsCrossed, Filter } from 'lucide-react';
import { fetchMenuItems } from '../api/menuApi'; // Asegúrate que esta ruta sea correcta en tu proyecto
import { MenuItem } from '../types'; // Asegúrate que esta ruta sea correcta en tu proyecto
import { formatPrice } from '../utils/dateUtils'; // Asegúrate que esta ruta sea correcta en tu proyecto

/** APIs */
const MENU_API = 'https://n8n.alliasoft.com/webhook/luis-res/menu';

/** Tipos */
type MenuItemWithRow = MenuItem & { row_number?: number };

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

    // Actualización optimista
    setMenuItems(prev => prev.map(i => (i.id === item.id ? { ...i, disponible: nuevoValor } : i)));
    
    try {
      await postAvailability(payload);
    } catch (err) {
      console.error(err);
      // Revertir si falla
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
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-150px)]">
      
      {/* === BARRA LATERAL / SUPERIOR DE FILTROS === */}
      {/* En Desktop es sidebar sticky, en móvil es bloque superior */}
      <aside className="lg:w-64 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 lg:sticky lg:top-24">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Filter size={18} className="text-gold" /> Filtros
            </h3>
            <button
              onClick={forceFetchMenuItems}
              disabled={loading}
              className={`p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-all ${loading ? 'animate-spin' : ''}`}
              title="Actualizar menú"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {/* Buscador */}
          <div className="relative mb-6 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gold transition-colors" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar plato..."
              className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold/50 outline-none text-sm transition-all bg-gray-50 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-500"
                title="Limpiar búsqueda"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          {/* Lista Categorías */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Categorías</h4>
            {/* En móvil usamos flex wrap, en desktop lista vertical */}
            <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between group ${
                    selectedCategory === cat
                      ? 'bg-gold text-white shadow-md shadow-gold/20 translate-x-1'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:pl-5'
                  }`}
                >
                  {cat}
                  {selectedCategory === cat && <span className="bg-white/20 w-2 h-2 rounded-full"></span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* === CONTENIDO PRINCIPAL (GRID) === */}
      <div className="flex-1">
        {/* Header de resultados */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">
            Platos <span className="text-gray-400 font-normal text-sm ml-2">({visibleMenuItems.length})</span>
          </h2>
          {/* Indicadores visuales pequeños */}
          <div className="hidden sm:flex gap-4 text-xs text-gray-500">
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Disponible</div>
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300"></span> Agotado</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {visibleMenuItems.map((item) => {
            const isAvailable = item.disponible;

            return (
              <div
                key={item.id as any}
                className={`group relative rounded-xl border transition-all duration-300 flex flex-col overflow-hidden ${
                  isAvailable
                    ? 'bg-white border-gray-200 hover:shadow-lg hover:-translate-y-1 hover:border-gold/30'
                    : 'bg-gray-50 border-gray-200 opacity-75 grayscale-[0.5]'
                }`}
              >
                {/* Barra de estado superior (visual) */}
                <div className={`h-1 w-full ${isAvailable ? 'bg-gold' : 'bg-gray-300'}`} />

                <div className="p-5 flex flex-col flex-1">
                  {/* Cabecera Card */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className={`font-bold text-lg leading-tight ${isAvailable ? 'text-gray-800' : 'text-gray-500 line-through decoration-gray-400'}`}>
                      {item.nombre}
                    </h3>
                    {/* Switch de disponibilidad */}
                    <button
                        onClick={() => updateMenuItemAvailability(item, !item.disponible)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2 ${
                          item.disponible ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                        title={item.disponible ? 'Marcar como Agotado' : 'Marcar como Disponible'}
                      >
                        <span className="sr-only">Disponibilidad</span>
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            item.disponible ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                    </button>
                  </div>

                  {/* Categorías */}
                  <div className="flex flex-wrap gap-1.5 mb-4 flex-1 content-start">
                    {item.categorias?.map((categoria: string) => (
                      <span
                        key={categoria}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                          isAvailable 
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        <Tag size={10} className="mr-1" /> {categoria}
                      </span>
                    ))}
                  </div>

                  {/* Footer Card: Precio */}
                  <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Precio</span>
                      <span className={`text-xl font-bold ${isAvailable ? 'text-gray-900' : 'text-gray-400'}`}>
                        {formatPrice(item.valor)}
                      </span>
                    </div>
                    {!isAvailable && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-md uppercase">
                        Agotado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Estado Vacío */}
        {!loading && visibleMenuItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="bg-gray-50 p-4 rounded-full mb-4">
              <UtensilsCrossed size={48} className="opacity-20" />
            </div>
            <p className="text-lg font-medium">No se encontraron platos</p>
            <p className="text-sm opacity-70">Intenta con otra categoría o búsqueda</p>
            <button 
              onClick={clearSearch} 
              className="mt-4 text-gold hover:underline font-medium text-sm"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Loader inicial */}
        {loading && visibleMenuItems.length === 0 && (
           <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mt-4">
             {[...Array(8)].map((_, i) => (
               <div key={i} className="bg-white h-48 rounded-xl border border-gray-100 animate-pulse p-4">
                 <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                 <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                 <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                 <div className="mt-12 h-8 bg-gray-200 rounded w-full"></div>
               </div>
             ))}
           </div>
        )}
      </div>
    </div>
  );
};

export default MenuTab;