/**
 * Pipeline Phase 2: Blueprint — Generate and validate .helix blueprint with self-healing
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import ora from 'ora';
import { createCompletion, DEFAULT_MODEL } from '../openrouter.js';
import { parseHelix } from '../parser/index.js';
import { HELIX_SYNTAX_GUIDE } from '../types.js';
import { MAX_RETRY_ATTEMPTS, type PipelineContext } from './types.js';

/**
 * Generate a .helix blueprint from the prompt, with self-healing retry.
 * Mutates ctx.blueprint on success.
 */
export async function generateBlueprintPhase(ctx: PipelineContext): Promise<void> {
  let blueprint = '';
  let attempts = 0;
  let success = false;

  while (attempts < MAX_RETRY_ATTEMPTS && !success) {
    attempts++;
    const spinner = ora(`Designing blueprint... (attempt ${attempts}/${MAX_RETRY_ATTEMPTS})`).start();

    try {
      blueprint = await callBlueprintLLM(ctx.enrichedPrompt, ctx.constitution);
      parseHelix(blueprint);
      success = true;
      spinner.succeed('Blueprint designed');
    } catch (error: any) {
      const errMsg = error.message || String(error);
      if (attempts < MAX_RETRY_ATTEMPTS) {
        spinner.warn(`Blueprint parse failed, self-healing... (${errMsg.substring(0, 80)})`);
        blueprint = await repairBlueprint(blueprint, errMsg);
        try {
          parseHelix(blueprint);
          success = true;
          console.log(chalk.green('  ✅ Self-healed blueprint'));
        } catch {
          // Will retry in next loop iteration
        }
      } else {
        spinner.fail('Blueprint generation failed after retries');
        throw error;
      }
    }
  }

  ctx.blueprint = blueprint;
  await fs.writeFile(path.join(ctx.projectPath, 'blueprint.helix'), blueprint);
}

async function callBlueprintLLM(prompt: string, constitution?: string): Promise<string> {
  let constitutionSection = '';
  if (constitution) {
    constitutionSection = `
=== CONSTITUTION / PROJECT CONTEXT ===
The following guidelines MUST be followed when designing the application:

${constitution}

=== END CONSTITUTION ===

`;
  }

  const systemPrompt = `${constitutionSection}You are the Helix Architect v11.1.
Your task is to convert a natural language app description into a valid Helix blueprint.

${HELIX_SYNTAX_GUIDE}

RULES:
- Create appropriate strands for the data models needed
- Create views that make sense for the user's request
- Keep it simple but complete
- Output ONLY valid Helix code, no markdown fences or explanations
${constitution ? '- IMPORTANT: Follow ALL guidelines from the CONSTITUTION section above' : ''}

Example output:
strand Task {
  field title: String
  field is_completed: Boolean
  field priority: Int
}

view TaskList {
  list: Task.all()
  theme: Glassmorphism
}
`;

  return await createCompletion(
    systemPrompt,
    `Create a Helix blueprint for: ${prompt}`,
    { model: DEFAULT_MODEL, maxTokens: 2048 },
  );
}

async function repairBlueprint(blueprint: string, error: string): Promise<string> {
  const systemPrompt = `You are a Helix blueprint repair specialist.
Fix the syntax errors in the provided .helix blueprint.

RULES:
- Output ONLY valid Helix code, no markdown fences or explanations
- Keep the same strands and views, just fix the syntax
- strands use: strand Name { field fieldName: Type }
- views use: view Name { list: StrandName.all() }
- Valid types: String, Int, Float, Boolean, DateTime
`;

  return await createCompletion(systemPrompt,
    `Fix this broken Helix blueprint:

ERROR: ${error}

BLUEPRINT:
${blueprint}

Output the corrected blueprint:`,
    { model: DEFAULT_MODEL, maxTokens: 2048, thinking: true },
  );
}
