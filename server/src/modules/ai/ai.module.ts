import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Case } from '../cases/entities/case.entity';
import { Action } from '../actions/entities/action.entity';
import { User } from '../users/entities/user.entity';
import { Loan } from '../loans/entities/loan.entity';
import { Debtor } from '../debtors/entities/debtor.entity';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiForecastController } from './ai-forecast.controller';
import { AiCurrencyController } from './ai-currency.controller';
import { AiIntelligenceController } from './ai-intelligence.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Case, Action, User, Loan, Debtor])],
  controllers: [AiController, AiForecastController, AiCurrencyController, AiIntelligenceController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
