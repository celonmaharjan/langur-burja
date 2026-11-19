import { useEffect, useState } from 'react';

// Table themes. `premium` is reserved for themes that could be sold later; every theme is free for now.
export const THEMES = [
  { id: 'classic', ne: 'परम्परागत', en: 'Classic felt', swatch: ['#0f3d30', '#e3b95a'], premium: false },
  { id: 'dashain', ne: 'दशैं', en: 'Dashain', swatch: ['#6b1620', '#f0b23a'], premium: false },
  { id: 'tihar', ne: 'तिहार', en: 'Tihar', swatch: ['#1b2a5e', '#ff9f1c'], premium: false },
];
const KEY = 'langur-burja:theme';
const read = () => { try { const v = localStorage.getItem(KEY); return THEMES.some((t) => t.id === v) ? v : 'classic'; } catch { return 'classic'; } };

export function useTheme() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg || '#0b1512');
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  return [theme, setTheme];
}
