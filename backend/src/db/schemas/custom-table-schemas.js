import { model, Schema } from 'mongoose';

// _id: false prevents a nested _id on each column subdocument
const ColumnDefinitionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    defaultValue: {
      type: String,
      default: null,
    },
    primaryKey: {
      type: Boolean,
      default: false,
    },
    unique: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const CustomTableSchemaSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    columns: {
      type: [ColumnDefinitionSchema],
      default: [],
    },
  },
  { versionKey: false },
);

const CustomTableSchemaModel = model('_schemas', CustomTableSchemaSchema);
export default CustomTableSchemaModel;
