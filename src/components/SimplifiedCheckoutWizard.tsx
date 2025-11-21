import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Truck, Store, Search, DollarSign, Send, CreditCard, User, MapPin, Check, ChevronRight } from 'lucide-react';
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
  const [isTyping, setIsTyping] = useState(false);

  // Detectar teclado en móviles
  useEffect(() => {
    const onFocusIn = () => setIsTyping(true);
    const onFocusOut = () => setTimeout(() => setIsTyping(false), 150); // Un poco más de delay para evitar saltos
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
  const progressPercentage = (currentStep / totalSteps) * 100;

  // Cargar áreas
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

  // LocalStorage Logic
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

  // Filtrado de barrios
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

  // Validaciones
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

  const handleFieldFocus = (e: React.FocusEvent<HTMLElement>) => {
    try {
      e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {}
  };

  // Componente reutilizable para Inputs estilo App Moderna
  const InputField = ({ label, icon: Icon, ...props }: any) => (
    <div className="group">
      <label className="block text-xs font-bold text-wood-medium mb-1.5 uppercase tracking-wide ml-1">
        {label}
      </label>
      <div className="relative flex items-center">
        {Icon && <Icon className="absolute left-4 text-wood-medium/50 group-focus-within:text-gold transition-colors w-5 h-5" />}
        <input
          onFocus={handleFieldFocus}
          className={`w-full ${Icon ? 'pl-12' : 'pl-4'} pr-4 py-3.5 rounded-2xl bg-gray-100 border-2 border-transparent focus:bg-white focus:border-gold/50 focus:ring-0 transition-all text-wood-dark font-medium placeholder-wood-medium/40 text-base shadow-sm`}
          {...props}
        />
      </div>
    </div>
  );

  // Componente para Tarjetas de Selección (Delivery/Pickup/Pago)
  const SelectionCard = ({ selected, onClick, icon: Icon, title, subtitle }: any) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-200 border-2 relative overflow-hidden ${
        selected
          ? 'bg-white border-gold shadow-gold/20 shadow-lg'
          : 'bg-white border-gray-100 hover:border-gold/30 text-wood-medium shadow-sm'
      }`}
    >
      {selected && (
        <div className="absolute top-0 right-0 bg-gold text-white p-1 rounded-bl-xl">
          <Check size={12} />
        </div>
      )}
      <div className={`p-3 rounded-xl ${selected ? 'bg-gold/10 text-gold' : 'bg-gray-100 text-wood-medium'}`}>
        <Icon size={24} />
      </div>
      <div className="text-left flex-1">
        <div className={`font-bold text-lg ${selected ? 'text-wood-dark' : 'text-wood-dark/80'}`}>{title}</div>
        <div className="text-xs opacity-80">{subtitle}</div>
      </div>
    </motion.button>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      
      {/* --- HEADER STICKY --- */}
      {/* Visible siempre para mejor navegación */}
      <div className={`bg-white/80 backdrop-blur-md border-b border-gray-100 flex-shrink-0 sticky top-0 z-20 transition-all ${isTyping ? 'py-2' : 'py-3'}`}>
        <div className="max-w-md mx-auto px-4 w-full">
          <div className="flex items-center justify-between mb-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-wood-dark transition-colors"
            >
              <ArrowLeft size={20} />
            </motion.button>
            
            <h2 className="font-bold text-wood-dark text-lg">
              {currentStep === 1 && "Tipo de Entrega"}
              {currentStep === 2 && "Tus Datos"}
              {currentStep === 3 && "Dirección"}
              {currentStep === 4 && "Pago"}
            </h2>
            
            <div className="w-8 text-right text-xs font-medium text-gold">
              {currentStep}/{totalSteps}
            </div>
          </div>
          
          {/* Barra de Progreso */}
          <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gold"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>

      {/* --- CONTENIDO SCROLLEABLE --- */}
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-md mx-auto w-full min-h-[300px]">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: Delivery Type */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4 py-4"
              >
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-wood-dark">¿Cómo quieres tu pedido?</h3>
                  <p className="text-wood-medium text-sm mt-1">Elige la opción que prefieras</p>
                </div>

                <SelectionCard
                  selected={customerInfo.deliveryType === 'delivery'}
                  onClick={() => {
                    setCustomerInfo(prev => ({ ...prev, deliveryType: 'delivery' }));
                    setTimeout(nextStep, 250);
                  }}
                  icon={Truck}
                  title="Domicilio"
                  subtitle="Llevamos la comida a tu puerta"
                />

                <SelectionCard
                  selected={customerInfo.deliveryType === 'pickup'}
                  onClick={() => {
                    setCustomerInfo(prev => ({ ...prev, deliveryType: 'pickup' }));
                    setTimeout(nextStep, 250);
                  }}
                  icon={Store}
                  title="Recoger en Local"
                  subtitle="Pasa por tu pedido (Sin costo)"
                />
              </motion.div>
            )}

            {/* STEP 2: User Info */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 py-4"
              >
                <div className="text-center mb-2">
                  <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-3 text-gold">
                    <User size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-wood-dark">Datos de Contacto</h3>
                </div>

                <div className="space-y-4 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                  <InputField
                    label="Nombre Completo"
                    icon={User}
                    type="text"
                    value={customerInfo.name}
                    onChange={(e: any) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Juan Pérez"
                    autoFocus
                  />

                  <InputField
                    label="Teléfono / WhatsApp"
                    icon={Store} // Icono de teléfono o store
                    type="tel"
                    pattern="[0-9]*"
                    value={customerInfo.phone}
                    onChange={(e: any) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Ej: 300 123 4567"
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 3: Address (Delivery Only) */}
            {currentStep === 3 && customerInfo.deliveryType === 'delivery' && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5 py-4"
              >
                <div className="text-center mb-2">
                  <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-3 text-gold">
                    <MapPin size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-wood-dark">Ubicación de Entrega</h3>
                </div>

                {/* Barrio Search */}
                <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-wood-medium mb-1.5 uppercase tracking-wide ml-1">
                      Barrio
                    </label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-wood-medium/50 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Buscar barrio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={handleFieldFocus}
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-gray-100 border-2 border-transparent focus:bg-white focus:border-gold/50 focus:ring-0 transition-all text-wood-dark outline-none"
                      />
                    </div>
                    
                    {/* Lista de Barrios */}
                    <div className="mt-2 max-h-48 overflow-y-auto custom-scrollbar rounded-xl border border-gray-100 bg-gray-50/50">
                      {loadingAreas ? (
                        <div className="p-4 text-center text-sm text-wood-medium">Cargando...</div>
                      ) : filteredNeighborhoods.length > 0 ? (
                        filteredNeighborhoods.map(neighborhood => (
                          <button
                            key={neighborhood.barrio}
                            onClick={() => handleNeighborhoodSelect(neighborhood.barrio)}
                            className={`w-full p-3 text-left text-sm border-b border-gray-100 last:border-0 flex justify-between items-center hover:bg-white transition-colors ${
                              selectedNeighborhood === neighborhood.barrio ? 'bg-gold/10 text-gold font-semibold' : 'text-wood-dark'
                            }`}
                          >
                            <span>{neighborhood.barrio}</span>
                            <span className="text-xs font-bold bg-white px-2 py-1 rounded border border-gray-100">
                              {formatPrice(neighborhood.precio)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-wood-medium">No hay resultados</div>
                      )}
                    </div>
                  </div>

                  {/* Dirección Exacta */}
                  <AnimatePresence>
                    {selectedNeighborhood && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <InputField
                          label="Dirección Exacta"
                          icon={MapPin}
                          type="text"
                          value={customerInfo.address}
                          onChange={(e: any) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="Calle 123 #45-67, Casa 2"
                          autoFocus
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* STEP 4: Payment */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 py-4"
              >
                <div className="text-center mb-4">
                  <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-3 text-gold">
                    <CreditCard size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-wood-dark">Método de Pago</h3>
                </div>

                <div className="space-y-3">
                  <SelectionCard
                    selected={customerInfo.paymentMethod === 'efectivo'}
                    onClick={() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'efectivo' }))}
                    icon={DollarSign}
                    title="Efectivo"
                    subtitle="Pagas al recibir el pedido"
                  />

                  <SelectionCard
                    selected={customerInfo.paymentMethod === 'transferencia'}
                    onClick={() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'transferencia' }))}
                    icon={CreditCard}
                    title="Transferencia"
                    subtitle="Nequi / Bancolombia"
                  />
                </div>

                <AnimatePresence>
                  {customerInfo.paymentMethod === 'transferencia' && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col items-center text-center shadow-sm"
                    >
                      <div className="bg-white p-2 rounded-full mb-2 shadow-sm">
                        <CreditCard size={20} className="text-blue-600" />
                      </div>
                      <p className="font-bold text-blue-800 text-lg mb-1 tracking-wide">
                        {restaurantConfig.nequi}
                      </p>
                      <p className="text-blue-600 text-xs">
                        Recuerda enviar el comprobante por WhatsApp al confirmar.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
        {/* Espacio extra al final para que el footer no tape contenido */}
        <div className="h-24" />
      </div>

      {/* --- FOOTER STICKY --- */}
      <div className={`bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex-shrink-0 sticky bottom-0 z-30 w-full transition-all ${isTyping ? 'p-2 pb-safe' : 'p-4 pb-safe'}`}>
        <div className="max-w-md mx-auto w-full">
          
          {/* Total Row (Oculto al escribir para ganar espacio) */}
          {!isTyping && (
            <div className="flex justify-between items-end mb-3 px-1">
              <div className="flex flex-col">
                <span className="text-xs text-wood-medium font-medium">Total a pagar</span>
                {customerInfo.deliveryType === 'delivery' && deliveryPrice > 0 && (
                  <span className="text-[10px] text-gold bg-gold/10 px-1.5 py-0.5 rounded mt-0.5 inline-block self-start">
                    + {formatPrice(deliveryPrice)} domi
                  </span>
                )}
              </div>
              <span className="text-2xl font-bold text-wood-dark">
                {formatPrice(cartTotal + (customerInfo.deliveryType === 'delivery' ? deliveryPrice : 0))}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            {currentStep > 1 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={prevStep}
                className="px-5 py-3 rounded-xl font-bold text-wood-dark bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft size={20} />
              </motion.button>
            )}

            {currentStep < totalSteps ? (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={nextStep}
                disabled={!canProceedToNext()}
                className={`flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                  canProceedToNext()
                    ? 'bg-gradient-to-r from-gold to-gold/90 shadow-gold/30'
                    : 'bg-gray-300 cursor-not-allowed shadow-none'
                }`}
              >
                Continuar
                <ChevronRight size={20} />
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSubmit(deliveryPrice)}
                disabled={!isFormValid()}
                className={`flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${
                  isFormValid()
                    ? 'bg-gradient-to-r from-green-500 to-green-600 shadow-green-500/30'
                    : 'bg-gray-300 cursor-not-allowed shadow-none'
                }`}
              >
                <Send size={18} />
                Confirmar Pedido
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimplifiedCheckoutWizard;