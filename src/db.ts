import mongoose from "mongoose";
import { env } from "./config/env.js";

export async function connectDB() {
  await mongoose.connect(env.MONGODB_URL);
  console.log("MongoDB connected");
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
