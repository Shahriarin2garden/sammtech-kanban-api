import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@ApiTags('boards')
@ApiBearerAuth()
@Controller('boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateBoardDto) {
    return this.boards.create(userId, dto);
  }

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.boards.listMine(userId);
  }

  @Get(':id')
  getOne(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.boards.getOneOwned(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boards.update(userId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.boards.remove(userId, id);
  }
}
