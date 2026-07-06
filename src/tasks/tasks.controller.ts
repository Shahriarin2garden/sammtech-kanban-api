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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post('columns/:id/tasks')
  create(
    @CurrentUser('sub') userId: string,
    @Param('id') columnId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.createInColumn(userId, columnId, dto);
  }

  @Get('tasks')
  list(@CurrentUser('sub') userId: string, @Query() query: QueryTasksDto) {
    return this.tasks.list(userId, query);
  }

  @Patch('tasks/:id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(userId, id, dto);
  }

  @Patch('tasks/:id/position')
  move(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.tasks.move(userId, id, dto);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.tasks.remove(userId, id);
  }
}
