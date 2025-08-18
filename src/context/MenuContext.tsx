import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { fetchMenuItems } from '../api/menuApi';
import { MenuItem } from '../types';

interface MenuContextProps {
  menuItems: MenuItem[];
  loading: boolean;
  error: string | null;
  selectedCategory: string | null;
  categories: string[];
  setSelectedCategory: (category: string | null) => void;
  filteredItems: MenuItem[];
  retryLoading: () => void;
}

const MenuContext = createContext<MenuContextProps | undefined>(undefined);

export const MenuProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMenuItems();

      // Valida nombre y precio solamente
      const validItems = data.filter(
        (item: MenuItem) =>
          item?.nombre &&
          item.nombre.trim() !== '' &&
          typeof item.valor === 'number' &&
          item.valor > 0
      );

      const sortedData = [...validItems].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
      );

      setMenuItems(sortedData);

      // Construir categorías únicas
      const allCategories = sortedData
        .flatMap(item => Array.isArray(item.categorias) ? item.categorias : [])
        .filter(cat => typeof cat === 'string' && cat.trim() !== '');

      const uniqueCategories = [...new Set(allCategories)].sort((a, b) =>
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      );

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

  // Filtra SOLO por categoría. NO filtra por servicio ni día.
  const filteredItems = React.useMemo(() => {
    // Mostrar TODOS los items sin filtrar por servicio, día o cualquier otra condición
    return menuItems.filter(item => {
      // Solo validar que el item tenga datos básicos válidos
      if (!item?.nombre || !item.nombre.trim()) return false;
      if (typeof item.valor !== 'number' || item.valor <= 0) return false;

      const categoryMatch = selectedCategory
        ? Array.isArray(item.categorias) && item.categorias.includes(selectedCategory)
        : true;

      return categoryMatch;
    });
  }, [menuItems, selectedCategory]);

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
        categories,
        setSelectedCategory,
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
