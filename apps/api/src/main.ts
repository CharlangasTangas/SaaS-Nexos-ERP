import { NestFactory } from '@nestjs/core';
import type {
  NestFastifyApplication} from '@nestjs/platform-fastify';
import {
  FastifyAdapter
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

const PORT = process.env.PORT ?? 4000;
const NODE_ENV = process.env.NODE_ENV ?? 'development';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: NODE_ENV === 'development' }),
  );

  // ─── CORS ───────────────────────────────────────────────────────────────
  app.enableCors({
    origin: (origin, callback) => {
      // Allow *.lvh.me, *.localhost, and no-origin (curl, Postman)
      if (
        !origin ||
        /\.lvh\.me(:\d+)?$/.test(origin) ||
        /\.localhost(:\d+)?$/.test(origin) ||
        origin === 'http://localhost:3000'
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  // ─── Global prefix ───────────────────────────────────────────────────────
  app.setGlobalPrefix('api', { exclude: ['/health'] });

  // ─── Swagger (solo en desarrollo) ────────────────────────────────────────
  if (NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Nexos ERP API')
      .setDescription(
        'API del ERP multi-tenant. Usar header X-Tenant-Slug para identificar el tenant.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Tenant-Slug', in: 'header' }, 'tenant-slug')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    console.info(`📚 Swagger disponible en http://localhost:${PORT}/api/docs`);
  }

  await app.listen(PORT, '0.0.0.0');
  console.info(`🚀 Nexos API corriendo en http://localhost:${PORT}`);
  console.info(`🌍 Entorno: ${NODE_ENV}`);
}

bootstrap().catch((err) => {
  console.error('Error al iniciar la API:', err);
  process.exit(1);
});
