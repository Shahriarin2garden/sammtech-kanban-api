import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { ColumnsRepository } from '../columns/columns.repository';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { STEP, needsRebalance, positionBetween } from './position';
import { TasksRepository } from './tasks.repository';

@Injectable()
export class TasksService {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly columns: ColumnsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createInColumn(userId: string, columnId: string, dto: CreateTaskDto): Promise<Task> {
    const column = await this.assertColumnOwned(userId, columnId);

    const max = (await this.tasks.maxPositionInColumn(column.id)) ?? 0;
    const position = max + STEP;

    const task = await this.tasks.create({
      title: dto.title,
      description: dto.description,
      priority: dto.priority ?? 'MEDIUM',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      position,
      column: { connect: { id: column.id } },
      ...(dto.assigneeId ? { assignee: { connect: { id: dto.assigneeId } } } : {}),
      ...(dto.labels && dto.labels.length
        ? { labels: { create: dto.labels.map((l) => ({ name: l.name, color: l.color })) } }
        : {}),
    });

    await this.log(task.id, userId, 'created');
    return task;
  }

  async list(userId: string, query: QueryTasksDto) {
    return this.tasks.listOwnedByUser(userId, {
      q: query.q,
      priority: query.priority,
      dueBefore: query.dueBefore ? new Date(query.dueBefore) : undefined,
      dueAfter: query.dueAfter ? new Date(query.dueAfter) : undefined,
      boardId: query.boardId,
      take: query.take ?? 50,
      skip: query.skip ?? 0,
    });
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.assertTaskOwned(userId, taskId);

    // Column change through PATCH /tasks/:id → append to end of destination.
    let position = task.position;
    let columnConnect = undefined as { connect: { id: string } } | undefined;
    if (dto.columnId && dto.columnId !== task.columnId) {
      const destCol = await this.assertColumnOwned(userId, dto.columnId);
      const max = (await this.tasks.maxPositionInColumn(destCol.id)) ?? 0;
      position = max + STEP;
      columnConnect = { connect: { id: destCol.id } };
    }

    const updated = await this.tasks.update(taskId, {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : dto.dueDate === null ? null : undefined,
      position,
      ...(columnConnect ? { column: columnConnect } : {}),
      ...(dto.assigneeId !== undefined
        ? dto.assigneeId
          ? { assignee: { connect: { id: dto.assigneeId } } }
          : { assignee: { disconnect: true } }
        : {}),
      ...(dto.labels
        ? {
            labels: {
              deleteMany: {},
              create: dto.labels.map((l) => ({ name: l.name, color: l.color })),
            },
          }
        : {}),
    });

    await this.log(taskId, userId, 'updated', { columnChanged: !!columnConnect });
    return updated;
  }

  async move(userId: string, taskId: string, dto: MoveTaskDto): Promise<Task> {
    if (dto.beforeTaskId && dto.afterTaskId) {
      throw new BadRequestException('Provide beforeTaskId OR afterTaskId, not both');
    }

    const task = await this.assertTaskOwned(userId, taskId);
    const destCol = await this.assertColumnOwned(userId, dto.targetColumnId);

    // Ensure destination column belongs to same board as task's board (owner check already done).
    if (destCol.board.id !== task.column.board.id) {
      throw new BadRequestException('Cannot move task across boards');
    }

    const { prev, next } = await this.resolveNeighbors(
      destCol.id,
      taskId,
      dto.beforeTaskId,
      dto.afterTaskId,
    );

    let newPosition = positionBetween(prev, next);

    if (needsRebalance(prev, next)) {
      newPosition = await this.rebalanceAndInsert(destCol.id, taskId, prev, next);
    }

    const updated = await this.tasks.update(taskId, {
      position: newPosition,
      column: { connect: { id: destCol.id } },
    });

    await this.log(taskId, userId, 'moved', {
      from: { columnId: task.columnId, position: task.position },
      to: { columnId: destCol.id, position: newPosition },
    });

    return updated;
  }

