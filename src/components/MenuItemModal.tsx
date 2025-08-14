import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Plus, Minus } from 'lucide-react';
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

  const totalPrice = item.valor * quantity;

  const handleAddToCart = () => {
    addToCart({ ...item, isForTakeaway: true }, quantity, notes);
    onClose();
    setQuantity(1);
    setNotes('');
  };

  const resetAndClose = () => {
    setQuantity(1);
    setNotes('');
    onClose();
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={resetAndClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-full sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-full sm:scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-t-xl sm:rounded-xl bg-white shadow-xl transition-all">
                {/* Header */}
                <div className="relative">
                  <button
                    onClick={resetAndClose}
                    className="absolute right-4 top-4 z-10 p-2 rounded-full bg-black/20 text-white hover:bg-black/40 transition-all"
                  >
                    <X size={18} />
                  </button>

                  <div className="relative aspect-[16/9] w-full overflow-hidden">
                    <img
                      src={item.url_imagen || 'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg'}
                      alt={item.nombre}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    
                    <div className="absolute bottom-4 right-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                        item.disponible 
                          ? 'bg-green-500 text-white' 
                          : 'bg-red-500 text-white'
                      }`}>
                        {item.disponible ? 'Disponible' : 'Agotado'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div>
                    <Dialog.Title className="text-xl font-bold text-wood-dark mb-2">
                      {item.nombre}
                    </Dialog.Title>
                    
                    {item.descripcion && (
                      <p className="text-wood-medium text-sm leading-relaxed">
                        {item.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-wood-dark">Precio:</span>
                      <span className="text-lg font-bold text-wood-dark">
                        {formatPrice(item.valor)}
                      </span>
                    </div>
                    
                    {item.precio_adicional_llevar && item.precio_adicional_llevar > 0 && (
                      <div className="flex items-center justify-between text-sm text-amber-600">
                        <span>Recargo para llevar:</span>
                        <span className="font-medium">+{formatPrice(item.precio_adicional_llevar!)}</span>
                      </div>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-wood-dark">Cantidad:</span>
                    <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="p-2 rounded-md bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="font-bold text-lg w-12 text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="p-2 rounded-md bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-gold">{formatPrice(totalPrice)}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-wood-dark mb-2">
                      Notas (opcional)
                    </label>
                    <textarea
                      placeholder="Indicaciones especiales..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all text-sm"
                      rows={2}
                    />
                  </div>

                  {/* Add to cart button */}
                  <button
                    onClick={handleAddToCart}
                    disabled={!item.disponible}
                    className={`w-full py-3 px-6 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                      item.disponible
                        ? 'bg-gold hover:bg-gold/90 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus size={18} />
                    {item.disponible ? 'Agregar al Pedido' : 'No Disponible'}
                  </button>
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