import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { UsersRepository } from './users.repository';

export type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async findByIdOrThrow(id: string): Promise<PublicUser> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  create(input: { email: string; name: string; passwordHash: string }): Promise<User> {
    return this.repo.create(input);
  }

  toPublic(user: User): PublicUser {
    // Strip passwordHash — never leak.
    const { passwordHash, ...rest } = user;
    void passwordHash;
    return rest;
  }
}
