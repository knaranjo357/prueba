import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Plus, Minus, MessageSquare, ShoppingBag } from 'lucide-react';
import { motion } from 'framer-motion';
import { MenuItem } from '../types';
import { formatPrice } from '../utils/dateUtils';
import { useCart } from '../context/CartContext';

interface MenuItemModalProps {
  item: MenuItem;
  isOpen: boolean;
  onClose: () => void;
}

const MenuItemModal: React.FC<MenuItemModalProps> = ({ item, isOpen, onClose }) => {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const { addToCart } = useCart();

  // Resetear estado al abrir un nuevo item
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setNotes('');
    }
  }, [isOpen, item]);

  const itemPrice = item.valor;
  const takeawayCost = (item.isForTakeaway && item.precio_adicional_llevar) ? item.precio_adicional_llevar : 0;
  const totalPrice = (itemPrice + takeawayCost) * quantity;

  const handleAddToCart = () => {
    addToCart({ ...item }, quantity, notes);
    onClose();
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Overlay oscuro con blur */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-wood-dark/60 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          {/* Centrado en desktop, pegado abajo en mobile */}
          <div className="flex min-h-full items-end justify-center text-center sm:items-center sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="translate-y-full opacity-0 sm:translate-y-0 sm:scale-95"
              enterTo="translate-y-0 opacity-100 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="translate-y-0 opacity-100 sm:scale-100"
              leaveTo="translate-y-full opacity-0 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-lg transform overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white text-left shadow-2xl transition-all flex flex-col max-h-[90vh]">
                
                {/* --- HEADER: IMAGEN --- */}
                <div className="relative h-56 sm:h-64 shrink-0">
                  {/* Botón cerrar flotante */}
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-white hover:text-wood-dark transition-all shadow-lg"
                  >
                    <X size={20} />
                  </button>

                  {/* Imagen */}
                  <img
                    src={item.url_imagen || 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'}
                    alt={item.nombre}
                    className="h-full w-full object-cover"
                  />
                  
                  {/* Gradiente inferior para legibilidad */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Badges sobre la imagen */}
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                    <div className="flex gap-2">
                      {!item.disponible && (
                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-red-500 text-white shadow-sm">
                          Agotado
                        </span>
                      )}
                      {item.categorias && item.categorias[0] && (
                        <span className="px-3 py-1 rounded-lg text-xs font-bold bg-gold text-white shadow-sm uppercase tracking-wider">
                          {item.categorias[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* --- BODY: CONTENIDO SCROLLEABLE --- */}
                <div className="flex-1 overflow-y-auto p-5 pb-32 sm:pb-28 custom-scrollbar">
                  <div className="flex justify-between items-start mb-2">
                    <Dialog.Title as="h3" className="text-2xl font-bold text-wood-dark leading-tight">
                      {item.nombre}
                    </Dialog.Title>
                    <div className="flex flex-col items-end pl-4">
                       <span className="text-xl font-bold text-gold">
                        {formatPrice(item.valor)}
                      </span>
                    </div>
                  </div>

                  <div className="mb-6">
                    {item.descripcion ? (
                      <p className="text-wood-medium text-sm leading-relaxed">
                        {item.descripcion}
                      </p>
                    ) : (
                      <p className="text-gray-400 text-sm italic">Sin descripción disponible.</p>
                    )}
                  </div>

                  {/* Sección de Notas */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-wood-dark">
                      <MessageSquare size={16} className="text-gold" />
                      Instrucciones especiales
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ej: Sin cebolla, salsa aparte..."
                      rows={3}
                      className="w-full p-4 rounded-xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-gold/30 focus:ring-0 transition-all text-sm resize-none placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* --- FOOTER: ACCIONES (STICKY) --- */}
                {/* Este bloque siempre está visible abajo */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10">
                  <div className="flex items-center gap-4">
                    
                    {/* Selector Cantidad Compacto */}
                    <div className="flex items-center bg-gray-100 rounded-xl p-1.5 shrink-0">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={!item.disponible || quantity <= 1}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                          quantity <= 1 ? 'text-gray-300' : 'bg-white text-wood-dark shadow-sm hover:text-red-500'
                        }`}
                      >
                        <Minus size={18} />
                      </motion.button>
                      
                      <span className="w-8 text-center font-bold text-lg text-wood-dark tabular-nums">
                        {quantity}
                      </span>
                      
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setQuantity(quantity + 1)}
                        disabled={!item.disponible}
                        className="w-10 h-10 flex items-center justify-center rounded-lg bg-white text-wood-dark shadow-sm hover:text-gold transition-colors"
                      >
                        <Plus size={18} />
                      </motion.button>
                    </div>

                    {/* Botón Agregar con Precio Total */}
                    <motion.button
                      whileHover={item.disponible ? { scale: 1.02 } : {}}
                      whileTap={item.disponible ? { scale: 0.98 } : {}}
                      onClick={handleAddToCart}
                      disabled={!item.disponible}
                      className={`flex-1 flex items-center justify-between px-6 py-4 rounded-xl font-bold text-white shadow-lg transition-all ${
                        item.disponible
                          ? 'bg-gradient-to-r from-gold to-gold/90 hover:shadow-gold/30'
                          : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm md:text-base">
                        {item.disponible ? 'Agregar' : 'No disponible'}
                      </span>
                      {item.disponible && (
                        <span className="bg-white/20 px-2 py-1 rounded text-sm">
                          {formatPrice(totalPrice)}
                        </span>
                      )}
                    </motion.button>
                  </div>
                </div>

              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default MenuItemModal;