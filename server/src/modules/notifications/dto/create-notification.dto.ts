import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ description: 'UUID or "all" for broadcast' })
  @IsString()
  recipientId: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ enum: ['Normal', 'Urgent'] })
  @IsOptional()
  @IsString()
  priority?: 'Normal' | 'Urgent';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTask?: boolean;
}
