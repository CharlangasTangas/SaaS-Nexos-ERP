import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import type { SignupDto } from './dto/signup.dto';
import type { LoginDto } from './dto/login.dto';
import {
  ALL_SYSTEM_ROLES,
  SYSTEM_ROLES,
} from '../common/constants/roles';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS_MAP,
} from '../common/constants/permissions';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * AuthService — handles signup, login, refresh, and logout.
 *
 * Signup creates transactionally:
 * - Tenant
 * - OWNER user
 * - All system roles for the tenant
 * - All permissions (global, idempotent)
 * - Role-permission assignments
 *
 * Login validates:
 * - Tenant active
 * - User belongs to tenant
 * - Password (argon2id)
 * - User active
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtl: string;
  private readonly refreshTtlSeconds: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {
    this.accessTtl = process.env.JWT_ACCESS_TTL ?? '15m';
    this.refreshTtlSeconds = this.parseTtlToSeconds(
      process.env.JWT_REFRESH_TTL ?? '7d',
    );
    this.accessSecret =
      process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';
    this.refreshSecret =
      process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me';
  }

  /**
   * Signup — create tenant + owner + roles + permissions transactionally.
   */
  async signup(dto: SignupDto): Promise<TokenPair> {
    // Check if slug is already taken
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existingTenant) {
      throw new ConflictException(`Tenant slug "${dto.slug}" already exists.`);
    }

    // Hash password
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: parseInt(process.env.ARGON2_MEMORY_COST ?? '19456', 10),
      timeCost: parseInt(process.env.ARGON2_TIME_COST ?? '2', 10),
    });

    // Ensure global permissions exist
    await this.seedGlobalPermissions();

    // Create everything in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          slug: dto.slug,
          name: dto.companyName,
          businessType: dto.businessType as any,
          settings: {},
        },
      });

      // 2. Create system roles for this tenant
      const roles: Record<string, string> = {};
      for (const roleName of ALL_SYSTEM_ROLES) {
        const role = await tx.role.create({
          data: {
            tenantId: tenant.id,
            name: roleName,
            description: `System role: ${roleName}`,
            isSystem: true,
          },
        });
        roles[roleName] = role.id;
      }

      // 3. Assign permissions to roles
      const allPerms = await tx.permission.findMany();
      const permCodeToId = Object.fromEntries(
        allPerms.map((p) => [p.code, p.id]),
      );

      for (const [roleName, permCodes] of Object.entries(
        ROLE_PERMISSIONS_MAP,
      )) {
        const roleId = roles[roleName];
        if (!roleId) continue;

        for (const code of permCodes) {
          const permId = permCodeToId[code];
          if (!permId) continue;

          await tx.rolePermission.create({
            data: {
              roleId,
              permissionId: permId,
              tenantId: tenant.id,
            },
          });
        }
      }

      // 4. Create OWNER user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          roleId: roles[SYSTEM_ROLES.OWNER],
          isActive: true,
        },
      });

      return { tenant, user, ownerRoleName: SYSTEM_ROLES.OWNER };
    });

    // Get permissions for the OWNER role
    const ownerPermissions = ROLE_PERMISSIONS_MAP[SYSTEM_ROLES.OWNER] ?? [];

    // Generate tokens
    return this.generateTokenPair({
      sub: result.user.id,
      tenantId: result.tenant.id,
      tenantSlug: result.tenant.slug,
      roles: [SYSTEM_ROLES.OWNER],
      permissions: ownerPermissions as string[],
      isSuperadmin: false,
    });
  }

  /**
   * Login — validate credentials and return tokens.
   */
  async login(dto: LoginDto, tenantSlug: string): Promise<TokenPair> {
    // 1. Find tenant
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: tenantSlug, status: 'ACTIVE' },
    });
    if (!tenant) {
      throw new UnauthorizedException('Tenant not found or inactive.');
    }

    // 2. Find user in this tenant
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: dto.email,
        deletedAt: null,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 3. Check user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated.');
    }

    // 4. Verify password
    const validPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // 5. Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 6. Build permissions list
    const permissions = user.role.rolePermissions.map(
      (rp) => rp.permission.code,
    );

    // 7. Generate tokens
    return this.generateTokenPair({
      sub: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      roles: [user.role.name],
      permissions,
      isSuperadmin: user.isSuperadmin,
    });
  }

  /**
   * Refresh — rotate refresh token and issue new pair.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing.');
    }

    // Verify the refresh token
    let payload: any;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }

    // Check if token exists in Redis (not revoked)
    const key = `refresh:${payload.sub}:${refreshToken}`;
    const exists = await this.redis.exists(key);
    if (!exists) {
      throw new UnauthorizedException(
        'Refresh token has been revoked or expired.',
      );
    }

    // Invalidate old refresh token
    await this.redis.del(key);

    // Fetch user to get fresh permissions
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
        tenant: true,
      },
    });

    if (!user || !user.isActive || user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('User or tenant no longer active.');
    }

    const permissions = user.role.rolePermissions.map(
      (rp) => rp.permission.code,
    );

    return this.generateTokenPair({
      sub: user.id,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      roles: [user.role.name],
      permissions,
      isSuperadmin: user.isSuperadmin,
    });
  }

  /**
   * Logout — invalidate the refresh token in Redis.
   */
  async logout(refreshToken: string, userId: string): Promise<void> {
    if (!refreshToken) return;

    const key = `refresh:${userId}:${refreshToken}`;
    await this.redis.del(key);
    this.logger.log(`User ${userId} logged out`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async generateTokenPair(payload: {
    sub: string;
    tenantId: string;
    tenantSlug: string;
    roles: string[];
    permissions: string[];
    isSuperadmin: boolean;
  }): Promise<TokenPair> {
    // Access token
    const accessToken = this.jwt.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });

    // Refresh token (minimal payload)
    const refreshToken = this.jwt.sign(
      { sub: payload.sub, type: 'refresh' },
      {
        secret: this.refreshSecret,
        expiresIn: `${this.refreshTtlSeconds}s`,
      },
    );

    // Store refresh token in Redis
    const key = `refresh:${payload.sub}:${refreshToken}`;
    await this.redis.set(key, '1', this.refreshTtlSeconds);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseTtlToSeconds(this.accessTtl),
    };
  }

  /**
   * Ensure all global permissions exist in the database.
   * Idempotent — safe to call multiple times.
   */
  private async seedGlobalPermissions(): Promise<void> {
    for (const code of ALL_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { code },
        update: {},
        create: {
          code,
          description: `Permission: ${code}`,
        },
      });
    }
  }

  private parseTtlToSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 900; // default 15 min

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }
}
