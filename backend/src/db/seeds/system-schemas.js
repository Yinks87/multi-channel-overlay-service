import CustomTableSchemaModel from '../schemas/custom-table-schemas.js';

const col = (name, type, opts = {}) => ({
  name,
  type,
  required: opts.required ?? false,
  unique: opts.unique ?? false,
  primaryKey: opts.primaryKey ?? false,
  defaultValue: opts.defaultValue ?? null,
});

const SYSTEM_SCHEMAS = [
  {
    name: '_schemas',
    columns: [
      col('name', 'TEXT', { primaryKey: true, unique: true, required: true }),
      col('columns', 'OBJECT[]'),
    ],
  },
  {
    name: 'app_settings',
    columns: [
      col('id', 'TEXT', { primaryKey: true, unique: true, required: true }),
      col('access_token', 'TEXT', { required: true }),
      col('refresh_token', 'TEXT', { required: true }),
      col('scope', 'STRING[]'),
    ],
  },
  {
    name: 'users',
    columns: [
      col('id', 'TEXT', { primaryKey: true, unique: true, required: true }),
      col('userName', 'TEXT', { required: true }),
      col('normalizedUserName', 'TEXT', { required: true }),
      col('twitch', 'OBJECT'),
      col('roles', 'STRING[]'),
      col('moderatedChannels', 'OBJECT[]'),
      col('connected', 'BOOLEAN'),
      col('created_at', 'TEXT'),
    ],
  },
  {
    name: 'overlays',
    columns: [
      col('id', 'TEXT', { primaryKey: true, unique: true, required: true }),
      col('name', 'TEXT', { required: true }),
      col('route_path', 'TEXT', { required: true }),
      col('folder_path', 'TEXT', { required: true }),
      col('entry_file', 'TEXT', { required: true }),
      col('params', 'OBJECT'),
      col('notes', 'TEXT'),
      col('streamer_ids', 'STRING[]'),
      col('overlay_type', 'STRING[]'),
      col('width', 'NUMBER'),
      col('height', 'NUMBER'),
      col('active', 'BOOLEAN'),
      col('created_at', 'TEXT'),
    ],
  },
  {
    name: 'user_emotes',
    columns: [
      col('id', 'TEXT', { primaryKey: true, unique: true, required: true }),
      col('twitch', 'OBJECT'),
      col('bttv', 'OBJECT'),
      col('ffz', 'OBJECT'),
      col('7tv', 'OBJECT'),
    ],
  },
  {
    name: 'global_emotes',
    columns: [
      col('last_updated', 'TEXT'),
      col('bttv', 'OBJECT'),
      col('ffz', 'OBJECT'),
      col('7tv', 'OBJECT'),
    ],
  },
];

// Uses $setOnInsert so existing schemas are never overwritten
export async function seedSystemSchemas() {
  for (const schema of SYSTEM_SCHEMAS) {
    await CustomTableSchemaModel.updateOne(
      { name: schema.name },
      { $setOnInsert: { name: schema.name, columns: schema.columns } },
      { upsert: true },
    );
  }
  console.log('[DB] System schemas seeded');
}
