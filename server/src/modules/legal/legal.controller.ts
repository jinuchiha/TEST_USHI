import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LegalService } from './legal.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

const storage = diskStorage({
  destination: './uploads/documents',
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

@ApiTags('Legal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/legal')
export class LegalController {
  constructor(private legalService: LegalService) {}

  // ── Notices ──
  @Post('notices')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Create legal notice' })
  async createNotice(@Body() body: any, @CurrentUser('id') userId: string) {
    const data = await this.legalService.createNotice({ ...body, createdBy: userId });
    return { data };
  }

  @Get('notices/case/:caseId')
  @ApiOperation({ summary: 'Get notices for a case' })
  async getNotices(@Param('caseId') caseId: string) {
    const data = await this.legalService.getNoticesByCaseId(caseId);
    return { data };
  }

  @Patch('notices/:id/status')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Update notice status' })
  async updateNoticeStatus(
    @Param('id') id: string,
    @Body() body: { status: string; deliveredDate?: string },
  ) {
    const data = await this.legalService.updateNoticeStatus(id, body.status as any, body.deliveredDate);
    return { data };
  }

  // ── Court Cases ──
  @Post('court-cases')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Register court case' })
  async createCourtCase(@Body() body: any) {
    const data = await this.legalService.createCourtCase(body);
    return { data };
  }

  @Get('court-cases')
  @ApiOperation({ summary: 'List court cases' })
  async getCourtCases(@Query('caseId') caseId?: string) {
    const data = await this.legalService.getCourtCases(caseId);
    return { data };
  }

  @Patch('court-cases/:id')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Update court case' })
  async updateCourtCase(@Param('id') id: string, @Body() body: any) {
    const data = await this.legalService.updateCourtCase(id, body);
    return { data };
  }

  @Get('court-cases/upcoming')
  @ApiOperation({ summary: 'Get upcoming hearings' })
  async upcomingHearings(@Query('days') days?: string) {
    const data = await this.legalService.getUpcomingHearings(parseInt(days || '30'));
    return { data };
  }

  // ── Document Vault ──
  @Post('documents')
  @ApiOperation({ summary: 'Upload document to vault' })
  @UseInterceptors(FileInterceptor('file', { storage }))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { debtorId?: string; caseId?: string; type: string; isConfidential?: boolean },
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.legalService.uploadDocument({
      debtorId: body.debtorId || null,
      caseId: body.caseId || null,
      type: body.type as any,
      fileName: file.originalname,
      filePath: file.filename,
      fileSize: file.size,
      mimeType: file.mimetype,
      isConfidential: body.isConfidential === true,
      uploadedBy: userId,
    });
    return { data };
  }

  @Get('documents')
  @ApiOperation({ summary: 'List documents' })
  async getDocuments(@Query('debtorId') debtorId?: string, @Query('caseId') caseId?: string) {
    const data = await this.legalService.getDocuments(debtorId, caseId);
    return { data };
  }

  @Delete('documents/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete document' })
  async deleteDocument(@Param('id') id: string) {
    await this.legalService.deleteDocument(id);
    return { message: 'Document deleted' };
  }
}
