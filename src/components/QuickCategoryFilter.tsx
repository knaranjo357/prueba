import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter } from 'lucide-react';
import { useMenu } from '../context/MenuContext';

const QuickCategoryFilter: React.FC = () => {
  const { categories, selectedCategory, setSelectedCategory } = useMenu();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSticky, setIsSticky] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsSticky(scrollPosition > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const filteredCategories = useMemo(() => {
    return categories.filter(category =>
      category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const handleCategoryClick = (category: string | null) => {
    setSelectedCategory(category);
    // Scroll al inicio del menú
    const menuSection = document.getElementById('menu-items');
    if (menuSection) {
      menuSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      {isSticky && <div className="h-20" />}
      <div className={`transition-all duration-300 z-30 ${
        isSticky 
          ? 'fixed top-0 left-0 right-0 bg-white shadow-lg border-b border-gold/20' 
          : 'bg-white shadow-sm border-b border-gold/10'
      } py-3`}>
      <div className="container mx-auto px-4">
        {/* Search bar */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-wood-medium" />
          <input
            type="text"
            placeholder="Buscar platos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-wood-light/30 rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold/50 transition-all text-sm"
          />
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hidden pb-1">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleCategoryClick(null)}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-medium transition-all ${
              selectedCategory === null
                ? 'bg-gold text-white shadow-md'
                : 'bg-gray-100 text-wood-dark hover:bg-gray-200'
            }`}
          >
            Todos
          </motion.button>
          
          {filteredCategories.map((category) => (
            <motion.button
              key={category}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCategoryClick(category)}
              className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-medium capitalize transition-all ${
                selectedCategory === category
                  ? 'bg-gold text-white shadow-md'
                  : 'bg-gray-100 text-wood-dark hover:bg-gray-200'
              }`}
            >
              {category}
            </motion.button>
          ))}
        </div>
      </div>
      </div>
    </>
  );
};

export default QuickCategoryFilter;