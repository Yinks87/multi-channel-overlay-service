import api from './api.js';

function normalizeReturnTo(returnTo) {
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/')) {
    return '/main';
  }
  return returnTo;
}

export function startTwitchAuthorization(returnTo = '/main') {
  const params = new URLSearchParams({
    returnTo: normalizeReturnTo(returnTo),
    frontendOrigin: window.location.origin,
  });

  window.location.assign(
    `${api.defaults.baseURL}/api/v1/twitch/start?${params.toString()}`,
  );
}
