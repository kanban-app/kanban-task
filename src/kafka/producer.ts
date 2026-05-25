import { Kafka, type Producer } from "kafkajs";
import { env } from "../config/env.js";

const kafka = new Kafka({
  clientId: "kanban-task-service",
  brokers: env.KAFKA_BROKERS.split(","),
});

let producer: Producer | null = null;

export async function connectProducer() {
  producer = kafka.producer();
  await producer.connect();
  console.log("Kafka producer connected");
}

export async function disconnectProducer() {
  await producer?.disconnect();
}

export interface TaskEvent {
  type: "task.created" | "task.updated" | "task.assigned";
  taskId: string;
  workspaceId: string;
  triggeredBy: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export async function publishTaskEvent(event: TaskEvent) {
  if (!producer) {
    console.error("Kafka producer not connected");
    return;
  }

  await producer.send({
    topic: "task-events",
    messages: [
      {
        // Используем workspaceId как key — все события одного
        // workspace гарантированно попадут в одну партицию
        key: event.workspaceId,
        value: JSON.stringify(event),
      },
    ],
  });
}
