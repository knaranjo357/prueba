import React, { useState } from 'react';
import { ShoppingBag, X, ArrowLeft, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { formatPrice, calculateTotalPrice } from '../utils/dateUtils';
import { CustomerInfo } from '../types';
import CartContent from './CartContent';
import SimplifiedCheckoutWizard from './SimplifiedCheckoutWizard';

const Cart: React.FC = () => {
  const { items } = useCart();
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

  const resetCart = () => {
    setIsOpen(false);
    setStep('cart');
    setCustomerInfo({
      name: '',
      phone: '',
      address: '',
      city: '',
      paymentMethod: 'efectivo',
      deliveryType: 'delivery'
    });
  };

  const handleSubmitOrder = async (deliveryPrice: number) => {
    try {
      // Format order details like the API expects
      const detalleItems = items.map(item => {
        const itemPrice = item.valor + (item.isForTakeaway && item.precio_adicional_llevar ? item.precio_adicional_llevar : 0);
        return `- ${item.quantity},${item.nombre} ,${itemPrice}`;
      }).join(';') + ';';
      
      const orderData = {
        fecha: new Date().toLocaleString('es-CO', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/, '$3-$2-$1 $4:$5:$6'),
        nombre: customerInfo.name,
        numero: `57${customerInfo.phone.replace(/\D/g, '')}@s.whatsapp.net`,
        direccion: customerInfo.deliveryType === 'delivery' ? customerInfo.address : 'Recoger en local',
        "detalle pedido": detalleItems,
        valor_restaurante: calculateTotalPrice(items),
        valor_domicilio: deliveryPrice,
        metodo_pago: customerInfo.paymentMethod,
        estado: 'confirmado'
      };

      const response = await fetch('https://n8n.alliasoft.com/webhook/luis-res/hacer-pedido', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              resetCart();
            }
          }}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-gradient-to-br from-cream to-cream-light flex flex-col h-full"
          >
            {/* Header simplificado */}
            <div className="bg-white backdrop-blur-xl border-b-2 border-gold/30 sticky top-0 z-10 shadow-luxury">
              <div className="p-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    {step === 'checkout' && (
                      <motion.button
                        whileHover={{ scale: 1.1, x: -2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setStep('cart')}
                        className="p-3 hover:bg-gold/10 rounded-2xl transition-all border-2 border-transparent hover:border-gold/30"
                      >
                        <ArrowLeft size={24} className="text-wood-dark" />
                      </motion.button>
                    )}
                    <div>
                      <h3 className="text-3xl font-bold text-wood-dark font-title flex items-center gap-3">
                        {step === 'cart' ? (
                          <>
                            <div className="p-2 bg-gold/20 rounded-xl">
                              <ShoppingBag size={28} className="text-gold" />
                            </div>
                            Tu Pedido
                          </>
                        ) : (
                          <>
                            <div className="p-2 bg-gold/20 rounded-xl">
                              <Sparkles size={28} className="text-gold" />
                            </div>
                            Datos de Entrega
                          </>
                        )}
                      </h3>
                      {step === 'cart' && (
                        <p className="text-wood-medium text-lg font-medium">
                          {items.length} {items.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                        </p>
                      )}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={resetCart}
                    className="text-wood-dark/60 hover:text-wood-dark hover:bg-gold/10 transition-all p-3 rounded-2xl border-2 border-transparent hover:border-gold/30"
                  >
                    <X size={28} />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {step === 'cart' && (
                  <motion.div
                    key="cart"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
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
                    transition={{ duration: 0.3 }}
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="h-full flex items-center justify-center p-6"
                  >
                    <div className="bg-white rounded-3xl shadow-luxury p-8 max-w-md w-full text-center">
                      <div className="mb-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Sparkles size={40} className="text-green-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-wood-dark mb-2">
                          ¡Pedido Enviado!
                        </h3>
                        <p className="text-wood-medium">
                          Tu pedido ha sido pasado a cocina. ¡Muchas gracias!
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left">
                        <h4 className="font-bold text-wood-dark mb-3">Resumen del Pedido:</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Cliente:</span>
                            <span className="font-medium">{customerInfo.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Teléfono:</span>
                            <span className="font-medium">{customerInfo.phone}</span>
                          </div>
                          {customerInfo.deliveryType === 'delivery' && (
                            <div className="flex justify-between">
                              <span>Dirección:</span>
                              <span className="font-medium text-xs">{customerInfo.address}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>Tipo:</span>
                            <span className="font-medium">
                              {customerInfo.deliveryType === 'delivery' ? 'Domicilio' : 'Recoger en local'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Pago:</span>
                            <span className="font-medium">
                              {customerInfo.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                            </span>
                          </div>
                          <div className="border-t pt-2 flex justify-between font-bold text-gold">
                            <span>Total:</span>
                            <span>{formatPrice(calculateTotalPrice(items) + (customerInfo.deliveryType === 'delivery' ? 5000 : 0))}</span>
                          </div>
                        </div>
                      </div>

                      {customerInfo.paymentMethod === 'transferencia' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                          <h4 className="font-bold text-blue-800 mb-2">Información de Pago</h4>
                          <p className="text-blue-700 text-sm mb-3">
                            Por favor realiza la transferencia y envía el comprobante al siguiente número:
                          </p>
                          <a
                            href="https://wa.me/573166193963"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                          >
                            📱 3166193963
                          </a>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          resetCart();
                          window.location.reload();
                        }}
                        className="w-full bg-gold hover:bg-gold/90 text-white font-bold py-3 px-6 rounded-2xl transition-colors"
                      >
                        Realizar Otro Pedido
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Enhanced Floating Cart Button */}
      <motion.button
        whileHover={{ scale: 1.1, y: -5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-40 ${
          items.length > 0
            ? 'bg-gradient-to-r from-gold to-gold/90 hover:from-gold/90 hover:to-gold text-white shadow-luxury hover:shadow-glow-strong'
            : 'bg-wood-dark/50 text-cream/50 cursor-not-allowed'
        } p-5 rounded-3xl transition-all duration-300 border-2 ${
          items.length > 0 ? 'border-gold/30' : 'border-wood-dark/30'
        }`}
        disabled={items.length === 0}
      >
        <div className="relative">
          <ShoppingBag size={32} />
          {items.length > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-3 -right-3 bg-red-500 text-white text-sm w-7 h-7 rounded-full flex items-center justify-center font-bold shadow-lg border-2 border-white"
            >
              {items.length}
            </motion.span>
          )}
        </div>
      </motion.button>
    </AnimatePresence>
  );
};

export default Cart;
