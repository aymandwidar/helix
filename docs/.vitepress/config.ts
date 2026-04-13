import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Helix',
  description: 'AI-Native Development Platform — Generate full-stack apps from natural language',
  base: '/helix/',

  head: [
    ['meta', { name: 'theme-color', content: '#6366f1' }],
    ['link', { rel: 'icon', href: '/helix/favicon.ico' }],
  ],

  themeConfig: {
    logo: '⬡',
    siteTitle: 'Helix',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'DSL Reference', link: '/guide/helix-dsl' },
      { text: 'Examples', link: '/examples/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/helix-lang' },
      { text: 'GitHub', link: 'https://github.com/aymandwidar/helix' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/guide/getting-started' },
          { text: 'Installation', link: '/guide/getting-started#installation' },
          { text: 'Quick Start', link: '/guide/getting-started#quick-start' },
        ],
      },
      {
        text: 'Core Concepts',
        items: [
          { text: 'The spawn Command', link: '/guide/spawn-command' },
          { text: 'Helix DSL', link: '/guide/helix-dsl' },
          { text: 'Themes', link: '/guide/themes' },
          { text: 'Self-Healing', link: '/guide/self-healing' },
        ],
      },
      {
        text: 'Features',
        items: [
          { text: 'Templates (helix init)', link: '/guide/templates' },
          { text: 'Web Dashboard', link: '/guide/web-dashboard' },
          { text: 'Deploy', link: '/guide/deploy' },
          { text: 'Collaboration', link: '/guide/collaboration' },
          { text: 'Plugins', link: '/guide/plugins' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'All Examples', link: '/examples/' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/aymandwidar/helix' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Ayman Dwidar',
    },

    search: { provider: 'local' },
  },
});
