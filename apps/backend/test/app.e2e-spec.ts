import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from './../src/health/health.controller';
import { HealthService } from './../src/health/health.service';

/**
 * HTTP smoke test for the public /health endpoint.
 *
 * It boots only the HealthController with a mocked HealthService, so it
 * exercises the real Nest HTTP stack (routing + controller + serialization)
 * via supertest without needing a database or environment configuration.
 * Run with `pnpm test:e2e`.
 */
describe('Health endpoint (e2e smoke)', () => {
  let app: INestApplication;

  const healthServiceMock = {
    getStatus: jest.fn().mockResolvedValue({
      status: 'ok',
      db: 'connected',
      ledgerBalanced: true,
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns an ok status payload', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', db: 'connected', ledgerBalanced: true });
  });
});
