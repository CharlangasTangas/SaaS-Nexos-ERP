import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { SignupSchema, type SignupDto } from './dto/signup.dto';
import { LoginSchema, type LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/request.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/signup
   * Creates a new tenant with an OWNER user, system roles, and permissions.
   * No authentication required.
   */
  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new tenant and owner user' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async signup(
    @Body() body: any,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const dto: SignupDto = SignupSchema.parse(body);
    const tokens = await this.authService.signup(dto);

    // Set refresh token as httpOnly cookie
    reply.setCookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return {
      success: true,
      data: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  /**
   * POST /auth/login
   * Authenticates a user within a specific tenant.
   * Requires X-Tenant-Slug header.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiHeader({ name: 'X-Tenant-Slug', required: true })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() body: any,
    @Headers('x-tenant-slug') tenantSlug: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    if (!tenantSlug) {
      throw new BadRequestException('X-Tenant-Slug header is required.');
    }

    const dto: LoginDto = LoginSchema.parse(body);
    const tokens = await this.authService.login(dto, tenantSlug);

    // Set refresh token as httpOnly cookie
    reply.setCookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      success: true,
      data: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  /**
   * POST /auth/refresh
   * Rotates the refresh token and issues a new access token.
   * Reads refresh token from httpOnly cookie.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const refreshToken = (request as any).cookies?.refresh_token;
    const tokens = await this.authService.refresh(refreshToken);

    reply.setCookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      success: true,
      data: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  /**
   * POST /auth/logout
   * Invalidates the refresh token.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const refreshToken = (request as any).cookies?.refresh_token;
    await this.authService.logout(refreshToken, user.sub);

    reply.clearCookie('refresh_token', { path: '/auth' });

    return {
      success: true,
      message: 'Logged out successfully.',
    };
  }
}
