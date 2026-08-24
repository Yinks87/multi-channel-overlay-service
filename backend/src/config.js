import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

/**
 * Configuration for environment variables
 */

/**
 * @typedef EnvironmentConfig
 * @prop {number | string} BACKEND_PORT - The port number for the backend server.
 * @prop {string} BACKEND_HOST - The host address for the backend server.
 * @prop {string} TWITCH_CLIENT_ID - The client ID for Twitch authentication.
 * @prop {string} TWITCH_CLIENT_SECRET - The client secret for Twitch authentication.
 * @prop {string} TWITCH_REDIRECT_URI - The redirect URI for Twitch authentication.
 * @prop {string} TWITCH_AUTH_REDIRECT_URL - The URL for Twitch authentication redirect.
 * @prop {string} TWITCH_SCOPES - The scopes for Twitch authentication.
 * @prop {string} TWITCH_OWNER_ID - The Twitch ID of the application owner.
 * @prop {string} BACKEND_PUBLIC_ORIGIN - The public origin URL of the backend server.
 * @prop {string} FRONTEND_ORIGIN - The origin URL of the frontend application.
 * @prop {string} EVENTSUB_WEBHOOK_SECRET - The secret key used for verifying Twitch EventSub webhook signatures.
 * @prop {string} JWT_SECRET - The secret key used for signing JWT tokens.
 * @prop {string} JWT_EXPIRY - The expiry time for JWT tokens (e.g., 1h, 2d, etc.).
 * @prop {string} DB_PATH - The file path for the SQLite database.
 * @prop {string} MODE - The mode of the application (e.g., 'production' or 'development').
 */

/**
 * @type {EnvironmentConfig}
 */

const config = {
  ...process.env,
};

export default config;
