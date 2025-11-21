import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserCircle2, Store } from 'lucide-react';
import { restaurantConfig } from '../config/restaurantConfig';

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`sticky top-0 z-40 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/90 backdrop-blur-md shadow-sm py-2' 
          : 'bg-white py-4 border-b border-gold/10'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          
          {/* Left: Brand */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="bg-gold/10 p-2 rounded-xl text-gold">
              <Store size={24} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-wood-dark font-title leading-none">
                {restaurantConfig.nombre}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-xs text-wood-medium font-medium">
                  Abierto ahora
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
};

export default Header;