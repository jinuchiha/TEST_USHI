import { IsUUID, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCaseDto {
  @ApiProperty()
  @IsUUID()
  debtorId: string;

  @ApiProperty()
  @IsUUID()
  loanId: string;

  @ApiProperty()
  @IsUUID()
  assignedOfficerId: string;

  @ApiProperty()
  @IsString()
  crmStatus: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactStatus?: 'Contact' | 'Non Contact';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workStatus?: 'Work' | 'Non Work';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tracingStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statusCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cyber?: 'Yes' | 'No';
}
