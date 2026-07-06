import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBoardDto {
  @ApiProperty({ example: 'Product Roadmap Q3' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;
}
