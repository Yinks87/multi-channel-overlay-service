import { model, Schema } from 'mongoose';

const OverlaysSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    route_path: {
      type: String,
      required: true,
    },
    folder_path: {
      type: String,
      required: true,
    },
    entry_file: {
      type: String,
      required: true,
    },
    params: {
      type: Object,
      default: {},
    },
    notes: {
      type: String,
      default: '',
    },
    streamer_ids: {
      type: [String],
      default: [],
    },
    overlay_type: {
      type: [String],
      default: [],
    },
    width: {
      type: Number,
      default: 800,
    },
    height: {
      type: Number,
      default: 600,
    },
    active: {
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

const OverlaysModel = model('overlays', OverlaysSchema);
export default OverlaysModel;
