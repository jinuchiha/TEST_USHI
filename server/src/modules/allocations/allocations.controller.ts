import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AllocationsService } from './allocations.service';
import { AllocateCasesDto } from './dto/allocate-cases.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('Allocations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/allocations')
export class AllocationsController {
  constructor(private allocationsService: AllocationsService) {}

  @Post()
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Allocate cases to an officer' })
  async allocate(
    @Body() dto: AllocateCasesDto,
    @CurrentUser('id') allocatorId: string,
  ) {
    const data = await this.allocationsService.allocate(dto, allocatorId);
    return { data };
  }

  @Get('log')
  @Roles(Role.MANAGER, Role.ADMIN, Role.CEO)
  @ApiOperation({ summary: 'Get allocation history' })
  async findAll(@Query() pagination: PaginationDto) {
    return this.allocationsService.findAll(pagination);
  }
}
