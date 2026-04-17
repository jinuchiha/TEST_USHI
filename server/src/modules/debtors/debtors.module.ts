import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Debtor } from './entities/debtor.entity';
import { TracingLog } from './entities/tracing-log.entity';
import { DebtorsService } from './debtors.service';
import { DebtorsController } from './debtors.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Debtor, TracingLog])],
  controllers: [DebtorsController],
  providers: [DebtorsService],
  exports: [DebtorsService],
})
export class DebtorsModule {}
