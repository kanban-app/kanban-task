import * as grpc from "@grpc/grpc-js";
import { AuthServiceClient } from "./generated/auth/v1/auth.js";
import { env } from "../config/env.js";

// Создаём один инстанс клиента на всё приложение
const client = new AuthServiceClient(
  env.AUTH_GRPC_URL,
  grpc.credentials.createInsecure(),
);

export interface ValidatedUser {
  userId: string;
  email: string;
}

// Промисифицированная обёртка над gRPC callback
export function validateToken(token: string): Promise<ValidatedUser> {
  return new Promise((resolve, reject) => {
    client.validateToken({ token }, (err, response) => {
      if (err) {
        reject(err);
        return;
      }

      if (!response.valid) {
        reject(new Error("Invalid token"));
        return;
      }

      resolve({
        userId: response.userId,
        email: response.email,
      });
    });
  });
}
