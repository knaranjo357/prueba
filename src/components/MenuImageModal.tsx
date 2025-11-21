import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, ZoomIn } from 'lucide-react';
import { motion } from 'framer-motion';

interface MenuImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
}

const MenuImageModal: React.FC<MenuImageModalProps> = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  title 
}) => {
  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[60]">
        
        {/* Backdrop con blur */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-wood-dark/80 backdrop-blur-md" />
        </Transition.Child>

        {/* Modal Container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <Dialog.Panel className="relative w-full max-w-4xl bg-transparent shadow-2xl transition-all">
                
                {/* Botón Cerrar Flotante */}
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="absolute -top-12 right-0 md:-right-12 text-white/80 hover:text-white p-2 transition-colors"
                >
                  <X size={32} />
                </motion.button>
                
                {/* Contenedor de Imagen Estilo Marco */}
                <div className="bg-white p-2 md:p-3 rounded-2xl shadow-2xl overflow-hidden">
                  <div className="relative bg-gray-100 rounded-xl overflow-hidden">
                    <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                      <ZoomIn size={12} />
                      <span>Pellizca para ver más</span>
                    </div>
                    
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-auto max-h-[80vh] object-contain"
                      loading="eager"
                    />
                  </div>
                  
                  <div className="mt-3 text-center">
                    <h3 className="text-lg font-bold text-wood-dark">{title}</h3>
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

export default MenuImageModal;