import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix(config.getOrThrow<string>('apiPrefix'));
  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string>('corsOrigin'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SammTech Kanban API')
    .setDescription('Kanban board REST API — boards, columns, tasks, auth')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, doc, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.getOrThrow<number>('port');
  // Bind to 0.0.0.0 so WSL and Docker can reach the server when running on host
  await app.listen(port, '0.0.0.0');
  logger.log(`Listening on :${port} (docs at /docs)`);
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', e);
  process.exit(1);
});
