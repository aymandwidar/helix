/**
 * Helix Theme Engine - Data-driven theme definitions
 * V2.0 - Replaces hardcoded Deep Void CSS with selectable themes
 */

export interface HelixTheme {
  name: string;
  description: string;
  css: {
    themeVars: string;
    body: string;
    glass: string;
    inputs: string;
    inputFocus: string;
    inputPlaceholder: string;
  };
  /** Tailwind class hints for generated UI components */
  componentClasses: {
    primaryButton: string;
    secondaryButton: string;
    card: string;
    text: string;
    textMuted: string;
    heading: string;
    badge: string;
    statusColors: { success: string; warning: string; info: string };
  };
}

export const THEMES: Record<string, HelixTheme> = {
  glassmorphism: {
    name: 'Glassmorphism',
    description: 'Dark gradient, gold accent — the Deep Void default',
    css: {
      themeVars: `@theme {
  --color-deep-void: #0f0f1a;
  --color-helix-gold: #FFD700;
}`,
      body: `body {
  background: linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0d1117 100%);
  color: white;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}`,
      glass: `.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
}`,
      inputs: `input, select, textarea {
  background: rgba(255, 255, 255, 0.05) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  color: white !important;
  border-radius: 0.375rem;
  padding: 0.75rem;
}`,
      inputFocus: `input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: #f59e0b !important;
  box-shadow: 0 0 0 1px #f59e0b !important;
}`,
      inputPlaceholder: `input::placeholder, textarea::placeholder {
  color: rgba(255, 255, 255, 0.5);
}`,
    },
    componentClasses: {
      primaryButton: 'bg-indigo-600 hover:bg-indigo-500 text-white',
      secondaryButton: 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300',
      card: 'glass',
      text: 'text-white',
      textMuted: 'text-gray-400',
      heading: 'text-white',
      badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      statusColors: { success: '#10b981', warning: '#f59e0b', info: '#6366f1' },
    },
  },

  professional: {
    name: 'Professional',
    description: 'Clean white, indigo accent — SaaS / business apps',
    css: {
      themeVars: `@theme {
  --color-primary: #4f46e5;
  --color-primary-light: #6366f1;
  --color-surface: #ffffff;
  --color-surface-alt: #f8fafc;
}`,
      body: `body {
  background: #f8fafc;
  color: #1e293b;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}`,
      glass: `.glass {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}`,
      inputs: `input, select, textarea {
  background: #ffffff !important;
  border: 1px solid #d1d5db !important;
  color: #1e293b !important;
  border-radius: 0.375rem;
  padding: 0.75rem;
}`,
      inputFocus: `input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: #4f46e5 !important;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2) !important;
}`,
      inputPlaceholder: `input::placeholder, textarea::placeholder {
  color: #9ca3af;
}`,
    },
    componentClasses: {
      primaryButton: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      secondaryButton: 'bg-white hover:bg-gray-50 border border-gray-300 text-gray-700',
      card: 'glass',
      text: 'text-slate-800',
      textMuted: 'text-slate-500',
      heading: 'text-slate-900',
      badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      statusColors: { success: '#059669', warning: '#d97706', info: '#4f46e5' },
    },
  },

  minimal: {
    name: 'Minimal',
    description: 'Pure white, black accent — productivity / tools',
    css: {
      themeVars: `@theme {
  --color-primary: #000000;
  --color-surface: #ffffff;
  --color-border: #e5e5e5;
}`,
      body: `body {
  background: #ffffff;
  color: #171717;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}`,
      glass: `.glass {
  background: #ffffff;
  border: 1px solid #e5e5e5;
  border-radius: 0.5rem;
}`,
      inputs: `input, select, textarea {
  background: #fafafa !important;
  border: 1px solid #e5e5e5 !important;
  color: #171717 !important;
  border-radius: 0.375rem;
  padding: 0.75rem;
}`,
      inputFocus: `input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: #000000 !important;
  box-shadow: 0 0 0 1px #000000 !important;
}`,
      inputPlaceholder: `input::placeholder, textarea::placeholder {
  color: #a3a3a3;
}`,
    },
    componentClasses: {
      primaryButton: 'bg-black hover:bg-neutral-800 text-white',
      secondaryButton: 'bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-700',
      card: 'glass',
      text: 'text-neutral-900',
      textMuted: 'text-neutral-500',
      heading: 'text-black',
      badge: 'bg-neutral-100 text-neutral-700 border border-neutral-200',
      statusColors: { success: '#16a34a', warning: '#ca8a04', info: '#171717' },
    },
  },

  vibrant: {
    name: 'Vibrant',
    description: 'Gradient UI, pink accent — social / consumer apps',
    css: {
      themeVars: `@theme {
  --color-primary: #ec4899;
  --color-primary-light: #f472b6;
  --color-accent: #8b5cf6;
}`,
      body: `body {
  background: linear-gradient(135deg, #fdf2f8 0%, #ede9fe 50%, #f0f9ff 100%);
  color: #1e1b4b;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}`,
      glass: `.glass {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(236, 72, 153, 0.15);
  border-radius: 1rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.04);
}`,
      inputs: `input, select, textarea {
  background: rgba(255, 255, 255, 0.8) !important;
  border: 1px solid rgba(236, 72, 153, 0.2) !important;
  color: #1e1b4b !important;
  border-radius: 0.5rem;
  padding: 0.75rem;
}`,
      inputFocus: `input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: #ec4899 !important;
  box-shadow: 0 0 0 2px rgba(236, 72, 153, 0.2) !important;
}`,
      inputPlaceholder: `input::placeholder, textarea::placeholder {
  color: #a78bfa;
}`,
    },
    componentClasses: {
      primaryButton: 'bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600 text-white',
      secondaryButton: 'bg-white/70 hover:bg-white border border-pink-200 text-pink-700',
      card: 'glass',
      text: 'text-indigo-950',
      textMuted: 'text-indigo-400',
      heading: 'text-indigo-900',
      badge: 'bg-pink-100 text-pink-700 border border-pink-200',
      statusColors: { success: '#10b981', warning: '#f59e0b', info: '#8b5cf6' },
    },
  },

  midnight: {
    name: 'Midnight',
    description: 'Dark blue, cyan accent — corporate / dashboard apps',
    css: {
      themeVars: `@theme {
  --color-primary: #06b6d4;
  --color-primary-light: #22d3ee;
  --color-surface: #0f172a;
  --color-surface-alt: #1e293b;
}`,
      body: `body {
  background: linear-gradient(180deg, #0f172a 0%, #020617 100%);
  color: #e2e8f0;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}`,
      glass: `.glass {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(6, 182, 212, 0.1);
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}`,
      inputs: `input, select, textarea {
  background: rgba(30, 41, 59, 0.8) !important;
  border: 1px solid rgba(6, 182, 212, 0.2) !important;
  color: #e2e8f0 !important;
  border-radius: 0.375rem;
  padding: 0.75rem;
}`,
      inputFocus: `input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: #06b6d4 !important;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2) !important;
}`,
      inputPlaceholder: `input::placeholder, textarea::placeholder {
  color: #64748b;
}`,
    },
    componentClasses: {
      primaryButton: 'bg-cyan-600 hover:bg-cyan-500 text-white',
      secondaryButton: 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300',
      card: 'glass',
      text: 'text-slate-200',
      textMuted: 'text-slate-400',
      heading: 'text-white',
      badge: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      statusColors: { success: '#10b981', warning: '#f59e0b', info: '#06b6d4' },
    },
  },

  sunset: {
    name: 'Sunset',
    description: 'Warm gradient, orange accent — creative / portfolio apps',
    css: {
      themeVars: `@theme {
  --color-primary: #f97316;
  --color-primary-light: #fb923c;
  --color-accent: #e11d48;
}`,
      body: `body {
  background: linear-gradient(135deg, #1c1917 0%, #292524 40%, #1c1917 100%);
  color: #fafaf9;
  min-height: 100vh;
  font-family: system-ui, -apple-system, sans-serif;
}`,
      glass: `.glass {
  background: rgba(41, 37, 36, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(249, 115, 22, 0.12);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}`,
      inputs: `input, select, textarea {
  background: rgba(41, 37, 36, 0.8) !important;
  border: 1px solid rgba(249, 115, 22, 0.2) !important;
  color: #fafaf9 !important;
  border-radius: 0.375rem;
  padding: 0.75rem;
}`,
      inputFocus: `input:focus, select:focus, textarea:focus {
  outline: none !important;
  border-color: #f97316 !important;
  box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2) !important;
}`,
      inputPlaceholder: `input::placeholder, textarea::placeholder {
  color: #78716c;
}`,
    },
    componentClasses: {
      primaryButton: 'bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white',
      secondaryButton: 'bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-300',
      card: 'glass',
      text: 'text-stone-100',
      textMuted: 'text-stone-400',
      heading: 'text-white',
      badge: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
      statusColors: { success: '#22c55e', warning: '#f97316', info: '#e11d48' },
    },
  },
};

