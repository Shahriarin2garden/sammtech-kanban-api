import { Module } from '@nestjs/common';
import { BoardsModule } from '../boards/boards.module';
import { ColumnsController } from './columns.controller';
import { ColumnsRepository } from './columns.repository';
import { ColumnsService } from './columns.service';

@Module({
  imports: [BoardsModule],
  controllers: [ColumnsController],
  providers: [ColumnsService, ColumnsRepository],
  exports: [ColumnsService, ColumnsRepository],
})
export class ColumnsModule {}
