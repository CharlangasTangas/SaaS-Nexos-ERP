import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { RedisService } from '../common/redis/redis.service';
import type { InviteUserDto } from './dto/invite-user.dto';

/**
 * UsersService — manages users within a tenant context.
 * Most operations use TenantPrismaService for RLS enforcement.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly redis: RedisService,
  ) {
    // Mailhog SMTP transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
      ignoreTLS: true,
    });
  }

  /**
   * List users in the current tenant.
   */
  async list(tenantId: string): Promise<any[]> {
    return this.tenantPrisma.$transaction(async (tx) => {
      return tx.user.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          role: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  /**
   * Invite a new user to the tenant.
   * Sends an invitation email via Mailhog.
   * Creates user with a temporary password and is_active=false.
   */
  async invite(
    dto: InviteUserDto,
    tenantId: string,
    tenantSlug: string,
    inviterId: string,
  ): Promise<{ userId: string; inviteToken: string }> {
    // Check if user already exists in this tenant
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `User with email ${dto.email} already exists in this tenant.`,
      );
    }

    // Verify the role belongs to this tenant
    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, tenantId },
    });
    if (!role) {
      throw new NotFoundException('Role not found in this tenant.');
    }

    // Generate invite token (24h expiry)
    const inviteToken = uuidv4();
    const tempPassword = uuidv4(); // Will be changed on activation
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
    });

    // Create inactive user
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        roleId: dto.roleId,
        isActive: false,
      },
    });

    // Store invite token in Redis (24h)
    await this.redis.set(
      `invite:${inviteToken}`,
      JSON.stringify({ userId: user.id, tenantId, email: dto.email }),
      86400, // 24 hours
    );

    // Send invitation email
    const inviteUrl = `http://${tenantSlug}.lvh.me:3000/activate?token=${inviteToken}`;
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'no-reply@nexos.local',
      to: dto.email,
      subject: `Invitation to join ${tenantSlug} on Nexos ERP`,
      html: `
        <h2>You've been invited to Nexos ERP</h2>
        <p>Hello ${dto.fullName},</p>
        <p>You've been invited to join the <strong>${tenantSlug}</strong> organization.</p>
        <p>Click the link below to set your password and activate your account:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p>This link expires in 24 hours.</p>
        <p>— Nexos ERP</p>
      `,
    });

    this.logger.log(
      `Invitation sent to ${dto.email} for tenant ${tenantSlug}`,
    );

    return { userId: user.id, inviteToken };
  }

  /**
   * Activate a user via invite token.
   */
  async activate(
    token: string,
    password: string,
  ): Promise<{ userId: string }> {
    const data = await this.redis.get(`invite:${token}`);
    if (!data) {
      throw new BadRequestException(
        'Invalid or expired invitation token.',
      );
    }

    const { userId } = JSON.parse(data);

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true, passwordHash },
    });

    // Remove invite token
    await this.redis.del(`invite:${token}`);

    return { userId };
  }

  /**
   * Deactivate a user.
   */
  async deactivate(userId: string, tenantId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  /**
   * Reactivate a user.
   */
  async reactivate(userId: string, tenantId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  }

  /**
   * Assign a new role to a user.
   */
  async assignRole(
    userId: string,
    roleId: string,
    tenantId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) {
      throw new NotFoundException('Role not found in this tenant.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { roleId },
    });
  }
}
