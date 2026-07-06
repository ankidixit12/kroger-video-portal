import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from '@staffbase/widget-sdk';
import KrogerStockQuote from './KrogerStockQuote';

const icon = 'data:image/svg+xml;base64,' + btoa(`
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="8" width="40" height="32" rx="4" stroke="#000" stroke-width="3" fill="none"/>
  <polyline points="8,32 16,24 22,28 30,16 40,20" stroke="#16a34a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="16" cy="24" r="2" fill="#16a34a"/>
  <circle cx="22" cy="28" r="2" fill="#16a34a"/>
  <circle cx="30" cy="16" r="2" fill="#16a34a"/>
</svg>
`);

const configurationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema',
  type: 'object' as const,
  properties: {},
};

const uiSchema = {};

const factory: BlockFactory = (BaseBlockClass) => {
  return class KrogerStockQuoteBlock extends BaseBlockClass implements BaseBlock {
    private root: Root | null = null;
    private editorRoot: Root | null = null;

    public constructor() { super(); }

    public renderBlock(container: HTMLElement): void {
      if (!this.root) this.root = createRoot(container);
      this.root.render(<KrogerStockQuote />);
    }

    public renderBlockInEditor(container: HTMLElement): void {
      if (!this.editorRoot) this.editorRoot = createRoot(container);
      this.editorRoot.render(<KrogerStockQuote />);
    }

    public unmountBlock(_container: HTMLElement): void {
      if (this.root) { this.root.unmount(); this.root = null; }
      if (this.editorRoot) { this.editorRoot.unmount(); this.editorRoot = null; }
    }

    public static get observedAttributes(): string[] {
      return [];
    }

    public attributeChangedCallback(
      ...args: [string, string | undefined, string | undefined]
    ): void {
      super.attributeChangedCallback.apply(this, args);
    }
  };
};

const blockDefinition: BlockDefinition = {
  name: 'kroger-stockquote',
  factory,
  attributes: [],
  blockLevel: 'block',
  configurationSchema,
  uiSchema,
  label: 'Kroger\nStock Quote',
  iconUrl: icon,
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: 'Custom',
  version: '1.0.0',
};

const _labelStyle = document.createElement('style');
_labelStyle.textContent = '.ui-commons__widget-menu__label { white-space: pre-line !important; }';
document.head.appendChild(_labelStyle);

window.defineBlock(externalBlockDefinition);
