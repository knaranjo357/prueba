import React, { useEffect, useState } from 'react';
import { Trash2, Plus, Minus, Utensils, MessageSquare, ShoppingBag, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { formatPrice, calculateItemPrice } from '../utils/dateUtils';

interface CartContentProps {
  onCheckout: () => void;
}

const CartContent: React.FC<CartContentProps> = ({ onCheckout }) => {
  const { items, removeFromCart, updateQuantity, updateNotes } = useCart();
  const cartTotal = items.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  // Detecta escritura para compactar UI
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      setIsTyping(true);
      // Scroll suave para mantener el input visible
      setTimeout(() => {
        try {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {}
      }, 100);
    };
    const onFocusOut = () => setTimeout(() => setIsTyping(false), 150);

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  // --- ESTADO VACÍO ---
  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag size={40} className="text-gray-300" />
        </div>
        <h3 className="text-xl font-bold text-wood-dark mb-2">Tu carrito está vacío</h3>
        <p className="text-wood-medium mb-8 max-w-xs mx-auto">
          Parece que aún no has agregado nada delicioso a tu pedido.
        </p>
        {/* Nota: El botón de volver/cerrar suele estar en el componente padre (Cart) */}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* --- LISTA DE PRODUCTOS --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 pb-32 space-y-4">
          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              const itemPrice = calculateItemPrice(item);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-4"
                >
                  {/* Top Row: Imagen + Info + Delete */}
                  <div className="flex gap-4">
                    {/* Imagen */}
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                      <img
                        src={item.url_imagen || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg'}
                        alt={item.nombre}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-wood-dark text-base leading-tight line-clamp-2 mr-2">
                            {item.nombre}
                          </h4>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 -mr-2 -mt-2"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <p className="text-xs text-wood-medium mt-1 font-medium">
                          {formatPrice(item.valor)} c/u
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Notas (Input Style iOS) */}
                  <div className="relative group">
                    <div className="absolute left-3 top-3 text-gray-400">
                      <MessageSquare size={14} />
                    </div>
                    <textarea
                      value={item.notes || ''}
                      onChange={(e) => updateNotes(item.id, e.target.value)}
                      placeholder="¿Alguna indicación especial?"
                      rows={1}
                      className="w-full bg-gray-50 hover:bg-gray-100 focus:bg-white border border-transparent focus:border-gold/30 rounded-xl py-2.5 pl-9 pr-3 text-sm text-wood-dark placeholder-gray-400 resize-none transition-all outline-none"
                    />
                  </div>

                  {/* Bottom: Quantity Controls + Total Item Price */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    
                    {/* Quantity Stepper */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-wood-dark hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        <Minus size={14} />
                      </motion.button>
                      <span className="w-10 text-center font-bold text-wood-dark text-sm">
                        {item.quantity}
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm text-wood-dark hover:text-gold transition-colors"
                      >
                        <Plus size={14} />
                      </motion.button>
                    </div>

                    {/* Total Price for this item */}
                    <div className="text-right">
                      <span className="text-lg font-bold text-wood-dark">
                        {formatPrice(itemPrice)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* --- FOOTER STICKY --- */}
      <div 
        className={`bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-4 z-20 transition-all duration-300 ${isTyping ? 'pb-2' : 'pb-safe'}`}
        style={{ paddingBottom: isTyping ? '8px' : 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {!isTyping && (
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-wood-medium text-xs font-semibold uppercase tracking-wider">Total Estimado</p>
              <p className="text-xs text-gray-400 font-normal mt-0.5">No incluye domicilio</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-gold block leading-none">
                {formatPrice(cartTotal)}
              </span>
            </div>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCheckout}
          className={`w-full bg-wood-dark hover:bg-black text-white rounded-xl font-bold shadow-lg shadow-wood-dark/20 flex items-center justify-center gap-2 transition-all ${isTyping ? 'py-3 text-sm' : 'py-4 text-base'}`}
        >
          <Utensils size={18} />
          Continuar compra
          <ArrowRight size={18} className="opacity-60" />
        </motion.button>
      </div>
    </div>
  );
};

export default CartContent;