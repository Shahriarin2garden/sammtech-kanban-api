import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const rounds = this.config.getOrThrow<number>('bcryptRounds');
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    return this.issueTokens({ sub: user.id, email: user.email });
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.users.findByEmail(dto.email);
    // Constant-ish work regardless of user existence — reduce timing signal.
    const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvaliduvwxyz0123456789ABCDEFG';
    const ok = await bcrypt.compare(dto.password, hash);
    if (!user || !ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens({ sub: user.id, email: user.email });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Find matching stored hash — rotate on use.
    const stored = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    let matchId: string | null = null;
    for (const row of stored) {
      if (await bcrypt.compare(refreshToken, row.tokenHash)) {
        matchId = row.id;
        break;
      }
    }
    if (!matchId) throw new UnauthorizedException('Refresh token not recognised');

    await this.prisma.refreshToken.update({
      where: { id: matchId },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens({ sub: payload.sub, email: payload.email });
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.getOrThrow<string>('jwt.accessTtl'),
    });
    const refreshTtl = this.config.getOrThrow<string>('jwt.refreshTtl');
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: refreshTtl,
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash,
        expiresAt: new Date(Date.now() + parseTtlMs(refreshTtl)),
      },
    });

    return { accessToken, refreshToken };
  }
}

// Support "15m" | "7d" | "3600s" | raw seconds.
function parseTtlMs(ttl: string): number {
  const m = /^(\d+)([smhd])?$/.exec(ttl);
  if (!m) return 7 * 24 * 3600 * 1000;
  const n = parseInt(m[1], 10);
  const unit = m[2] ?? 's';
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 1000;
  return n * mult;
}
