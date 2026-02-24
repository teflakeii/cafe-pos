import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpErrorInterceptor } from './common/interceptors/http-error.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const jwtSecret = configService.get<string>('JWT_SECRET');

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
  });

  app.use(
    helmet({
      frameguard: {
        action: 'deny',
      },
      hidePoweredBy: true,
      noSniff: true,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new HttpErrorInterceptor());

  await app.listen(3000);
  logger.log(`Backend running on http://localhost:3000 (${nodeEnv})`);
}

bootstrap();
