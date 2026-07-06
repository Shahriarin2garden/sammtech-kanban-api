import { Injectable } from '@nestjs/common';
import { Board, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_COLUMNS = ['Backlog', 'Todo', 'In Progress', 'Review', 'Done'];

@Injectable()
export class BoardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createWithDefaults(ownerId: string, title: string): Promise<Board> {
    return this.prisma.board.create({
      data: {
        title,
        ownerId,
        columns: {
          create: DEFAULT_COLUMNS.map((name, i) => ({ title: name, order: (i + 1) * 1000 })),
        },
      },
      include: { columns: { orderBy: { order: 'asc' } } },
    });
  }

  listByOwner(ownerId: string) {
    return this.prisma.board.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.board.findFirst({
      where: { id, deletedAt: null },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              where: { deletedAt: null },
              orderBy: { position: 'asc' },
              include: { labels: true },
            },
          },
        },
      },
    });
  }

  findBareById(id: string) {
    return this.prisma.board.findFirst({ where: { id, deletedAt: null } });
  }

  update(id: string, data: Prisma.BoardUpdateInput): Promise<Board> {
    return this.prisma.board.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Board> {
    return this.prisma.board.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
