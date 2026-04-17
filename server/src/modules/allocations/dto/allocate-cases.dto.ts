import { IsUUID, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AllocateCasesDto {
  @ApiProperty()
  @IsUUID()
  recipientId: string;

  @ApiProperty()
  @IsArray()
  @IsUUID('4', { each: true })
  caseIds: string[];

  @ApiProperty({ enum: ['Initial Assignment', 'Re-Assignment', 'Re-Activation'] })
  @IsString()
  type: 'Initial Assignment' | 'Re-Assignment' | 'Re-Activation';
}
