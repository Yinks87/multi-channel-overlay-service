import UserEmotesModel from '../schemas/user-emotes.js';
import GlobalEmotesModel from '../schemas/global-emotes.js';

export async function getEmotesByTwitchId({ twitchId }) {
  const emotes = await UserEmotesModel.findOne({ id: twitchId });
  return emotes;
}

export async function deleteUserEmotes({ id }) {
  await UserEmotesModel.deleteOne({ id });
}

export async function getGlobalEmotes() {
  const emotes = await GlobalEmotesModel.find();

  return emotes;
}

export async function deleteGlobalEmotes() {
  await GlobalEmotesModel.collection.drop();
}
