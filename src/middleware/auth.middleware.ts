import type { FastifyRequest, FastifyReply } from "fastify";
import { validateToken } from "../grpc/auth.client.js";

// Расширяем типы Fastify чтобы добавить user в request
declare module "fastify" {
  interface FastifyRequest {
    user: {
      userId: string;
      email: string;
    };
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);

  try {
    const user = await validateToken(token);
    request.user = user;
  } catch {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
}

// Middleware проверки членства в workspace
export function requireWorkspaceMember(
  getWorkspaceId: (req: FastifyRequest) => string,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const workspaceId = getWorkspaceId(request);
    const { userId } = request.user;

    const { Workspace } = await import("../models/workspace.model.js");
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const isMember =
      workspace.ownerId === userId || workspace.memberIds.includes(userId);

    if (!isMember) {
      return reply.status(403).send({ error: "Access denied" });
    }

    // Добавляем workspace в request для использования в роуте
    (request as any).workspace = workspace;
  };
}
