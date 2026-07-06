import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh JWT issued by /auth/login' })
  @IsJWT()
  refreshToken!: string;
}
