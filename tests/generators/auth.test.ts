import { describe, it, expect } from 'vitest';
import { generateAuthFiles, generateAuthPrismaModels } from '../../src/generators/auth.js';
import type { HelixAuth } from '../../src/parser/index.js';

describe('Auth Generator', () => {
  const auth: HelixAuth = {
    provider: 'credentials',
    roles: ['admin', 'user'],
    loc: { line: 1, column: 1 },
  };

  describe('generateAuthFiles', () => {
    it('generates all required files for credentials provider', () => {
      const files = generateAuthFiles(auth, 'test-app');
      expect(Object.keys(files)).toContain('src/app/api/auth/[...nextauth]/route.ts');
      expect(Object.keys(files)).toContain('src/lib/auth.ts');
      expect(Object.keys(files)).toContain('src/components/SessionProvider.tsx');
      expect(Object.keys(files)).toContain('src/app/auth/signin/page.tsx');
      expect(Object.keys(files)).toContain('src/app/auth/signup/page.tsx');
      expect(Object.keys(files)).toContain('src/app/api/auth/register/route.ts');
      expect(Object.keys(files)).toContain('src/middleware.ts');
    });

    it('skips signup page for non-credentials providers', () => {
      const googleAuth: HelixAuth = { provider: 'google', roles: [], loc: { line: 1, column: 1 } };
      const files = generateAuthFiles(googleAuth, 'test-app');
      expect(Object.keys(files)).not.toContain('src/app/auth/signup/page.tsx');
      expect(Object.keys(files)).not.toContain('src/app/api/auth/register/route.ts');
    });

    it('includes CredentialsProvider import for credentials', () => {
      const files = generateAuthFiles(auth, 'test-app');
      expect(files['src/lib/auth.ts']).toContain('CredentialsProvider');
    });

    it('includes GoogleProvider import for google', () => {
      const googleAuth: HelixAuth = { provider: 'google', roles: [], loc: { line: 1, column: 1 } };
      const files = generateAuthFiles(googleAuth, 'test-app');
      expect(files['src/lib/auth.ts']).toContain('GoogleProvider');
    });

    it('uses jwt strategy for credentials', () => {
      const files = generateAuthFiles(auth, 'test-app');
      expect(files['src/lib/auth.ts']).toContain('strategy: "jwt"');
    });

    it('includes role callbacks when roles are defined', () => {
      const files = generateAuthFiles(auth, 'test-app');
      expect(files['src/lib/auth.ts']).toContain('token.role');
    });
  });

  describe('generateAuthPrismaModels', () => {
    it('generates User, Account, Session, VerificationToken models', () => {
      const models = generateAuthPrismaModels(auth);
      expect(models).toContain('model User');
      expect(models).toContain('model Account');
      expect(models).toContain('model Session');
      expect(models).toContain('model VerificationToken');
    });

    it('includes Role enum when roles are defined', () => {
      const models = generateAuthPrismaModels(auth);
      expect(models).toContain('enum Role');
      expect(models).toContain('ADMIN');
      expect(models).toContain('USER');
    });

    it('skips Role enum when no roles', () => {
      const noRolesAuth: HelixAuth = { provider: 'credentials', roles: [], loc: { line: 1, column: 1 } };
      const models = generateAuthPrismaModels(noRolesAuth);
      expect(models).not.toContain('enum Role');
    });
  });
});
