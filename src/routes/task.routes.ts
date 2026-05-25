import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Task, TaskStatus } from "../models/task.model.js";
import { Workspace } from "../models/workspace.model.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { publishTaskEvent } from "../kafka/producer.js";

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().optional(),
});

// Хелпер — проверить что пользователь имеет доступ к workspace
async function checkWorkspaceAccess(workspaceId: string, userId: string) {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return null;

  const isMember =
    workspace.ownerId === userId || workspace.memberIds.includes(userId);

  return isMember ? workspace : null;
}

export async function taskRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // POST /workspaces/:workspaceId/tasks
  app.post<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/tasks",
    async (request, reply) => {
      const workspace = await checkWorkspaceAccess(
        request.params.workspaceId,
        request.user.userId,
      );

      if (!workspace) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const result = createTaskSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed" });
      }

      const task = await Task.create({
        workspaceId: request.params.workspaceId,
        title: result.data.title,
        description: result.data.description,
        assigneeId: result.data.assigneeId,
        createdById: request.user.userId,
      });

      await publishTaskEvent({
        type: "task.created",
        taskId: task.id,
        workspaceId: task.workspaceId,
        triggeredBy: request.user.userId,
        payload: {
          title: task.title,
          assigneeId: task.assigneeId,
        },
        timestamp: new Date().toISOString(),
      });

      return reply.status(201).send({ task });
    },
  );

  // GET /workspaces/:workspaceId/tasks
  app.get<{
    Params: { workspaceId: string };
    Querystring: { status?: string; cursor?: string; limit?: string };
  }>("/workspaces/:workspaceId/tasks", async (request, reply) => {
    const workspace = await checkWorkspaceAccess(
      request.params.workspaceId,
      request.user.userId,
    );

    if (!workspace) {
      return reply.status(403).send({ error: "Access denied" });
    }

    const limit = Math.min(Number(request.query.limit ?? 20), 100);
    const filter: Record<string, unknown> = {
      workspaceId: request.params.workspaceId,
    };

    if (request.query.status) {
      filter["status"] = request.query.status;
    }

    // Cursor-based пагинация
    if (request.query.cursor) {
      filter["_id"] = { $gt: request.query.cursor };
    }

    const tasks = await Task.find(filter)
      .sort({ _id: 1 })
      .limit(limit + 1);

    const hasMore = tasks.length > limit;
    const items = hasMore ? tasks.slice(0, -1) : tasks;

    return reply.send({
      tasks: items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    });
  });

  // GET /workspaces/:workspaceId/tasks/:taskId
  app.get<{ Params: { workspaceId: string; taskId: string } }>(
    "/workspaces/:workspaceId/tasks/:taskId",
    async (request, reply) => {
      const workspace = await checkWorkspaceAccess(
        request.params.workspaceId,
        request.user.userId,
      );

      if (!workspace) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const task = await Task.findOne({
        _id: request.params.taskId,
        workspaceId: request.params.workspaceId,
      });

      if (!task) {
        return reply.status(404).send({ error: "Task not found" });
      }

      return reply.send({ task });
    },
  );

  // PATCH /workspaces/:workspaceId/tasks/:taskId
  app.patch<{ Params: { workspaceId: string; taskId: string } }>(
    "/workspaces/:workspaceId/tasks/:taskId",
    async (request, reply) => {
      const workspace = await checkWorkspaceAccess(
        request.params.workspaceId,
        request.user.userId,
      );

      if (!workspace) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const result = updateTaskSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed" });
      }

      const task = await Task.findOneAndUpdate(
        {
          _id: request.params.taskId,
          workspaceId: request.params.workspaceId,
        },
        { $set: result.data },
        { new: true },
      );

      if (!task) {
        return reply.status(404).send({ error: "Task not found" });
      }

      await publishTaskEvent({
        type: result.data.assigneeId ? "task.assigned" : "task.updated",
        taskId: task.id,
        workspaceId: task.workspaceId,
        triggeredBy: request.user.userId,
        payload: result.data,
        timestamp: new Date().toISOString(),
      });

      return reply.send({ task });
    },
  );

  // DELETE /workspaces/:workspaceId/tasks/:taskId
  app.delete<{ Params: { workspaceId: string; taskId: string } }>(
    "/workspaces/:workspaceId/tasks/:taskId",
    async (request, reply) => {
      const workspace = await checkWorkspaceAccess(
        request.params.workspaceId,
        request.user.userId,
      );

      if (!workspace) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const task = await Task.findOneAndDelete({
        _id: request.params.taskId,
        workspaceId: request.params.workspaceId,
      });

      if (!task) {
        return reply.status(404).send({ error: "Task not found" });
      }

      return reply.send({ message: "Task deleted" });
    },
  );
}
