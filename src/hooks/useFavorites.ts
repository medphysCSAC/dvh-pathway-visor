import { useState, useEffect } from 'react';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<string[]>(() => {
    const stored = localStorage.getItem('dvh-favorites');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('dvh-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (structureName: string) => {
    setFavorites(prev => 
      prev.includes(structureName)
        ? prev.filter(name => name !== structureName)
        : [...prev, structureName]
    );
  };

  const isFavorite = (structureName: string) => favorites.includes(structureName);

  return { favorites, toggleFavorite, isFavorite };
};
