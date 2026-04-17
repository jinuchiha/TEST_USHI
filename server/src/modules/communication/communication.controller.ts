import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommunicationService } from './communication.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Communication')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/communication')
export class CommunicationController {
  constructor(private commService: CommunicationService) {}

  @Get('templates')
  @ApiOperation({ summary: 'Get email templates' })
  getTemplates() {
    return { data: this.commService.getTemplates() };
  }

  @Post('render-template')
  @ApiOperation({ summary: 'Render template with variables' })
  renderTemplate(@Body() body: { templateId: string; variables: Record<string, string> }) {
    const template = this.commService.getTemplateById(body.templateId);
    if (!template) return { error: 'Template not found' };
    const rendered = this.commService.renderTemplate(template, body.variables);
    return { data: rendered };
  }

  @Post('send/email')
  @ApiOperation({ summary: 'Send email to debtor' })
  async sendEmail(
    @Body() body: { to: string; subject: string; body: string; caseId: string },
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.commService.sendEmail(body.to, body.subject, body.body, body.caseId, userId);
    return { data: result };
  }

  @Post('send/sms')
  @ApiOperation({ summary: 'Send SMS to debtor' })
  async sendSms(
    @Body() body: { to: string; message: string; caseId: string },
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.commService.sendSms(body.to, body.message, body.caseId, userId);
    return { data: result };
  }

  @Post('send/whatsapp')
  @ApiOperation({ summary: 'Send WhatsApp message' })
  async sendWhatsApp(
    @Body() body: { to: string; message: string; caseId: string },
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.commService.sendWhatsApp(body.to, body.message, body.caseId, userId);
    return { data: result };
  }

  @Post('log-call')
  @ApiOperation({ summary: 'Log a phone call' })
  async logCall(
    @Body() body: { phoneNumber: string; caseId: string; duration?: number; outcome?: string },
    @CurrentUser('id') userId: string,
  ) {
    await this.commService.logCall(body.phoneNumber, body.caseId, userId, body.duration, body.outcome);
    return { message: 'Call logged' };
  }

  @Post('ai/formal-note')
  @ApiOperation({ summary: 'AI: Generate formal note from short input' })
  generateNote(@Body() body: {
    shortNote: string;
    debtorName: string;
    crmStatus: string;
    balance: number;
    currency: string;
  }) {
    const note = this.commService.generateFormalNote(body.shortNote, body);
    return { data: { formalNote: note } };
  }

  @Post('ai/contact-strategy')
  @ApiOperation({ summary: 'AI: Suggest best contact strategy' })
  suggestStrategy(@Body() body: any) {
    const strategy = this.commService.suggestContactStrategy(body);
    return { data: strategy };
  }
}
