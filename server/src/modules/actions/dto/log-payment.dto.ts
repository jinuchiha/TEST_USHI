import { IsNumber, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogPaymentDto {
  @ApiProperty()
  @IsNumber()
  amountPaid: number;

  @ApiProperty({ enum: ['Full Payment', 'Settlement', 'Installment'] })
  @IsString()
  paymentType: 'Full Payment' | 'Settlement' | 'Installment';

  @ApiProperty({ enum: ['Slip', 'Bank Confirmation'] })
  @IsString()
  confirmationMethod: 'Slip' | 'Bank Confirmation';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  finalSubStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attributionDate?: string;
}
