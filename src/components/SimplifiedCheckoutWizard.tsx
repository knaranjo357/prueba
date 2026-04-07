import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Truck, Store, Search, DollarSign, Send, CreditCard, User, MapPin, HelpCircle } from 'lucide-react';
import { CustomerInfo } from '../types';
import { useCart } from '../context/CartContext';
import { formatPrice, calculateTotalPrice } from '../utils/dateUtils';
import { fetchDeliveryAreas } from '../api/deliveryApi';
import { restaurantConfig } from '../config/restaurantConfig';

interface SimplifiedCheckoutWizardProps {
  customerInfo: CustomerInfo;
  setCustomerInfo: React.Dispatch<React.SetStateAction<CustomerInfo>>;
  onBack: () => void;
  onSubmit: (deliveryPrice: number) => void;
  isSubmitting?: boolean;
}

const SimplifiedCheckoutWizard: React.FC<SimplifiedCheckoutWizardProps> = ({
  customerInfo,
  setCustomerInfo,
  onBack,
  onSubmit,
  isSubmitting = false
}) => {
  const submitLockRef = useRef(false);
  const { items } = useCart();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [notFoundOpen, setNotFoundOpen] = useState(false);     // toggle info panel
  const [noBarrioFound, setNoBarrioFound] = useState(false);   // usuario eligió "no está mi barrio"
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

  // Precio de domicilio: 0 si el usuario eligió "no está mi barrio"
  const deliveryPrice = noBarrioFound
    ? 0
    : selectedNeighborhood
      ? deliveryAreas.find(a => a.barrio.toLowerCase() === selectedNeighborhood.toLowerCase())?.precio || 0
      : 0;

  // Pasos: delivery = 5, pickup = 3
  const totalSteps = customerInfo.deliveryType === 'delivery' ? 5 : 3;

  useEffect(() => {
    (async () => {
      try {
        setLoadingAreas(true);
        setDeliveryAreas(await fetchDeliveryAreas());
      } catch (e) {
        console.error('Error loading delivery areas:', e);
      } finally {
        setLoadingAreas(false);
      }
    })();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('customerInfo');
    if (!saved) return;
    try {
      const p = JSON.parse(saved);
      setCustomerInfo(prev => ({
        ...prev,
        name: p.name || prev.name,
        phone: p.phone || prev.phone,
        address: p.address || prev.address,
        paymentMethod: p.paymentMethod || prev.paymentMethod,
        neighborhood: p.neighborhood || prev.neighborhood,
      }));
      if (p.neighborhood) {
        setSelectedNeighborhood(p.neighborhood);
        setSearchTerm(p.neighborhood);
      }
    } catch {}
  }, [setCustomerInfo]);

  useEffect(() => {
    if (customerInfo.name || customerInfo.phone) {
      localStorage.setItem('customerInfo', JSON.stringify({
        name: customerInfo.name,
        phone: customerInfo.phone,
        address: customerInfo.address,
        paymentMethod: customerInfo.paymentMethod,
        neighborhood: customerInfo.neighborhood,
      }));
    }
  }, [customerInfo]);

  const filteredNeighborhoods = useMemo(() =>
    deliveryAreas
      .filter(n => (n?.barrio || '').toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (a?.barrio || '').localeCompare(b?.barrio || '', 'es', { sensitivity: 'base' })),
    [deliveryAreas, searchTerm]
  );

  const handleNeighborhoodSelect = (barrio: string) => {
    setSelectedNeighborhood(barrio);
    setNoBarrioFound(false);
    setCustomerInfo(prev => ({ ...prev, neighborhood: barrio, city: 'Bucaramanga' }));
  };

  // ── Navegación ──────────────────────────────────────────────
  // Mapa lógico para pickup: steps visibles son 1 → 2 → 5 (pago)
  // Para delivery: 1 → 2 → 3 → 4 → 5
  const PAYMENT_STEP = 5;

  const canProceedToNext = (): boolean => {
    if (customerInfo.deliveryType === 'delivery') {
      switch (currentStep) {
        case 1: return true;
        case 2: return Boolean(customerInfo.name.trim() && customerInfo.phone.trim());
        case 3: return Boolean(selectedNeighborhood || noBarrioFound);  // barrio confirmado o elegido "no está"
        case 4: return Boolean(customerInfo.address.trim());
        case 5: return true;
        default: return false;
      }
    } else {
      // pickup: steps 1, 2, 5
      switch (currentStep) {
        case 1: return true;
        case 2: return Boolean(customerInfo.name.trim() && customerInfo.phone.trim());
        case PAYMENT_STEP: return true;
        default: return false;
      }
    }
  };

  const nextStep = () => {
    if (!canProceedToNext()) return;
    if (currentStep === 2 && customerInfo.deliveryType === 'pickup') {
      setCurrentStep(PAYMENT_STEP);
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const prevStep = () => {
    if (currentStep === PAYMENT_STEP && customerInfo.deliveryType === 'pickup') {
      setCurrentStep(2);
    } else {
      setCurrentStep(s => s - 1);
    }
  };

  const isFormValid = (): boolean => {
    if (customerInfo.deliveryType === 'delivery') {
      return Boolean(
        customerInfo.name.trim() &&
        customerInfo.phone.trim() &&
        customerInfo.address.trim() &&
        (selectedNeighborhood || noBarrioFound)
      );
    }
    return Boolean(customerInfo.name.trim() && customerInfo.phone.trim());
  };

  const handleFieldFocus = (e: React.FocusEvent<HTMLElement>) => {
    try { e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {}
  };

  // Indicador de progreso visual
  const visualStep = customerInfo.deliveryType === 'pickup' && currentStep === PAYMENT_STEP ? 3 : currentStep;
  const visualTotal = totalSteps;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-cream to-cream-light touch-manipulation">

      {/* Barra de progreso */}
      <div className="flex-shrink-0 px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: visualTotal }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                i < visualStep ? 'bg-gold' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-wood-medium mt-1 text-right">
          Paso {visualStep} de {visualTotal}
        </p>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-28 md:pb-6">
        <AnimatePresence mode="wait">

          {/* ── Step 1: Tipo de entrega ── */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-3"
            >
              <div className="mb-5">
                <p className="font-bold text-wood-dark text-lg leading-tight">¿Cómo prefieres tu pedido?</p>
                <p className="text-xs text-wood-medium">Elige el tipo de entrega</p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setCustomerInfo(prev => ({ ...prev, deliveryType: 'delivery' }));
                  setTimeout(nextStep, 200);
                }}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 border-2 ${
                  customerInfo.deliveryType === 'delivery'
                    ? 'bg-gradient-to-br from-gold to-gold/90 text-white border-transparent shadow-xl shadow-gold/20'
                    : 'bg-white border-gray-100 text-wood-dark hover:border-gold/30 hover:shadow-md'
                }`}
              >
                <Truck className="w-7 h-7" />
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
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 border-2 ${
                  customerInfo.deliveryType === 'pickup'
                    ? 'bg-wood-dark text-white border-transparent shadow-xl shadow-wood-dark/20'
                    : 'bg-white border-gray-100 text-wood-dark hover:border-gold/30 hover:shadow-md'
                }`}
              >
                <Store className="w-7 h-7" />
                <div className="text-left">
                  <div className="font-bold text-lg">Recoger en local</div>
                  <div className="text-sm opacity-80">Más rápido y sin costo adicional</div>
                </div>
              </motion.button>
            </motion.div>
          )}

          {/* ── Step 2: Datos del cliente ── */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gold/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <p className="font-bold text-wood-dark text-base leading-tight">Tus datos</p>
                  <p className="text-xs text-wood-medium">Para contactarte sobre tu pedido</p>
                </div>
              </div>

              <div>
                <label className="block text-wood-dark font-semibold mb-1.5 text-sm">Nombre completo</label>
                <input
                  type="text"
                  inputMode="text"
                  value={customerInfo.name}
                  onChange={e => setCustomerInfo((prev: any) => ({ ...prev, name: e.target.value }))}
                  onFocus={handleFieldFocus}
                  className="w-full bg-white px-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all text-base outline-none placeholder:text-gray-300 font-medium shadow-sm"
                  placeholder="Tu nombre completo"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-wood-dark font-semibold mb-1.5 text-sm">Teléfono</label>
                <input
                  type="tel"
                  inputMode="tel"
                  pattern="[0-9]*"
                  value={customerInfo.phone}
                  onChange={e => setCustomerInfo((prev: any) => ({ ...prev, phone: e.target.value }))}
                  onFocus={handleFieldFocus}
                  className="w-full bg-white px-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all text-base outline-none placeholder:text-gray-300 font-medium shadow-sm"
                  placeholder="300 123 4567"
                />
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Selección de barrio (solo delivery) ── */}
          {currentStep === 3 && customerInfo.deliveryType === 'delivery' && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gold/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <p className="font-bold text-wood-dark text-base leading-tight">¿A qué barrio enviamos?</p>
                  <p className="text-xs text-wood-medium">Selecciona tu barrio para ver el precio de envío</p>
                </div>
              </div>

              {/* Buscador */}
              {!noBarrioFound && (
                <div className="relative mb-3">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="search"
                    placeholder="Busca tu barrio..."
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      if (selectedNeighborhood && !e.target.value) {
                        setSelectedNeighborhood('');
                        setCustomerInfo((prev: any) => ({ ...prev, neighborhood: '', city: '' }));
                      }
                    }}
                    onFocus={handleFieldFocus}
                    className="w-full bg-white pl-10 pr-4 py-2.5 border-2 border-gray-100 rounded-xl focus:border-gold focus:ring-4 focus:ring-gold/10 transition-all text-base outline-none placeholder:text-gray-300 font-medium shadow-sm"
                  />
                </div>
              )}

              {/* Estado seleccionado / no-barrio */}
              <AnimatePresence mode="wait">
                {noBarrioFound ? (
                  /* Panel "no encontré mi barrio" */
                  <motion.div
                    key="no-barrio"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 mb-3"
                  >
                    <div className="flex gap-3 items-start mb-3">
                      <span className="text-2xl flex-shrink-0">🛵</span>
                      <div>
                        <p className="font-bold text-amber-900 text-sm mb-1">¡Sin problema!</p>
                        <p className="text-amber-800 text-sm leading-relaxed">
                          Usamos una empresa mensajera para los domicilios. Si tu barrio no está en la lista, el costo de envío depende de la tarifa que ellos manejen y <strong>se cuadra directamente con el domiciliario</strong> cuando llegue con tu pedido. Anotaremos <strong>$0</strong> por ahora.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNoBarrioFound(false);
                        setSearchTerm('');
                      }}
                      className="w-full text-center text-sm text-amber-700 font-semibold underline underline-offset-2"
                    >
                      ← Volver a buscar mi barrio
                    </button>
                  </motion.div>
                ) : (
                  /* Lista de barrios */
                  <motion.div
                    key="barrio-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {loadingAreas ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-wood-medium">
                        <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium">Cargando barrios...</span>
                      </div>
                    ) : (
                      <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
                        {filteredNeighborhoods.map(neighborhood => {
                          const isSelected = selectedNeighborhood.toLowerCase() === neighborhood.barrio.toLowerCase();
                          return (
                            <motion.button
                              key={neighborhood.barrio}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleNeighborhoodSelect(neighborhood.barrio)}
                              className={`w-full px-3 py-2.5 rounded-xl text-left transition-all border-2 ${
                                isSelected
                                  ? 'bg-gold text-white border-gold shadow-md shadow-gold/20'
                                  : 'bg-white text-wood-dark border-gray-100 hover:border-gold/40 hover:bg-amber-50/40 shadow-sm'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  {isSelected && <span className="text-white text-xs">✓</span>}
                                  <span className="font-semibold text-sm">{neighborhood.barrio}</span>
                                </div>
                                <span className={`font-bold text-sm tabular-nums ${isSelected ? 'text-white/90' : 'text-gold'}`}>
                                  {formatPrice(neighborhood.precio)}
                                </span>
                              </div>
                            </motion.button>
                          );
                        })}

                        {/* Botón "No encuentro mi barrio" */}
                        <button
                          type="button"
                          onClick={() => {
                            setNoBarrioFound(true);
                            setSelectedNeighborhood('');
                            setCustomerInfo((prev: any) => ({ ...prev, neighborhood: 'Sin barrio - cuadrar con domiciliario', city: 'Bucaramanga' }));
                          }}
                          className="w-full mt-2 px-3 py-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-amber-50 hover:border-amber-300 transition-all flex items-center gap-2.5 group"
                        >
                          <HelpCircle className="w-4 h-4 text-gray-400 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                          <span className="text-sm font-semibold text-gray-500 group-hover:text-amber-700 transition-colors">
                            No encuentro mi barrio
                          </span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chip de barrio seleccionado */}
              {selectedNeighborhood && !noBarrioFound && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center justify-between bg-gold/10 border border-gold/30 rounded-xl px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gold text-sm">✓</span>
                    <span className="text-sm font-bold text-wood-dark">{selectedNeighborhood}</span>
                  </div>
                  <span className="text-sm font-bold text-gold tabular-nums">{formatPrice(deliveryPrice)}</span>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── Step 4: Dirección exacta (solo delivery) ── */}
          {currentStep === 4 && customerInfo.deliveryType === 'delivery' && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto"
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-gold/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <p className="font-bold text-wood-dark text-base leading-tight">¿Cuál es la dirección exacta?</p>
                  <p className="text-xs text-wood-medium">
                    {noBarrioFound ? 'El domicilio se cuadra con el mensajero' : `Envío a ${selectedNeighborhood}`}
                  </p>
                </div>
              </div>

              <div className="bg-white border-2 border-gold/30 rounded-2xl p-4 shadow-sm">
                <label className="block text-wood-dark font-semibold mb-2 text-sm">
                  Dirección completa
                </label>
                <textarea
                  inputMode="text"
                  rows={3}
                  value={customerInfo.address}
                  onChange={e => setCustomerInfo((prev: any) => ({ ...prev, address: e.target.value }))}
                  onFocus={handleFieldFocus}
                  className="w-full bg-gray-50 px-4 py-3 border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-gold/10 focus:border-gold transition-all text-base outline-none placeholder:text-gray-300 font-medium resize-none"
                  placeholder="Ej: Calle 45 #23-10, Casa/Apto, referencia..."
                  autoFocus
                />
                <p className="text-xs text-wood-medium mt-2">
                  Incluye referencias que ayuden al domiciliario a encontrarte fácilmente.
                </p>
              </div>

              {/* Nota si no hay barrio */}
              {noBarrioFound && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5 items-start"
                >
                  <span className="text-lg flex-shrink-0">🛵</span>
                  <p className="text-amber-800 text-xs leading-relaxed">
                    El costo del domicilio se cuadra con el mensajero cuando lleve tu pedido. Quedará registrado como <strong>$0</strong>.
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── Step 5: Método de pago ── */}
          {currentStep === PAYMENT_STEP && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-3"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gold/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-gold" />
                </div>
                <div>
                  <p className="font-bold text-wood-dark text-base leading-tight">¿Cómo pagas?</p>
                  <p className="text-xs text-wood-medium">Elige tu método de pago</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'efectivo' }))}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all border-2 ${
                  customerInfo.paymentMethod === 'efectivo'
                    ? 'bg-gold text-white border-gold shadow-lg'
                    : 'bg-white border-gray-100 text-wood-dark hover:border-gold/30 hover:shadow-md'
                }`}
              >
                <DollarSign className="w-7 h-7" />
                <div className="text-left">
                  <div className="font-bold text-lg">Efectivo</div>
                  <div className="text-sm opacity-80">Pago al recibir</div>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'transferencia' }))}
                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all border-2 ${
                  customerInfo.paymentMethod === 'transferencia'
                    ? 'bg-gold text-white border-gold shadow-lg'
                    : 'bg-white border-gray-100 text-wood-dark hover:border-gold/30 hover:shadow-md'
                }`}
              >
                <CreditCard className="w-7 h-7" />
                <div className="text-left">
                  <div className="font-bold text-lg">Transferencia</div>
                  <div className="text-sm opacity-80">Pago anticipado</div>
                </div>
              </motion.button>

              <AnimatePresence>
                {customerInfo.paymentMethod === 'transferencia' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="bg-blue-50 border border-blue-200 rounded-xl p-4"
                  >
                    <p className="text-blue-700 font-bold text-center mb-1">
                      📱 Nequi: {restaurantConfig.nequi}
                    </p>
                    <p className="text-blue-600 text-xs text-center">
                      Envía el comprobante por WhatsApp luego de confirmar.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Footer fijo ── */}
      <div
        className={`border-t border-gold/20 bg-white/90 backdrop-blur-sm ${isTyping ? 'p-2' : 'p-3 md:p-4'} flex-shrink-0 sticky bottom-0`}
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${isTyping ? '6px' : '12px'})` }}
      >
        {/* Resumen de total — oculto al escribir */}
        {!isTyping && (
          <div className="bg-gold/10 rounded-xl px-3 py-2 mb-3 flex justify-between items-center">
            <span className="font-bold text-wood-dark text-sm">Total:</span>
            <div className="text-right">
              <span className="text-lg font-bold text-gold">
                {formatPrice(cartTotal + (customerInfo.deliveryType === 'delivery' ? deliveryPrice : 0))}
              </span>
              {customerInfo.deliveryType === 'delivery' && (
                <p className="text-xs text-wood-medium leading-none mt-0.5">
                  {noBarrioFound
                    ? 'Dom: a cuadrar con mensajero'
                    : deliveryPrice > 0
                      ? `Incl. envío ${formatPrice(deliveryPrice)}`
                      : 'Sin envío seleccionado'}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {currentStep > 1 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={prevStep}
              className={`px-4 ${isTyping ? 'py-1.5' : 'py-2.5'} bg-wood-light/20 hover:bg-wood-light/30 text-wood-dark rounded-xl font-medium transition-all text-sm flex items-center gap-1`}
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </motion.button>
          )}

          {currentStep < PAYMENT_STEP ? (
            <motion.button
              whileHover={canProceedToNext() ? { scale: 1.02 } : {}}
              whileTap={canProceedToNext() ? { scale: 0.98 } : {}}
              onClick={nextStep}
              disabled={!canProceedToNext()}
              className={`flex-1 ${isTyping ? 'py-2' : 'py-2.5'} rounded-xl font-bold transition-all text-sm ${
                canProceedToNext()
                  ? 'bg-gold hover:bg-gold/90 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Continuar
            </motion.button>
          ) : (
            <motion.button
              whileHover={isFormValid() && !isSubmitting ? { scale: 1.02 } : {}}
              whileTap={isFormValid() && !isSubmitting ? { scale: 0.98 } : {}}
              onClick={() => {
                if (submitLockRef.current || isSubmitting || !isFormValid()) return;
                submitLockRef.current = true;
                onSubmit(deliveryPrice);
              }}
              disabled={!isFormValid() || isSubmitting}
              className={`flex-1 flex items-center justify-center gap-2 ${isTyping ? 'py-2' : 'py-2.5'} rounded-xl font-bold transition-all text-sm ${
                isFormValid() && !isSubmitting
                  ? 'bg-gold hover:bg-gold/90 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Confirmar Pedido
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimplifiedCheckoutWizard;
