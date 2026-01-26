/**
 * Helix File Writer v10.0
 * Recursive file system writing from FileSystemMap
 */

import * as fs from "fs-extra";
import * as path from "path";
import chalk from "chalk";
import ora from "ora";
import { FileSystemMap, GeneratedFile } from "./types";

/**
 * Write a FileSystemMap to the disk
 * Creates all necessary directories and files
 */
export async function writeFileSystemMap(
    projectPath: string,
    fsMap: FileSystemMap,
    options: {
        silent?: boolean;
        overwriteExisting?: boolean;
    } = {}
): Promise<{ written: number; skipped: number; errors: string[] }> {
    const results = {
        written: 0,
        skipped: 0,
        errors: [] as string[],
    };

    const spinner = options.silent ? null : ora("Writing files...").start();

    for (const file of fsMap.files) {
        const fullPath = path.join(projectPath, file.path);
        const dir = path.dirname(fullPath);

        try {
            // Create directory if it doesn't exist
            await fs.ensureDir(dir);

            // Check if file exists
            const exists = await fs.pathExists(fullPath);

            if (exists && !file.overwrite && !options.overwriteExisting) {
                results.skipped++;
                if (!options.silent) {
                    console.log(chalk.gray(`  ⏭️  Skipped (exists): ${file.path}`));
                }
                continue;
            }

            // Write the file
            await fs.writeFile(fullPath, file.content, "utf-8");
            results.written++;

            if (!options.silent) {
                const icon = exists ? "📝" : "✨";
                console.log(chalk.green(`  ${icon} ${file.path}`));
            }

        } catch (error: any) {
            results.errors.push(`${file.path}: ${error.message}`);
            if (!options.silent) {
                console.log(chalk.red(`  ❌ ${file.path}: ${error.message}`));
            }
        }
    }

    if (spinner) {
        if (results.errors.length > 0) {
            spinner.fail(`Written ${results.written} files with ${results.errors.length} errors`);
        } else {
            spinner.succeed(`Written ${results.written} files (${results.skipped} skipped)`);
        }
    }

    return results;
}

/**
 * Create a FileSystemMap from a directory structure
 * Useful for converting existing projects
 */
export async function readToFileSystemMap(
    projectPath: string,
    patterns: string[] = ["**/*.ts", "**/*.tsx", "**/*.dart", "**/*.json"]
): Promise<FileSystemMap> {
    const files: GeneratedFile[] = [];

    // Simple recursive read (for now, just reads specific directories)
    const readDir = async (dir: string, base: string = "") => {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.join(base, entry.name).replace(/\\/g, "/");

            // Skip node_modules and hidden directories
            if (entry.name.startsWith(".") || entry.name === "node_modules") {
                continue;
            }

            if (entry.isDirectory()) {
                await readDir(fullPath, relativePath);
            } else if (entry.isFile()) {
                // Check if file matches patterns
                const ext = path.extname(entry.name);
                if ([".ts", ".tsx", ".dart", ".json", ".sql", ".md"].includes(ext)) {
                    const content = await fs.readFile(fullPath, "utf-8");
                    files.push({
                        path: relativePath,
                        content,
                        overwrite: true,
                    });
                }
            }
        }
    };

    await readDir(projectPath);

    return {
        files,
        metadata: {
            projectName: path.basename(projectPath),
            generatedAt: new Date().toISOString(),
            helixVersion: "10.0.0",
            target: "flutter", // Default, would need detection
        },
    };
}

/**
 * Merge two FileSystemMaps
 * Files in the second map override those in the first
 */
export function mergeFileSystemMaps(
    base: FileSystemMap,
    overlay: FileSystemMap
): FileSystemMap {
    const fileMap = new Map<string, GeneratedFile>();

    // Add base files
    for (const file of base.files) {
        fileMap.set(file.path, file);
    }

    // Overlay files (override)
    for (const file of overlay.files) {
        fileMap.set(file.path, { ...file, overwrite: true });
    }

    return {
        files: Array.from(fileMap.values()),
        metadata: {
            ...base.metadata,
            ...overlay.metadata,
        },
    };
}

/**
 * Create a basic Flutter project structure as FileSystemMap
 */
export function createFlutterStructure(projectName: string): FileSystemMap {
    return {
        files: [
            {
                path: "lib/main.dart",
                content: `// Generated by Helix v10.0
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/home_screen.dart';
import 'providers/app_provider.dart';

void main() {
  runApp(const HelixApp());
}

class HelixApp extends StatelessWidget {
  const HelixApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppProvider(),
      child: MaterialApp(
        title: '${projectName}',
        debugShowCheckedModeBanner: false,
        theme: ThemeData.dark().copyWith(
          scaffoldBackgroundColor: const Color(0xFF0a0a12),
          primaryColor: const Color(0xFFFFD700),
          cardColor: const Color(0xFF1a1a2e),
        ),
        home: const HomeScreen(),
      ),
    );
  }
}
`,
                overwrite: true,
            },
            {
                path: "lib/providers/.gitkeep",
                content: "",
                overwrite: false,
            },
            {
                path: "lib/models/.gitkeep",
                content: "",
                overwrite: false,
            },
            {
                path: "lib/screens/.gitkeep",
                content: "",
                overwrite: false,
            },
            {
                path: "lib/services/.gitkeep",
                content: "",
                overwrite: false,
            },
            {
                path: "lib/widgets/.gitkeep",
                content: "",
                overwrite: false,
            },
        ],
        metadata: {
            projectName,
            generatedAt: new Date().toISOString(),
            helixVersion: "10.0.0",
            target: "flutter",
        },
    };
}

/**
 * Print a summary of the FileSystemMap
 */
export function printFileSystemMapSummary(fsMap: FileSystemMap): void {
    console.log(chalk.cyan("\n📁 Generated File Structure:\n"));

    // Group by directory
    const dirs = new Map<string, string[]>();

    for (const file of fsMap.files) {
        const dir = path.dirname(file.path) || ".";
        if (!dirs.has(dir)) {
            dirs.set(dir, []);
        }
        dirs.get(dir)!.push(path.basename(file.path));
    }

    // Print tree
    const sortedDirs = Array.from(dirs.keys()).sort();
    for (const dir of sortedDirs) {
        console.log(chalk.yellow(`  📂 ${dir}/`));
        for (const file of dirs.get(dir)!.sort()) {
            console.log(chalk.white(`     └─ ${file}`));
        }
    }

    console.log(chalk.gray(`\n  Total: ${fsMap.files.length} files\n`));
}
