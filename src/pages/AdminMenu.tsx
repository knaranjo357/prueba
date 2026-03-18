// src/pages/AdminMenu.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, X as XIcon, Tag, UtensilsCrossed, Filter } from 'lucide-react';
import { fetchMenuItems } from '../api/menuApi';
import { MenuItem } from '../types';
import { formatPrice } from '../utils/dateUtils';

/** APIs */
const MENU_API = 'https://n8n.alliasoft.com/webhook/luis-res/menu';

/** Tipos */
type MenuItemWithRow = MenuItem & { row_number?: number };

const normalizeText = (text: string = '') =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const ALMUERZO_EXTRA_NAMES = [
  'porcion principio del dia',
  'porcion arroz blanco',
  'porcion yuca al vapor',
  'porcion papa al vapor',
  'porcion arroz con verduras',
  'sopa del dia',
  'media sopa del dia',
];

const ALMUERZO_EXTRA_SET = new Set(ALMUERZO_EXTRA_NAMES.map(normalizeText));

const MenuTab: React.FC = () => {
  const [menuItems, setMenuItems] = useState<MenuItemWithRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkUpdatingLunch, setBulkUpdatingLunch] = useState(false);

  // Búsqueda / categoría
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  useEffect(() => {
    forceFetchMenuItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLunchNameItem = (item: MenuItemWithRow) =>
    normalizeText(item.nombre || '').includes('almuerzo');

  const isLunchExtraItem = (item: MenuItemWithRow) =>
    ALMUERZO_EXTRA_SET.has(normalizeText(item.nombre || ''));

  const isLunchCategoryItem = (item: MenuItemWithRow) =>
    (item.categorias || []).some((c: string) => normalizeText(c) === 'almuerzo');

  const isLunchGroupedItem = (item: MenuItemWithRow) =>
    isLunchNameItem(item) || isLunchCategoryItem(item) || isLunchExtraItem(item);

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

  const postAvailability = async (payload: {
    row_number: number | null;
    id: number | string;
    disponible: boolean;
  }) => {
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
      id: item.id,
      disponible: nuevoValor,
    };

    // Actualización optimista
    setMenuItems(prev =>
      prev.map(i => (String(i.id) === String(item.id) ? { ...i, disponible: nuevoValor } : i))
    );

    try {
      await postAvailability(payload);
    } catch (err) {
      console.error(err);
      // Revertir si falla
      setMenuItems(prev =>
        prev.map(i => (String(i.id) === String(item.id) ? { ...i, disponible: !nuevoValor } : i))
      );
      alert('No se pudo guardar el cambio. Intenta de nuevo.');
    }
  };

  const updateAllLunchAvailability = async (nuevoValor: boolean) => {
    const lunchItems = menuItems.filter(isLunchGroupedItem);
    if (!lunchItems.length) return;

    const previousItems = menuItems;
    const lunchIds = new Set(lunchItems.map(item => String(item.id)));

    setBulkUpdatingLunch(true);

    // Actualización optimista
    setMenuItems(prev =>
      prev.map(item =>
        lunchIds.has(String(item.id)) ? { ...item, disponible: nuevoValor } : item
      )
    );

    try {
      await Promise.all(
        lunchItems.map(item =>
          postAvailability({
            row_number: item.row_number ?? null,
            id: item.id,
            disponible: nuevoValor,
          })
        )
      );
    } catch (error) {
      console.error(error);
      setMenuItems(previousItems);
      alert('No se pudieron actualizar todos los almuerzos. Se revirtieron los cambios.');
    } finally {
      setBulkUpdatingLunch(false);
    }
  };

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      (item.categorias || []).forEach((c: string) => set.add(c));
    });
    return ['Todas', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))];
  }, [menuItems]);

  const lunchGroupedItems = useMemo(() => {
    return menuItems.filter(isLunchGroupedItem);
  }, [menuItems]);

  const allLunchOff =
    lunchGroupedItems.length > 0 && lunchGroupedItems.every(item => !item.disponible);

  const visibleMenuItems = useMemo(() => {
    const normalizedTerm = normalizeText(searchTerm);
    const selectedCategoryNormalized = normalizeText(selectedCategory);

    let filtered = menuItems.filter((item) => {
      const inCategory =
        selectedCategory === 'Todas'
          ? true
          : selectedCategoryNormalized === 'almuerzo'
          ? isLunchGroupedItem(item)
          : (item.categorias || []).some(
              (c: string) => normalizeText(c) === selectedCategoryNormalized
            );

      const inName =
        normalizedTerm === '' || normalizeText(item.nombre || '').includes(normalizedTerm);

      return inCategory && inName;
    });

    if (selectedCategoryNormalized === 'almuerzo') {
      const extraOrderMap = ALMUERZO_EXTRA_NAMES.reduce<Record<string, number>>((acc, name, idx) => {
        acc[normalizeText(name)] = idx;
        return acc;
      }, {});

      filtered = [...filtered].sort((a, b) => {
        const aIsExtra = isLunchExtraItem(a);
        const bIsExtra = isLunchExtraItem(b);

        if (aIsExtra && !bIsExtra) return 1;
        if (!aIsExtra && bIsExtra) return -1;

        if (aIsExtra && bIsExtra) {
          return (
            (extraOrderMap[normalizeText(a.nombre || '')] ?? 999) -
            (extraOrderMap[normalizeText(b.nombre || '')] ?? 999)
          );
        }

        return (a.nombre || '').localeCompare(b.nombre || '', 'es');
      });
    }

    return filtered;
  }, [menuItems, selectedCategory, searchTerm]);

  const clearSearch = () => setSearchTerm('');

  const isAlmuerzoView = normalizeText(selectedCategory) === 'almuerzo';

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
      {/* === BARRA LATERAL / SUPERIOR DE FILTROS === */}
      <aside className="lg:w-56 shrink-0 lg:self-start">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sticky top-20 lg:top-24 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
              <Filter size={16} className="text-gold" /> Filtros
            </h3>
            <button
              onClick={forceFetchMenuItems}
              disabled={loading}
              className={`p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-all ${
                loading ? 'animate-spin' : ''
              }`}
              title="Actualizar menú"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Buscador */}
          <div className="relative mb-4 group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gold transition-colors"
              size={16}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar plato..."
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold/50 outline-none text-sm transition-all bg-gray-50 focus:bg-white"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-500"
                title="Limpiar búsqueda"
              >
                <XIcon size={13} />
              </button>
            )}
          </div>

          {/* Lista Categorías */}
          <div>
            <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Categorías
            </h4>
            <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
              {allCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between group ${
                    selectedCategory === cat
                      ? 'bg-gold text-white shadow-md shadow-gold/20'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                  {selectedCategory === cat && (
                    <span className="bg-white/20 w-2 h-2 rounded-full"></span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* === CONTENIDO PRINCIPAL (GRID) === */}
      <div className="flex-1 min-w-0">
        {/* Header de resultados */}
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base font-bold text-gray-800">
            Platos{' '}
            <span className="text-gray-400 font-normal text-sm ml-2">
              ({visibleMenuItems.length})
            </span>
          </h2>

          <div className="flex items-center gap-3 flex-wrap">
            {isAlmuerzoView && lunchGroupedItems.length > 0 && (
              <button
                onClick={() => updateAllLunchAvailability(allLunchOff)}
                disabled={bulkUpdatingLunch || loading}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                title={
                  allLunchOff
                    ? 'Encender todos los almuerzos'
                    : 'Apagar todos los almuerzos'
                }
              >
                {bulkUpdatingLunch
                  ? 'Guardando...'
                  : allLunchOff
                  ? 'Encender todos los almuerzos'
                  : 'Apagar todos los almuerzos'}
              </button>
            )}

            <div className="hidden sm:flex gap-3 text-[11px] text-gray-500">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Disponible
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-300"></span> Agotado
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {visibleMenuItems.map((item) => {
            const isAvailable = item.disponible;

            return (
              <div
                key={String(item.id)}
                className={`group relative rounded-lg border transition-all duration-300 flex flex-col overflow-hidden ${
                  isAvailable
                    ? 'bg-white border-gray-200 hover:shadow-md hover:-translate-y-0.5 hover:border-gold/30'
                    : 'bg-gray-50 border-gray-200 opacity-75 grayscale-[0.5]'
                }`}
              >
                <div className={`h-0.5 w-full ${isAvailable ? 'bg-gold' : 'bg-gray-300'}`} />

                <div className="p-4 flex flex-col flex-1">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3
                      className={`font-bold text-base leading-tight ${
                        isAvailable
                          ? 'text-gray-800'
                          : 'text-gray-500 line-through decoration-gray-400'
                      }`}
                    >
                      {item.nombre}
                    </h3>

                    <button
                      onClick={() => updateMenuItemAvailability(item, !item.disponible)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gold/50 focus:ring-offset-2 ${
                        item.disponible ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      title={
                        item.disponible
                          ? 'Marcar como Agotado'
                          : 'Marcar como Disponible'
                      }
                    >
                      <span className="sr-only">Disponibilidad</span>
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          item.disponible ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3 flex-1 content-start">
                    {item.categorias?.map((categoria: string) => (
                      <span
                        key={categoria}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                          isAvailable
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        <Tag size={9} className="mr-1" /> {categoria}
                      </span>
                    ))}

                    {isAlmuerzoView && isLunchExtraItem(item) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-100">
                        Extra almuerzo
                      </span>
                    )}
                  </div>

                  <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                        Precio
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          isAvailable ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {formatPrice(item.valor)}
                      </span>
                    </div>

                    {!isAvailable && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-md uppercase">
                        Agotado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!loading && visibleMenuItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="bg-gray-50 p-3 rounded-full mb-3">
              <UtensilsCrossed size={40} className="opacity-20" />
            </div>
            <p className="text-base font-medium">No se encontraron platos</p>
            <p className="text-sm opacity-70">Intenta con otra categoría o búsqueda</p>
            <button
              onClick={clearSearch}
              className="mt-3 text-gold hover:underline font-medium text-sm"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {loading && visibleMenuItems.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 mt-3">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white h-40 rounded-lg border border-gray-100 animate-pulse p-4"
              >
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                <div className="mt-10 h-7 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuTab;