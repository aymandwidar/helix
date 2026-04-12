import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/login
 * Authenticates a user with email and password.
 *
 * Replace the database stubs below with your actual Prisma or Supabase queries.
 */
export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        // --- Replace with your database lookup ---
        // const user = await prisma.user.findUnique({ where: { email } });
        const user = await lookupUser(email);

        if (!user) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // --- Replace with bcrypt.compare(password, user.passwordHash) ---
        const isValid = await verifyPassword(password, user.passwordHash);

        if (!isValid) {
            return NextResponse.json(
                { error: 'Invalid credentials' },
                { status: 401 }
            );
        }

        // Create session
        const sessionToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // --- Replace with your session creation logic ---
        // await prisma.session.create({ data: { userId: user.id, token: sessionToken, expiresAt } });
        await createSession(user.id, sessionToken, expiresAt);

        const response = NextResponse.json({
            message: 'Login successful',
            token: sessionToken,
            user: { id: user.id, email: user.email, name: user.name },
        });

        // Set httpOnly cookie as well
        response.cookies.set('authToken', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
        });

        return response;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// --- Stubs: replace with real implementations ---

async function lookupUser(_email: string): Promise<{
    id: string;
    email: string;
    name: string | null;
    passwordHash: string;
} | null> {
    // Replace with: return prisma.user.findUnique({ where: { email } });
    return null;
}

async function verifyPassword(_plain: string, _hash: string): Promise<boolean> {
    // Replace with: return bcrypt.compare(plain, hash);
    return false;
}

async function createSession(_userId: string, _token: string, _expiresAt: Date): Promise<void> {
    // Replace with: await prisma.session.create({ data: { userId, token, expiresAt } });
}
