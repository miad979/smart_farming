import React from 'react';
import { RouterProvider } from 'react-router';
import { AppProvider } from './context/AppContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { router } from './routes';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AppProvider>
      <RealtimeProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors closeButton expand={true} />
      </RealtimeProvider>
    </AppProvider>
  );
}