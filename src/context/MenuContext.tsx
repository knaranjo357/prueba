import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { fetchMenuItems } from '../api/menuApi';
import { MenuItem, ServiceType } from '../types';
import { getCurrentServiceType } from '../config/restaurantConfig';

interface MenuContextProps {
  menuItems: MenuItem[];
  loading: boolean;
  error: string | null;
  selectedCategory: string | null;
  selectedService: ServiceType;
  categories: string[];
  setSelectedCategory: (category: string | null) => void;
  setSelectedService: (service: ServiceType) => void;
  filteredItems: MenuItem[];
  retryLoading: () => void;
}

const MenuContext = createContext<MenuContextProps | undefined>(undefined);

export const MenuProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceType>('almuerzo');
  const [categories, setCategories] = useState<string[]>([]);

  // Auto-detect current service based on time
  useEffect(() => {
    const updateService = () => {
      const currentService = getCurrentServiceType();
      setSelectedService(currentService);
    };

    updateService();
    
    // Update service every minute
    const interval = setInterval(updateService, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMenuItems();
      
      const validItems = data.filter(item => 
        item.nombre && 
        item.nombre.trim() !== '' &&
        item.valor > 0
      );

      const sortedData = [...validItems].sort((a, b) => 
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
      );
      
      setMenuItems(sortedData);
      
      const allCategories = sortedData
        .flatMap(item => item.categorias)
        .filter(cat => cat && typeof cat === 'string' && cat.trim() !== '')
        .filter((cat, index, arr) => arr.indexOf(cat) === index); // Remove duplicates
      const uniqueCategories = [...new Set(allCategories)]
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
      
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      setError('Error al cargar el menú.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenuItems();
  }, []);

  const filteredItems = React.useMemo(() => {
    return menuItems.filter(item => {
      if (!item.nombre || !item.servicios) {
        return false;
      }

      const categoryMatch = selectedCategory ? 
        (item.categorias && item.categorias.includes(selectedCategory)) : true;
      
      const serviceMatch = Array.isArray(item.servicios) ? item.servicios.includes(selectedService) : true;
      
      const currentDay = new Date().getDay() || 7;
      const dayMatch = item.dias && Array.isArray(item.dias) ? 
        item.dias.includes(currentDay) : true;
      
      return categoryMatch && serviceMatch && dayMatch;
    });
  }, [menuItems, selectedCategory, selectedService]);

  const retryLoading = () => {
    loadMenuItems();
  };

  return (
    <MenuContext.Provider
      value={{
        menuItems,
        loading,
        error,
        selectedCategory,
        selectedService,
        categories,
        setSelectedCategory,
        setSelectedService,
        filteredItems,
        retryLoading,
      }}
    >
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = (): MenuContextProps => {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
};