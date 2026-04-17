import { IsUUID, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReassignCaseDto {
  @ApiProperty()
  @IsUUID()
  newOfficerId: string;
}

export class BulkReassignDto {
  @ApiProperty()
  @IsArray()
  @IsUUID('4', { each: true })
  caseIds: string[];

  @ApiProperty()
  @IsUUID()
  newOfficerId: string;
}
