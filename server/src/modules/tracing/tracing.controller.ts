import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TracingService } from './tracing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Tracing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/tracing')
export class TracingController {
  constructor(private tracingService: TracingService) {}

  @Post('contacts')
  @ApiOperation({ summary: 'Add a new contact record for a debtor' })
  async addContact(
    @Body() body: { debtorId: string; caseId?: string; type: string; value: string; label?: string; source?: string; notes?: string },
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.tracingService.addContact({ ...body, addedBy: userId } as any);
    return { data };
  }

  @Get('contacts/:debtorId')
  @ApiOperation({ summary: 'Get all contacts for a debtor' })
  async getContacts(@Param('debtorId') debtorId: string) {
    const data = await this.tracingService.getContactsByDebtor(debtorId);
    return { data };
  }

  @Patch('contacts/:id/status')
  @ApiOperation({ summary: 'Update contact status (valid/invalid/switched_off/new_found)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    const data = await this.tracingService.updateContactStatus(id, body.status as any, body.notes);
    return { data };
  }

  @Post('contacts/:id/attempt')
  @ApiOperation({ summary: 'Log a contact attempt (success/failure)' })
  async logAttempt(
    @Param('id') id: string,
    @Body() body: { success: boolean },
  ) {
    const data = await this.tracingService.logAttempt(id, body.success);
    return { data };
  }

  @Get('success-rate/:debtorId')
  @ApiOperation({ summary: 'Get contact success rate for a debtor' })
  async successRate(@Param('debtorId') debtorId: string) {
    const data = await this.tracingService.getContactSuccessRate(debtorId);
    return { data };
  }

  @Get('timeline/:debtorId')
  @ApiOperation({ summary: 'Get tracing timeline for a debtor' })
  async timeline(@Param('debtorId') debtorId: string) {
    const data = await this.tracingService.getTracingTimeline(debtorId);
    return { data };
  }
}
