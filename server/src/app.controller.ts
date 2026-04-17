import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('api')
export class AppController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  async health() {
    const dbOk = this.dataSource.isInitialized;
    let dbLatency = -1;

    if (dbOk) {
      const start = Date.now();
      await this.dataSource.query('SELECT 1');
      dbLatency = Date.now() - start;
    }

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: { status: dbOk ? 'connected' : 'disconnected', latencyMs: dbLatency },
      },
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  async ready() {
    const dbOk = this.dataSource.isInitialized;
    if (!dbOk) {
      throw new Error('Database not ready');
    }
    return { status: 'ready' };
  }

  @Get('health/hr')
  @ApiOperation({ summary: 'HR module health check' })
  async hrHealth() {
    const dbOk = this.dataSource.isInitialized;
    let attendanceTableOk = false;
    let leaveTableOk = false;
    let todayRecords = 0;

    if (dbOk) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const attResult = await this.dataSource.query(`SELECT COUNT(*) as count FROM attendance WHERE date = $1`, [today]);
        todayRecords = parseInt(attResult[0]?.count || '0', 10);
        attendanceTableOk = true;
      } catch { attendanceTableOk = false; }

      try {
        await this.dataSource.query(`SELECT 1 FROM leave_requests LIMIT 1`);
        leaveTableOk = true;
      } catch { leaveTableOk = false; }
    }

    return {
      status: attendanceTableOk && leaveTableOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      modules: {
        attendance: { status: attendanceTableOk ? 'ok' : 'error', todayRecords },
        leave: { status: leaveTableOk ? 'ok' : 'error' },
      },
      alerts: todayRecords === 0 ? ['No attendance records for today — scheduler may not have run'] : [],
    };
  }
}
