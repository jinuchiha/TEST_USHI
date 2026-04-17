import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplyHelpRequestDto {
  @ApiProperty()
  @IsString()
  message: string;
}
