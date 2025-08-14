import React from 'react';
import { motion } from 'framer-motion';
import { restaurantConfig } from '../config/restaurantConfig';

const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gold/10">
      <div className="container mx-auto px-4 py-3">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-wood-dark font-title">
            {restaurantConfig.nombre}
          </h1>
          <p className="text-wood-medium text-sm mt-1">
            {restaurantConfig.direccion}
          </p>
        </motion.div>
      </div>
    </header>
  );
};

export default Header;