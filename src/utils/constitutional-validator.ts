/**
 * Constitutional Helix - Validation & Compliance System
 * Enforces UI Constitution (Deep Void) and AI Constitution (AI-First Agent)
 */

import chalk from 'chalk';

// ============================================
// CONSTITUTIONAL DEFINITIONS
// ============================================

export const UI_CONSTITUTION = {
    background: {
        gradient: ['#0f0c29', '#000000'],
        law: 'All core views must use Deep Void gradient',
    },
    glassmorphism: {
        blur: '16px',
        transparency: 'rgba(255, 255, 255, 0.1)',
        border: 'rgba(255, 255, 255, 0.2)',
        law: 'All cards use glass blur with 10% white fill, 20% white border',
    },
    accent: {
        helixGold: '#FFD700',
        law: 'Reserved for high-action elements only (CTAs, FABs)',
    },
    spacing: {
        grid: [8, 16, 24],
        law: 'Strict 8px/16px/24px spacing system',
    },
} as const;

export const AI_CONSTITUTION = {
    contextAwareness: {
        requirement: 'Redis caching for user context memory',
        law: 'AI must remember past interactions',
    },
    proactiveIntelligence: {
        requirement: 'One predictive feature per app',
        example: 'Predict maintenance based on usage patterns',
        law: 'Every app must be proactive, not just reactive',
    },
    safetyHealth: {
        requirement: 'Helix Evolve pre-scan before generation',
        law: 'Prevent N+1 queries and inefficient renders at birth',
    },
    naturalInterface: {
        preference: 'Chat/voice over complex menus',
        law: 'Favor conversational interfaces',
    },
} as const;

// ============================================
// VALIDATION TYPES
// ============================================

export interface ConstitutionalViolation {
    type: 'ui' | 'ai';
    severity: 'low' | 'medium' | 'high';
    law: string;
    message: string;
    suggestion: string;
    autoFixable: boolean;
}

export interface ConstitutionalReport {
    compliant: boolean;
    score: number;
    violations: ConstitutionalViolation[];
    warnings: string[];
}

export interface SpawnOptions {
    target?: 'web' | 'flutter';
    db?: string;
    theme?: string;
    aiContext?: boolean;
    cache?: boolean;
    noConstitution?: boolean;
    components?: string[];
}

// ============================================
// VALIDATORS
// ============================================

export function validateUIConstitution(prompt: string, options: SpawnOptions): ConstitutionalViolation[] {
    const violations: ConstitutionalViolation[] = [];

    // V2: Accept any valid theme — only flag if no theme at all
    const validThemes = ['deep-void', 'glassmorphism', 'glass', 'professional', 'pro', 'saas',
        'business', 'clean', 'minimal', 'minimalist', 'simple', 'vibrant', 'colorful', 'social',
        'midnight', 'corporate', 'dashboard', 'darkblue', 'sunset', 'warm', 'creative', 'portfolio', 'orange'];
    const hasValidTheme = options.theme && validThemes.includes(options.theme.toLowerCase());

    if (!hasValidTheme) {
        violations.push({
            type: 'ui',
            severity: 'low', // Downgraded from 'high' — glassmorphism is applied as default anyway
            law: UI_CONSTITUTION.background.law,
            message: 'No explicit theme specified — defaulting to Glassmorphism',
            suggestion: 'Set --theme <name> to choose: glassmorphism, professional, minimal, vibrant',
            autoFixable: true,
        });
    }

    // Check for glass/blur mentions
    const hasGlassmorphism = prompt.toLowerCase().includes('glass') ||
        prompt.toLowerCase().includes('blur') ||
        prompt.toLowerCase().includes('frosted');

    if (!hasGlassmorphism && !prompt.includes('card')) {
        violations.push({
            type: 'ui',
            severity: 'medium',
            law: UI_CONSTITUTION.glassmorphism.law,
            message: 'No glassmorphism UI specified',
            suggestion: 'Cards should use blur(16px) with glass effect',
            autoFixable: false,
        });
    }

    // Check spacing mentions
    const hasSpacing = prompt.match(/\d+(px|rem)/);
    if (!hasSpacing) {
        violations.push({
            type: 'ui',
            severity: 'low',
            law: UI_CONSTITUTION.spacing.law,
            message: 'No spacing system mentioned',
            suggestion: 'Use 8/16/24px grid for consistent spacing',
            autoFixable: false,
        });
    }

    return violations;
}

