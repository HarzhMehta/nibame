import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { BrainProvider } from '@/context/BrainContext';
import { AppRoutes } from '@/routes';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <BrainProvider>
        <AppRoutes />
      </BrainProvider>
    </BrowserRouter>
  );
};

export default App;
