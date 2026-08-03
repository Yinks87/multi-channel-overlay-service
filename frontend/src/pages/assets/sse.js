const SSE_ENDPOINT = import.meta.env.VITE_SSE_ENDPOINT ?? '/clients';

export const sseConnectionSnippet = `// Only the listed topics will be delivered — omitting topics= receives nothing
const source = new EventSource(
  '${SSE_ENDPOINT}?topics=custom_db_table:insert,channel.subscribe'
);

source.addEventListener('open', () => console.log('[SSE] Connected'));
source.addEventListener('error', (e) => {
  if (e.readyState === EventSource.CLOSED)
    console.log('[SSE] Connection closed — will auto-reconnect');
});`;

// ── Custom DB table topics ────────────────────────────────────────────────

export const sseSections = [
  {
    event: 'custom_db_table:insert',
    description: 'Fired after a row is inserted into any custom table.',
    payloadSchema: `{
  tableName:  string;              // affected table name
  rowId:      number;              // SQLite lastInsertRowid
  data:       Record<string, any>; // all inserted column values
}`,
    payloadExample: `{
  "tableName": "scoreboard",
  "rowId": 42,
  "data": {
    "id": "p3",
    "player_name": "Clara",
    "score": 15,
    "created_at": "2026-07-26T18:10:00.000Z"
  }
}`,
    listenerSnippet: `source.addEventListener('custom_db_table:insert', (e) => {
  const { tableName, rowId, data } = JSON.parse(e.data);
  if (tableName !== 'scoreboard') return;
  console.log('New row', rowId, data);
});`,
    notes: [
      'tableName identifies which table was affected.',
      'rowId is the SQLite lastInsertRowid.',
      'data contains the values that were inserted.',
    ],
  },
  {
    event: 'custom_db_table:update',
    description: 'Fired after a row is updated in any custom table.',
    payloadSchema: `{
  tableName:   string;              // affected table name
  key:         string;              // lookup column name
  keyValue:    string | number;     // value that identifies the row
  updatedData: Record<string, any>; // changed fields only
}`,
    payloadExample: `{
  "tableName": "scoreboard",
  "key": "id",
  "keyValue": "p3",
  "updatedData": { "player_name": "Clara Updated", "score": 20 }
}`,
    listenerSnippet: `source.addEventListener('custom_db_table:update', (e) => {
  const { tableName, key, keyValue, updatedData } = JSON.parse(e.data);
  if (tableName !== 'scoreboard') return;
  console.log('Updated where', key, '=', keyValue, updatedData);
});`,
    notes: [
      'key and keyValue identify the changed row.',
      'updatedData contains only the changed fields.',
      'Use key: "rowid" with the __rowid__ value when no primary key exists.',
    ],
  },
  {
    event: 'custom_db_table:delete',
    description: 'Fired after a row is deleted from any custom table.',
    payloadSchema: `{
  tableName: string;          // affected table name
  key:       string;          // lookup column name
  keyValue:  string | number; // value that identified the deleted row
}`,
    payloadExample: `{
  "tableName": "scoreboard",
  "key": "id",
  "keyValue": "p3"
}`,
    listenerSnippet: `source.addEventListener('custom_db_table:delete', (e) => {
  const { tableName, key, keyValue } = JSON.parse(e.data);
  if (tableName !== 'scoreboard') return;
  console.log('Deleted where', key, '=', keyValue);
});`,
    notes: [
      'The payload does not include the deleted row data.',
      'Fetch a fresh copy of the table if you need to re-render.',
    ],
  },

  // ── Twitch EventSub topics ──────────────────────────────────────────────

  {
    event: 'channel.chat.message',
    warning:
      'High-frequency topic. Busy chats can deliver hundreds of events per minute. ' +
      'Only subscribe if your overlay really needs the messages',
    description: 'Fires for every chat message in the channel.',
    payloadSchema: `{
  type: "channel.chat.message";
  data: {
    broadcaster_user_id:    string;
    broadcaster_user_login: string;
    chatter_user_id:        string;
    chatter_user_login:     string;
    chatter_user_name:      string;
    message_id:             string;
    message: {
      text:      string;
      fragments: Array<{ type: string; text: string; emote: object | null; cheermote: object | null; }>;
    };
    color:        string;           // hex, e.g. "#FF0000" — empty string if not set
    badges:       Array<{ set_id: string; id: string; info: string; }>;
    message_type: "text" | "channel_points_highlighted" | "channel_points_sub_only" | string;
    cheer:        { bits: number } | null;
    reply:        object | null;
    channel_points_custom_reward_id: string | null;
  };
}`,
    payloadExample: `{
  "type": "channel.chat.message",
  "data": {
      "broadcaster_user_id": "1971641",
      "broadcaster_user_login": "streamer",
      "broadcaster_user_name": "streamer",
      "chatter_user_id": "4145994",
      "chatter_user_login": "viewer32",
      "chatter_user_name": "viewer32",
      "message_id": "cc106a89-1814-919d-454c-f4f2f970aae7",
      "message": {
        "text": "Hi chat",
        "fragments": [
          {
            "type": "text",
            "text": "Hi chat",
            "cheermote": null,
            "emote": null,
            "mention": null
          }
        ]
      },
      "color": "#00FF7F",
      "badges": [
        {
          "set_id": "moderator",
          "id": "1",
          "info": ""
        },
        {
          "set_id": "subscriber",
          "id": "12",
          "info": "16"
        },
        {
          "set_id": "sub-gifter",
          "id": "1",
          "info": ""
        }
      ],
      "message_type": "text",
      "cheer": null,
      "reply": null,
      "channel_points_custom_reward_id": null,
      "source_broadcaster_user_id": null,
      "source_broadcaster_user_login": null,
      "source_broadcaster_user_name": null,
      "source_message_id": null,
      "source_badges": null
    }
  }
}`,
    listenerSnippet: `source.addEventListener('channel.chat.message', (e) => {
  const { data } = JSON.parse(e.data);
  renderChatLine(data.chatter_user_login, data.message.text, data.color);
});`,
    notes: [
      'Only subscribe to this topic when your overlay actually displays chat.',
      'Full payload follows the Twitch EventSub channel.chat.message schema.',
    ],
  },
  {
    event: 'channel.subscribe',
    description: 'Fires when a viewer subscribes (non-gift) to the channel.',
    payloadSchema: `{
  type: "channel.subscribe";
  data: {
    user_id:                string;
    user_login:             string;
    user_name:              string;
    broadcaster_user_id:    string;
    broadcaster_user_login: string;
    tier:     "1000" | "2000" | "3000";
    is_gift:  false;            // always false — use channel.subscription.gift for gifts
  };
}`,
    payloadExample: `{
  "type": "channel.subscribe",
  "data": {
    "user_id": "1234",
    "user_login": "cool_user",
    "user_name": "Cool_User",
    "broadcaster_user_id": "1337",
    "broadcaster_user_login": "cooler_user",
    "broadcaster_user_name": "Cooler_User",
    "tier": "1000",
    "is_gift": false
  }
}`,
    listenerSnippet: `source.addEventListener('channel.subscribe', (e) => {
  const { data } = JSON.parse(e.data);
  showAlert('New sub: ' + data.user_login + ' — Tier ' + data.tier);
});`,
    notes: [
      'is_gift is always false here; use channel.subscription.gift for gift subs.',
      'tier values: "1000", "2000", "3000".',
    ],
  },
  {
    event: 'channel.subscription.gift',
    description: 'Fires when a viewer gifts one or more subscriptions.',
    payloadSchema: `{
  type: "channel.subscription.gift";
  data: {
    user_id:                string;
    user_login:             string;
    user_name:              string;
    broadcaster_user_id:    string;
    broadcaster_user_login: string;
    total:             number;        // subs gifted in this event
    tier:              "1000" | "2000" | "3000";
    cumulative_total:  number | null; // null if anonymous / not shared
    is_anonymous:      boolean;
  };
}`,
    payloadExample: `{
  "type": "channel.subscription.gift",
  "data": {
    "user_id": "1234",
    "user_login": "cool_user",
    "user_name": "Cool_User",
    "broadcaster_user_id": "1337",
    "broadcaster_user_login": "cooler_user",
    "broadcaster_user_name": "Cooler_User",
    "total": 2,
    "tier": "1000",
    "cumulative_total": 284, //null if anonymous or not shared by the user
    "is_anonymous": false  
  }
}`,
    listenerSnippet: `source.addEventListener('channel.subscription.gift', (e) => {
  const { data } = JSON.parse(e.data);
  showAlert(data.user_login + ' gifted ' + data.total + ' subs!');
});`,
    notes: [
      'total is the number of subs gifted in this event.',
      'cumulative_total is the all-time gift count for this user.',
    ],
  },
  {
    event: 'channel.cheer',
    description: 'Fires when a viewer cheers Bits in the channel.',
    payloadSchema: `{
  type: "channel.cheer";
  data: {
    is_anonymous:           boolean;
    user_id:                string | null; // null when anonymous
    user_login:             string | null;
    user_name:              string | null;
    broadcaster_user_id:    string;
    broadcaster_user_login: string;
    message: string;
    bits:    number;
  };
}`,
    payloadExample: `{
  "type": "channel.cheer",
  "data": {
    "is_anonymous": false,
    "user_id": "1234",          // null if is_anonymous=true
    "user_login": "cool_user",  // null if is_anonymous=true
    "user_name": "Cool_User",   // null if is_anonymous=true
    "broadcaster_user_id": "1337",
    "broadcaster_user_login": "cooler_user",
    "broadcaster_user_name": "Cooler_User",
    "message": "pogchamp",
    "bits": 1000  
  }
}`,
    listenerSnippet: `source.addEventListener('channel.cheer', (e) => {
  const { data } = JSON.parse(e.data);
  showAlert(data.user_login + ' cheered ' + data.bits + ' bits: ' + data.message);
});`,
    notes: [
      'is_anonymous is true when the viewer chose to cheer anonymously.',
      'message is the chat message attached to the cheer.',
    ],
  },
  {
    event: 'channel.bits.use',
    description:
      'Fires when Bits are used (broader than cheer — includes Power-Ups).',
    payloadSchema: `{
  type: "channel.bits.use";
  data: {
    user_id:                string;
    user_login:             string;
    broadcaster_user_id:    string;
    broadcaster_user_login: string;
    bits:    number;
    type:    "cheer" | "power_up" | string;
    message: { text: string; fragments: Array<object>; } | null;
    power_up:        object | null;
    custom_power_up: object | null;
  };
}`,
    payloadExample: `{
  "type": "channel.bits.use",
  "data": {
    "user_id": "1234",
    "user_login": "cool_user",
    "user_name": "Cool_User",
    "broadcaster_user_id": "1337",
    "broadcaster_user_login": "cooler_user",
    "broadcaster_user_name": "Cooler_User",
    "bits": 2,
    "type": "cheer",
    "power_up": null,
    "custom_power_up": null,
    "message": {
      "text": "cheer1 hi cheer1",
      "fragments": [
        {
          "type": "cheermote",
          "text": "cheer1",
          "cheermote": {
            "prefix": "cheer",
            "bits": 1,
            "tier": 1
          },
          "emote": null
        },
        {
          "type": "text",
          "text": " hi ",
          "cheermote": null,
          "emote": null
        },
        {
          "type": "cheermote",
          "text": "cheer1",
          "cheermote": {
            "prefix": "cheer",
            "bits": 1,
            "tier": 1
          },
          "emote": null
        }
      ]
    }
  }
}`,
    listenerSnippet: `source.addEventListener('channel.bits.use', (e) => {
  const { data } = JSON.parse(e.data);
  console.log(data.user_login, 'used', data.bits, 'bits via', data.type);
});`,
    notes: [
      'type distinguishes between "cheer", "power_up", and similar use cases.',
    ],
  },
  {
    event: 'channel.channel_points_custom_reward_redemption.update',
    description:
      'Fires when a Channel Points custom reward redemption status changes.',
    payloadSchema: `{
  type: "channel.channel_points_custom_reward_redemption.update";
  data: {
    id:                     string;  // redemption ID
    broadcaster_user_id:    string;
    broadcaster_user_login: string;
    user_id:                string;
    user_login:             string;
    user_name:              string;
    user_input:             string;
    status:                 "fulfilled" | "canceled";
    reward: {
      id:     string;
      title:  string;
      cost:   number;
      prompt: string;
    };
    redeemed_at: string;            // ISO 8601 timestamp
  };
}`,
    payloadExample: `{
  "type": "channel.channel_points_custom_reward_redemption.update",
  "data": {
    "id": "17fa2df1-ad76-4804-bfa5-a40ef63efe63",
    "broadcaster_user_id": "1337",
    "broadcaster_user_login": "cool_user",
    "broadcaster_user_name": "Cool_User",
    "user_id": "9001",
    "user_login": "cooler_user",
    "user_name": "Cooler_User",
    "user_input": "pogchamp",
    "status": "fulfilled",  // Either fulfilled or cancelled
    "reward": {
        "id": "92af127c-7326-4483-a52b-b0da0be61c01",
        "title": "title",
        "cost": 100,
        "prompt": "reward prompt"
    },
    "redeemed_at": "2020-07-15T17:16:03.17106713Z" 
  }
}`,
    listenerSnippet: `source.addEventListener(
  'channel.channel_points_custom_reward_redemption.update',
  (e) => {
    const { data } = JSON.parse(e.data);
    if (data.reward.title !== 'Hydrate!') return;
    showAlert(data.user_login + ' redeemed ' + data.reward.title);
  }
);`,
    notes: [
      'status can be "fulfilled" or "canceled".',
      'Full reward object includes id, title, cost, and prompt.',
    ],
  },
  {
    event: 'channel.custom_power_up_redemption.add',
    description: 'Fires when a viewer redeems a custom Power-Up.',
    payloadSchema: `{
  type: "channel.custom_power_up_redemption.add";
  data: {
    id:                     string;
    broadcaster_user_id:    string;
    broadcaster_user_login: string;
    user_id:                string;
    user_login:             string;
    user_input:             string;
    status:                 "unfulfilled" | "fulfilled" | "canceled";
    custom_power_up: {
      id:     string;
      title:  string;
      bits:   number;
      prompt: string;
    };
    redeemed_at: string; // ISO 8601 timestamp
  };
}`,
    payloadExample: `{
  "type": "channel.custom_power_up_redemption.add",
  "data": {
    "id": "17fa2df1-ad76-4804-bfa5-a40ef63efe63",
    "broadcaster_user_id": "1337",
    "broadcaster_user_login": "cool_user",
    "broadcaster_user_name": "Cool_User",
    "user_id": "9001",
    "user_login": "cooler_user",
    "user_name": "Cooler_User",
    "user_input": "pogchamp",
    "status": "unfulfilled",
    "custom_power_up": {
        "id": "92af127c-7326-4483-a52b-b0da0be61c01",
        "title": "title",
        "bits": 100,
        "prompt": "Power-up prompt"
    },
    "redeemed_at": "2026-05-01T17:16:03.17106713Z"
  }
}`,
    listenerSnippet: `source.addEventListener('channel.custom_power_up_redemption.add', (e) => {
  const { data } = JSON.parse(e.data);
  showPowerUp(data.user_login, data.power_up.title);
});`,
    notes: ['power_up.type identifies the Power-Up category.'],
  },
];
