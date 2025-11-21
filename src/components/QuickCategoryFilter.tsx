import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useMenu } from '../context/MenuContext';

const QuickCategoryFilter: React.FC = () => {
  const { categories, selectedCategory, setSelectedCategory } = useMenu();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSticky, setIsSticky] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsSticky(scrollPosition > 100); // Activar antes
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const filteredCategories = useMemo(() => {
    return ['Todas', ...categories].filter(category =>
      category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category === 'Todas' ? null : category);
    
    // Scroll suave al menú
    const menuSection = document.getElementById('menu-items');
    if (menuSection) {
      menuSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      {/* Spacer para evitar saltos cuando se pone sticky */}
      {isSticky && <div className="h-28" />}
      
      <div className={`transition-all duration-300 z-30 bg-white/95 backdrop-blur-sm ${
        isSticky 
          ? 'fixed top-0 left-0 right-0 shadow-md py-3' 
          : 'relative py-4 border-b border-gold/10'
      }`}>
        <div className="container mx-auto px-4 max-w-7xl">
          
          {/* Search Input Moderno */}
          <div className="relative mb-4 max-w-lg mx-auto">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-wood-medium/60" />
              <input
                type="text"
                placeholder="¿Qué se te antoja hoy?"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-gray-100 border-transparent focus:bg-white focus:border-gold/50 border-2 rounded-2xl transition-all outline-none text-wood-dark placeholder-wood-medium/50 shadow-inner"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200 rounded-full text-gray-500 hover:text-wood-dark"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Categorías (Scroll Horizontal) */}
          <div 
            ref={scrollRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mask-linear-fade"
          >
            {filteredCategories.map((category) => {
              const isSelected = 
                (category === 'Todas' && selectedCategory === null) || 
                selectedCategory === category;

              return (
                <motion.button
                  key={category}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCategoryClick(category)}
                  className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-gold text-white border-gold shadow-lg shadow-gold/30'
                      : 'bg-white text-wood-medium border-gray-200 hover:border-gold/50 hover:text-gold'
                  }`}
                >
                  {category}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default QuickCategoryFilter;