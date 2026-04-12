import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/auth/register
 * Creates a new user account.
 *
 * Replace the database stubs below with your actual Prisma or Supabase queries.
 */
export async function POST(request: NextRequest) {
    try {
        const { name, email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (typeof password !== 'string' || password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existing = await lookupUserByEmail(email);
        if (existing) {
            return NextResponse.json(
                { error: 'An account with this email already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user
        const user = await createUser({ name: name || null, email, passwordHash });

        // Create session
        const sessionToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await createSession(user.id, sessionToken, expiresAt);

        const response = NextResponse.json({
            message: 'Account created successfully',
            token: sessionToken,
            user: { id: user.id, email: user.email, name: user.name },
        }, { status: 201 });

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

async function lookupUserByEmail(_email: string): Promise<{ id: string } | null> {
    // return prisma.user.findUnique({ where: { email }, select: { id: true } });
    return null;
}

async function hashPassword(_password: string): Promise<string> {
    // return bcrypt.hash(password, 12);
    return '';
}

async function createUser(data: {
    name: string | null;
    email: string;
    passwordHash: string;
}): Promise<{ id: string; email: string; name: string | null }> {
    // return prisma.user.create({ data });
    return { id: crypto.randomUUID(), email: data.email, name: data.name };
}

async function createSession(_userId: string, _token: string, _expiresAt: Date): Promise<void> {
    // await prisma.session.create({ data: { userId, token, expiresAt } });
}
