/**
 * Pipeline Types — Shared context passed through all pipeline stages
 */

import type { HelixAST } from '../parser/index.js';
import type { SpawnOptions } from '../utils/constitutional-validator.js';

export interface PipelineContext {
  prompt: string;
  enrichedPrompt: string;
  projectName: string;
  projectPath: string;
  options: SpawnOptions;
  constitution?: string;
  connectionString?: string;
  ast?: HelixAST;
  blueprint?: string;
  activeThemeName?: string;
}

export const MAX_RETRY_ATTEMPTS = 3;
