/**
 * Auth Tests (Unit — no database required)
 *
 * Verifies:
 * 1. Password hashing with argon2id
 * 2. JWT structure with correct claims
 * 3. Token expiry behavior
 * 4. Token validation with wrong secret
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';

describe('Auth', () => {
  let jwtService: JwtService;

  beforeAll(() => {
    jwtService = new JwtService({
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    });
  });

  describe('Password hashing', () => {
    it('should hash passwords with argon2id', async () => {
      const password = 'TestPassword123!';
      const hash = await argon2.hash(password, { type: argon2.argon2id });

      expect(hash).toBeDefined();
      expect(hash.startsWith('$argon2id$')).toBe(true);

      const valid = await argon2.verify(hash, password);
      expect(valid).toBe(true);

      const invalid = await argon2.verify(hash, 'wrong-password');
      expect(invalid).toBe(false);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'SamePassword123';
      const hash1 = await argon2.hash(password, { type: argon2.argon2id });
      const hash2 = await argon2.hash(password, { type: argon2.argon2id });

      expect(hash1).not.toBe(hash2);
      expect(await argon2.verify(hash1, password)).toBe(true);
      expect(await argon2.verify(hash2, password)).toBe(true);
    });
  });

  describe('JWT Structure', () => {
    it('should create JWT with required tenant claims', () => {
      const payload = {
        sub: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: '660e8400-e29b-41d4-a716-446655440000',
        tenantSlug: 'empresa1',
        roles: ['ADMIN'],
        permissions: ['products:write', 'sales:read'],
        isSuperadmin: false,
      };

      const token = jwtService.sign(payload, { expiresIn: '15m' });
      expect(token).toBeDefined();

      const decoded = jwtService.verify(token);
      expect(decoded.sub).toBe(payload.sub);
      expect(decoded.tenantId).toBe(payload.tenantId);
      expect(decoded.tenantSlug).toBe(payload.tenantSlug);
      expect(decoded.roles).toEqual(payload.roles);
      expect(decoded.permissions).toEqual(payload.permissions);
      expect(decoded.isSuperadmin).toBe(false);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should include iat and exp timestamps', () => {
      const token = jwtService.sign(
        { sub: 'test-user', tenantId: 'test-tenant' },
        { expiresIn: '15m' },
      );
      const decoded = jwtService.verify(token);

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp - decoded.iat).toBe(900); // 15 minutes
    });

    it('should reject expired tokens', async () => {
      const token = jwtService.sign(
        { sub: 'test', tenantId: 'test' },
        { expiresIn: '0s' },
      );

      // Wait for the token to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(() => jwtService.verify(token)).toThrow();
    });

    it('should reject tokens with wrong secret', () => {
      const otherJwt = new JwtService({ secret: 'wrong-secret' });
      const token = otherJwt.sign({ sub: 'test' });

      expect(() => jwtService.verify(token)).toThrow();
    });

    it('should contain all RBAC fields in JWT', () => {
      const payload = {
        sub: 'user-uuid',
        tenantId: 'tenant-uuid',
        tenantSlug: 'empresa-test',
        roles: ['OWNER'],
        permissions: [
          'products:read',
          'products:write',
          'inventory:read',
          'sales:read',
          'sales:create',
        ],
        isSuperadmin: false,
      };

      const token = jwtService.sign(payload, { expiresIn: '15m' });
      const decoded = jwtService.verify(token);

      // These are the claims required by the spec
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('tenantId');
      expect(decoded).toHaveProperty('tenantSlug');
      expect(decoded).toHaveProperty('roles');
      expect(decoded).toHaveProperty('permissions');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });
  });
});
