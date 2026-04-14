import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useApp, Theme } from '../context/AppContext';

export const ThemeToggle: React.FC = () => {
  const { state, setTheme } = useApp();
  const currentTheme = state.theme;

  const themes: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
  ];

  return (
    <div className="inline-flex items-center rounded-2xl border border-border/70 bg-background/80 p-1 shadow-sm backdrop-blur-md">
      {themes.map(({ value, icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200
            ${
              currentTheme === value
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }
          `}
          title={label}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};