/**
 * Resolve a theme name from a .helix AST view property.
 * Handles case-insensitive matching and common aliases.
 */
export function resolveTheme(themeName?: string): HelixTheme {
  if (!themeName) return THEMES.glassmorphism;

  const normalized = themeName.toLowerCase().replace(/[\s-_]/g, '');

  const aliases: Record<string, string> = {
    'glassmorphism': 'glassmorphism',
    'glass': 'glassmorphism',
    'deepvoid': 'glassmorphism',
    'dark': 'glassmorphism',
    'professional': 'professional',
    'pro': 'professional',
    'saas': 'professional',
    'business': 'professional',
    'clean': 'professional',
    'minimal': 'minimal',
    'minimalist': 'minimal',
    'simple': 'minimal',
    'productivity': 'minimal',
    'vibrant': 'vibrant',
    'colorful': 'vibrant',
    'social': 'vibrant',
    'gradient': 'vibrant',
    'fun': 'vibrant',
    'midnight': 'midnight',
    'corporate': 'midnight',
    'dashboard': 'midnight',
    'darkblue': 'midnight',
    'sunset': 'sunset',
    'warm': 'sunset',
    'creative': 'sunset',
    'portfolio': 'sunset',
    'orange': 'sunset',
  };

  const resolved = aliases[normalized];
  return resolved ? THEMES[resolved] : THEMES.glassmorphism;
}

/**
 * Generate the full globals.css content for a given theme.
 */
export function generateThemeCSS(theme: HelixTheme): string {
  return `@import "tailwindcss";
@source "../**/*.tsx";

${theme.css.themeVars}

${theme.css.body}

${theme.css.glass}

${theme.css.inputs}

${theme.css.inputFocus}

${theme.css.inputPlaceholder}
`;
}

/**
 * Get complete CSS variables string for a theme by name.
 * Resolves aliases (e.g. "dark" -> glassmorphism, "pro" -> professional).
 */
export function getThemeCSS(themeName?: string): string {
  const theme = resolveTheme(themeName);
  return generateThemeCSS(theme);
}

/**
 * Get Tailwind class mappings for UI components by theme name.
 * Returns classes for cards, buttons, inputs, text, and backgrounds.
 */
export function getThemeClasses(themeName?: string): HelixTheme['componentClasses'] {
  const theme = resolveTheme(themeName);
  return theme.componentClasses;
}
