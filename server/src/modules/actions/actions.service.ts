import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action } from './entities/action.entity';
import { CreateActionDto } from './dto/create-action.dto';
import { LogPaymentDto } from './dto/log-payment.dto';
import { ActionType } from '../../common/enums';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(Action)
    private actionsRepo: Repository<Action>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  async findByCaseId(caseId: string): Promise<Action[]> {
    return this.actionsRepo.find({
      where: { caseId },
      order: { createdAt: 'DESC' },
    });
  }

  async createAction(caseId: string, dto: CreateActionDto, officerId: string): Promise<Action> {
    const action = this.actionsRepo.create({
      caseId,
      type: dto.type,
      officerId,
      notes: dto.notes || null,
      nextFollowUp: dto.nextFollowUp ? new Date(dto.nextFollowUp) : null,
      promisedAmount: dto.promisedAmount || null,
      promisedDate: dto.promisedDate || null,
    });
    const saved = await this.actionsRepo.save(action);

    await this.auditRepo.save(
      this.auditRepo.create({
        userId: officerId,
        caseId,
        details: `Action: ${dto.type}${dto.notes ? ' - ' + dto.notes : ''}`,
      }),
    );

    return saved;
  }

  async logPayment(
    caseId: string,
    dto: LogPaymentDto,
    officerId: string,
    receiptPath?: string,
    settlementLetterPath?: string,
  ): Promise<Action> {
    const action = this.actionsRepo.create({
      caseId,
      type: ActionType.PAYMENT_RECEIVED,
      officerId,
      notes: dto.notes || null,
      amountPaid: dto.amountPaid,
      paymentType: dto.paymentType,
      confirmationMethod: dto.confirmationMethod,
      attributionDate: dto.attributionDate || null,
      receiptPath: receiptPath || null,
      settlementLetterPath: settlementLetterPath || null,
      paymentConfirmedBy: 'User',
    });
    const saved = await this.actionsRepo.save(action);

    await this.auditRepo.save(
      this.auditRepo.create({
        userId: officerId,
        caseId,
        details: `Payment logged: ${dto.amountPaid} (${dto.paymentType})`,
      }),
    );

    return saved;
  }

  async verifyPayment(actionId: string, financeUserId: string): Promise<Action> {
    const action = await this.actionsRepo.findOne({ where: { id: actionId } });
    if (!action) throw new NotFoundException('Action not found');

    action.paymentVerifiedByFinanceAt = new Date();
    action.paymentConfirmedBy = 'Bank';
    const saved = await this.actionsRepo.save(action);

    await this.auditRepo.save(
      this.auditRepo.create({
        userId: financeUserId,
        caseId: action.caseId,
        details: `Payment verified by finance for amount ${action.amountPaid}`,
      }),
    );

    return saved;
  }
}
