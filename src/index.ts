import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { connectDB, disconnectDB } from "./db.js";
import { connectProducer, disconnectProducer } from "./kafka/producer.js";
import { workspaceRoutes } from "./routes/workspace.routes.js";
import { taskRoutes } from "./routes/task.routes.js";
import { env } from "./config/env.js";

async function bootstrap() {
  await connectDB();
  await connectProducer();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      ...(env.NODE_ENV !== "production" && {
        transport: { target: "pino-pretty" },
      }),
    },
  });

  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? "https://your-domain.com" : true,
    credentials: true,
  });

  await app.register(workspaceRoutes);
  await app.register(taskRoutes);

  app.get("/health", async () => ({
    status: "ok",
    service: "task",
  }));

  const shutdown = async () => {
    console.log("Shutting down...");
    await app.close();
    await disconnectDB();
    await disconnectProducer();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await app.listen({ host: "0.0.0.0", port: env.PORT });
  console.log(`HTTP server listening on port ${env.PORT}`);
}

bootstrap().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
