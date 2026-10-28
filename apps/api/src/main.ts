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
async function main() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        redact: [
          "req.headers.cookie",
          "req.headers.authorization",
          "res.headers.set-cookie",
        ],
      },
      bodyLimit: 32768,
    }),
  );
  await app.register(cookie);
  await app.register(helmet);
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
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
  await app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0");
}
main().catch(() => {
  console.error(
    "API startup failed. Check configuration and service availability.",
  );
  process.exitCode = 1;
});
