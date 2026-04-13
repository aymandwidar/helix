# Themes

Helix includes 6 built-in UI themes, each providing a distinct visual style with matching Tailwind CSS component classes.

## Available Themes

### glassmorphism
Frosted glass effect with backdrop blur, subtle borders, and indigo accents.

```bash
helix spawn "My app" --theme glassmorphism
```

**Palette:** Dark background with frosted glass cards, indigo/purple gradients.

---

### professional
Clean, corporate design with solid colors and structured layouts.

```bash
helix spawn "My app" --theme professional
```

**Palette:** Navy blue, white, clean grid system.

---

### minimal
Ultra-clean, typography-focused design with maximum whitespace.

```bash
helix spawn "My app" --theme minimal
```

**Palette:** White/off-white with gray text, no decorative elements.

---

### vibrant
Bold, colorful design with strong contrasts and gradients.

```bash
helix spawn "My app" --theme vibrant
```

**Palette:** Purple/pink/cyan gradients, high saturation.

---

### midnight
Dark blue corporate theme — elegant and sophisticated.

```bash
helix spawn "My app" --theme midnight
```

**Palette:** Deep navy, slate blue, silver accents.

---

### sunset
Warm gradient theme with amber/orange/rose tones.

```bash
helix spawn "My app" --theme sunset
```

**Palette:** Amber, orange, rose gradient backgrounds.

---

## Theme Aliases

Themes support shorthand aliases:

| Alias | Theme |
|---|---|
| `glass` | glassmorphism |
| `pro` | professional |
| `clean` | minimal |
| `dark` | midnight |
| `warm` | sunset |
| `bright` | vibrant |

```bash
helix spawn "My app" --theme glass
helix spawn "My app" --theme dark
```

## Custom Themes

Themes are defined in `src/themes/index.ts`. Each theme provides:
- CSS custom properties for colors and gradients
- Tailwind component class mappings (card, button, input, nav, etc.)
- A system prompt hint that guides the AI's design choices
