import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from '@staffbase/widget-sdk';
import QualtricsEmbeddedFeedback from './QualtricsEmbeddedFeedback';

const icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSI0IiB5PSI4IiB3aWR0aD0iNDAiIGhlaWdodD0iMzIiIHJ4PSI0IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMyIgZmlsbD0ibm9uZSIvPjxsaW5lIHgxPSIxMiIgeTE9IjE4IiB4Mj0iMzYiIHkyPSIxOCIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGxpbmUgeDE9IjEyIiB5MT0iMjQiIHgyPSIzNiIgeTI9IjI0IiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMi41IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48bGluZSB4MT0iMTIiIHkxPSIzMCIgeDI9IjI0IiB5Mj0iMzAiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==';

const configurationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema',
  type: 'object' as const,
  properties: {},
};

const uiSchema = {};

const factory: BlockFactory = (BaseBlockClass) => {
  return class QualtricsEmbeddedFeedbackBlock extends BaseBlockClass implements BaseBlock {
    private root: Root | null = null;
    private editorRoot: Root | null = null;
    private blockContainer: HTMLElement | null = null;
    private editorContainer: HTMLElement | null = null;

    public constructor() { super(); }

    public renderBlock(container: HTMLElement): void {
      if (this.blockContainer !== container) {
        if (this.root) this.root.unmount();
        this.root = createRoot(container);
        this.blockContainer = container;
      }
      this.root.render(<QualtricsEmbeddedFeedback />);
    }

    public renderBlockInEditor(container: HTMLElement): void {
      if (this.editorContainer !== container) {
        if (this.editorRoot) this.editorRoot.unmount();
        this.editorRoot = createRoot(container);
        this.editorContainer = container;
      }
      this.editorRoot.render(<QualtricsEmbeddedFeedback />);
    }

    public unmountBlock(_container: HTMLElement): void {
      if (this.root) { this.root.unmount(); this.root = null; this.blockContainer = null; }
      if (this.editorRoot) { this.editorRoot.unmount(); this.editorRoot = null; this.editorContainer = null; }
    }

    public attributeChangedCallback(attrName: string, oldValue: string | undefined, newValue: string | undefined): void {
      if (super.attributeChangedCallback) super.attributeChangedCallback(attrName, oldValue, newValue);
    }

    public static get observedAttributes(): string[] {
      return [];
    }
  };
};

const blockDefinition: BlockDefinition = {
  name: 'kroger-qualtrics-feedback',
  factory,
  attributes: [],
  blockLevel: 'block',
  configurationSchema,
  uiSchema,
  label: 'Qualtrics Embedded Feedback',
  iconUrl: icon,
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: 'Custom',
  version: '1.0.0',
};

window.defineBlock(externalBlockDefinition);
