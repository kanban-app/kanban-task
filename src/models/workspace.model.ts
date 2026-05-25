import mongoose, { type Document, type Model } from "mongoose";

export interface IWorkspace extends Document {
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new mongoose.Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: String, required: true },
    memberIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

workspaceSchema.index({ ownerId: 1 });
workspaceSchema.index({ memberIds: 1 });

export const Workspace: Model<IWorkspace> = mongoose.model(
  "Workspace",
  workspaceSchema,
);
