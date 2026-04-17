import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActionDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextFollowUp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  promisedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  promisedDate?: string;
}
