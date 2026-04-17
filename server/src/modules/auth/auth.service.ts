import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  private refreshTokens: Map<string, { userId: string; expiresAt: Date }> =
    new Map();

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) return null;

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      agentCode: user.agentCode,
      target: user.target,
      dailyTarget: user.dailyTarget,
    };
  }

  async login(user: any) {
    const payload = { sub: user.id, role: user.role, name: user.name };

    const accessToken = this.jwtService.sign(payload);
    const refreshTokenId = uuidv4();
    const refreshToken = this.jwtService.sign(
      { sub: user.id, tokenId: refreshTokenId },
      { expiresIn: (this.configService.get<string>('jwt.refreshExpiry') || '7d') as any },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    this.refreshTokens.set(refreshTokenId, {
      userId: user.id,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        agentCode: user.agentCode,
        target: user.target,
        dailyTarget: user.dailyTarget,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const stored = this.refreshTokens.get(decoded.tokenId);

      if (!stored || stored.userId !== decoded.sub || stored.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      this.refreshTokens.delete(decoded.tokenId);

      const user = await this.usersService.findById(decoded.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return this.login({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        agentCode: user.agentCode,
        target: user.target,
        dailyTarget: user.dailyTarget,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      this.refreshTokens.delete(decoded.tokenId);
    } catch {
      // Token already invalid, no-op
    }
  }
}
