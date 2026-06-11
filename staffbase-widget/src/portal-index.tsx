import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from '@staffbase/widget-sdk';
import KrogerDivisionVideoPortal from './KrogerDivisionVideoPortal';
import pkg from '../package.json';

const icon =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNDY0QjUwIj48cGF0aCBkPSJNMjEgM0gzYy0xLjEgMC0yIC45LTIgMnYxMmMwIDEuMS45IDIgMiAyaDV2Mkg2djJoMTJ2LTJoLTJ2LTJoNWMxLjEgMCAyLS45IDItMlY1YzAtMS4xLS45LTItMi0yem0wIDE0SDNWNWGXOC4vem0tOC0ybC00LTMgNC0zdjZ6Ii8+PC9zdmc+';

const factory: BlockFactory = (BaseBlockClass, _widgetApi) => {
  return class KrogerDivisionVideoPortalBlock extends BaseBlockClass implements BaseBlock {
    private root: Root | null = null;

    public constructor() { super(); }

    public renderBlock(container: HTMLElement): void {
      if (!this.root) this.root = createRoot(container);
      this.doRender();
    }

    private doRender(): void {
      if (!this.root) return;
      this.root.render(
        <KrogerDivisionVideoPortal
          widgettitle={this.getAttribute('widgettitle') ?? 'Division Video Portal'}
        />,
      );
    }

    public renderBlockInEditor(container: HTMLElement): void {
      this.renderBlock(container);
    }

    public unmountBlock(_container: HTMLElement): void {
      if (this.root) { this.root.unmount(); this.root = null; }
    }

    public static get observedAttributes(): string[] {
      return ['widgettitle'];
    }

    public attributeChangedCallback(
      ...args: [string, string | undefined, string | undefined]
    ): void {
      super.attributeChangedCallback.apply(this, args);
      this.doRender();
    }
  };
};

const blockDefinition: BlockDefinition = {
  name:       'kroger-division-video-portal',
  factory,
  attributes: ['widgettitle'],
  blockLevel:  'block',
  configurationSchema: {
    $schema: 'http://json-schema.org/draft-07/schema',
    type: 'object' as const,
    properties: {
      widgettitle: { type: 'string' as const, title: 'Widget Title' },
    },
  },
  uiSchema: {
    widgettitle: { 'ui:widget': 'hidden' },
  },
  label:    'Kroger Division Video Portal',
  iconUrl:  icon,
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author:  pkg.author,
  version: pkg.version,
};

window.defineBlock(externalBlockDefinition);
