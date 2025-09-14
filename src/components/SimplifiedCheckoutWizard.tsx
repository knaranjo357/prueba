import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Truck, Store, Search, DollarSign, Send, CreditCard, User, MapPin } from 'lucide-react';
import { CustomerInfo } from '../types';
import { useCart } from '../context/CartContext';
import { formatPrice, calculateTotalPrice } from '../utils/dateUtils';
import { fetchDeliveryAreas } from '../api/deliveryApi';
import { restaurantConfig } from '../config/restaurantConfig';

interface SimplifiedCheckoutWizardProps {
  customerInfo: CustomerInfo;
  setCustomerInfo: (info: CustomerInfo) => void;
  onBack: () => void;
  onSubmit: (deliveryPrice: number) => void;
}

const SimplifiedCheckoutWizard: React.FC<SimplifiedCheckoutWizardProps> = ({
  customerInfo,
  setCustomerInfo,
  onBack,
  onSubmit
}) => {
  const { items } = useCart();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deliveryAreas, setDeliveryAreas] = useState<any[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(false);

  /** Detectar escritura/teclado para compactar UI */
  const [isTyping, setIsTyping] = useState(false);
  useEffect(() => {
    const onFocusIn = () => setIsTyping(true);
    const onFocusOut = () => setTimeout(() => setIsTyping(false), 120);
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const cartTotal = calculateTotalPrice(items);
  const deliveryPrice = selectedNeighborhood
    ? deliveryAreas.find(area => area.barrio === selectedNeighborhood)?.precio || 0
    : 0;

  const totalSteps = customerInfo.deliveryType === 'delivery' ? 4 : 3;

  useEffect(() => {
    const loadDeliveryAreas = async () => {
      try {
        setLoadingAreas(true);
        const areas = await fetchDeliveryAreas();
        setDeliveryAreas(areas);
      } catch (error) {
        console.error('Error loading delivery areas:', error);
      } finally {
        setLoadingAreas(false);
      }
    };
    loadDeliveryAreas();
  }, []);

  useEffect(() => {
    const savedInfo = localStorage.getItem('customerInfo');
    if (savedInfo) {
      try {
        const parsed = JSON.parse(savedInfo);
        setCustomerInfo(prev => ({
          ...prev,
          name: parsed.name || prev.name,
          phone: parsed.phone || prev.phone,
          address: parsed.address || prev.address,
          paymentMethod: parsed.paymentMethod || prev.paymentMethod
        }));
      } catch (error) {
        console.error('Error loading saved customer info:', error);
      }
    }
  }, [setCustomerInfo]);

  useEffect(() => {
    if (customerInfo.name || customerInfo.phone) {
      localStorage.setItem('customerInfo', JSON.stringify({
        name: customerInfo.name,
        phone: customerInfo.phone,
        address: customerInfo.address,
        paymentMethod: customerInfo.paymentMethod
      }));
    }
  }, [customerInfo]);

  const filteredNeighborhoods = useMemo(() => {
    return deliveryAreas
      .filter(neighborhood =>
        (neighborhood?.barrio || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (a?.barrio || '').localeCompare(b?.barrio || '', 'es', { sensitivity: 'base' }));
  }, [deliveryAreas, searchTerm]);

  const handleNeighborhoodSelect = (neighborhood: string) => {
    setSelectedNeighborhood(neighborhood);
    setCustomerInfo(prev => ({ ...prev, neighborhood, city: 'Bucaramanga' }));
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1: return true;
      case 2: return Boolean(customerInfo.name.trim() && customerInfo.phone.trim());
      case 3:
        if (customerInfo.deliveryType === 'pickup') return true;
        return Boolean(customerInfo.address.trim() && selectedNeighborhood);
      case 4: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (canProceedToNext()) {
      if (currentStep === 2 && customerInfo.deliveryType === 'pickup') {
        setCurrentStep(4);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep === 4 && customerInfo.deliveryType === 'pickup') {
      setCurrentStep(2);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const isFormValid = () => {
    if (customerInfo.deliveryType === 'delivery') {
      return Boolean(
        customerInfo.name.trim() &&
        customerInfo.phone.trim() &&
        customerInfo.address.trim() &&
        selectedNeighborhood
      );
    }
    return Boolean(customerInfo.name.trim() && customerInfo.phone.trim());
  };

  /** Asegura que el input quede visible al abrir teclado */
  const handleFieldFocus = (e: React.FocusEvent<HTMLElement>) => {
    try {
      e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {}
  };

  const showSectionTitles = !isTyping; // oculta títulos mientras se escribe (también en desktop)

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-cream to-cream-light touch-manipulation">
      {/* Header: totalmente oculto en móvil y también al escribir */}
      {showSectionTitles && (
        <div className="hidden md:block bg-white/90 backdrop-blur-sm border-b border-gold/20 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <motion.button
              whileHover={{ scale: 1.05, x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="flex items-center gap-2 text-wood-dark hover:text-gold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Volver</span>
            </motion.button>
            <div className="text-center">
              <p className="text-sm text-wood-medium">
                Paso {currentStep} de {totalSteps}
              </p>
            </div>
            <div className="w-16" />
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-24 md:pb-6">
        <AnimatePresence mode="wait">
          {/* Step 1 */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-3 md:space-y-6"
            >
              {/* Título oculto en móvil y al escribir */}
              {showSectionTitles && (
                <div className="hidden md:block text-center mb-4 md:mb-8">
                  <h3 className="text-2xl font-bold text-wood-dark mb-2">¿Cómo prefieres tu pedido?</h3>
                </div>
              )}

              <div className="space-y-2.5 md:space-y-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setCustomerInfo(prev => ({ ...prev, deliveryType: 'delivery' }));
                    setTimeout(nextStep, 200);
                  }}
                  className={`w-full p-3 md:p-6 rounded-2xl flex items-center gap-3 md:gap-4 transition-all duration-200 border-2 ${
                    customerInfo.deliveryType === 'delivery'
                      ? 'bg-gold text-white border-gold shadow-lg'
                      : 'bg-white border-gold/30 text-wood-dark hover:border-gold/50'
                  }`}
                >
                  <Truck className="w-6 h-6 md:w-8 md:h-8" />
                  <div className="text-left">
                    <div className="font-bold text-base md:text-lg">Domicilio</div>
                    <div className="text-xs md:text-sm opacity-80">Entrega en tu dirección</div>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setCustomerInfo(prev => ({ ...prev, deliveryType: 'pickup' }));
                    setTimeout(nextStep, 200);
                  }}
                  className={`w-full p-3 md:p-6 rounded-2xl flex items-center gap-3 md:gap-4 transition-all duration-200 border-2 ${
                    customerInfo.deliveryType === 'pickup'
                      ? 'bg-gold text-white border-gold shadow-lg'
                      : 'bg-white border-gold/30 text-wood-dark hover:border-gold/50'
                  }`}
                >
                  <Store className="w-6 h-6 md:w-8 md:h-8" />
                  <div className="text-left">
                    <div className="font-bold text-base md:text-lg">Recoger en local</div>
                    <div className="text-xs md:text-sm opacity-80">Más rápido y sin costo adicional</div>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 2 */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-3 md:space-y-6"
            >
              {showSectionTitles && (
                <div className="hidden md:block text-center mb-4 md:mb-8">
                  <User className="text-gold mx-auto mb-4 w-12 h-12" />
                  <h3 className="text-2xl font-bold text-wood-dark mb-2">Tus datos</h3>
                  <p className="text-wood-medium">Para contactarte sobre tu pedido</p>
                </div>
              )}

              <div className="space-y-2.5 md:space-y-4">
                <div>
                  <label className="block text-wood-dark font-medium mb-1.5 text-xs md:text-sm">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    inputMode="text"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                    onFocus={handleFieldFocus}
                    className="w-full px-4 py-2.5 md:p-4 border-2 border-wood-light/30 rounded-xl focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all text-[16px] md:text-lg scroll-mb-40"
                    placeholder="Tu nombre completo"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-wood-dark font-medium mb-1.5 text-xs md:text-sm">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    pattern="[0-9]*"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                    onFocus={handleFieldFocus}
                    className="w-full px-4 py-2.5 md:p-4 border-2 border-wood-light/30 rounded-xl focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all text-[16px] md:text-lg scroll-mb-40"
                    placeholder="300 123 4567"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3 */}
          {currentStep === 3 && customerInfo.deliveryType === 'delivery' && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-3 md:space-y-6"
            >
              {showSectionTitles && (
                <div className="hidden md:block text-center mb-4 md:mb-8">
                  <MapPin className="text-gold mx-auto mb-4 w-12 h-12" />
                  <h3 className="text-2xl font-bold text-wood-dark mb-2">¿A dónde enviamos?</h3>
                </div>
              )}

              <div className="space-y-2.5 md:space-y-4">
                {/* Barrio */}
                <div>
                  <label className="block text-wood-dark font-medium mb-1.5 text-xs md:text-sm">
                    Barrio de entrega
                  </label>

                  <div className="relative mb-2 md:mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-wood-medium w-5 h-5" />
                    <input
                      type="text"
                      inputMode="search"
                      placeholder="Buscar barrio..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={handleFieldFocus}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-wood-light/30 rounded-xl focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all text-[16px] scroll-mb-40"
                    />
                  </div>

                  {loadingAreas && (
                    <div className="text-center py-3">
                      <p className="text-wood-medium text-sm">Cargando barrios...</p>
                    </div>
                  )}

                  {!loadingAreas && (
                    <div className="max-h-40 md:max-h-64 overflow-y-auto space-y-2">
                      {filteredNeighborhoods.map(neighborhood => (
                        <motion.button
                          key={neighborhood.barrio}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handleNeighborhoodSelect(neighborhood.barrio)}
                          className={`w-full p-3 rounded-xl text-left transition-all border-2 ${
                            selectedNeighborhood === neighborhood.barrio
                              ? 'bg-gold text-white border-gold'
                              : 'bg-white hover:bg-gold/10 text-wood-dark border-transparent hover:border-gold/30'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm md:text-base">{neighborhood.barrio}</span>
                            <span className={`font-bold ${selectedNeighborhood === neighborhood.barrio ? 'text-white' : 'text-gold'}`}>
                              {formatPrice(neighborhood.precio)}
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dirección */}
                {selectedNeighborhood && (
                  <div>
                    <label className="block text-wood-dark font-medium mb-1.5 text-xs md:text-sm">
                      Dirección completa
                    </label>
                    <input
                      type="text"
                      inputMode="text"
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                      onFocus={handleFieldFocus}
                      className="w-full px-4 py-2.5 md:p-4 border-2 border-wood-light/30 rounded-xl focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all text-[16px] md:text-lg scroll-mb-40"
                      placeholder="Calle 123 #45-67, Apto 101"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 4 */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-3 md:space-y-6"
            >
              {showSectionTitles && (
                <div className="hidden md:block text-center mb-4 md:mb-8">
                  <CreditCard className="text-gold mx-auto mb-4 w-12 h-12" />
                  <h3 className="text-2xl font-bold text-wood-dark mb-2">¿Cómo pagas?</h3>
                </div>
              )}

              <div className="space-y-2.5 md:space-y-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'efectivo' }))}
                  className={`w-full p-3 md:p-6 rounded-2xl flex items-center gap-3 md:gap-4 transition-all border-2 ${
                    customerInfo.paymentMethod === 'efectivo'
                      ? 'bg-gold text-white border-gold shadow-lg'
                      : 'bg-white border-gold/30 text-wood-dark hover:border-gold/50'
                  }`}
                >
                  <DollarSign className="w-6 h-6 md:w-8 md:h-8" />
                  <div className="text-left">
                    <div className="font-bold text-base md:text-lg">Efectivo</div>
                    <div className="text-xs md:text-sm opacity-80">Pago al recibir</div>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'transferencia' }))}
                  className={`w-full p-3 md:p-6 rounded-2xl flex items-center gap-3 md:gap-4 transition-all border-2 ${
                    customerInfo.paymentMethod === 'transferencia'
                      ? 'bg-gold text-white border-gold shadow-lg'
                      : 'bg-white border-gold/30 text-wood-dark hover:border-gold/50'
                  }`}
                >
                  <CreditCard className="w-6 h-6 md:w-8 md:h-8" />
                  <div className="text-left">
                    <div className="font-bold text-base md:text-lg">Transferencia</div>
                    <div className="text-xs md:text-sm opacity-80">Pago anticipado</div>
                  </div>
                </motion.button>
              </div>

              {customerInfo.paymentMethod === 'transferencia' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4"
                >
                  <p className="text-blue-700 font-medium text-center mb-1 md:mb-2">
                    📱 Número: {restaurantConfig.nequi}
                  </p>
                  <p className="text-blue-600 text-xs md:text-sm text-center">
                    Envía el comprobante por WhatsApp
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer compacto y “keyboard-aware” */}
      <div
        className={`border-t border-gold/20 bg-white/90 backdrop-blur-sm ${isTyping ? 'p-2' : 'p-3 md:p-4'} flex-shrink-0 sticky bottom-0`}
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${isTyping ? '6px' : '12px'})` }}
      >
        {/* Total: oculto mientras se escribe para ganar espacio */}
        {!isTyping && (
          <div className="bg-gold/10 rounded-xl p-3 mb-3 md:mb-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-wood-dark text-sm md:text-base">Total:</span>
              <span className="text-lg md:text-xl font-bold text-gold">
                {formatPrice(cartTotal + (customerInfo.deliveryType === 'delivery' ? deliveryPrice : 0))}
              </span>
            </div>
            {customerInfo.deliveryType === 'delivery' && deliveryPrice > 0 && (
              <div className="text-xs md:text-sm text-wood-medium mt-1">
                Incluye domicilio: {formatPrice(deliveryPrice)}
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2 md:gap-3">
          {currentStep > 1 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={prevStep}
              className={`px-4 ${isTyping ? 'py-1.5' : 'py-2'} md:px-6 md:py-3 bg-wood-light/20 hover:bg-wood-light/30 text-wood-dark rounded-xl font-medium transition-all text-sm md:text-base`}
            >
              Anterior
            </motion.button>
          )}

          {currentStep < totalSteps ? (
            <motion.button
              whileHover={canProceedToNext() ? { scale: 1.02 } : {}}
              whileTap={canProceedToNext() ? { scale: 0.98 } : {}}
              onClick={nextStep}
              disabled={!canProceedToNext()}
              className={`flex-1 ${isTyping ? 'py-2' : 'py-2'} md:py-3 rounded-xl font-bold transition-all text-sm md:text-base ${
                canProceedToNext()
                  ? 'bg-gold hover:bg-gold/90 text-white shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Continuar
            </motion.button>
          ) : (
            <motion.button
              whileHover={isFormValid() ? { scale: 1.02 } : {}}
              whileTap={isFormValid() ? { scale: 0.98 } : {}}
              onClick={() => onSubmit(deliveryPrice)}
              disabled={!isFormValid()}
              className={`flex-1 flex items-center justify-center gap-2 md:gap-3 ${isTyping ? 'py-2' : 'py-2'} md:py-3 rounded-xl font-bold transition-all text-sm md:text-base ${
                isFormValid()
                  ? 'bg-gold hover:bg-gold/90 text-white shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
              Confirmar Pedido
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimplifiedCheckoutWizard;
