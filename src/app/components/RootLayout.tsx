import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Layout } from './Layout';
import { useApp } from '../context/AppContext';

export const RootLayout: React.FC = () => {
  const { state } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (state.userMode !== 'guest') return;
    if (location.pathname !== '/') return;
    navigate('/signup', { replace: true });
  }, [state.userMode, location.pathname, navigate]);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};
