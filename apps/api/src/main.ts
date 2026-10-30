import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { SwaggerModule } from "@nestjs/swagger";
import { createOpenAPIDocument } from "./openapi";
import cookie from "@fastify/cookie";
import type { FastifyRequest } from "fastify";
import helmet from "@fastify/helmet";
import { AppModule, Errors } from "./app";
import { StartupConfigurationError, validateEnvironment } from "./config";
async function main() {
  const config = validateEnvironment();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: config.trustProxy,
      logger: {
        serializers: {
          req: (req: FastifyRequest) => ({
            method: req.method,
            // Never retain query values, including on failed/unmatched requests.
            url: req.url?.split(/[?#]/, 1)[0],
            host: req.host,
            remoteAddress: req.ip,
            remotePort: req.socket?.remotePort,
          }),
        },
        redact: [
          "req.headers.cookie",
          "req.headers.authorization",
          "res.headers.set-cookie",
        ],
      },
      bodyLimit: 32768,
    }),
    { abortOnError: false },
  );
  await app.register(cookie);
  await app.register(helmet);
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.origin,
    credentials: true,
  });
  const document = createOpenAPIDocument(app);
  SwaggerModule.setup("api/docs", app, document);
  try {
    await app.listen(config.port, "0.0.0.0");
  } catch (error) {
    await app.close();
    throw error;
  }
}
main().catch((error: unknown) => {
  const message =
    error instanceof StartupConfigurationError
      ? error.message
      : "API startup failed. Check port availability and the sanitized startup logs.";
  console.error(message);
  process.exitCode = 1;
});
