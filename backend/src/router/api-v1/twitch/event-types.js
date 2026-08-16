export const getEventTypes = ({ broadcasterId, condition = {} }) => [
  {
    type: 'channel.chat.message',
    version: '1',
    useUserToken: false,
    condition: {
      broadcaster_user_id: String(broadcasterId),
      user_id: String(broadcasterId),
    },
  },
  {
    type: 'channel.bits.use',
    version: '1',
    useUserToken: false,
    condition: {
      broadcaster_user_id: String(broadcasterId),
    },
  },
  {
    type: 'channel.subscribe',
    version: '1',
    useUserToken: false,
    condition: {
      broadcaster_user_id: String(broadcasterId),
    },
  },
  {
    type: 'channel.subscription.gift',
    version: '1',
    useUserToken: false,
    condition: {
      broadcaster_user_id: String(broadcasterId),
    },
  },
  {
    type: 'channel.cheer',
    version: '1',
    useUserToken: false,
    condition: {
      broadcaster_user_id: String(broadcasterId),
    },
  },
  {
    type: 'channel.channel_points_custom_reward_redemption.update',
    version: '1',
    useUserToken: false,
    condition: {
      broadcaster_user_id: String(broadcasterId),
    },
  },
  {
    type: 'channel.custom_power_up_redemption.add',
    version: '1',
    useUserToken: false,
    condition: {
      broadcaster_user_id: String(broadcasterId),
    },
  },
];
