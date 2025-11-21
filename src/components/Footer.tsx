import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Heart, Instagram, Facebook, MessageCircle } from 'lucide-react';
import { restaurantConfig } from '../config/restaurantConfig';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-wood-dark text-white/80 pt-12 pb-6 mt-auto border-t-4 border-gold">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-8 mb-8">
          
          {/* Brand Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center md:text-left max-w-sm"
          >
            <h3 className="text-3xl font-bold font-title text-gold mb-2">
              {restaurantConfig.nombre}
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              {restaurantConfig.frase || "Sabores que enamoran, calidad que se siente."}
            </p>
          </motion.div>

          {/* Contact Info */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-4 text-sm"
          >
            <div className="flex items-center gap-3 justify-center md:justify-start group">
              <div className="p-2 bg-white/5 rounded-full group-hover:bg-gold/20 transition-colors">
                <MapPin size={18} className="text-gold" />
              </div>
              <span>{restaurantConfig.direccion}</span>
            </div>
            
            <div className="flex items-center gap-3 justify-center md:justify-start group">
              <div className="p-2 bg-white/5 rounded-full group-hover:bg-gold/20 transition-colors">
                <Phone size={18} className="text-gold" />
              </div>
              <span>{restaurantConfig.telefono}</span>
            </div>
            
            <div className="flex items-center gap-3 justify-center md:justify-start group">
              <div className="p-2 bg-white/5 rounded-full group-hover:bg-gold/20 transition-colors">
                <Clock size={18} className="text-gold" />
              </div>
              <span>Lun - Dom: 11:00 AM - 9:30 PM</span>
            </div>
          </motion.div>

          {/* Social Links (Simulados) */}
          <motion.div 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.2 }}
             className="flex gap-4"
          >
            {[Instagram, Facebook, MessageCircle].map((Icon, i) => (
              <motion.a
                key={i}
                href="#"
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.9 }}
                className="p-3 bg-white/5 hover:bg-gold hover:text-white text-gold rounded-xl transition-all duration-300 shadow-lg"
              >
                <Icon size={20} />
              </motion.a>
            ))}
          </motion.div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />

        {/* Copyright */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-white/40">
          <p>© {currentYear} {restaurantConfig.nombre}. Todos los derechos reservados.</p>
          
          <div className="flex items-center gap-1.5">
            <span>Creado con</span>
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }} 
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Heart size={12} className="text-red-500 fill-red-500" />
            </motion.div>
            <span>para ti</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;