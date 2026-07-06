import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardsService } from '../boards/boards.service';
import { ColumnsRepository } from './columns.repository';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@Injectable()
export class ColumnsService {
  constructor(
    private readonly repo: ColumnsRepository,
    private readonly boards: BoardsService,
  ) {}

  async create(userId: string, boardId: string, dto: CreateColumnDto) {
    await this.boards.assertOwner(userId, boardId);
    const max = (await this.repo.maxOrder(boardId)) ?? 0;
    return this.repo.create(boardId, dto.title, max + 1000);
  }

  async update(userId: string, columnId: string, dto: UpdateColumnDto) {
    const col = await this.getOwnedOrThrow(userId, columnId);
    return this.repo.update(col.id, dto);
  }

  async remove(userId: string, columnId: string): Promise<void> {
    const col = await this.getOwnedOrThrow(userId, columnId);
    await this.repo.delete(col.id);
  }

  private async getOwnedOrThrow(userId: string, columnId: string) {
    const col = await this.repo.findById(columnId);
    if (!col) throw new NotFoundException('Column not found');
    if (col.board.ownerId !== userId) throw new ForbiddenException('Not board owner');
    return col;
  }
}
