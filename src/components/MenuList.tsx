import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Image as ImageIcon, Plus, Minus, Search, X as XIcon, RefreshCw } from 'lucide-react';
import MenuItemModal from './MenuItemModal';
// import QuickCategoryFilter from './QuickCategoryFilter'; // <- ya no se usa
import MenuImageModal from './MenuImageModal';
import { useMenu } from '../context/MenuContext';
import { useCart } from '../context/CartContext';
import { getCurrentMenuImage } from '../config/restaurantConfig';
import { formatPrice } from '../utils/dateUtils';
import { MenuItem as MenuItemType } from '../types';

/** ======================
 *  GRID (mismo patrón de Admin)
 *  ====================== */
const GRID_COLS_MOBILE = 1;   // columnas en móviles
const GRID_COLS_MD = 2;       // columnas en tablets
const GRID_COLS_DESKTOP = 4;  // columnas en desktop

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

const MenuList: React.FC = () => {
  const { filteredItems, loading, error } = useMenu();
  const { addToCart, items: cartItems, updateQuantity } = useCart();

  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // UI estilo Admin
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  // Ordena y limpia items
  const sortedItems = useMemo(() => {
    return [...filteredItems]
      .filter(item => item && item.nombre && item.nombre.trim() !== '')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [filteredItems]);

  // Todas las categorías
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    sortedItems.forEach((item) => {
      (item.categorias || []).forEach((c: string) => set.add(c));
    });
    return ['Todas', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))];
  }, [sortedItems]);

  // Filtro por categoría + búsqueda
  const visibleItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sortedItems.filter((item) => {
      const inCategory =
        selectedCategory === 'Todas' ||
        (item.categorias || []).includes(selectedCategory);
      const inSearch =
        term === '' ||
        (item.nombre || '').toLowerCase().includes(term) ||
        (item.descripcion || '').toLowerCase().includes(term);
      return inCategory && inSearch;
    });
  }, [sortedItems, selectedCategory, searchTerm]);

  const clearSearch = () => setSearchTerm('');

  const getItemQuantityInCart = (itemId: string) => {
    const cartItem = cartItems.find(item => item.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const handleOpenModal = (item: MenuItemType) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleQuantityChange = (item: MenuItemType, newQuantity: number) => {
    const currentQuantity = getItemQuantityInCart(item.id);

    if (newQuantity <= 0) {
      if (currentQuantity > 0) updateQuantity(item.id, 0);
    } else if (currentQuantity === 0) {
      addToCart(item, newQuantity);
    } else {
      updateQuantity(item.id, newQuantity);
    }
  };

  const currentMenuImage = getCurrentMenuImage();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8" id="menu-items">
        <div className="text-center">
          <ChefHat size={48} className="text-gold mx-auto mb-4 animate-pulse" />
          <p className="text-wood-medium">Cargando menú...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8" id="menu-items">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gold text-white px-4 py-2 rounded-lg"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Header compacto sticky con botón Menú del Día */}
      <div className="bg-white/80 backdrop-blur border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="text-gold" size={28} />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Menú</h1>
                <p className="text-gray-600 text-sm">Explora y ordena</p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsImageModalOpen(true)}
              className="inline-flex items-center gap-2 bg-gold text-white px-4 py-2 rounded-lg font-medium hover:bg-gold/90 transition-colors shadow-sm"
            >
              <ImageIcon size={18} />
              Ver Menú del Día
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar categorías fijo (igual a Admin) */}
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

              {/* Lista vertical UNA columna con scroll */}
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

              {/* Botón auxiliar (no hace fetch, solo UX) */}
              <div className="px-2">
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="mt-3 w-full bg-gold hover:bg-gold/90 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 shadow-sm"
                  title="Ir arriba"
                >
                  <RefreshCw size={16} />
                  Arriba
                </button>
              </div>
            </div>
          </aside>

          {/* Contenido desplazado a la derecha del sidebar */}
          <div className="flex-1 min-w-0 ml-28 sm:ml-40 lg:ml-64">
            {/* Contador de items */}
            {visibleItems.length > 0 && (
              <div className="text-left mb-4">
                <p className="text-wood-medium text-sm">
                  {visibleItems.length} platillo{visibleItems.length !== 1 ? 's' : ''} disponibles
                  {selectedCategory !== 'Todas' ? ` · ${selectedCategory}` : ''}
                </p>
              </div>
            )}

            {/* Grid estilo Admin con tus controles de cantidad */}
            {visibleItems.length > 0 ? (
              <div className={`grid ${gridColsClass} gap-4`}>
                {visibleItems.map((item, index) => {
                  const currentQuantity = getItemQuantityInCart(item.id);

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`bg-white rounded-xl border border-gray-200 p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow ${
                        !item.disponible ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-semibold text-gray-900 mb-1 leading-tight break-words cursor-pointer"
                          onClick={() => handleOpenModal(item)}
                          title="Ver detalles"
                        >
                          {item.nombre}
                        </h3>

                        {item.descripcion && (
                          <p className="text-sm text-gray-600 mb-2 leading-relaxed break-words">
                            {item.descripcion}
                          </p>
                        )}

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

                      {/* Pie de la card: precio + estado/controles */}
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="font-bold text-gold text-base sm:text-lg tracking-tight">
                          {formatPrice(item.valor)}
                        </p>

                        {/* Contenedor derecho sin romper el layout */}
                        <div className="flex items-center gap-2 sm:gap-3 ml-2 shrink-0">
                          {/* Mostrar SOLO cuando NO hay disponibilidad */}
                          {!item.disponible && (
                            <span className="px-2 py-0.5 rounded-full text-[12px] font-medium border bg-red-50 text-red-700 border-red-200">
                              Agotado
                            </span>
                          )}

                          {/* Controles de cantidad SOLO si hay disponibilidad */}
                          {item.disponible && (
                            <div className="flex items-center gap-2 sm:gap-3 whitespace-nowrap">
                              {currentQuantity > 0 && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleQuantityChange(item, currentQuantity - 1)}
                                  className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                                  title="Quitar 1"
                                >
                                  <Minus size={16} />
                                </motion.button>
                              )}

                              {currentQuantity > 0 && (
                                <span className="font-bold text-lg w-8 text-center text-gray-900">
                                  {currentQuantity}
                                </span>
                              )}

                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleQuantityChange(item, currentQuantity + 1)}
                                className="p-2 rounded-lg bg-gold hover:bg-gold/90 text-white transition-colors"
                                title="Agregar 1"
                              >
                                <Plus size={16} />
                              </motion.button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <ChefHat size={48} className="text-gray-400 mx-auto mb-4" />
                <p className="text-wood-medium">No hay platillos disponibles</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modales */}
      <AnimatePresence>
        {selectedItem && (
          <MenuItemModal
            item={selectedItem}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
          />
        )}
      </AnimatePresence>

      <MenuImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        imageUrl={currentMenuImage}
        title="Menú del Día"
      />
    </div>
  );
};

export default MenuList;
