import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateColumnDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title?: string;

  @ApiPropertyOptional({ description: 'Float order value; higher = further right' })
  @IsOptional()
  @IsNumber()
  order?: number;
}
