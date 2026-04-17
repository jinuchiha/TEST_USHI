import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplyNotificationDto {
  @ApiProperty()
  @IsString()
  message: string;
}
