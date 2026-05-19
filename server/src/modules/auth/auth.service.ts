import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
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

    const tokenId = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshToken = this.jwtService.sign(
      { sub: user.id, tokenId },
      { expiresIn: (this.configService.get<string>('jwt.refreshExpiry') || '7d') as any },
    );

    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({ userId: user.id, tokenId, expiresAt }),
    );

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
    let decoded: any;
    try {
      decoded = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenId: decoded.tokenId, revoked: false },
    });

    if (!stored || stored.userId !== decoded.sub || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepo.update({ id: stored.id }, { revoked: true });

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
  }

  async logout(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      await this.refreshTokenRepo.update(
        { tokenId: decoded.tokenId },
        { revoked: true },
      );
    } catch {
      // Token already invalid — no-op
    }
  }

  async pruneExpiredTokens(): Promise<void> {
    await this.refreshTokenRepo.delete({ expiresAt: LessThan(new Date()) });
  }
}
