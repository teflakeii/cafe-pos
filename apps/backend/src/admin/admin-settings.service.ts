import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminSettingsService {
  constructor(private readonly configService: ConfigService) {}

  getSettings() {
    return {
      app: {
        name: 'Cafe POS',
        environment: this.configService.get<string>('NODE_ENV') ?? 'development',
      },
      api: {
        port: 3000,
        corsOrigins: ['http://localhost:3001', 'http://localhost:3002'],
      },
      auth: {
        jwtExpiryHours: 8,
      },
      pos: {
        allowCashierOpenShift: true,
        requiresOpenShiftForOrders: true,
      },
    };
  }
}
