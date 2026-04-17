import {
  Controller, Get, Post, Patch, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HelpRequestsService } from './help-requests.service';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { ReplyHelpRequestDto } from './dto/reply-help-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('Help Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/help-requests')
export class HelpRequestsController {
  constructor(private helpRequestsService: HelpRequestsService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all help requests' })
  async findAll() {
    const data = await this.helpRequestsService.findAll();
    return { data };
  }

  @Post()
  @ApiOperation({ summary: 'Submit a help request' })
  async create(
    @Body() dto: CreateHelpRequestDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.helpRequestsService.create(
      user.id, user.name, user.role, dto.query,
    );
    return { data };
  }

  @Post(':id/replies')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin reply to help request' })
  async addReply(
    @Param('id') id: string,
    @Body() dto: ReplyHelpRequestDto,
    @CurrentUser('name') adminName: string,
  ) {
    const data = await this.helpRequestsService.addReply(id, adminName, dto.message);
    return { data };
  }

  @Patch(':id/resolve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mark help request as resolved' })
  async resolve(
    @Param('id') id: string,
    @CurrentUser('name') resolvedBy: string,
  ) {
    await this.helpRequestsService.resolve(id, resolvedBy);
    return { message: 'Help request resolved' };
  }
}
