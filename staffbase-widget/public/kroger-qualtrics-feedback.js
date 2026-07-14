(function () {
  window.defineBlock({
    blockDefinition: {
      name: 'kroger-qualtrics-feedback',
      factory: function (Base, widgetApi) {
        return class extends Base {
          constructor() { super(); }
          renderBlock(container) {
            container.innerHTML = '<div class="qualtricsembeddedfeedback"></div>';
          }
          renderBlockInEditor(container) {
            container.innerHTML = '<div class="qualtricsembeddedfeedback" style="min-height:48px;border:2px dashed #bbb;padding:12px;color:#aaa;font-family:sans-serif;font-size:13px;text-align:center;box-sizing:border-box">Qualtrics Embedded Feedback</div>';
          }
          unmountBlock(container) {
            container.innerHTML = '';
          }
          attributeChangedCallback(attrName, oldValue, newValue) {
            if (super.attributeChangedCallback) super.attributeChangedCallback(attrName, oldValue, newValue);
          }
          static get observedAttributes() { return []; }
        };
      },
      attributes: [],
      blockLevel: 'block',
      configurationSchema: {
        '$schema': 'http://json-schema.org/draft-07/schema',
        title: 'Qualtrics Embedded Feedback',
        type: 'object',
        properties: {}
      },
      label: 'Qualtrics Embedded Feedback',
      iconUrl: ''
    },
    author: 'Custom',
    version: '1.0.0'
  });
}());
