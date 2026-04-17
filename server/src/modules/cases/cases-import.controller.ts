import {
  Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { CasesImportService } from './cases-import.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

@ApiTags('Cases - Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/cases')
export class CasesImportController {
  constructor(private importService: CasesImportService) {}

  @Post('import')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Bulk import cases from CSV' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importCases(
    @UploadedFile() file: Express.Multer.File,
    @Body('assignedOfficerId') assignedOfficerId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) {
      return { error: 'No file uploaded' };
    }

    const csvContent = file.buffer.toString('utf-8');
    const { headers, rows } = this.importService.parseCsv(csvContent);
    const mapping = this.importService.detectFieldMapping(headers);

    const result = await this.importService.importCases(
      rows,
      mapping,
      assignedOfficerId || 'unassigned',
      userId,
    );

    return { data: result };
  }

  @Post('import/preview')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Preview CSV field mapping before import' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { error: 'No file uploaded' };
    }

    const csvContent = file.buffer.toString('utf-8');
    const { headers, rows } = this.importService.parseCsv(csvContent);
    const mapping = this.importService.detectFieldMapping(headers);

    return {
      data: {
        headers,
        detectedMapping: mapping,
        sampleRows: rows.slice(0, 3),
        totalRows: rows.length,
        unmappedFields: headers.filter(h => !Object.values(mapping).includes(h)),
      },
    };
  }
}
