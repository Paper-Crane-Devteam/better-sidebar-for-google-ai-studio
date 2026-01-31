import React, { createContext, useContext } from 'react';

const ShadowRootContext = createContext<HTMLElement | null>(null);

export const ShadowRootProvider = ({ 
  container, 
  children 
}: { 
  container: HTMLElement | null; 
  children: React.ReactNode 
}) => {
  return (
    <ShadowRootContext.Provider value={container}>
      {children}
    </ShadowRootContext.Provider>
  );
};

export const useShadowRoot = () => {
  return useContext(ShadowRootContext);
};

