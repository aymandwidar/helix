import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/csv',
]);

function ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof Blob)) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        // Validate type
        if (ALLOWED_TYPES.size > 0 && !ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json(
                { error: `File type ${file.type} is not allowed` },
                { status: 400 }
            );
        }

        ensureUploadDir();

        // Generate safe filename
        const originalName = file instanceof File ? file.name : 'upload';
        const ext = path.extname(originalName);
        const hash = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const filename = `${Date.now()}-${hash}${ext}`;
        const filePath = path.join(UPLOAD_DIR, filename);

        // Write file
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.promises.writeFile(filePath, buffer);

        return NextResponse.json({
            message: 'File uploaded successfully',
            filename,
            originalName,
            size: file.size,
            type: file.type,
            url: `/uploads/${filename}`,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Upload failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { filename } = await request.json();

        if (!filename || typeof filename !== 'string') {
            return NextResponse.json(
                { error: 'Filename is required' },
                { status: 400 }
            );
        }

        // Prevent path traversal
        const safeName = path.basename(filename);
        const filePath = path.join(UPLOAD_DIR, safeName);

        if (!fs.existsSync(filePath)) {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        await fs.promises.unlink(filePath);

        return NextResponse.json({ message: 'File deleted successfully' });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Delete failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
