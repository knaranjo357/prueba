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
  
  const cartTotal = calculateTotalPrice(items);
  const deliveryPrice = selectedNeighborhood ? 
    deliveryAreas.find(area => area.barrio === selectedNeighborhood)?.precio || 0 : 0;

  const totalSteps = customerInfo.deliveryType === 'delivery' ? 4 : 3;

  // Load delivery areas when component mounts
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

  // Load saved customer info from localStorage
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

  // Save customer info to localStorage when it changes
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

  // Filtrar y ordenar barrios alfabéticamente
  const filteredNeighborhoods = useMemo(() => {
    return deliveryAreas
      .filter(neighborhood => 
        neighborhood.barrio.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.barrio.localeCompare(b.barrio, 'es', { sensitivity: 'base' }));
  }, [deliveryAreas, searchTerm]);

  const handleNeighborhoodSelect = (neighborhood: string) => {
    setSelectedNeighborhood(neighborhood);
    setCustomerInfo(prev => ({ ...prev, neighborhood, city: 'Bucaramanga' }));
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1: // Delivery type
        return true;
      case 2: // Personal info
        return customerInfo.name.trim() && customerInfo.phone.trim();
      case 3: // Address (only for delivery)
        if (customerInfo.deliveryType === 'pickup') return true;
        return customerInfo.address.trim() && selectedNeighborhood;
      case 4: // Payment method
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (canProceedToNext()) {
      if (currentStep === 2 && customerInfo.deliveryType === 'pickup') {
        setCurrentStep(4); // Skip address step for pickup
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep === 4 && customerInfo.deliveryType === 'pickup') {
      setCurrentStep(2); // Skip address step for pickup
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const isFormValid = () => {
    if (customerInfo.deliveryType === 'delivery') {
      return customerInfo.name.trim() && 
             customerInfo.phone.trim() && 
             customerInfo.address.trim() && 
             selectedNeighborhood;
    }
    return customerInfo.name.trim() && customerInfo.phone.trim();
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-cream to-cream-light">
      {/* Header minimalista */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gold/20 p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <motion.button
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="flex items-center gap-2 text-wood-dark hover:text-gold transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Volver</span>
          </motion.button>
          
          <div className="text-center">
            <p className="text-sm text-wood-medium">
              Paso {currentStep} de {totalSteps}
            </p>
          </div>
          
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Contenido principal - enfocado en los datos */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {/* Step 1: Delivery Type */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-6"
            >
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-wood-dark mb-2">¿Cómo prefieres tu pedido?</h3>
              </div>
              
              <div className="space-y-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setCustomerInfo(prev => ({ ...prev, deliveryType: 'delivery' }));
                    setTimeout(nextStep, 200);
                  }}
                  className={`w-full p-6 rounded-2xl flex items-center gap-4 transition-all duration-200 border-2 ${
                    customerInfo.deliveryType === 'delivery'
                      ? 'bg-gold text-white border-gold shadow-lg'
                      : 'bg-white border-gold/30 text-wood-dark hover:border-gold/50'
                  }`}
                >
                  <Truck size={32} />
                  <div className="text-left">
                    <div className="font-bold text-lg">Domicilio</div>
                    <div className="text-sm opacity-80">Entrega en tu dirección</div>
                  </div>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setCustomerInfo(prev => ({ ...prev, deliveryType: 'pickup' }));
                    setTimeout(nextStep, 200);
                  }}
                  className={`w-full p-6 rounded-2xl flex items-center gap-4 transition-all duration-200 border-2 ${
                    customerInfo.deliveryType === 'pickup'
                      ? 'bg-gold text-white border-gold shadow-lg'
                      : 'bg-white border-gold/30 text-wood-dark hover:border-gold/50'
                  }`}
                >
                  <Store size={32} />
                  <div className="text-left">
                    <div className="font-bold text-lg">Recoger en local</div>
                    <div className="text-sm opacity-80">Más rápido y sin costo adicional</div>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Personal Information */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-6"
            >
              <div className="text-center mb-8">
                <User size={48} className="text-gold mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-wood-dark mb-2">Tus datos</h3>
                <p className="text-wood-medium">Para contactarte sobre tu pedido</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-wood-dark font-medium mb-2">Nombre completo</label>
                  <input
                    type="text"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-4 border-2 border-wood-light/30 rounded-xl focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all text-lg"
                    placeholder="Tu nombre completo"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-wood-dark font-medium mb-2">Teléfono</label>
                  <input
                    type="tel"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-4 border-2 border-wood-light/30 rounded-xl focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all text-lg"
                    placeholder="300 123 4567"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Address (only for delivery) */}
          {currentStep === 3 && customerInfo.deliveryType === 'delivery' && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-6"
            >
              <div className="text-center mb-8">
                <MapPin size={48} className="text-gold mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-wood-dark mb-2">¿A dónde enviamos?</h3>
              </div>
              
              <div className="space-y-4">
                {/* Neighborhood Selection */}
                <div>
                  <label className="block text-wood-dark font-medium mb-2">
                    Barrio de entrega
                  </label>
                  
                  {/* Search bar */}
                  <div className="relative mb-3">
                    <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-wood-medium" />
                    <input
                      type="text"
                      placeholder="Buscar barrio..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-wood-light/30 rounded-xl focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all"
                    />
                  </div>

                  {/* Loading state */}
                  {loadingAreas && (
                    <div className="text-center py-4">
                      <p className="text-wood-medium">Cargando barrios...</p>
                    </div>
                  )}

                  {/* Neighborhoods list */}
                  {!loadingAreas && (
                    <div className="max-h-48 overflow-y-auto space-y-2">
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
                            <span className="font-medium">{neighborhood.barrio}</span>
                            <span className={`font-bold ${
                              selectedNeighborhood === neighborhood.barrio ? 'text-white' : 'text-gold'
                            }`}>
                              {formatPrice(neighborhood.precio)}
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Address Input */}
                {selectedNeighborhood && (
                  <div>
                    <label className="block text-wood-dark font-medium mb-2">Dirección completa</label>
                    <input
                      type="text"
                      value={customerInfo.address}
                      onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full p-4 border-2 border-wood-light/30 rounded-xl focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all text-lg"
                      placeholder="Calle 123 #45-67, Apto 101"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 4: Payment Method */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-6"
            >
              <div className="text-center mb-8">
                <CreditCard size={48} className="text-gold mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-wood-dark mb-2">¿Cómo pagas?</h3>
              </div>
              
              <div className="space-y-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'efectivo' }))}
                  className={`w-full p-6 rounded-2xl flex items-center gap-4 transition-all border-2 ${
                    customerInfo.paymentMethod === 'efectivo'
                      ? 'bg-gold text-white border-gold shadow-lg'
                      : 'bg-white border-gold/30 text-wood-dark hover:border-gold/50'
                  }`}
                >
                  <DollarSign size={32} />
                  <div className="text-left">
                    <div className="font-bold text-lg">Efectivo</div>
                    <div className="text-sm opacity-80">Pago al recibir</div>
                  </div>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'transferencia' }))}
                  className={`w-full p-6 rounded-2xl flex items-center gap-4 transition-all border-2 ${
                    customerInfo.paymentMethod === 'transferencia'
                      ? 'bg-gold text-white border-gold shadow-lg'
                      : 'bg-white border-gold/30 text-wood-dark hover:border-gold/50'
                  }`}
                >
                  <CreditCard size={32} />
                  <div className="text-left">
                    <div className="font-bold text-lg">Transferencia</div>
                    <div className="text-sm opacity-80">Pago anticipado</div>
                  </div>
                </motion.button>
              </div>

              {/* Transfer instructions - compactas */}
              {customerInfo.paymentMethod === 'transferencia' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-50 border border-blue-200 rounded-xl p-4"
                >
                  <p className="text-blue-700 font-medium text-center mb-2">
                    📱 Número: {restaurantConfig.nequi}
                  </p>
                  <p className="text-blue-600 text-sm text-center">
                    Envía el comprobante por WhatsApp
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer con navegación y total - compacto */}
      <div className="border-t border-gold/20 bg-white/90 backdrop-blur-sm p-4 flex-shrink-0">
        {/* Total compacto */}
        <div className="bg-gold/10 rounded-xl p-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="font-bold text-wood-dark">Total:</span>
            <span className="text-xl font-bold text-gold">
              {formatPrice(cartTotal + (customerInfo.deliveryType === 'delivery' ? deliveryPrice : 0))}
            </span>
          </div>
          {customerInfo.deliveryType === 'delivery' && deliveryPrice > 0 && (
            <div className="text-sm text-wood-medium mt-1">
              Incluye domicilio: {formatPrice(deliveryPrice)}
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3">
          {currentStep > 1 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={prevStep}
              className="px-6 py-3 bg-wood-light/20 hover:bg-wood-light/30 text-wood-dark rounded-xl font-medium transition-all"
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
              className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all ${
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
              className={`flex-1 flex items-center justify-center gap-3 py-3 px-6 rounded-xl font-bold transition-all ${
                isFormValid()
                  ? 'bg-gold hover:bg-gold/90 text-white shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send size={20} />
              Confirmar Pedido
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimplifiedCheckoutWizard;
