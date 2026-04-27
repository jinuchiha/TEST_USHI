import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case } from './entities/case.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { Action } from '../actions/entities/action.entity';
import { Debtor } from '../debtors/entities/debtor.entity';
import { Loan } from '../loans/entities/loan.entity';
import { User } from '../users/entities/user.entity';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { CasesImportService } from './cases-import.service';
import { CasesImportController } from './cases-import.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Case, AuditLog, Action, Debtor, Loan, User])],
  controllers: [CasesController, CasesImportController],
  providers: [CasesService, CasesImportService],
  exports: [CasesService],
})
export class CasesModule {}
