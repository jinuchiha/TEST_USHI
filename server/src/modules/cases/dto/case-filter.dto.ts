import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CaseFilterDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  crmStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedOfficerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;
}