export function validateAIConstitution(prompt: string, options: SpawnOptions): ConstitutionalViolation[] {
    const violations: ConstitutionalViolation[] = [];

    // Check Redis context
    const hasRedis = prompt.toLowerCase().includes('redis') ||
        options.cache ||
        options.db?.includes('redis');

    if (!hasRedis) {
        violations.push({
            type: 'ai',
            severity: 'medium',
            law: AI_CONSTITUTION.contextAwareness.law,
            message: 'No Redis context layer specified',
            suggestion: 'Add --cache or include redis in --db for user context memory',
            autoFixable: true,
        });
    }

    // Check for predictive features
    const hasPredictive = prompt.toLowerCase().includes('predict') ||
        prompt.toLowerCase().includes('suggest') ||
        prompt.toLowerCase().includes('recommend') ||
        prompt.toLowerCase().includes('forecast');

    if (!hasPredictive) {
        violations.push({
            type: 'ai',
            severity: 'high',
            law: AI_CONSTITUTION.proactiveIntelligence.law,
            message: 'No predictive AI feature detected',
            suggestion: 'Add AI prediction/suggestion capability to make app proactive',
            autoFixable: false,
        });
    }

    // Check for natural interface
    const hasNaturalUI = prompt.toLowerCase().includes('chat') ||
        prompt.toLowerCase().includes('voice') ||
        prompt.toLowerCase().includes('conversation');

    if (!hasNaturalUI && !prompt.includes('dashboard')) {
        violations.push({
            type: 'ai',
            severity: 'low',
            law: AI_CONSTITUTION.naturalInterface.law,
            message: 'No natural interface (chat/voice) specified',
            suggestion: 'Consider chat or voice input for better UX',
            autoFixable: false,
        });
    }

    return violations;
}

export function validateConstitution(prompt: string, options: SpawnOptions): ConstitutionalReport {
    // Bypass if explicitly disabled
    if (options.noConstitution) {
        return {
            compliant: true,
            score: 100,
            violations: [],
            warnings: ['Constitutional validation bypassed with --no-constitution'],
        };
    }

    const uiViolations = validateUIConstitution(prompt, options);
    const aiViolations = validateAIConstitution(prompt, options);
    const allViolations = [...uiViolations, ...aiViolations];

    // Calculate score
    const highCount = allViolations.filter(v => v.severity === 'high').length;
    const mediumCount = allViolations.filter(v => v.severity === 'medium').length;
    const lowCount = allViolations.filter(v => v.severity === 'low').length;

    const score = Math.max(0, 100 - (highCount * 15 + mediumCount * 8 + lowCount * 3));
    const compliant = score >= 70; // 70% threshold for compliance

    return {
        compliant,
        score,
        violations: allViolations,
        warnings: [],
    };
}

export function autoCorrectOptions(options: SpawnOptions, violations: ConstitutionalViolation[]): SpawnOptions {
    const corrected = { ...options };

    violations.forEach(violation => {
        if (!violation.autoFixable) return;

        // Auto-fix theme — default to glassmorphism if none specified
        if (violation.message.includes('theme')) {
            corrected.theme = corrected.theme || 'glassmorphism';
        }

        // Auto-add Redis cache
        if (violation.message.includes('Redis')) {
            corrected.cache = true;
            if (corrected.db && !corrected.db.includes('redis')) {
                corrected.db += ',redis';
            } else if (!corrected.db) {
                corrected.db = 'redis';
            }
        }
    });

    return corrected;
}

export function printConstitutionalReport(report: ConstitutionalReport): void {
    console.log(chalk.cyan('\n📜 Constitutional Compliance Report\n'));

    // Score
    const scoreColor = report.score >= 90 ? chalk.green :
        report.score >= 70 ? chalk.yellow :
            chalk.red;

    console.log(scoreColor(`Score: ${report.score}/100`));
    console.log(report.compliant ? chalk.green('✅ Compliant') : chalk.red('❌ Non-Compliant'));

    // Violations
    if (report.violations.length > 0) {
        console.log(chalk.yellow(`\n⚠️  ${report.violations.length} Constitutional Violations:\n`));

        report.violations.forEach((v, index) => {
            const severityIcon = v.severity === 'high' ? '🔴' :
                v.severity === 'medium' ? '🟡' :
                    '⚪';

            console.log(`${severityIcon} ${index + 1}. [${v.type.toUpperCase()}] ${v.message}`);
            console.log(chalk.gray(`   Law: "${v.law}"`));
            console.log(chalk.cyan(`   💡 ${v.suggestion}`));
            if (v.autoFixable) {
                console.log(chalk.green('   ✨ Auto-fixable'));
            }
            console.log('');
        });
    }

    // Warnings
    if (report.warnings.length > 0) {
        console.log(chalk.yellow('Warnings:'));
        report.warnings.forEach(w => console.log(chalk.gray(`  - ${w}`)));
    }
}

export function enhancePromptWithConstitution(prompt: string): string {
    const enhancement = `
CONSTITUTIONAL REQUIREMENTS:

UI Constitution - Deep Void:
- Background: Linear gradient #0f0c29 → #000000
- Cards: backdrop-filter blur(16px), rgba(255,255,255,0.1), border rgba(255,255,255,0.2)
- Accent: #FFD700 for CTAs/FABs only
- Spacing: 8px/16px/24px grid

AI Constitution - AI-First:
- Redis context for user memory
- One predictive AI feature
- Natural interface (chat/voice preferred)
`;

    return `${prompt}\n${enhancement}`;
}
