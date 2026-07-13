(function () {
  window.defineBlock({
    blockDefinition: {
      name: 'kroger-stockquote-test',
      factory: function (Base, widgetApi) {
        return class extends Base {
          constructor() { super(); }
          renderBlock(container) { container.innerHTML = '<div>KR Stock Quote</div>'; }
          renderBlockInEditor(container) { container.innerHTML = '<div>KR Stock Quote</div>'; }
          unmountBlock() {}
          static get observedAttributes() { return []; }
        };
      },
      attributes: [],
      blockLevel: 'block',
      configurationSchema: {
        '$schema': 'http://json-schema.org/draft-07/schema',
        type: 'object',
        properties: {}
      },
      label: 'Kroger Stock Quote Test',
      iconUrl: ''
    },
    author: 'Custom',
    version: '1.0.0'
  });
}());
