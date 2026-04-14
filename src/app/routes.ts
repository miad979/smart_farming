import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { RootLayout } from './components/RootLayout';
import { useApp, type UserRole } from './context/AppContext';
import { Dashboard } from './pages/Dashboard';
import { DiseaseDetection } from './pages/DiseaseDetection';
import { Irrigation } from './pages/Irrigation';
import { MarketPrices } from './pages/MarketPrices';
import { Profile } from './pages/Profile';
import { AdminDashboard } from './pages/AdminDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { AdminDoctorVerification } from './pages/AdminDoctorVerification';
import { SignupPage } from './pages/SignupPage';
import { DoctorApplicationPage } from './pages/DoctorApplicationPage';
import { NotFound } from './pages/NotFound';

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useApp();
  if (state.userMode === 'guest' || !state.accessToken) {
    return React.createElement(Navigate, { to: '/profile?auth=signin', replace: true });
  }
  return React.createElement(React.Fragment, null, children);
};

const RequireRole: React.FC<{ role: UserRole; children: React.ReactNode }> = ({ role, children }) => {
  const { state } = useApp();
  const hasRequiredRole = state.user.role === role;
  if (!hasRequiredRole) {
    return React.createElement(Navigate, { to: '/', replace: true });
  }
  return React.createElement(React.Fragment, null, children);
};

const RequireAdminOrSuperUser: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useApp();
  const allowed = state.user.role === 'admin' || state.user.role === 'super_admin';
  if (!allowed) {
    return React.createElement(Navigate, { to: '/', replace: true });
  }
  return React.createElement(React.Fragment, null, children);
};

const AdminDashboardRoute: React.FC = () => React.createElement(
  RequireAuth,
  null,
  React.createElement(
    RequireAdminOrSuperUser,
    null,
    React.createElement(AdminDashboard),
  ),
);

const AdminDoctorVerificationRoute: React.FC = () => React.createElement(
  RequireAuth,
  null,
  React.createElement(
    RequireRole,
    { role: 'admin' },
    React.createElement(AdminDoctorVerification),
  ),
);

const DoctorDashboardRoute: React.FC = () => React.createElement(
  RequireAuth,
  null,
  React.createElement(
    RequireRole,
    { role: 'doctor' },
    React.createElement(DoctorDashboard),
  ),
);

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: Dashboard,
      },
      {
        path: 'detect',
        Component: DiseaseDetection,
      },
      {
        path: 'irrigation',
        Component: Irrigation,
      },
      {
        path: 'prices',
        Component: MarketPrices,
      },
      {
        path: 'signup',
        Component: SignupPage,
      },
      {
        path: 'signup/doctor',
        Component: DoctorApplicationPage,
      },
      {
        path: 'profile',
        Component: Profile,
      },
      {
        path: 'admin',
        Component: AdminDashboardRoute,
      },
      {
        path: 'admin/doctor-verification',
        Component: AdminDoctorVerificationRoute,
      },
      {
        path: 'doctor',
        Component: DoctorDashboardRoute,
      },
      {
        path: '*',
        Component: NotFound,
      },
    ],
  },
]);