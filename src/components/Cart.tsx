import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, ArrowLeft, Sparkles, CheckCircle2, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { formatPrice, calculateTotalPrice } from '../utils/dateUtils';
import { CustomerInfo } from '../types';
import CartContent from './CartContent';
import SimplifiedCheckoutWizard from './SimplifiedCheckoutWizard';

const Cart: React.FC = () => {
  const { items, clearCart } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    address: '',
    city: '',
    paymentMethod: 'efectivo',
    deliveryType: 'delivery'
  });

  // Bloquear scroll del body cuando el carrito está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const resetCart = () => {
    setIsOpen(false);
    setTimeout(() => {
      setStep('cart');
      setCustomerInfo({
        name: '',
        phone: '',
        address: '',
        city: '',
        paymentMethod: 'efectivo',
        deliveryType: 'delivery'
      });
    }, 300);
  };

  const handleSuccessClose = () => {
    clearCart(); // Limpiar carrito visualmente
    resetCart();
    window.location.reload();
  };

  const handleSubmitOrder = async (deliveryPrice: number) => {
    try {
      const detalleItems =
        items
          .map(item => {
            const itemPrice =
              item.valor + (item.isForTakeaway && item.precio_adicional_llevar ? item.precio_adicional_llevar : 0);
            return `- ${item.quantity}x ${item.nombre} (${formatPrice(itemPrice)})`;
          })
          .join('\n');

      const orderData = {
        fecha: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
        nombre: customerInfo.name,
        numero: `57${customerInfo.phone.replace(/\D/g, '')}@s.whatsapp.net`,
        direccion: customerInfo.deliveryType === 'delivery' ? customerInfo.address : 'Recoger en local',
        'detalle pedido': detalleItems,
        valor_restaurante: calculateTotalPrice(items),
        valor_domicilio: deliveryPrice,
        metodo_pago: customerInfo.paymentMethod,
        estado: 'confirmado'
      };

      const response = await fetch('https://n8n.alliasoft.com/webhook/luis-res/hacer-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        setStep('success');
      } else {
        throw new Error('Error al enviar el pedido');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('Error al enviar el pedido. Por favor intente nuevamente.');
    }
  };

  // Variantes de animación para el panel (Drawer vs Sheet)
  const isMobile = window.innerWidth < 768;
  const panelVariants = {
    hidden: { 
      x: isMobile ? 0 : '100%', 
      y: isMobile ? '100%' : 0,
      opacity: 0 
    },
    visible: { 
      x: 0, 
      y: 0,
      opacity: 1,
      transition: { type: "spring", damping: 25, stiffness: 200 }
    },
    exit: { 
      x: isMobile ? 0 : '100%', 
      y: isMobile ? '100%' : 0,
      opacity: 0,
      transition: { duration: 0.3 }
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end items-end md:items-stretch">
            {/* Backdrop (Fondo Oscuro) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetCart}
              className="absolute inset-0 bg-wood-dark/60 backdrop-blur-sm"
            />

            {/* Main Panel */}
            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative w-full md:max-w-md h-[92vh] md:h-full bg-gray-50 rounded-t-3xl md:rounded-none shadow-2xl flex flex-col overflow-hidden z-10"
            >
              {/* Header */}
              <div className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20 px-4 py-4 md:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {step === 'checkout' && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setStep('cart')}
                        className="p-2 rounded-full hover:bg-gray-100 text-wood-dark transition-colors"
                      >
                        <ArrowLeft size={20} />
                      </motion.button>
                    )}
                    
                    <div>
                      <h2 className="text-xl font-bold text-wood-dark flex items-center gap-2">
                        {step === 'cart' && 'Tu Pedido'}
                        {step === 'checkout' && 'Finalizar'}
                        {step === 'success' && '¡Listo!'}
                      </h2>
                      {step === 'cart' && (
                        <p className="text-xs text-wood-medium font-medium">
                          {items.length} items en el carrito
                        </p>
                      )}
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={resetCart}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-wood-medium hover:text-wood-dark transition-colors"
                  >
                    <X size={20} />
                  </motion.button>
                </div>
              </div>

              {/* Content Body */}
              <div className="flex-1 overflow-hidden relative bg-gray-50">
                <AnimatePresence mode="wait">
                  {step === 'cart' && (
                    <motion.div
                      key="cart"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="h-full"
                    >
                      <CartContent onCheckout={() => setStep('checkout')} />
                    </motion.div>
                  )}

                  {step === 'checkout' && (
                    <motion.div
                      key="checkout"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="h-full"
                    >
                      <SimplifiedCheckoutWizard
                        customerInfo={customerInfo}
                        setCustomerInfo={setCustomerInfo}
                        onBack={() => setStep('cart')}
                        onSubmit={handleSubmitOrder}
                      />
                    </motion.div>
                  )}

                  {step === 'success' && (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="h-full flex flex-col items-center justify-center p-6 overflow-y-auto"
                    >
                      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-xl border border-gray-100 relative">
                        {/* Decoración estilo ticket */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-gray-50 rounded-full border-b border-gray-200" />
                        
                        <div className="text-center mb-6">
                          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <CheckCircle2 size={32} />
                          </div>
                          <h3 className="text-2xl font-bold text-wood-dark">¡Pedido Confirmado!</h3>
                          <p className="text-wood-medium text-sm mt-1">
                            Hemos recibido tu orden y ya estamos preparándola.
                          </p>
                        </div>

                        {/* Detalles del Recibo */}
                        <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-dashed border-gray-200">
                          <div className="flex items-center gap-2 mb-3 text-wood-dark font-bold border-b border-gray-200 pb-2">
                            <Receipt size={16} className="text-gold" />
                            Resumen
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-wood-medium">Cliente</span>
                              <span className="font-medium text-wood-dark">{customerInfo.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-wood-medium">Entrega</span>
                              <span className="font-medium text-wood-dark capitalize">
                                {customerInfo.deliveryType === 'delivery' ? 'Domicilio' : 'Recoger'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-wood-medium">Método de Pago</span>
                              <span className="font-medium text-wood-dark capitalize">{customerInfo.paymentMethod}</span>
                            </div>
                            
                            <div className="border-t border-gray-200 my-2 pt-2 flex justify-between items-center">
                              <span className="font-bold text-wood-dark">Total</span>
                              <span className="font-bold text-xl text-gold">
                                {formatPrice(calculateTotalPrice(items) + (customerInfo.deliveryType === 'delivery' ? 5000 : 0))} 
                                {/* Nota: El valor 5000 es placeholder, idealmente traerlo del step anterior si se pudiera, o recalcularlo */}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={handleSuccessClose}
                          className="w-full bg-wood-dark hover:bg-black text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-wood-dark/20 flex items-center justify-center gap-2"
                        >
                          <Sparkles size={18} />
                          Hacer nuevo pedido
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BOTÓN FLOTANTE (FAB) */}
      <AnimatePresence>
        {!isOpen && items.length > 0 && (
          <motion.button
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-4 md:right-8 z-40 flex items-center gap-3 pl-4 pr-5 py-3 bg-wood-dark text-white rounded-full shadow-2xl shadow-wood-dark/40 border border-white/10 hover:bg-black transition-colors group"
          >
            <div className="relative">
              <ShoppingBag size={24} className="text-gold" />
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-wood-dark">
                {items.length}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-none mb-0.5">
                Total
              </span>
              <span className="font-bold text-base leading-none">
                {formatPrice(calculateTotalPrice(items))}
              </span>
            </div>
            
            {/* Glow Effect */}
            <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-gold/50 transition-all" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default Cart;