import { model, Schema } from 'mongoose';

const UserEmotesSchema = new Schema(
  {
    id: {
      type: String,
      ref: 'users',
      required: true,
    },
    twitch: {
      type: Object,
      default: {},
    },
    bttv: {
      type: Object,
      default: {},
    },
    ffz: {
      type: Object,
      default: {},
    },
    '7tv': {
      type: Object,
      default: {},
    },
  },
  { versionKey: false },
);

const UserEmotesModel = model('user_emotes', UserEmotesSchema);
export default UserEmotesModel;
