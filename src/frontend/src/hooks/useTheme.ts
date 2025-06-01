import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [storedTheme, setStoredTheme] = useLocalStorage<Theme>('theme', 'dark');
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    // Update localStorage when theme changes
    setStoredTheme(theme);
    
    // Update document attributes
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, setStoredTheme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const darkMode = theme === 'dark'; // Added darkMode property

  return { theme, toggleTheme, darkMode }; // Returned darkMode
}
