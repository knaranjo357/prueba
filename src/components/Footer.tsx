import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Heart } from 'lucide-react';
import { restaurantConfig } from '../config/restaurantConfig';

const Footer: React.FC = () => {
  return (
    <footer className="bg-wood-dark text-cream py-8 mt-16">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h3 className="text-2xl font-bold font-title mb-4 text-gold">
            {restaurantConfig.nombre}
          </h3>
          
          <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-6">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-gold" />
              <span className="text-sm">{restaurantConfig.direccion}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Phone size={18} className="text-gold" />
              <span className="text-sm">{restaurantConfig.telefono}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-gold" />
              <span className="text-sm">Lun-Dom: 11:00 - 21:30</span>
            </div>
          </div>
          
          <p className="text-cream/80 text-sm max-w-2xl mx-auto mb-4 leading-relaxed">
            {restaurantConfig.frase}
          </p>
          
          <div className="flex items-center justify-center gap-2 text-cream/60 text-xs">
            <span>Hecho con</span>
            <Heart size={14} className="text-red-400" />
            <span>para nuestros clientes</span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;