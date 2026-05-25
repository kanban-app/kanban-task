import mongoose, { type Document, type Model } from "mongoose";

export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
}

export interface ITask extends Document {
  workspaceId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assigneeId?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new mongoose.Schema<ITask>(
  {
    workspaceId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.TODO,
    },
    assigneeId: { type: String },
    createdById: { type: String, required: true },
  },
  { timestamps: true },
);

taskSchema.index({ workspaceId: 1 });
taskSchema.index({ workspaceId: 1, status: 1 });
taskSchema.index({ assigneeId: 1 });

export const Task: Model<ITask> = mongoose.model("Task", taskSchema);