  async remove(userId: string, taskId: string): Promise<void> {
    await this.assertTaskOwned(userId, taskId);
    await this.tasks.softDelete(taskId);
    await this.log(taskId, userId, 'deleted');
  }

  // --- internals ---

  private async resolveNeighbors(
    columnId: string,
    movingTaskId: string,
    beforeTaskId?: string,
    afterTaskId?: string,
  ): Promise<{ prev: number | null; next: number | null }> {
    if (beforeTaskId) {
      const before = await this.tasks.positionOf(beforeTaskId);
      if (!before || before.deletedAt || before.columnId !== columnId) {
        throw new BadRequestException('beforeTaskId not in target column');
      }
      // Neighbor above beforeTaskId (excluding the moving task itself).
      const [aboveList] = await this.prisma.$transaction([
        this.prisma.task.findFirst({
          where: {
            columnId,
            deletedAt: null,
            position: { lt: before.position },
            NOT: { id: movingTaskId },
          },
          orderBy: { position: 'desc' },
          select: { position: true },
        }),
      ]);
      return { prev: aboveList?.position ?? null, next: before.position };
    }

    if (afterTaskId) {
      const after = await this.tasks.positionOf(afterTaskId);
      if (!after || after.deletedAt || after.columnId !== columnId) {
        throw new BadRequestException('afterTaskId not in target column');
      }
      const belowList = await this.prisma.task.findFirst({
        where: {
          columnId,
          deletedAt: null,
          position: { gt: after.position },
          NOT: { id: movingTaskId },
        },
        orderBy: { position: 'asc' },
        select: { position: true },
      });
      return { prev: after.position, next: belowList?.position ?? null };
    }

    // Append to end (excluding the moving task).
    const last = await this.prisma.task.findFirst({
      where: { columnId, deletedAt: null, NOT: { id: movingTaskId } },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return { prev: last?.position ?? null, next: null };
  }

  private async rebalanceAndInsert(
    columnId: string,
    movingTaskId: string,
    prev: number | null,
    next: number | null,
  ): Promise<number> {
    // Rebalance whole column to evenly-spaced integer positions, then compute
    // the moving task's target as midpoint of its new neighbors' positions.
    const rows = await this.tasks.listPositionsAsc(columnId);
    const targets = rows.filter((r) => r.id !== movingTaskId);

    // Reassign positions STEP, 2*STEP, ...
    await this.prisma.$transaction(
      targets.map((row, i) =>
        this.prisma.task.update({
          where: { id: row.id },
          data: { position: (i + 1) * STEP },
        }),
      ),
    );

    // Recompute new prev/next based on original ordering intent.
    // If prev existed, find where its task now lives; same for next.
    const prevRow = prev !== null ? rows.find((r) => r.position === prev) : null;
    const nextRow = next !== null ? rows.find((r) => r.position === next) : null;

    const targetIds = targets.map((t) => t.id);
    const prevIdx = prevRow ? targetIds.indexOf(prevRow.id) : -1;
    const nextIdx = nextRow ? targetIds.indexOf(nextRow.id) : -1;

    const newPrev = prevIdx >= 0 ? (prevIdx + 1) * STEP : null;
    const newNext = nextIdx >= 0 ? (nextIdx + 1) * STEP : null;
    return positionBetween(newPrev, newNext);
  }

  private async assertTaskOwned(userId: string, taskId: string) {
    const task = await this.tasks.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');
    if (task.column.board.ownerId !== userId) throw new ForbiddenException('Not board owner');
    return task;
  }

  private async assertColumnOwned(userId: string, columnId: string) {
    const col = await this.columns.findById(columnId);
    if (!col) throw new NotFoundException('Column not found');
    if (col.board.ownerId !== userId) throw new ForbiddenException('Not board owner');
    return col;
  }

  private log(
    taskId: string,
    userId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.activityLog.create({
      data: { taskId, userId, action, metadata: (metadata ?? undefined) as Prisma.InputJsonValue },
    });
  }
}
