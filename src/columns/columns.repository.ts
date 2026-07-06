import { Injectable } from '@nestjs/common';
import { Column, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ColumnsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.column.findUnique({ where: { id }, include: { board: true } });
  }

  maxOrder(boardId: string): Promise<number | null> {
    return this.prisma.column
      .aggregate({ where: { boardId }, _max: { order: true } })
      .then((r) => r._max.order);
  }

  create(boardId: string, title: string, order: number): Promise<Column> {
    return this.prisma.column.create({ data: { boardId, title, order } });
  }

  update(id: string, data: Prisma.ColumnUpdateInput): Promise<Column> {
    return this.prisma.column.update({ where: { id }, data });
  }

  delete(id: string): Promise<Column> {
    return this.prisma.column.delete({ where: { id } });
  }
}
