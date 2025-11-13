import { useState, useEffect } from 'react';

export const useHiddenProtocols = () => {
  const [hiddenProtocols, setHiddenProtocols] = useState<string[]>(() => {
    const stored = localStorage.getItem('dvh-hidden-protocols');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('dvh-hidden-protocols', JSON.stringify(hiddenProtocols));
  }, [hiddenProtocols]);

  const toggleHidden = (protocolId: string) => {
    setHiddenProtocols(prev => 
      prev.includes(protocolId)
        ? prev.filter(id => id !== protocolId)
        : [...prev, protocolId]
    );
  };

  const isHidden = (protocolId: string) => hiddenProtocols.includes(protocolId);

  return { hiddenProtocols, toggleHidden, isHidden };
};
