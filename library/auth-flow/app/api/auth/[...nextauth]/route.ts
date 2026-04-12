/**
 * NextAuth catch-all API route.
 *
 * This file should be placed at: app/api/auth/[...nextauth]/route.ts
 *
 * Prerequisites:
 *   - npm install next-auth
 *   - Set NEXTAUTH_SECRET in your .env
 *   - Configure authOptions in components/auth/nextauth-config.ts
 */

// import NextAuth from 'next-auth';
// import { authOptions } from '@/components/auth/nextauth-config';
//
// const handler = NextAuth(authOptions);
// export { handler as GET, handler as POST };

import { NextResponse } from 'next/server';

// Placeholder until NextAuth is installed and configured
export async function GET() {
    return NextResponse.json({
        message: 'NextAuth not configured yet. Install next-auth and uncomment the handler above.',
    });
}

export async function POST() {
    return NextResponse.json({
        message: 'NextAuth not configured yet. Install next-auth and uncomment the handler above.',
    });
}
