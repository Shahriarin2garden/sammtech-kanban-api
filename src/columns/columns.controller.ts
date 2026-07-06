import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ColumnsService } from './columns.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@ApiTags('columns')
@ApiBearerAuth()
@Controller()
export class ColumnsController {
  constructor(private readonly columns: ColumnsService) {}

  @Post('boards/:id/columns')
  create(
    @CurrentUser('sub') userId: string,
    @Param('id') boardId: string,
    @Body() dto: CreateColumnDto,
  ) {
    return this.columns.create(userId, boardId, dto);
  }

  @Patch('columns/:id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.columns.update(userId, id, dto);
  }

  @Delete('columns/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.columns.remove(userId, id);
  }
}
