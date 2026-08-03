import { sendEventToClients } from '../overlay/client-v1.js';

export function handleEventSub(eventSub) {
  const e = eventSub.subscription?.type
    ? eventSub.subscription?.type
    : eventSub.session?.status;

  switch (e) {
    case 'channel.chat.message':
      console.log(eventSub.event);
      (async () => {
        await sendEventToClients({
          event: 'channel.chat.message',
          data: {
            type: eventSub.subscription.type,
            data: eventSub.event,
          },
        });
      })();
      break;

    // ── SCARED TO HANDLE THESE EVENTS, BECAUSE THEY MIGHT BE TOO SPAMMY, BUT I CAN ADD THEM LATER IF NEEDED ────────────

    // case 'channel.chat.notification':
    //   (async () => {
    //     await sendEventToClients({
    //       event: 'channel.chat.notification',
    //       data: {
    //         type: eventSub.subscription.type,
    //         data: eventSub.event,
    //       },
    //     });
    //   })();
    //   break;
    case 'channel.bits.use':
      (async () => {
        await sendEventToClients({
          event: 'channel.bits.use',
          data: {
            type: eventSub.subscription.type,
            data: eventSub.event,
          },
        });
      })();
      break;
    case 'channel.subscribe':
      (async () => {
        await sendEventToClients({
          event: 'channel.subscribe',
          data: {
            type: eventSub.subscription.type,
            data: eventSub.event,
          },
        });
      })();
      break;
    case 'channel.subscription.gift':
      (async () => {
        await sendEventToClients({
          event: 'channel.subscription.gift',
          data: {
            type: eventSub.subscription.type,
            data: eventSub.event,
          },
        });
      })();
      break;
    case 'channel.cheer':
      (async () => {
        await sendEventToClients({
          event: 'channel.cheer',
          data: {
            type: eventSub.subscription.type,
            data: eventSub.event,
          },
        });
      })();
      break;
    case 'channel.channel_points_custom_reward_redemption.update':
      (async () => {
        await sendEventToClients({
          event: 'channel.channel_points_custom_reward_redemption.update',
          data: {
            type: eventSub.subscription.type,
            data: eventSub.event,
          },
        });
      })();
      break;
    case 'channel.custom_power_up_redemption.add':
      (async () => {
        await sendEventToClients({
          event: 'channel.custom_power_up_redemption.add',
          data: {
            type: eventSub.subscription.type,
            data: eventSub.event,
          },
        });
      })();
      break;
    default:
      console.warn(`Unhandled EventSub type: ${e}`);
      return { success: false, error: `Unhandled EventSub type: ${e}` };
  }
}
