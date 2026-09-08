import { model, Schema } from 'mongoose';

const AppSettingsSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    access_token: {
      type: String,
      required: true,
    },
    refresh_token: {
      type: String,
      required: true,
    },
    scope: {
      type: [String],
      default: [],
    },
  },
  { versionKey: false },
);

const AppSettingsModel = model('app_settings', AppSettingsSchema);
export default AppSettingsModel;
