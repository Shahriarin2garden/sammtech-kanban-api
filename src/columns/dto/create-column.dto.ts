import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateColumnDto {
  @ApiProperty({ example: 'Blocked' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;
}
