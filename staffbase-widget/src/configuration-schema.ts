// pluginid is shown in Studio settings so admins can configure the QUMU plugin.
// All video-selection fields are hidden — selection is handled via the card picker.
export const configurationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema',
  type: 'object' as const,
  properties: {
    pluginid:      { type: 'string' as const, title: 'QUMU Plugin ID' },
    division:      { type: 'string' as const, title: 'Division'       },
    videotitle:    { type: 'string' as const, title: 'Video Title'     },
    videourl:      { type: 'string' as const, title: 'Video URL'       },
    videoduration: { type: 'string' as const, title: 'Duration'        },
    videoexpiry:   { type: 'string' as const, title: 'Expiry Date'     },
    videothumb:    { type: 'string' as const, title: 'Thumbnail'       },
  },
};

export const uiSchema = {
  pluginid:      { 'ui:placeholder': 'e.g. 6a0cc22372fe006d424385a2' },
  division:      { 'ui:widget': 'hidden' },
  videotitle:    { 'ui:widget': 'hidden' },
  videourl:      { 'ui:widget': 'hidden' },
  videoduration: { 'ui:widget': 'hidden' },
  videoexpiry:   { 'ui:widget': 'hidden' },
  videothumb:    { 'ui:widget': 'hidden' },
};
