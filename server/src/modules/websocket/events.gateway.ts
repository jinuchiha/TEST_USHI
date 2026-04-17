import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * WebSocket Gateway for real-time features:
 * - Notification push
 * - Case status change broadcasts
 * - PTP reminders
 * - Officer online status
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/ws',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedUsers = new Map<string, string>(); // socketId -> userId

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id);
    this.connectedUsers.delete(client.id);
    if (userId) {
      this.logger.log(`User ${userId} disconnected`);
      this.server.emit('user:offline', { userId });
    }
  }

  @SubscribeMessage('auth')
  handleAuth(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    this.connectedUsers.set(client.id, data.userId);
    client.join(`user:${data.userId}`);
    client.join('all');
    this.logger.log(`User ${data.userId} authenticated on socket ${client.id}`);
    this.server.emit('user:online', { userId: data.userId });
  }

  // --- Emission methods (called by services) ---

  /**
   * Send notification to specific user or broadcast
   */
  emitNotification(recipientId: string, notification: any) {
    if (recipientId === 'all') {
      this.server.to('all').emit('notification:new', notification);
    } else {
      this.server.to(`user:${recipientId}`).emit('notification:new', notification);
    }
  }

  /**
   * Broadcast case status change (for live dashboard updates)
   */
  emitCaseUpdate(caseId: string, data: {
    crmStatus: string;
    subStatus: string;
    officerId: string;
    officerName: string;
  }) {
    this.server.to('all').emit('case:updated', { caseId, ...data });
  }

  /**
   * Broadcast new payment logged
   */
  emitPaymentLogged(data: {
    caseId: string;
    amount: number;
    currency: string;
    officerName: string;
  }) {
    this.server.to('all').emit('payment:logged', data);
  }

  /**
   * Send PTP reminder to specific officer
   */
  emitPtpReminder(officerId: string, data: {
    caseId: string;
    debtorName: string;
    promisedAmount: number;
    promisedDate: string;
  }) {
    this.server.to(`user:${officerId}`).emit('ptp:reminder', data);
  }

  /**
   * Get count of online users
   */
  getOnlineUserIds(): string[] {
    return Array.from(new Set(this.connectedUsers.values()));
  }
}
