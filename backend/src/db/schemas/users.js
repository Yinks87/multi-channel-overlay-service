import { model, Schema } from 'mongoose';

const UsersSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    userName: {
      type: String,
      required: true,
    },
    normalizedUserName: {
      type: String,
      required: true,
    },
    twitch: {
      type: Object,
      default: {},
    },
    roles: {
      type: [String],
      default: [],
    },
    moderatedChannels: {
      type: [Object],
      default: [],
    },
    connected: {
      type: Boolean,
      default: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  { versionKey: false },
);

const UsersModel = model('users', UsersSchema);
export default UsersModel;
