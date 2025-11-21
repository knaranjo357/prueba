import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Image as ImageIcon, Plus, Minus, Search, X as XIcon } from 'lucide-react';
import MenuItemModal from './MenuItemModal';
import MenuImageModal from './MenuImageModal';
import { useMenu } from '../context/MenuContext';
import { useCart } from '../context/CartContext';
import { getCurrentMenuImage } from '../config/restaurantConfig';
import { formatPrice } from '../utils/dateUtils';
import { MenuItem as MenuItemType } from '../types';

const MenuList: React.FC = () => {
  const { filteredItems, loading, error } = useMenu();
  const { addToCart, items: cartItems, updateQuantity } = useCart();

  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [scrolled, setScrolled] = useState(false);

  // Detectar scroll para efectos visuales en el header
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Procesamiento de items
  const sortedItems = useMemo(() => {
    return [...filteredItems]
      .filter(item => item && item.nombre && item.nombre.trim() !== '')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [filteredItems]);

  // Obtener categorías únicas
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    sortedItems.forEach((item) => {
      (item.categorias || []).forEach((c: string) => set.add(c));
    });
    return ['Todas', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))];
  }, [sortedItems]);

  // Filtrado
  const visibleItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return sortedItems.filter((item) => {
      const inCategory = selectedCategory === 'Todas' || (item.categorias || []).includes(selectedCategory);
      const inSearch = term === '' || 
        (item.nombre || '').toLowerCase().includes(term) ||
        (item.descripcion || '').toLowerCase().includes(term);
      return inCategory && inSearch;
    });
  }, [sortedItems, selectedCategory, searchTerm]);

  const getItemQuantityInCart = (itemId: string) => {
    const cartItem = cartItems.find(item => item.id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const handleQuantityChange = (e: React.MouseEvent, item: MenuItemType, newQuantity: number) => {
    e.stopPropagation(); // Evitar abrir modal al hacer click en botones
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

  // Loading State elegante
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cream/30">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <ChefHat size={48} className="text-gold mb-4" />
        </motion.div>
        <p className="text-wood-medium font-medium animate-pulse">Preparando el menú...</p>
      </div>
    );
  }

  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24">
      
      {/* --- HEADER & SEARCH --- */}
      <div className={`sticky top-0 z-30 bg-white/95 backdrop-blur-md transition-all duration-300 border-b border-gold/10 ${scrolled ? 'shadow-md py-2' : 'py-4'}`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-gold/10 p-2 rounded-xl">
                <ChefHat className="text-gold w-6 h-6 md:w-8 md:h-8" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-wood-dark leading-none">Menú</h1>
                <p className="text-xs md:text-sm text-wood-medium">Sabores únicos</p>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsImageModalOpen(true)}
              className="flex items-center gap-2 bg-wood-dark text-white px-3 py-2 rounded-xl text-sm font-medium shadow-lg shadow-wood-dark/20"
            >
              <ImageIcon size={16} />
              <span className="hidden sm:inline">Menú del Día</span>
            </motion.button>
          </div>

          {/* Buscador */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-wood-medium/70 w-5 h-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="¿Qué se te antoja hoy?"
              className="w-full pl-12 pr-10 py-3 bg-gray-100/80 border-transparent focus:bg-white border-2 focus:border-gold/50 rounded-2xl text-wood-dark placeholder-wood-medium/60 transition-all outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 transition-colors"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        </div>

        {/* --- CATEGORÍAS (Horizontal Scroll en móvil, Sticky) --- */}
        <div className="mt-3 max-w-7xl mx-auto px-4">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mask-linear-fade">
            {allCategories.map((cat) => (
              <motion.button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                whileTap={{ scale: 0.95 }}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap border ${
                  selectedCategory === cat
                    ? 'bg-gold text-white border-gold shadow-gold/30 shadow-lg'
                    : 'bg-white text-wood-medium border-gray-200 hover:border-gold/50 hover:text-gold'
                }`}
              >
                {cat}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Título de sección actual */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-wood-dark flex items-center gap-2">
            {selectedCategory === 'Todas' ? 'Todos los platos' : selectedCategory}
            <span className="text-xs font-normal text-wood-medium bg-gray-100 px-2 py-1 rounded-full">
              {visibleItems.length}
            </span>
          </h2>
        </div>

        {visibleItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            <AnimatePresence mode="popLayout">
              {visibleItems.map((item) => {
                const quantity = getItemQuantityInCart(item.id);
                
                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={item.id}
                    onClick={() => setIsModalOpen(true) || setSelectedItem(item)}
                    className={`group relative bg-white rounded-2xl p-4 shadow-sm hover:shadow-xl border border-gray-100 hover:border-gold/30 transition-all duration-300 cursor-pointer flex flex-col h-full ${
                      !item.disponible ? 'opacity-75 grayscale-[0.5]' : ''
                    }`}
                  >
                    {/* Etiquetas / Categorías */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.categorias?.slice(0, 2).map((cat) => (
                        <span key={cat} className="text-[10px] uppercase tracking-wider font-bold text-gold bg-gold/5 px-2 py-0.5 rounded-md">
                          {cat}
                        </span>
                      ))}
                    </div>

                    {/* Info Principal */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-lg font-bold text-wood-dark leading-tight mb-1 group-hover:text-gold transition-colors">
                          {item.nombre}
                        </h3>
                      </div>
                      
                      {item.descripcion && (
                        <p className="text-wood-medium text-sm leading-relaxed line-clamp-2 mb-4">
                          {item.descripcion}
                        </p>
                      )}
                    </div>

                    {/* Footer: Precio y Acción */}
                    <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs text-wood-medium">Precio</span>
                        <span className="text-lg font-bold text-wood-dark">
                          {formatPrice(item.valor)}
                        </span>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        {!item.disponible ? (
                          <span className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg border border-gray-200">
                            Agotado
                          </span>
                        ) : quantity === 0 ? (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => handleQuantityChange(e, item, 1)}
                            className="bg-wood-light/10 hover:bg-gold hover:text-white text-wood-dark px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2"
                          >
                            <Plus size={16} />
                            Agregar
                          </motion.button>
                        ) : (
                          <div className="flex items-center bg-white rounded-xl shadow-md border border-gold/20 p-1">
                            <motion.button
                              whileTap={{ scale: 0.8 }}
                              onClick={(e) => handleQuantityChange(e, item, quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-red-50 text-wood-dark hover:text-red-500 rounded-lg transition-colors"
                            >
                              <Minus size={16} />
                            </motion.button>
                            <span className="w-8 text-center font-bold text-wood-dark">{quantity}</span>
                            <motion.button
                              whileTap={{ scale: 0.8 }}
                              onClick={(e) => handleQuantityChange(e, item, quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center bg-gold text-white rounded-lg shadow-sm"
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
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
            <Search size={64} className="text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-wood-dark">No encontramos resultados</h3>
            <p className="text-wood-medium">Intenta con otra categoría o término de búsqueda.</p>
            <button 
              onClick={() => {setSearchTerm(''); setSelectedCategory('Todas');}}
              className="mt-4 text-gold font-semibold hover:underline"
            >
              Ver todo el menú
            </button>
          </div>
        )}
      </main>

      {/* Modales */}
      <AnimatePresence>
        {selectedItem && (
          <MenuItemModal
            item={selectedItem}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setTimeout(() => setSelectedItem(null), 300);
            }}
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