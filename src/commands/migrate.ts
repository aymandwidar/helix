/**
 * Helix Schema Migration System
 * Detects .helix blueprint changes and generates Prisma migrations
 */
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { parseHelix, generatePrismaSchema, HelixAST, HelixField } from '../parser';

interface SchemaDiff {
  addedStrands: string[];
  removedStrands: string[];
  modifiedStrands: {
    name: string;
    addedFields: HelixField[];
    removedFields: string[];
    modifiedFields: { name: string; oldType: string; newType: string }[];
  }[];
}

/**
 * Compare two ASTs and return the diff
 */
function diffSchemas(oldAst: HelixAST, newAst: HelixAST): SchemaDiff {
  const oldNames = new Set(oldAst.strands.map(s => s.name));
  const newNames = new Set(newAst.strands.map(s => s.name));

  const diff: SchemaDiff = {
    addedStrands: [...newNames].filter(n => !oldNames.has(n)),
    removedStrands: [...oldNames].filter(n => !newNames.has(n)),
    modifiedStrands: []
  };

  // Check modified strands
  for (const newStrand of newAst.strands) {
    const oldStrand = oldAst.strands.find(s => s.name === newStrand.name);
    if (!oldStrand) continue; // handled by addedStrands

    const oldFields = new Map((oldStrand.fields || []).map(f => [f.name, f]));
    const newFields = new Map((newStrand.fields || []).map(f => [f.name, f]));

    const addedFields = (newStrand.fields || []).filter(f => !oldFields.has(f.name));
    const removedFields = (oldStrand.fields || []).filter(f => !newFields.has(f.name)).map(f => f.name);
    const modifiedFields: { name: string; oldType: string; newType: string }[] = [];

    for (const [name, newField] of newFields) {
      const oldField = oldFields.get(name);
      if (oldField && oldField.type !== newField.type) {
        modifiedFields.push({ name, oldType: oldField.type, newType: newField.type });
      }
    }

    if (addedFields.length > 0 || removedFields.length > 0 || modifiedFields.length > 0) {
      diff.modifiedStrands.push({
        name: newStrand.name,
        addedFields,
        removedFields,
        modifiedFields
      });
    }
  }

  return diff;
}

/**
 * Format the diff for display
 */
function formatDiff(diff: SchemaDiff): string {
  const lines: string[] = [];

  if (diff.addedStrands.length > 0) {
    lines.push('  Added strands:');
    diff.addedStrands.forEach(s => lines.push(`    + ${s}`));
  }

  if (diff.removedStrands.length > 0) {
    lines.push('  Removed strands:');
    diff.removedStrands.forEach(s => lines.push(`    - ${s}`));
  }

  for (const mod of diff.modifiedStrands) {
    lines.push(`  Modified: ${mod.name}`);
    mod.addedFields.forEach(f => lines.push(`    + ${f.name}: ${f.type}`));
    mod.removedFields.forEach(f => lines.push(`    - ${f}`));
    mod.modifiedFields.forEach(f => lines.push(`    ~ ${f.name}: ${f.oldType} \u2192 ${f.newType}`));
  }

  return lines.join('\n');
}

/**
 * Check if there are any changes
 */
function hasChanges(diff: SchemaDiff): boolean {
  return diff.addedStrands.length > 0 ||
    diff.removedStrands.length > 0 ||
    diff.modifiedStrands.length > 0;
}

/**
 * Main migrate function
 */
