import React, { useEffect, useState } from 'react';
import { Trash2, Plus, Minus, Utensils, Coffee, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { formatPrice, calculateItemPrice } from '../utils/dateUtils';

interface CartContentProps {
  onCheckout: () => void;
}

const CartContent: React.FC<CartContentProps> = ({ onCheckout }) => {
  const { items, removeFromCart, updateQuantity, updateNotes } = useCart();
  const cartTotal = items.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  // Detecta escritura para compactar UI y liberar espacio en pantalla
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      setIsTyping(true);
      // Lleva el campo al centro de la vista para que el teclado no lo tape
      setTimeout(() => {
        try {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {}
      }, 50);
    };
    const onFocusOut = () => {
      // pequeño retraso para evitar parpadeos
      setTimeout(() => setIsTyping(false), 120);
    };

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-cream to-cream-light">
      {/* Contenedor scroll con padding inferior para que el footer sticky no tape contenido */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 md:space-y-6 p-4 md:p-6 pb-28 md:pb-6">
          <AnimatePresence mode="popLayout">
            {items.map((item, index) => {
              const itemPrice = calculateItemPrice(item);
              const isFood = item.categorias.some(cat =>
                ['almuerzo', 'cena', 'platos', 'principales', 'entradas', 'sopas'].includes(cat.toLowerCase())
              );
              const isDrink = item.categorias.some(cat =>
                ['bebidas', 'jugos', 'gaseosas', 'agua', 'hicopores'].includes(cat.toLowerCase())
              );

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-gradient-to-br from-white to-cream/50 rounded-3xl shadow-luxury hover:shadow-luxury-lg transition-all duration-300 overflow-hidden border-2 border-gold/10 hover:border-gold/30"
                >
                  <div className="p-4 md:p-6">
                    {/* Header con imagen, título y eliminar */}
                    <div className="flex gap-3 mb-3 md:mb-4">
                      <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                        <img
                          src={item.url_imagen || 'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg'}
                          alt={item.nombre}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1.5 md:mb-2">
                          <h4 className="font-bold text-wood-dark text-base md:text-lg leading-tight font-title line-clamp-2">
                            {item.nombre}
                          </h4>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => removeFromCart(item.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all shadow-md border border-red-200 hover:border-red-300"
                            aria-label="Eliminar del carrito"
                          >
                            <Trash2 size={16} />
                          </motion.button>
                        </div>

                        {/* Badge categoría */}
                        <div className="flex items-center gap-1.5 md:gap-2 mb-2">
                          <div className="flex items-center gap-1 bg-gradient-to-r from-gold/20 to-gold/10 px-2 py-0.5 rounded-full border border-gold/30">
                            {isFood ? (
                              <Utensils size={12} className="text-gold" />
                            ) : isDrink ? (
                              <Coffee size={12} className="text-gold" />
                            ) : (
                              <Star size={12} className="text-gold" />
                            )}
                            <span className="text-[11px] md:text-xs font-bold text-gold">
                              {isFood ? 'Plato' : isDrink ? 'Bebida' : 'Especial'}
                            </span>
                          </div>
                        </div>

                        {/* Precios */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] md:text-xs font-medium text-wood-medium">Precio:</span>
                            <span className="font-bold text-wood-dark text-sm">{formatPrice(item.valor)}</span>
                          </div>

                          <div className="flex justify-between items-center pt-1 border-t border-gold/20">
                            <span className="font-bold text-wood-dark text-sm">Total:</span>
                            <span className="text-lg font-bold text-gold">{formatPrice(itemPrice)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notas */}
                    <div className="mb-3 md:mb-4">
                      <textarea
                        placeholder="Notas especiales para este producto..."
                        value={item.notes || ''}
                        onChange={(e) => updateNotes(item.id, e.target.value)}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => setIsTyping(false)}
                        className="w-full text-[16px] md:text-sm p-3 md:p-3 border-2 border-wood-light/30 rounded-xl focus:ring-2 focus:ring-gold/50 focus:border-gold/50 resize-none transition-all shadow-inner"
                        rows={2}
                      />
                    </div>

                    {/* Cantidad */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-wood-dark text-sm">Cantidad:</span>
                      <div className="flex items-center gap-2.5 md:gap-3 bg-gradient-to-r from-wood-light/10 to-wood-light/5 rounded-xl p-1.5 border-2 border-wood-light/20 shadow-inner">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-2 rounded-lg bg-white hover:bg-wood-light/10 transition-all shadow-md border border-wood-light/20"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus size={14} className="text-wood-dark" />
                        </motion.button>
                        <span className="font-bold text-base md:text-lg w-10 md:w-12 text-center text-wood-dark">
                          {item.quantity}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-2 rounded-lg bg-white hover:bg-wood-light/10 transition-all shadow-md border border-wood-light/20"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus size={14} className="text-wood-dark" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer sticky: compacto y oculta tarjeta de total cuando se escribe */}
      <div
        className={`sticky bottom-0 z-20 border-t-2 border-gold/30 bg-gradient-to-r from-white/95 to-cream/95 backdrop-blur-sm ${
          isTyping ? 'p-2' : 'p-4'
        } space-y-3 md:space-y-4 shadow-luxury`}
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${isTyping ? '6px' : '12px'})` }}
      >
        {!isTyping && (
          <div className="bg-gradient-to-br from-gold/10 to-gold/5 rounded-2xl p-3 md:p-4 border-2 border-gold/30 shadow-inner">
            <div className="flex justify-between items-center mb-1">
              <span className="text-base md:text-lg font-bold text-wood-dark">Total del pedido:</span>
              <span className="text-xl md:text-2xl font-bold text-gold">{formatPrice(cartTotal)}</span>
            </div>
            <p className="text-xs md:text-sm text-wood-medium font-medium">
              {items.length} {items.length === 1 ? 'producto' : 'productos'} en tu carrito
            </p>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCheckout}
          className={`w-full bg-gradient-to-r from-gold to-gold/90 hover:from-gold/90 hover:to-gold text-white ${
            isTyping ? 'py-3' : 'py-4'
          } px-6 rounded-2xl font-bold text-base md:text-lg transition-all duration-300 flex items-center justify-center gap-3 shadow-luxury hover:shadow-glow-strong border-2 border-gold/30`}
        >
          <Utensils size={20} />
          <span>Continuar con el Pedido</span>
          <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            ✨
          </motion.div>
        </motion.button>
      </div>
    </div>
  );
};

export default CartContent;
