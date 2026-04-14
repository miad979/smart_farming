import React, { ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { t } from '../utils/translations';
import { Home, Camera, Droplet, DollarSign, User, Wifi, WifiOff, Globe, Shield, Stethoscope } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { DetectFAB } from './DetectFAB';
import { QuickGuide } from './QuickGuide';
import { ThemeToggle } from './ThemeToggle';
import { NotificationPanel } from './NotificationPanel';
import { RealtimeStatus } from './RealtimeStatus';
import { RealtimeTestPanel } from './RealtimeTestPanel';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { state, setLanguage } = useApp();
  const location = useLocation();

  // Base navigation items for farmers
  const farmerNavItems = [
    { path: '/', icon: Home, label: t('dashboard', state.language) },
    { path: '/detect', icon: Camera, label: t('detect', state.language) },
    { path: '/irrigation', icon: Droplet, label: t('irrigation', state.language) },
    { path: '/prices', icon: DollarSign, label: t('prices', state.language) },
    { path: '/profile', icon: User, label: t('profile', state.language) },
  ];

  // Role-based navigation
  const getNavItems = () => {
    if (state.user.role === 'admin') {
      return [
        { path: '/admin', icon: Shield, label: t('adminPanel', state.language) },
        { path: '/profile', icon: User, label: t('profile', state.language) },
      ];
    } else if (state.user.role === 'doctor') {
      return [
        { path: '/doctor', icon: Stethoscope, label: t('doctorPanel', state.language) },
        { path: '/profile', icon: User, label: t('profile', state.language) },
      ];
    }
    return farmerNavItems;
  };

  const navItems = getNavItems();

  const isActive = (path: string) => location.pathname === path;

  const currentContextLabel = React.useMemo(() => {
    const isProfile = location.pathname === '/profile';
    if (isProfile) {
      const profilePrefix = state.language === 'bn' ? 'প্রোফাইল' : 'Profile';
      const profileName = state.user?.name || (state.language === 'bn' ? 'ব্যবহারকারী' : 'User');
      return `${profilePrefix}: ${profileName}`;
    }

    const isHome = location.pathname === '/';
    if (isHome) {
      return state.language === 'bn' ? 'হোম পেজ' : 'Home Page';
    }

    const activeItem = navItems.find((item) => isActive(item.path));
    return activeItem?.label || (state.language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard');
  }, [location.pathname, state.language, state.user?.name, navItems]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border shadow-[0_0_40px_rgba(15,23,42,0.08)] dark:shadow-[0_0_40px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo Header */}
          <div className="flex items-center justify-between h-20 px-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">Smart Farming</h1>
                <p className="text-xs text-muted-foreground">{currentContextLabel}</p>
              </div>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className={`w-5 h-5 transition-transform duration-200 ${
                  isActive(item.path) ? 'scale-110' : 'group-hover:scale-110'
                }`} />
                <span className="font-medium">{item.label}</span>
                {isActive(item.path) && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                )}
              </Link>
            ))}
          </nav>

          {/* Settings Footer */}
          <div className="p-4 border-t border-sidebar-border space-y-3">
            {/* Theme Toggle */}
            <div className="px-2">
              <ThemeToggle />
            </div>

            {/* Language Switcher */}
            <button
              onClick={() => setLanguage(state.language === 'bn' ? 'en' : 'bn')}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-sidebar-accent transition-all duration-200 text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <Globe className="w-5 h-5" />
              <span className="font-medium">{state.language === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>
            
            {/* Online Status */}
            <div className="flex items-center gap-3 px-4 py-2">
              {state.isOnline ? (
                <>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <div className="relative">
                      <Wifi className="w-5 h-5" />
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    </div>
                    <span className="text-sm font-medium">{t('online', state.language)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <WifiOff className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('offline', state.language)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-10 bg-card/90 border-b border-border backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-bold">Smart Farming</h1>
              <p className="text-[11px] text-muted-foreground">{currentContextLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {state.isOnline ? (
              <div className="relative mr-1">
                <Wifi className="w-5 h-5 text-green-600" />
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              </div>
            ) : (
              <WifiOff className="w-5 h-5 text-orange-600 mr-1" />
            )}
            <NotificationPanel />
            <button
              onClick={() => setLanguage(state.language === 'bn' ? 'en' : 'bn')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Globe className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:pl-72 pt-16 lg:pt-0 pb-20 lg:pb-0">
        <div className="container mx-auto p-4 md:p-6 max-w-7xl">
          {children}
        </div>
      </main>

      {/* Quick Detect FAB */}
      <DetectFAB />

      {/* Quick Guide */}
      <QuickGuide />

      {/* Real-time Status Indicator */}
      <RealtimeStatus />

      {/* Real-time Demo Trigger Panel */}
      <RealtimeTestPanel />

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-10 bg-card/90 border-t border-border backdrop-blur-xl shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
        <div className="flex justify-around px-2 py-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 ${
                isActive(item.path) 
                  ? 'text-primary scale-110' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
              {isActive(item.path) && (
                <div className="w-1 h-1 rounded-full bg-primary animate-pulse mt-0.5" />
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};