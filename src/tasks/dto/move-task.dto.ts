import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MoveTaskDto {
  @ApiProperty({ description: 'Destination column ID' })
  @IsString()
  targetColumnId!: string;

  @ApiPropertyOptional({
    description: 'Task ID this task should be placed BEFORE (i.e. inserted above it). Omit both to append.',
  })
  @IsOptional()
  @IsString()
  beforeTaskId?: string;

  @ApiPropertyOptional({
    description: 'Task ID this task should be placed AFTER (i.e. inserted below it).',
  })
  @IsOptional()
  @IsString()
  afterTaskId?: string;
}
