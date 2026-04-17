import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCaseStatusDto {
  @ApiProperty()
  @IsString()
  crmStatus: string;

  @ApiProperty()
  @IsString()
  subStatus: string;

  @ApiProperty()
  @IsString()
  contactStatus: 'Contact' | 'Non Contact';

  @ApiProperty()
  @IsString()
  workStatus: 'Work' | 'Non Work';

  @ApiProperty()
  @IsString()
  notes: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  promisedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promisedDate?: string;

  @ApiPropertyOptional({ description: 'Expected version for optimistic concurrency' })
  @IsOptional()
  @IsNumber()
  expectedVersion?: number;
}
