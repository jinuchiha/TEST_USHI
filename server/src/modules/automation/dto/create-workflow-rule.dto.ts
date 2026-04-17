import { IsString, IsBoolean, IsOptional, IsArray, IsObject, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowRuleDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  trigger: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  triggerParams?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  conditions?: Array<{ field: string; operator: string; value: string }>;

  @ApiProperty()
  @IsArray()
  actions: Array<{ type: string; params: Record<string, string> }>;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
