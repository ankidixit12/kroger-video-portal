import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  BaseBlock,
  BlockDefinition,
  BlockFactory,
  ExternalBlockDefinition,
} from '@staffbase/widget-sdk';
import { PingOneAuthPlugin } from './PingOneAuthPlugin';
import pkg from '../package.json';

const factory: BlockFactory = (BaseBlockClass) => {
  return class PingOneAuthBlock extends BaseBlockClass implements BaseBlock {
    private root: Root | null = null;

    public renderBlock(container: HTMLElement): void {
      if (!this.root) this.root = createRoot(container);
      this.root.render(<PingOneAuthPlugin />);
    }

    public renderBlockInEditor(_container: HTMLElement): void {
      // Intentionally empty — the auth plugin renders nothing in the editor.
    }

    public unmountBlock(_container: HTMLElement): void {
      if (this.root) {
        this.root.unmount();
        this.root = null;
      }
    }

    public static get observedAttributes(): string[] { return []; }
  };
};

const blockDefinition: BlockDefinition = {
  name:        'kroger-pingone-auth',
  factory,
  attributes:  [],
  blockLevel:  'block',
  configurationSchema: { properties: {}, required: [] },
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author:  pkg.author,
  version: pkg.version,
};

window.defineBlock(externalBlockDefinition);
