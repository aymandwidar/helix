/**
 * Pipeline Phase 1.5: Scope — Analyze complex prompts and generate requirements
 */

import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import ora from 'ora';
import { createCompletion, LOCAL_MODEL } from '../openrouter.js';
import type { PipelineContext } from './types.js';

/**
 * Runs the scope stage if the prompt is complex enough.
 * Mutates ctx.enrichedPrompt with requirements if successful.
 */
export async function scope(ctx: PipelineContext): Promise<void> {
  const isComplex = ctx.prompt.split(/\s+/).length > 30 || countEntityMentions(ctx.prompt) >= 3;
  if (!isComplex) return;

  const spinner = ora('Analyzing requirements (complex prompt detected)...').start();
  try {
    const requirements = await generateRequirements(ctx.prompt);
    spinner.succeed('Requirements analyzed');
    await fs.writeFile(path.join(ctx.projectPath, 'requirements.json'), requirements);
    ctx.enrichedPrompt = `${ctx.prompt}\n\n=== REQUIREMENTS ANALYSIS ===\n${requirements}\n=== END REQUIREMENTS ===`;
  } catch {
    spinner.warn('SCOPE stage failed — proceeding with direct blueprint generation');
  }
}

function countEntityMentions(prompt: string): number {
  const entityPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const matches = prompt.match(entityPattern) || [];
  return new Set(matches.map(m => m.toLowerCase())).size;
}

async function generateRequirements(prompt: string): Promise<string> {
  const systemPrompt = `You are a requirements analyst for a code generation system.
Analyze the user's app description and produce a structured JSON requirements document.

Output ONLY valid JSON with this structure:
{
  "models": [
    {
      "name": "ModelName",
      "fields": [{ "name": "fieldName", "type": "String|Int|Float|Boolean|DateTime" }],
      "relations": [{ "name": "relName", "target": "OtherModel", "type": "belongs_to|has_many" }]
    }
  ],
  "views": [
    { "name": "ViewName", "displays": "ModelName", "type": "list|kanban|feed|gallery" }
  ],
  "theme": "glassmorphism|professional|minimal|vibrant",
  "complexity": "simple|moderate|complex"
}

Rules:
- Identify ALL data models and their relationships
- Choose appropriate field types
- Detect the best view type for each model
- Suggest a theme that matches the domain
- Output ONLY JSON, no markdown fences or explanations`;

  return await createCompletion(
    systemPrompt,
    `Analyze requirements for: ${prompt}`,
    { model: LOCAL_MODEL, maxTokens: 2048 },
  );
}
