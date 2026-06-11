// All fields hidden — selection is handled via the card picker in renderBlockInEditor.
// The schema still declares the three attributes so Staffbase stores them.
export const configurationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema',
  type: 'object' as const,
  properties: {
    division:      { type: 'string' as const, title: 'Division'   },
    videotitle:    { type: 'string' as const, title: 'Video Title' },
    videourl:      { type: 'string' as const, title: 'Video URL'   },
    videoduration: { type: 'string' as const, title: 'Duration'    },
    videoexpiry:   { type: 'string' as const, title: 'Expiry Date' },
    videothumb:    { type: 'string' as const, title: 'Thumbnail'   },
  },
};

export const uiSchema = {
  division:      { 'ui:widget': 'hidden' },
  videotitle:    { 'ui:widget': 'hidden' },
  videourl:      { 'ui:widget': 'hidden' },
  videoduration: { 'ui:widget': 'hidden' },
  videoexpiry:   { 'ui:widget': 'hidden' },
  videothumb:    { 'ui:widget': 'hidden' },
};
