import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import jwtConfig from './config/jwt.config';

import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DebtorsModule } from './modules/debtors/debtors.module';
import { LoansModule } from './modules/loans/loans.module';
import { CasesModule } from './modules/cases/cases.module';
import { ActionsModule } from './modules/actions/actions.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HelpRequestsModule } from './modules/help-requests/help-requests.module';
import { AllocationsModule } from './modules/allocations/allocations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AiModule } from './modules/ai/ai.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { WithdrawalModule } from './modules/withdrawals/withdrawal.module';
import { HrModule } from './modules/hr/hr.module';
import { LegalModule } from './modules/legal/legal.module';
import { ProductivityModule } from './modules/productivity/productivity.module';
import { AutomationModule } from './modules/automation/automation.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { AccessLogModule } from './modules/access-log/access-log.module';
import { TracingModule } from './modules/tracing/tracing.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, jwtConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const useSsl = configService.get<boolean>('database.ssl');
        return {
          type: 'postgres',
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          database: configService.get<string>('database.name'),
          username: configService.get<string>('database.user'),
          password: configService.get<string>('database.password'),
          autoLoadEntities: true,
          // synchronize: true creates/updates tables from entities (use for first-time setup or dev)
          // Set DB_SYNC=true in .env for first run, then disable for production migrations
          synchronize: configService.get<string>('DB_SYNC') === 'true',
          logging: configService.get<string>('NODE_ENV') === 'development',
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          extra: useSsl ? {
            ssl: { rejectUnauthorized: false },
          } : {},
        };
      },
    }),
    AuthModule,
    UsersModule,
    DebtorsModule,
    LoansModule,
    CasesModule,
    ActionsModule,
    AuditLogsModule,
    NotificationsModule,
    HelpRequestsModule,
    AllocationsModule,
    ReportsModule,
    AiModule,
    SchedulerModule,
    WebsocketModule,
    WithdrawalModule,
    HrModule,
    LegalModule,
    ProductivityModule,
    AutomationModule,
    CommunicationModule,
    AccessLogModule,
    TracingModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
