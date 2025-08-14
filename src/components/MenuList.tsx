import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Image as ImageIcon, Plus } from 'lucide-react';
import MenuItemModal from './MenuItemModal';
import QuickCategoryFilter from './QuickCategoryFilter';
import MenuImageModal from './MenuImageModal';
import { useMenu } from '../context/MenuContext';
import { useCart } from '../context/CartContext';
import { getCurrentMenuImage, getCurrentServiceType } from '../config/restaurantConfig';
import { formatPrice } from '../utils/dateUtils';
import { MenuItem as MenuItemType } from '../types';

const MenuList: React.FC = () => {
  const { filteredItems, loading, error } = useMenu();
  const { addToCart, items: cartItems, removeFromCart } = useCart();
  const [selectedItem, setSelectedItem] = useState<MenuItemType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [filteredItems]);

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

  const handleQuickAdd = (item: MenuItemType, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(item, 1);
  };

  const currentMenuImage = getCurrentMenuImage();
  const currentService = getCurrentServiceType();

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
    <div className="bg-gray-50 min-h-screen">
      <QuickCategoryFilter />
      
      <div className="container mx-auto px-4 py-6" id="menu-items">
        {/* Menu image button */}
        <div className="text-center mb-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsImageModalOpen(true)}
            className="inline-flex items-center gap-2 bg-gold text-white px-4 py-2 rounded-lg font-medium hover:bg-gold/90 transition-colors"
          >
            <ImageIcon size={18} />
            Ver Menú {currentService === 'almuerzo' ? 'Almuerzo' : 'Comida'}
          </motion.button>
        </div>

        {/* Items count */}
        {sortedItems.length > 0 && (
          <div className="text-center mb-4">
            <p className="text-wood-medium text-sm">
              {sortedItems.length} platillos disponibles
            </p>
          </div>
        )}

        {/* Menu Items Grid */}
        {sortedItems.length > 0 ? (
          <div className="space-y-2">
            {sortedItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-all cursor-pointer ${
                  !item.disponible ? 'opacity-60' : ''
                }`}
                onClick={() => handleOpenModal(item)}
              >
                <div className="p-4 flex items-center gap-4">
                  {/* Image - small on left */}
                  {item.url_imagen && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={item.url_imagen}
                        alt={item.nombre}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-bold text-wood-dark text-lg leading-tight">
                        {item.nombre}
                      </h3>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="font-bold text-gold text-lg">
                          {formatPrice(item.valor)}
                        </span>
                        {item.disponible && getItemQuantityInCart(item.id) === 0 && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => handleQuickAdd(item, e)}
                            className="bg-gold text-white p-2 rounded-full hover:bg-gold/90 transition-colors"
                          >
                            <Plus size={16} />
                          </motion.button>
                        )}
                        {item.disponible && getItemQuantityInCart(item.id) > 0 && (
                          <div className="bg-gold text-white px-3 py-1 rounded-full font-bold text-sm">
                            {getItemQuantityInCart(item.id)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Categories */}
                    {item.categorias && item.categorias.length > 0 && (
                      <div className="flex items-center gap-2 mb-2">
                        {item.categorias.slice(0, 3).map((categoria, index) => (
                          <span
                            key={`${categoria}-${index}`}
                            className="bg-gold/20 text-gold px-2 py-1 rounded-full text-xs font-medium capitalize"
                          >
                            {categoria}
                          </span>
                        ))}
                        {item.categorias.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{item.categorias.length - 3} más
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Description */}
                    {item.descripcion && (
                      <p className="text-wood-medium text-sm line-clamp-2 leading-relaxed">
                        {item.descripcion}
                      </p>
                    )}
                    
                    {/* Availability */}
                    {!item.disponible && (
                      <div className="mt-2">
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                          Agotado
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <ChefHat size={48} className="text-gray-400 mx-auto mb-4" />
            <p className="text-wood-medium">No hay platillos disponibles</p>
          </div>
        )}
      </div>

      {/* Modals */}
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
        title={`Menú ${currentService === 'almuerzo' ? 'Almuerzo' : 'Comida'}`}
      />
    </div>
  );
};

export default MenuList;