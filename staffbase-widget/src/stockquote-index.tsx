import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from '@staffbase/widget-sdk';
import KrogerStockQuote from './KrogerStockQuote';

const icon = 'data:image/svg+xml;base64,Cjxzdmcgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiB2aWV3Qm94PSIwIDAgNDggNDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHJlY3QgeD0iNCIgeT0iOCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjMyIiByeD0iNCIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjMiIGZpbGw9Im5vbmUiLz4KICA8cG9seWxpbmUgcG9pbnRzPSI4LDMyIDE2LDI0IDIyLDI4IDMwLDE2IDQwLDIwIiBzdHJva2U9IiMxNmEzNGEiIHN0cm9rZS13aWR0aD0iMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CiAgPGNpcmNsZSBjeD0iMTYiIGN5PSIyNCIgcj0iMiIgZmlsbD0iIzE2YTM0YSIvPgogIDxjaXJjbGUgY3g9IjIyIiBjeT0iMjgiIHI9IjIiIGZpbGw9IiMxNmEzNGEiLz4KICA8Y2lyY2xlIGN4PSIzMCIgY3k9IjE2IiByPSIyIiBmaWxsPSIjMTZhMzRhIi8+Cjwvc3ZnPgo=';

const configurationSchema = {
  $schema: 'http://json-schema.org/draft-07/schema',
  type: 'object' as const,
  properties: {},
  additionalProperties: false as const,
};

const uiSchema = {};

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  let _branchUrl = '';
  try { _branchUrl = widgetApi.getBranchInformation().webUrl; } catch { /* ignore */ }

  return class KrogerStockQuoteBlock extends BaseBlockClass implements BaseBlock {
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
      this.root.render(<KrogerStockQuote />);
    }

    public renderBlockInEditor(container: HTMLElement): void {
      if (this.editorContainer !== container) {
        if (this.editorRoot) this.editorRoot.unmount();
        this.editorRoot = createRoot(container);
        this.editorContainer = container;
      }
      this.editorRoot.render(<KrogerStockQuote />);
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
  name: 'kroger-stockquote',
  factory,
  attributes: [],
  blockLevel: 'block',
  configurationSchema,
  uiSchema,
  label: 'Kroger Stock Quote',
  iconUrl: icon,
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: 'Custom',
  version: '1.0.0',
};

window.defineBlock(externalBlockDefinition);
