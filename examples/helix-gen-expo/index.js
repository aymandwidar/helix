/**
 * helix-gen-expo
 * Reference Helix generator plugin for Expo (React Native)
 *
 * Implements the GeneratorPlugin interface expected by Helix's PluginRegistry.
 * Install with: npm install helix-gen-expo
 * Use with:     helix spawn "My app" --target expo
 */

const plugin = {
  name: 'helix-gen-expo',
  target: 'expo',
  version: '1.0.0',

  /**
   * Generate an Expo project from a Helix AST.
   * @param {object} context - PipelineContext
   * @returns {Promise<void>}
   */
  async generate(context) {
    const { prompt, projectName, projectPath, options } = context;

    console.log(`[helix-gen-expo] Generating Expo app: ${projectName}`);
    console.log(`[helix-gen-expo] Prompt: ${prompt}`);

    // Plugin authors: implement your generator here.
    // You have access to:
    //   context.ast          — parsed HelixAST (strands, strategies, views, etc.)
    //   context.projectPath  — absolute output directory
    //   context.options      — CLI options (theme, db, etc.)
    //
    // Typical steps:
    //   1. Run `npx create-expo-app projectName` via execa
    //   2. Generate screens from context.ast.views
    //   3. Generate Prisma / SQLite schema from context.ast.strands
    //   4. Write navigation, components, and styles

    console.log('[helix-gen-expo] ✅ Done (reference implementation — add real generation logic)');
  },
};

module.exports = plugin;
module.exports.default = plugin;
