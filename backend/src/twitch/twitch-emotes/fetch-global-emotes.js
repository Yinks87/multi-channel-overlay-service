import axios from 'axios';

import {
  process7TVEmotes,
  processBTTVEmotes,
  processFFZEmotes,
} from './utils.js';
import {
  deleteGlobalEmotes,
  insertGlobalEmotes,
} from '../../db/services/emoteService.js';

export const fetchGlobalEmotes = async () => {
  try {
    const [bttvEmotes, ffzEmotes, sevenTvEmotes] = await Promise.all([
      getGlobalBttvEmotes(),
      getGlobalFfzEmotes(),
      getGlobal7tvEmotes(),
    ]);

    await deleteGlobalEmotes();

    await insertGlobalEmotes({
      bttv: bttvEmotes,
      ffz: ffzEmotes,
      sevenTv: sevenTvEmotes,
    });

    console.log('Global emotes fetched and saved successfully.');
  } catch (error) {
    console.error('Error fetching global emotes:', error);
  }
};

async function getGlobalBttvEmotes() {
  try {
    const response = await axios.get(
      'https://api.betterttv.net/3/cached/emotes/global',
    );

    if (response.status === 200) {
      const bttvEmotes = processBTTVEmotes(response.data);
      return bttvEmotes;
    }
    return {};
  } catch (error) {
    console.error('Error fetching global BTTV emotes:', error);
  }
}

async function getGlobalFfzEmotes() {
  try {
    const response = await axios.get(
      'https://api.frankerfacez.com/v1/set/global',
    );
    console.log('Fetching global FFZ emotes...');
    if (response.status === 200) {
      const ffzEmotes = processFFZEmotes(response.data);
      return ffzEmotes;
    }
    return {};
  } catch (error) {
    console.error('Error fetching global FFZ emotes:', error);
  }
}

async function getGlobal7tvEmotes() {
  try {
    const response = await axios.get('https://7tv.io/v3/emote-sets/global');

    if (response.status === 200) {
      const sevenTvEmotes = process7TVEmotes(response.data, 'global');
      return sevenTvEmotes;
    }

    return {};
  } catch (error) {
    console.error('Error fetching global 7TV emotes:', error);
  }
}

// --- Scheduling (global every 7 days) ---
let _globalInterval = null;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function scheduleGlobalEmotes(intervalMs = SEVEN_DAYS_MS) {
  if (_globalInterval) return;
  fetchGlobalEmotes();
  _globalInterval = setInterval(fetchGlobalEmotes, intervalMs);
  _globalInterval.unref?.();
  console.log('[emotes] Global emote scheduler started. Interval:', intervalMs);
}

export function stopGlobalEmoteScheduler() {
  if (_globalInterval) {
    clearInterval(_globalInterval);
    _globalInterval = null;
    console.log('[emotes] Global emote scheduler stopped.');
  }
}
