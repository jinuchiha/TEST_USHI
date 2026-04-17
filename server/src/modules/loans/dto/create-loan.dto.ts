import { IsString, IsNumber, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../../common/enums';

export class CreateLoanDto {
  @ApiProperty()
  @IsUUID()
  debtorId: string;

  @ApiProperty()
  @IsString()
  accountNumber: string;

  @ApiProperty()
  @IsNumber()
  originalAmount: number;

  @ApiProperty()
  @IsNumber()
  currentBalance: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  product?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bank?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subProduct?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bucket?: string;

  @ApiProperty({ enum: Currency })
  @IsEnum(Currency)
  currency: Currency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lpd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cif?: string;
}
