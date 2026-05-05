import { Schema, Document } from 'mongoose';

export interface MessageReaction {
  emoji: string;
  users: string[];
}

export interface Message extends Document {
  roomId: string;
  nickname: string;
  content: string;
  type: 'text' | 'file';
  fileUrl?: string;
  filename?: string;
  mimeType?: string;
  reactions: MessageReaction[];
  timestamp: Date;
}

const MessageReactionSchema = new Schema<MessageReaction>(
  {
    emoji: { type: String, required: true },
    users: { type: [String], default: [] },
  },
  { _id: false },
);

export const MessageSchema = new Schema<Message>({
  roomId: { type: String, required: true, index: true },
  nickname: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'file'], default: 'text' },
  fileUrl: { type: String },
  filename: { type: String },
  mimeType: { type: String },
  reactions: { type: [MessageReactionSchema], default: [] },
  timestamp: { type: Date, default: Date.now },
});

MessageSchema.index({ roomId: 1, timestamp: -1 });
