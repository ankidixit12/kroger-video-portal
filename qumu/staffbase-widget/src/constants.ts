declare const process: { env: Record<string, string> };

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

const qumuServiceRoot = trimTrailingSlash(process.env.QUMU_SERVICE_ROOT || '');

export const STAFFBASE_BASE_URL = trimTrailingSlash(process.env.STAFFBASE_BASE_URL || '');
export const QUMU_KULUS_BASE_URL = trimTrailingSlash(process.env.QUMU_KULUS_BASE_URL || `${qumuServiceRoot}/kulus`);
export const QUMU_TOKEN_BASE_URL = trimTrailingSlash(process.env.QUMU_TOKEN_BASE_URL || `${qumuServiceRoot}/api/token`);
export const QUMU_POST_BASE_URL = trimTrailingSlash(process.env.QUMU_POST_BASE_URL || `${qumuServiceRoot}/kulus/api/post`);

export const DEFAULT_INSTALLATION_ID = '6a3bd7361da609538cb79dac';
export const DEFAULT_THUMBNAIL_COLOR = '#004990';
export const THUMBNAIL_FALLBACK_BASE_URL = 'https://picsum.photos/seed/kroger';

export const PAGE_SIZE = 32;
export const CARD_HEIGHT = '290px';
export const EXPIRING_SOON_WINDOW_MONTHS = 1;

export const VIDEO_WIDGET_ATTRIBUTES = ['division', 'videotitle', 'videourl', 'videoduration', 'videoexpiry', 'videothumb'];
export const VIDEO_WIDGET_BLOCK_NAME = 'kroger-division-video-v12';
export const VIDEO_WIDGET_BLOCK_LABEL = 'Kroger\nVideo';

export const JSON_SCHEMA_DRAFT_07_URL = 'http://json-schema.org/draft-07/schema';
export const JSON_TYPE_OBJECT = 'object' as const;
export const JSON_TYPE_STRING = 'string' as const;
export const UI_WIDGET_KEY = 'ui:widget';
export const UI_WIDGET_HIDDEN = 'hidden';
