import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookie from "@fastify/cookie";
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
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("ROM Hub API")
      .setVersion("1.0")
      .addCookieAuth("romhub_session")
      .build(),
  );
  SwaggerModule.setup("api/docs", app, document);
  await app.listen(config.port, "0.0.0.0");
}
main().catch((error: unknown) => {
  const message =
    error instanceof StartupConfigurationError
      ? error.message
      : "API startup failed. Check port availability and the sanitized startup logs.";
  console.error(message);
  process.exitCode = 1;
});
