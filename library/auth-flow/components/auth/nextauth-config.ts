/**
 * NextAuth.js configuration boilerplate for Helix projects.
 *
 * Usage:
 *   1. Copy this file to src/lib/auth.ts
 *   2. Create app/api/auth/[...nextauth]/route.ts with:
 *        import NextAuth from 'next-auth';
 *        import { authOptions } from '@/lib/auth';
 *        const handler = NextAuth(authOptions);
 *        export { handler as GET, handler as POST };
 *   3. Set NEXTAUTH_SECRET and NEXTAUTH_URL in .env
 */

import type { NextAuthOptions, Session, User } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';

/**
 * Stub for password verification -- replace with your actual bcrypt compare.
 */
async function verifyPassword(_plain: string, _hash: string): Promise<boolean> {
    // Replace with: return bcrypt.compare(plain, hash);
    return false;
}

/**
 * Stub for user lookup -- replace with your Prisma/DB query.
 */
async function findUserByEmail(_email: string): Promise<{
    id: string;
    email: string;
    name: string | null;
    passwordHash: string;
} | null> {
    // Replace with: return prisma.user.findUnique({ where: { email } });
    return null;
}

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password are required');
                }

                const user = await findUserByEmail(credentials.email);

                if (!user) {
                    throw new Error('Invalid credentials');
                }

                const isValid = await verifyPassword(credentials.password, user.passwordHash);

                if (!isValid) {
                    throw new Error('Invalid credentials');
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                };
            },
        }),
    ],

    session: {
        strategy: 'jwt',
        maxAge: 7 * 24 * 60 * 60, // 7 days
    },

    pages: {
        signIn: '/login',
        error: '/login',
    },

    callbacks: {
        async jwt({ token, user }: { token: JWT; user?: User }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }: { session: Session; token: JWT }) {
            if (session.user && token.id) {
                (session.user as Record<string, unknown>).id = token.id;
            }
            return session;
        },
    },

    secret: process.env.NEXTAUTH_SECRET,
};
