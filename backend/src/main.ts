import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalValidationPipe } from './common/pipes/validation.pipe';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Seguridad
  app.use(helmet());
  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const devOrigins =
    process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8085'];
  const allowedOrigins = [...new Set([...configuredOrigins, ...devOrigins])];

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  });

  // Prefix global para la API REST
  app.setGlobalPrefix('api');

  // Pipes y filtros globales
  app.useGlobalPipes(GlobalValidationPipe);
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Backend corriendo en http://localhost:${port}/api`);
  logger.log(`🔌 WebSocket disponible en ws://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Error al iniciar el servidor:', err);
});
