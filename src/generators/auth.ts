/**
 * Auth Generator — NextAuth.js scaffolding for Helix apps
 *
 * Generates: NextAuth config, sign-in page, middleware, session provider,
 * and Prisma schema additions for auth tables.
 */

import type { HelixAuth } from '../parser/index.js';

export interface AuthFiles {
  [path: string]: string;
}

/**
 * Generate all auth-related files based on the auth block in the blueprint.
 */
export function generateAuthFiles(auth: HelixAuth, projectName: string): AuthFiles {
  const files: AuthFiles = {};

  // NextAuth route handler
  files['src/app/api/auth/[...nextauth]/route.ts'] = generateNextAuthRoute(auth);

  // Auth config
  files['src/lib/auth.ts'] = generateAuthConfig(auth);

  // Session provider wrapper
  files['src/components/SessionProvider.tsx'] = generateSessionProvider();

  // Sign-in page
  files['src/app/auth/signin/page.tsx'] = generateSignInPage(projectName);

  // Sign-up page (for credentials provider)
  if (auth.provider === 'credentials') {
    files['src/app/auth/signup/page.tsx'] = generateSignUpPage(projectName);
    files['src/app/api/auth/register/route.ts'] = generateRegisterRoute();
  }

  // Middleware for protected routes
  files['src/middleware.ts'] = generateMiddleware();

  return files;
}

/**
 * Generate Prisma schema additions for auth (User, Account, Session, etc.)
 */
export function generateAuthPrismaModels(auth: HelixAuth): string {
  const roleEnum = auth.roles.length > 0
    ? `enum Role {\n${auth.roles.map(r => `  ${r.toUpperCase()}`).join('\n')}\n}\n\n`
    : '';

  return `${roleEnum}model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?${auth.roles.length > 0 ? '\n  role          Role      @default(' + auth.roles[0].toUpperCase() + ')' : ''}
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
`;
}

function generateNextAuthRoute(auth: HelixAuth): string {
  return `import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
`;
}

function generateAuthConfig(auth: HelixAuth): string {
  const providers: string[] = [];

  if (auth.provider === 'credentials' || auth.provider === 'all') {
    providers.push(`    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        // In production, use bcrypt.compare
        if (user.password !== credentials.password) return null;

        return { id: user.id, email: user.email, name: user.name${auth.roles.length > 0 ? ', role: (user as any).role' : ''} };
      },
    })`);
  }

  if (auth.provider === 'google' || auth.provider === 'all') {
    providers.push(`    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })`);
  }

  if (auth.provider === 'github' || auth.provider === 'all') {
    providers.push(`    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    })`);
  }

  const imports = [];
  imports.push('import { type NextAuthOptions } from "next-auth";');
  imports.push('import { PrismaAdapter } from "@next-auth/prisma-adapter";');
  imports.push('import { prisma } from "./prisma";');
  if (auth.provider === 'credentials' || auth.provider === 'all') {
    imports.push('import CredentialsProvider from "next-auth/providers/credentials";');
  }
  if (auth.provider === 'google' || auth.provider === 'all') {
    imports.push('import GoogleProvider from "next-auth/providers/google";');
  }
  if (auth.provider === 'github' || auth.provider === 'all') {
    imports.push('import GithubProvider from "next-auth/providers/github";');
  }

  return `${imports.join('\n')}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
${providers.join(',\n')}
  ],
  session: {
    strategy: "${auth.provider === 'credentials' ? 'jwt' : 'database'}",
  },
  pages: {
    signIn: "/auth/signin",
  },${auth.roles.length > 0 ? `
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as any).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role;
      return session;
    },
  },` : ''}
};
`;
}

function generateSessionProvider(): string {
  return `"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
`;
}

function generateSignInPage(projectName: string): string {
  return `"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
            <p className="text-white/60">Sign in to ${projectName}</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-white/40 text-sm mt-6">
            Don&apos;t have an account?{" "}
            <a href="/auth/signup" className="text-indigo-400 hover:text-indigo-300">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
`;
}

function generateSignUpPage(projectName: string): string {
  return `"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      router.push("/auth/signin");
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create account</h1>
            <p className="text-white/60">Get started with ${projectName}</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                minLength={8}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <p className="text-center text-white/40 text-sm mt-6">
            Already have an account?{" "}
            <a href="/auth/signin" className="text-indigo-400 hover:text-indigo-300">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
`;
}

function generateRegisterRoute(): string {
  return `import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // In production, hash with bcrypt
    const user = await prisma.user.create({
      data: { name, email, password },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
`;
}

function generateMiddleware(): string {
  return `import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/auth/signin",
  },
});

export const config = {
  // Protect all routes except auth, api/auth, and static assets
  matcher: [
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
`;
}
