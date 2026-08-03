const BASE = import.meta.env.VITE_BASE_TABLES_API_URL;

export const endpointSections = [
  {
    title: 'Read all rows from a table',
    method: 'GET',
    path: `${BASE}/:tableName`,
    auth: 'Not protected',
    description: 'Returns all rows from the table as an array under data.',
    requestExample: `GET ${BASE}/scoreboard`,
    responseExample: `{
  "data": [
    {
      "__rowid__": 1,
      "id": "p1",
      "player_name": "Alice",
      "score": 12,
      "created_at": "2026-07-26T18:00:00.000Z"
    },
    {
      "__rowid__": 2,
      "id": "p2",
      "player_name": "Bob",
      "score": 9,
      "created_at": "2026-07-26T18:05:00.000Z"
    }
  ]
}`,
    notes: [
      'This endpoint is not protected.',
      'Each row includes __rowid__ as a fallback for updates and deletes when no primary key exists.',
      'The API always responds with { data: [...] }.',
    ],
  },
  {
    title: 'Read a single row from a table',
    method: 'GET',
    path: `${BASE}/row/:tableName`,
    auth: 'Not protected',
    description: 'Returns a single row matching the key and keyValue.',
    requestExample: `GET ${BASE}/scoreboard?key=id&keyValue=p1`,
    responseExample: `{
  "data": {
    "__rowid__": 1,
    "id": "p1",
    "player_name": "Alice",
    "score": 12,
    "created_at": "2026-07-26T18:00:00.000Z"
  }
}`,
    notes: [
      'This endpoint is not protected.',
      'The row includes __rowid__ as a fallback for updates and deletes when no primary key exists.',
      'The API always responds with { data: { ... } }.',
    ],
  },
  {
    title: 'Insert a new row',
    method: 'POST',
    path: `${BASE}/:tableName`,
    auth: 'Not protected',
    description: 'Inserts a new row into an existing table.',
    requestExample: `POST ${BASE}/scoreboard
Content-Type: application/json

{
  "id": "p3",
  "player_name": "Clara",
  "score": 15,
  "created_at": "2026-07-26T18:10:00.000Z"
}`,
    responseExample: `{
  "message": "Inserted data into custom table: scoreboard"
}`,
    notes: [
      'This endpoint is not protected.',
      'The request body is the row object itself.',
      'Do not send { "data": { ... } }.',
      'The keys must exactly match the column names in the table.',
    ],
  },
  {
    title: 'Update an existing row',
    method: 'PATCH',
    path: `${BASE}/:tableName`,
    auth: 'Not protected',
    description: 'Updates a row based on a lookup key.',
    requestExample: `PATCH ${BASE}/scoreboard
Content-Type: application/json

{
  "key": "id",
  "keyValue": "p3",
  "data": {
    "player_name": "Clara Updated",
    "score": 20
  }
}`,
    responseExample: `{
  "message": "Updated data in custom table: scoreboard"
}`,
    notes: [
      'This endpoint is not protected.',
      'data should contain only the fields that need to change.',
      'keyValue is functionally required even though the router does not explicitly validate it right now.',
    ],
  },
  {
    title: 'Update a row without a primary key',
    method: 'PATCH',
    path: `${BASE}/:tableName`,
    auth: 'Not protected',
    description:
      'Uses the SQLite rowid fallback when the table has no primary key.',
    requestExample: `PATCH ${BASE}/logs
Content-Type: application/json

{
  "key": "rowid",
  "keyValue": 7,
  "data": {
    "message": "Updated log line"
  }
}`,
    responseExample: `{
  "message": "Updated data in custom table: logs"
}`,
    notes: [
      'This endpoint is not protected.',
      'Take the keyValue from __rowid__ in the GET response.',
      'You must send key: "rowid", not key: "__rowid__".',
    ],
  },
  {
    title: 'Delete a row',
    method: 'DELETE',
    path: `${BASE}/:tableName`,
    auth: 'Not protected',
    description: 'Deletes a row based on a lookup key.',
    requestExample: `DELETE ${BASE}/scoreboard
Content-Type: application/json

{
  "key": "id",
  "keyValue": "p3"
}`,
    responseExample: `{
  "message": "Row deleted from scoreboard"
}`,
    notes: [
      'This endpoint is not protected.',
      'If the table has no primary key, use rowid with the value from __rowid__.',
    ],
  },
];
