import {
  JSON_SCHEMA_DRAFT_07_URL,
  JSON_TYPE_OBJECT,
  JSON_TYPE_STRING,
  UI_WIDGET_HIDDEN,
  UI_WIDGET_KEY,
} from './constants';

// All video-selection fields are hidden; selection is handled via the card picker.
export const configurationSchema = {
  $schema: JSON_SCHEMA_DRAFT_07_URL,
  type: JSON_TYPE_OBJECT,
  properties: {
    division:      { type: JSON_TYPE_STRING, title: 'Division'    },
    videotitle:    { type: JSON_TYPE_STRING, title: 'Video Title' },
    videourl:      { type: JSON_TYPE_STRING, title: 'Video URL'   },
    videoduration: { type: JSON_TYPE_STRING, title: 'Duration'     },
    videoexpiry:   { type: JSON_TYPE_STRING, title: 'Expiry Date'  },
    videothumb:    { type: JSON_TYPE_STRING, title: 'Thumbnail'    },
  },
};

export const uiSchema = {
  division:      { [UI_WIDGET_KEY]: UI_WIDGET_HIDDEN },
  videotitle:    { [UI_WIDGET_KEY]: UI_WIDGET_HIDDEN },
  videourl:      { [UI_WIDGET_KEY]: UI_WIDGET_HIDDEN },
  videoduration: { [UI_WIDGET_KEY]: UI_WIDGET_HIDDEN },
  videoexpiry:   { [UI_WIDGET_KEY]: UI_WIDGET_HIDDEN },
  videothumb:    { [UI_WIDGET_KEY]: UI_WIDGET_HIDDEN },
};
