(function () {
  window.defineBlock({
    blockDefinition: {
      name: 'kroger-stockquote-test',
      factory: function (Base, widgetApi) {
        return class extends Base {
          constructor() { super(); }
          renderBlock(container) {
            var ticker = this.getAttribute('ticker') || 'KR';
            container.innerHTML = '<div>Stock: ' + ticker + '</div>';
          }
          renderBlockInEditor(container) {
            var ticker = this.getAttribute('ticker') || 'KR';
            container.innerHTML = '<div>Stock: ' + ticker + '</div>';
          }
          unmountBlock() {}
          attributeChangedCallback(attrName, oldValue, newValue) {
            if (super.attributeChangedCallback) super.attributeChangedCallback(attrName, oldValue, newValue);
          }
          static get observedAttributes() { return ['ticker']; }
        };
      },
      attributes: ['ticker'],
      blockLevel: 'block',
      configurationSchema: {
        '$schema': 'http://json-schema.org/draft-07/schema',
        type: 'object',
        properties: {
          ticker: { type: 'string', title: 'Stock Ticker Symbol', default: 'KR' }
        }
      },
      label: 'Kroger Stock Quote Test',
      iconUrl: ''
    },
    author: 'Custom',
    version: '1.0.0'
  });
}());
