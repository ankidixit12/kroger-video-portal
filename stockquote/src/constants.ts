declare const process: { env: { STOCKQUOTE_API_URL: string } };

export const PLUGIN_ID         = '6a62f458a1562171e13f19d1';
export const TOKEN_BASE_PATH   = '/api/installations';
export const STOCKQUOTE_API_URL = process.env.STOCKQUOTE_API_URL;
