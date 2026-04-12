/**
 * File storage utility for handling uploads.
 *
 * Default implementation stores files locally.
 * Replace with S3, Cloudflare R2, or other cloud storage as needed.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface StoredFile {
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    storedAt: Date;
}

export interface StorageConfig {
    uploadDir: string;
    publicUrlPrefix: string;
    maxFileSize: number;
    allowedMimeTypes: string[];
}

const defaultConfig: StorageConfig = {
    uploadDir: path.join(process.cwd(), 'public', 'uploads'),
    publicUrlPrefix: '/uploads',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/csv',
        'application/json',
    ],
};

function ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function generateFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const hash = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const timestamp = Date.now();
    return `${timestamp}-${hash}${ext}`;
}

/**
 * Store a file buffer to local disk.
 */
export async function storeFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    config: Partial<StorageConfig> = {}
): Promise<StoredFile> {
    const cfg = { ...defaultConfig, ...config };

    // Validate size
    if (buffer.length > cfg.maxFileSize) {
        throw new Error(`File exceeds maximum size of ${(cfg.maxFileSize / 1024 / 1024).toFixed(0)}MB`);
    }

    // Validate type
    if (cfg.allowedMimeTypes.length > 0 && !cfg.allowedMimeTypes.includes(mimeType)) {
        throw new Error(`File type ${mimeType} is not allowed`);
    }

    ensureDir(cfg.uploadDir);

    const filename = generateFilename(originalName);
    const filePath = path.join(cfg.uploadDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    return {
        id: crypto.randomUUID(),
        filename,
        originalName,
        mimeType,
        size: buffer.length,
        url: `${cfg.publicUrlPrefix}/${filename}`,
        storedAt: new Date(),
    };
}

/**
 * Delete a stored file.
 */
export async function deleteFile(
    filename: string,
    config: Partial<StorageConfig> = {}
): Promise<void> {
    const cfg = { ...defaultConfig, ...config };
    const filePath = path.join(cfg.uploadDir, filename);

    if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
    }
}

/**
 * List stored files.
 */
export async function listFiles(
    config: Partial<StorageConfig> = {}
): Promise<StoredFile[]> {
    const cfg = { ...defaultConfig, ...config };

    ensureDir(cfg.uploadDir);

    const entries = await fs.promises.readdir(cfg.uploadDir, { withFileTypes: true });
    const files: StoredFile[] = [];

    for (const entry of entries) {
        if (!entry.isFile()) continue;

        const filePath = path.join(cfg.uploadDir, entry.name);
        const stat = await fs.promises.stat(filePath);

        files.push({
            id: entry.name,
            filename: entry.name,
            originalName: entry.name,
            mimeType: 'application/octet-stream',
            size: stat.size,
            url: `${cfg.publicUrlPrefix}/${entry.name}`,
            storedAt: stat.birthtime,
        });
    }

    return files;
}
