import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import logger from "./logger";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";

async function bootstrap() {
  process.on("uncaughtException", function (error) {
    logger.error(error.message, error.stack, "UnhandledExceptions");
    process.exit(1);
  });

  const app = await NestFactory.create(AppModule, {
    logger,
  });
  app.enableCors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
  });

  const configService = app.get(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("zkLink Nova LRT Points System API")
    .setDescription(
      "zkLink Nova supports querying points from other projects via this API for redistribution to users.",
    )
    .setVersion("1.0")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  app.enableShutdownHooks();
  await app.listen(configService.get("port"));
}

bootstrap();
