import {
  Controller, Get, Post, Patch, Body, Param, UseGuards,
  UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ActionsService } from './actions.service';
import { CreateActionDto } from './dto/create-action.dto';
import { LogPaymentDto } from './dto/log-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';

const storage = diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

@ApiTags('Actions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/cases/:caseId/actions')
export class ActionsController {
  constructor(private actionsService: ActionsService) {}

  @Get()
  @ApiOperation({ summary: 'List actions for a case' })
  async findAll(@Param('caseId') caseId: string) {
    const data = await this.actionsService.findByCaseId(caseId);
    return { data };
  }

  @Post()
  @Roles(Role.OFFICER, Role.MANAGER)
  @ApiOperation({ summary: 'Create an action (call, email, etc.)' })
  async create(
    @Param('caseId') caseId: string,
    @Body() dto: CreateActionDto,
    @CurrentUser('id') officerId: string,
  ) {
    const data = await this.actionsService.createAction(caseId, dto, officerId);
    return { data };
  }

  @Post('payment')
  @Roles(Role.OFFICER, Role.MANAGER, Role.FINANCE)
  @ApiOperation({ summary: 'Log a payment with optional file uploads' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'receipt', maxCount: 1 },
        { name: 'settlementLetter', maxCount: 1 },
      ],
      { storage },
    ),
  )
  async logPayment(
    @Param('caseId') caseId: string,
    @Body() dto: LogPaymentDto,
    @CurrentUser('id') officerId: string,
    @UploadedFiles()
    files?: {
      receipt?: Express.Multer.File[];
      settlementLetter?: Express.Multer.File[];
    },
  ) {
    const receiptPath = files?.receipt?.[0]?.filename || undefined;
    const settlementPath = files?.settlementLetter?.[0]?.filename || undefined;
    const data = await this.actionsService.logPayment(
      caseId, dto, officerId, receiptPath, settlementPath,
    );
    return { data };
  }
}

@ApiTags('Actions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/actions')
export class ActionsVerifyController {
  constructor(private actionsService: ActionsService) {}

  @Patch(':id/verify-payment')
  @Roles(Role.FINANCE)
  @ApiOperation({ summary: 'Finance verifies a payment' })
  async verifyPayment(
    @Param('id') id: string,
    @CurrentUser('id') financeUserId: string,
  ) {
    const data = await this.actionsService.verifyPayment(id, financeUserId);
    return { data };
  }
}
