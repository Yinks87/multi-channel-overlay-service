export function processBTTVEmotes(...inputs) {
  const result = {};

  const addArray = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((e) => {
      if (e && e.id && e.code) {
        result[e.code] = `https://cdn.betterttv.net/emote/${e.id}/2x`;
      }
    });
  };

  inputs.forEach((input) => {
    if (!input) return;
    if (Array.isArray(input)) {
      addArray(input); // global list
      return;
    }
    if (typeof input === 'object') {
      addArray(input.channelEmotes);
      addArray(input.sharedEmotes);
    }
  });
  return result;
}

export function processFFZEmotes(data) {
  const result = {};
  if (data?.sets) {
    Object.values(data.sets).forEach((set) => {
      set.emoticons?.forEach((emote) => {
        if (emote.name && emote.id) {
          result[emote.name] =
            `https://cdn.frankerfacez.com/emote/${emote.id}/2`;
        }
      });
    });
  }
  return result;
}

export function process7TVEmotes(data, set) {
  const result = {};
  if (set === 'global') {
    const emotes = data?.emotes || [];
    emotes.forEach((emote) => {
      if (emote.name && emote.id) {
        result[emote.name] = `https://cdn.7tv.app/emote/${emote.id}/2x`;
      }
    });
  }
  if (set === 'channel') {
    const emotes = data?.emote_set?.emotes || [];
    emotes.forEach((emote) => {
      if (emote.name && emote.id) {
        result[emote.name] = `https://cdn.7tv.app/emote/${emote.id}/2x`;
      }
    });
  }
  return result;
}

export function processTwitchEmotes(data) {
  const result = {};
  data.forEach((emote) => {
    if (emote.name && emote.id) {
      const format = emote.format?.includes('animated') ? 'animated' : 'static';
      result[emote.name] =
        `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/${format}/light/2.0`;
    }
  });
  return result;
}
