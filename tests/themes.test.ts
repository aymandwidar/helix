import { describe, it, expect } from 'vitest';
import { THEMES, resolveTheme, generateThemeCSS, getThemeClasses } from '../src/themes/index.js';

describe('Themes', () => {
  it('has 6 themes defined', () => {
    expect(Object.keys(THEMES)).toHaveLength(6);
  });

  it('all themes have complete componentClasses', () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      expect(theme.componentClasses.primaryButton, `${name} missing primaryButton`).toBeTruthy();
      expect(theme.componentClasses.secondaryButton, `${name} missing secondaryButton`).toBeTruthy();
      expect(theme.componentClasses.card, `${name} missing card`).toBeTruthy();
      expect(theme.componentClasses.text, `${name} missing text`).toBeTruthy();
      expect(theme.componentClasses.textMuted, `${name} missing textMuted`).toBeTruthy();
      expect(theme.componentClasses.heading, `${name} missing heading`).toBeTruthy();
      expect(theme.componentClasses.badge, `${name} missing badge`).toBeTruthy();
      expect(theme.componentClasses.statusColors, `${name} missing statusColors`).toBeTruthy();
    }
  });

  it('all themes have complete CSS sections', () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      expect(theme.css.themeVars, `${name} missing themeVars`).toBeTruthy();
      expect(theme.css.body, `${name} missing body`).toBeTruthy();
      expect(theme.css.glass, `${name} missing glass`).toBeTruthy();
      expect(theme.css.inputs, `${name} missing inputs`).toBeTruthy();
      expect(theme.css.inputFocus, `${name} missing inputFocus`).toBeTruthy();
      expect(theme.css.inputPlaceholder, `${name} missing inputPlaceholder`).toBeTruthy();
    }
  });

  describe('resolveTheme', () => {
    it('defaults to glassmorphism', () => {
      expect(resolveTheme().name).toBe('Glassmorphism');
      expect(resolveTheme(undefined).name).toBe('Glassmorphism');
    });

    it('resolves by exact name', () => {
      expect(resolveTheme('professional').name).toBe('Professional');
      expect(resolveTheme('midnight').name).toBe('Midnight');
      expect(resolveTheme('sunset').name).toBe('Sunset');
    });

    it('resolves aliases', () => {
      expect(resolveTheme('dark').name).toBe('Glassmorphism');
      expect(resolveTheme('pro').name).toBe('Professional');
      expect(resolveTheme('simple').name).toBe('Minimal');
      expect(resolveTheme('social').name).toBe('Vibrant');
      expect(resolveTheme('corporate').name).toBe('Midnight');
      expect(resolveTheme('warm').name).toBe('Sunset');
    });

    it('is case-insensitive', () => {
      expect(resolveTheme('PROFESSIONAL').name).toBe('Professional');
      expect(resolveTheme('Midnight').name).toBe('Midnight');
    });
  });

  describe('generateThemeCSS', () => {
    it('produces valid CSS with tailwind import', () => {
      const css = generateThemeCSS(THEMES.glassmorphism);
      expect(css).toContain('@import "tailwindcss"');
      expect(css).toContain('body {');
      expect(css).toContain('.glass {');
    });
  });

  describe('getThemeClasses', () => {
    it('returns component classes for a theme', () => {
      const classes = getThemeClasses('midnight');
      expect(classes.primaryButton).toContain('bg-cyan');
      expect(classes.heading).toBe('text-white');
    });
  });
});
