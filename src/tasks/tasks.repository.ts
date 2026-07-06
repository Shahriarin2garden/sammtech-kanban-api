import { Injectable } from '@nestjs/common';
import { Prisma, Priority, Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: { labels: true, column: { include: { board: true } } },
    });
  }

  findByIdRaw(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      include: { column: { include: { board: true } } },
    });
  }

  maxPositionInColumn(columnId: string) {
    return this.prisma.task
      .aggregate({ where: { columnId, deletedAt: null }, _max: { position: true } })
      .then((r) => r._max.position);
  }

  findPosition(taskId: string) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      select: { position: true, columnId: true },
    });
  }

  async listOwnedByUser(
    userId: string,
    filters: {
      q?: string;
      priority?: Priority;
      dueBefore?: Date;
      dueAfter?: Date;
      boardId?: string;
      take: number;
      skip: number;
    },
  ) {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      column: { board: { ownerId: userId, deletedAt: null, ...(filters.boardId ? { id: filters.boardId } : {}) } },
      ...(filters.q ? { title: { contains: filters.q, mode: 'insensitive' } } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.dueBefore || filters.dueAfter
        ? {
            dueDate: {
              ...(filters.dueBefore ? { lte: filters.dueBefore } : {}),
              ...(filters.dueAfter ? { gte: filters.dueAfter } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: { labels: true },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        take: filters.take,
        skip: filters.skip,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items, total };
  }

  create(data: Prisma.TaskCreateInput): Promise<Task> {
    return this.prisma.task.create({ data, include: { labels: true } });
  }

  update(id: string, data: Prisma.TaskUpdateInput) {
    return this.prisma.task.update({ where: { id }, data, include: { labels: true } });
  }

  softDelete(id: string) {
    return this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  listPositionsAsc(columnId: string) {
    return this.prisma.task.findMany({
      where: { columnId, deletedAt: null },
      select: { id: true, position: true },
      orderBy: { position: 'asc' },
    });
  }

  findNeighbors(columnId: string, targetPosition: number) {
    return this.prisma.$transaction([
      this.prisma.task.findFirst({
        where: { columnId, deletedAt: null, position: { lt: targetPosition } },
        orderBy: { position: 'desc' },
        select: { position: true },
      }),
      this.prisma.task.findFirst({
        where: { columnId, deletedAt: null, position: { gt: targetPosition } },
        orderBy: { position: 'asc' },
        select: { position: true },
      }),
    ]);
  }

  positionOf(taskId: string) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      select: { position: true, columnId: true, deletedAt: true },
    });
  }
}