export async function migrate(action: string, projectPath: string): Promise<void> {
  const helixConfigPath = path.join(projectPath, 'helix.config.json');
  const prismaSchemaPath = path.join(projectPath, 'prisma', 'schema.prisma');
  const snapshotDir = path.join(projectPath, '.helix-snapshots');

  switch (action) {
    case 'status': {
      console.log(chalk.cyan('\n  Migration Status\n'));

      if (!fs.existsSync(helixConfigPath)) {
        console.log(chalk.yellow('  Not a Helix project (no helix.config.json)'));
        return;
      }

      const config = JSON.parse(fs.readFileSync(helixConfigPath, 'utf-8'));
      const lastSnapshot = path.join(snapshotDir, 'last.helix');

      if (!fs.existsSync(lastSnapshot)) {
        console.log(chalk.yellow('  No snapshot found. Run "helix evolve migrate snapshot" first.'));
        return;
      }

      if (!config.blueprint) {
        console.log(chalk.yellow('  No blueprint content in helix.config.json'));
        return;
      }

      const oldAst = parseHelix(fs.readFileSync(lastSnapshot, 'utf-8'));
      const newAst = parseHelix(config.blueprint);
      const diff = diffSchemas(oldAst, newAst);

      if (hasChanges(diff)) {
        console.log(chalk.yellow('  Changes detected:\n'));
        console.log(formatDiff(diff));
        console.log(chalk.gray('\n  Run "helix evolve migrate apply" to generate migration.'));
      } else {
        console.log(chalk.green('  Schema is up to date. No changes detected.'));
      }
      break;
    }

    case 'snapshot': {
      console.log(chalk.cyan('\n  Creating Schema Snapshot\n'));

      if (!fs.existsSync(helixConfigPath)) {
        console.log(chalk.yellow('  Not a Helix project.'));
        return;
      }

      const config = JSON.parse(fs.readFileSync(helixConfigPath, 'utf-8'));
      if (!config.blueprint) {
        // Try to reconstruct from prisma schema
        if (fs.existsSync(prismaSchemaPath)) {
          fs.mkdirSync(snapshotDir, { recursive: true });
          fs.copyFileSync(prismaSchemaPath, path.join(snapshotDir, 'last.prisma'));
          console.log(chalk.green('  Prisma schema snapshot saved'));
        } else {
          console.log(chalk.yellow('  No blueprint or prisma schema found.'));
        }
        return;
      }

      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(path.join(snapshotDir, 'last.helix'), config.blueprint);

      // Also save current timestamp
      const meta = {
        snapshotAt: new Date().toISOString(),
        strandCount: parseHelix(config.blueprint).strands.length
      };
      fs.writeFileSync(path.join(snapshotDir, 'meta.json'), JSON.stringify(meta, null, 2));

      console.log(chalk.green('  Snapshot saved. Future changes will be detected against this baseline.'));
      break;
    }

    case 'apply': {
      console.log(chalk.cyan('\n  Applying Schema Migration\n'));

      if (!fs.existsSync(helixConfigPath)) {
        console.log(chalk.yellow('  Not a Helix project.'));
        return;
      }

      const config = JSON.parse(fs.readFileSync(helixConfigPath, 'utf-8'));
      if (!config.blueprint) {
        console.log(chalk.yellow('  No blueprint content found.'));
        return;
      }

      const newAst = parseHelix(config.blueprint);
      const newSchema = generatePrismaSchema(newAst);

      // Backup current schema
      if (fs.existsSync(prismaSchemaPath)) {
        const backupPath = prismaSchemaPath + '.backup.' + Date.now();
        fs.copyFileSync(prismaSchemaPath, backupPath);
        console.log(chalk.gray(`  Backed up current schema to ${path.basename(backupPath)}`));
      }

      // Write new schema
      fs.writeFileSync(prismaSchemaPath, newSchema);
      console.log(chalk.green('  Updated prisma/schema.prisma'));

      // Run prisma migrate
      try {
        const migrationName = `helix_${Date.now()}`;
        console.log(chalk.gray(`  Running prisma migrate dev --name ${migrationName}...`));
        execSync(`npx prisma migrate dev --name ${migrationName}`, {
          cwd: projectPath,
          stdio: 'inherit'
        });
        console.log(chalk.green('  Migration applied successfully'));
      } catch {
        console.log(chalk.yellow('  Prisma migrate failed. The schema has been updated — run prisma migrate manually.'));
      }

      // Update snapshot
      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(path.join(snapshotDir, 'last.helix'), config.blueprint);
      console.log(chalk.green('  Snapshot updated'));
      break;
    }

    case 'rollback': {
      console.log(chalk.cyan('\n  Rolling Back Schema\n'));

      // Find the backup
      const prismaDir = path.join(projectPath, 'prisma');
      if (!fs.existsSync(prismaDir)) {
        console.log(chalk.yellow('  No prisma directory found.'));
        return;
      }

      const backups = fs.readdirSync(prismaDir)
        .filter(f => f.startsWith('schema.prisma.backup.'))
        .sort()
        .reverse();

      if (backups.length === 0) {
        console.log(chalk.yellow('  No backups found to rollback to.'));
        return;
      }

      const latestBackup = backups[0];
      const backupPath = path.join(prismaDir, latestBackup);

      fs.copyFileSync(backupPath, prismaSchemaPath);
      fs.unlinkSync(backupPath);

      console.log(chalk.green(`  Rolled back to ${latestBackup}`));
      console.log(chalk.gray('  Run "npx prisma migrate dev" to apply the rollback.'));
      break;
    }

    default:
      console.log(chalk.cyan('\n  Helix Schema Migrations\n'));
      console.log(chalk.gray('  Commands:'));
      console.log(chalk.white('    helix evolve migrate status   ') + chalk.gray('— Show pending changes'));
      console.log(chalk.white('    helix evolve migrate snapshot ') + chalk.gray('— Save current schema baseline'));
      console.log(chalk.white('    helix evolve migrate apply    ') + chalk.gray('— Apply pending changes'));
      console.log(chalk.white('    helix evolve migrate rollback ') + chalk.gray('— Revert last migration'));
      console.log('');
  }
}
