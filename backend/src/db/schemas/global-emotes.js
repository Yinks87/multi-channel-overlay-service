import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const GlobalEmotesSchema = new Schema(
  {
    last_updated: {
      type: Date,
      default: Date.now,
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

const GlobalEmotesModel = model('global_emotes', GlobalEmotesSchema);

export default GlobalEmotesModel;
