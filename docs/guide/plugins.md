# Plugins

Helix's plugin system allows external npm packages to add new generation targets (like Expo, Vue, Svelte, etc.).

## How Plugins Work

A Helix generator plugin is an npm package named `helix-gen-*` that exports a `GeneratorPlugin` object with a `generate(context)` function.

Helix scans your project's `package.json` for `helix-gen-*` dependencies and loads them automatically.

## Listing Plugins

```bash
helix plugin list
# or (legacy alias)
helix plugins
```

Output:
```
📦 Helix Plugin Registry

  web    → helix-gen-nextjs [built-in]
  flutter → helix-gen-flutter [built-in]
  expo   → helix-gen-expo [external]
```

## Installing a Plugin

```bash
helix plugin install helix-gen-expo
```

This runs `npm install helix-gen-expo` in your current directory.

## Writing a Plugin

Create a package named `helix-gen-<target>`:

**package.json:**
```json
{
  "name": "helix-gen-expo",
  "version": "1.0.0",
  "main": "index.js",
  "helix": {
    "target": "expo"
  }
}
```

**index.js:**
```javascript
const plugin = {
  name: 'helix-gen-expo',
  target: 'expo',
  version: '1.0.0',

  async generate(context) {
    const { prompt, projectName, projectPath, options, ast } = context;

    // context.ast contains the parsed Helix blueprint:
    //   ast.strands  — data models
    //   ast.views    — UI page definitions
    //   ast.enums    — enum definitions
    //   ast.auth     — auth configuration

    // Generate your target-specific files here
    console.log(`Generating Expo app: ${projectName}`);
  },
};

module.exports = plugin;
module.exports.default = plugin;
```

Then use it:
```bash
npm install helix-gen-expo
helix spawn "My app" --target expo
```

## Reference Plugin

A full reference implementation is included in the Helix repository:

```
examples/helix-gen-expo/
├── package.json
└── index.js
```

Clone the repo and use it as a starting point for your own plugin.
