import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Workspace } from "../models/workspace.model.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});

const inviteMemberSchema = z.object({
  userId: z.string(),
});

export async function workspaceRoutes(app: FastifyInstance) {
  // Все роуты требуют авторизации
  app.addHook("preHandler", authMiddleware);

  // POST /workspaces — создать workspace
  app.post("/workspaces", async (request, reply) => {
    const result = createWorkspaceSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Validation failed" });
    }

    const workspace = await Workspace.create({
      name: result.data.name,
      ownerId: request.user.userId,
      memberIds: [],
    });

    return reply.status(201).send({ workspace });
  });

  // GET /workspaces — список workspace пользователя
  app.get("/workspaces", async (request, reply) => {
    const workspaces = await Workspace.find({
      $or: [
        { ownerId: request.user.userId },
        { memberIds: request.user.userId },
      ],
    });

    return reply.send({ workspaces });
  });

  // GET /workspaces/:id
  app.get<{ Params: { id: string } }>(
    "/workspaces/:id",
    async (request, reply) => {
      const workspace = await Workspace.findById(request.params.id);

      if (!workspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      const isMember =
        workspace.ownerId === request.user.userId ||
        workspace.memberIds.includes(request.user.userId);

      if (!isMember) {
        return reply.status(403).send({ error: "Access denied" });
      }

      return reply.send({ workspace });
    },
  );

  // POST /workspaces/:id/members — пригласить пользователя
  app.post<{ Params: { id: string } }>(
    "/workspaces/:id/members",
    async (request, reply) => {
      const workspace = await Workspace.findById(request.params.id);

      if (!workspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      if (workspace.ownerId !== request.user.userId) {
        return reply
          .status(403)
          .send({ error: "Only owner can invite members" });
      }

      const result = inviteMemberSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({ error: "Validation failed" });
      }

      const { userId } = result.data;

      if (workspace.memberIds.includes(userId)) {
        return reply.status(409).send({ error: "User already a member" });
      }

      workspace.memberIds.push(userId);
      await workspace.save();

      return reply.send({ workspace });
    },
  );

  // DELETE /workspaces/:id/members/:userId — удалить участника
  app.delete<{ Params: { id: string; userId: string } }>(
    "/workspaces/:id/members/:userId",
    async (request, reply) => {
      const workspace = await Workspace.findById(request.params.id);

      if (!workspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      if (workspace.ownerId !== request.user.userId) {
        return reply
          .status(403)
          .send({ error: "Only owner can remove members" });
      }

      workspace.memberIds = workspace.memberIds.filter(
        (id) => id !== request.params.userId,
      );
      await workspace.save();

      return reply.send({ workspace });
    },
  );
}
