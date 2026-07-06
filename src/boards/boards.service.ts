import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardsRepository } from './boards.repository';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@Injectable()
export class BoardsService {
  constructor(private readonly repo: BoardsRepository) {}

  create(userId: string, dto: CreateBoardDto) {
    return this.repo.createWithDefaults(userId, dto.title);
  }

  listMine(userId: string) {
    return this.repo.listByOwner(userId);
  }

  async getOneOwned(userId: string, boardId: string) {
    const board = await this.repo.findById(boardId);
    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId !== userId) throw new ForbiddenException('Not board owner');
    return board;
  }

  async assertOwner(userId: string, boardId: string): Promise<void> {
    const board = await this.repo.findBareById(boardId);
    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId !== userId) throw new ForbiddenException('Not board owner');
  }

  async update(userId: string, boardId: string, dto: UpdateBoardDto) {
    await this.assertOwner(userId, boardId);
    return this.repo.update(boardId, dto);
  }

  async remove(userId: string, boardId: string): Promise<void> {
    await this.assertOwner(userId, boardId);
    await this.repo.softDelete(boardId);
  }
}
