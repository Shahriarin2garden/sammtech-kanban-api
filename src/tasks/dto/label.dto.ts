import { ApiProperty } from '@nestjs/swagger';
import { IsHexColor, IsString, MaxLength, MinLength } from 'class-validator';

export class LabelDto {
  @ApiProperty({ example: 'bug' })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;

  @ApiProperty({ example: '#ff3366' })
  @IsHexColor()
  color!: string;
}
