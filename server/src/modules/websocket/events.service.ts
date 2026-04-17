import { Injectable } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

/**
 * EventsService — thin injectable wrapper around EventsGateway.
 *
 * Inject this (not the gateway directly) from other services so they
 * don't need to import the gateway class themselves.
 */
@Injectable()
export class EventsService {
  constructor(private readonly gateway: EventsGateway) {}

  emitNotification(recipientId: string, notification: {
    id?: string;
    senderId: string;
    senderName: string;
    message: string;
    priority: string;
  }) {
    this.gateway.emitNotification(recipientId, notification);
  }

  emitCaseUpdate(caseId: string, data: {
    crmStatus: string;
    subStatus: string;
    officerId: string;
    officerName: string;
  }) {
    this.gateway.emitCaseUpdate(caseId, data);
  }

  emitPaymentLogged(data: {
    caseId: string;
    amount: number;
    currency: string;
    officerName: string;
  }) {
    this.gateway.emitPaymentLogged(data);
  }

  emitPtpReminder(officerId: string, data: {
    caseId: string;
    debtorName: string;
    promisedAmount: number;
    promisedDate: string;
  }) {
    this.gateway.emitPtpReminder(officerId, data);
  }

  emitWorkflowTriggered(ruleName: string, casesAffected: number) {
    this.gateway.server?.to('all').emit('workflow:triggered', { ruleName, casesAffected });
  }

  getOnlineUserIds(): string[] {
    return this.gateway.getOnlineUserIds();
  }
}
