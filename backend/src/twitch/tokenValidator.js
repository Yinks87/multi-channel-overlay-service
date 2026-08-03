import { getAllUsersWithTwitchTokens } from '../db/services/userService.js';
import { doTokenValidationProcess } from './api.js';

const VALIDATION_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

async function validateAllUserTokens() {
  console.log('[TokenValidation] Starting user access token validation...');
  const tokens = await getAllUsersWithTwitchTokens();

  if (tokens.length === 0) {
    console.log('[TokenValidation] No user tokens to validate.');
    return;
  }

  const results = await Promise.allSettled(
    tokens.map((token) =>
      doTokenValidationProcess({ access_token: token }).catch((err) => {
        console.error(`[TokenValidation] Failed for a token: ${err.message}`);
      }),
    ),
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  console.log(
    `[TokenValidation] Done. ${tokens.length - failed}/${tokens.length} tokens OK.`,
  );
}

export function startUserTokenValidationSchedule() {
  // Validate immediately on startup
  validateAllUserTokens().catch((err) =>
    console.error('[TokenValidation] Initial run failed:', err.message),
  );

  setInterval(() => {
    validateAllUserTokens().catch((err) =>
      console.error('[TokenValidation] Scheduled run failed:', err.message),
    );
  }, VALIDATION_INTERVAL_MS);
}
