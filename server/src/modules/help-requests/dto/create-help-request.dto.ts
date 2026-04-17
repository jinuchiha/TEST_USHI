import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHelpRequestDto {
  @ApiProperty()
  @IsString()
  query: string;
}
