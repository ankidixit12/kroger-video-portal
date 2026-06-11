import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from '@staffbase/widget-sdk';
import KrogerVideoWidget from './KrogerVideoWidget';
import EditorWrapper from './EditorWrapper';
import { configurationSchema, uiSchema } from './configuration-schema';
import pkg from '../package.json';

const icon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNDY0QjUwIj48cGF0aCBkPSJNMjEgM0gzYy0xLjEgMC0yIC45LTIgMnYxMmMwIDEuMS45IDIgMiAyaDV2Mkg2djJoMTJ2LTJoLTJ2LTJoNWMxLjEgMCAyLS45IDItMlY1YzAtMS4xLS45LTItMi0yem0wIDE0SDNWNWGXOC4vem0tOC0ybC00LTMgNC0zdjZ6Ii8+PC9zdmc+';

const factory: BlockFactory = (BaseBlockClass, _widgetApi) => {
  return class KrogerVideoBlock extends BaseBlockClass implements BaseBlock {
    private root:       Root | null = null;
    private editorRoot: Root | null = null;

    public constructor() { super(); }

    // ── Page view ──────────────────────────────────────────────────────
    public renderBlock(container: HTMLElement): void {
      if (!this.root) this.root = createRoot(container);
      this.doRender();
    }

    private doRender(): void {
      if (!this.root) return;
      this.root.render(
        <KrogerVideoWidget
          division={this.getAttribute('division')   || ''}
          videotitle={this.getAttribute('videotitle') || ''}
          videourl={this.getAttribute('videourl')   || ''}
        />
      );
    }

    // ── Editor / WYSIWYG view ──────────────────────────────────────────
    public renderBlockInEditor(container: HTMLElement): void {
      if (!this.editorRoot) this.editorRoot = createRoot(container);
      this.doRenderEditor();
    }

    private doRenderEditor(): void {
      if (!this.editorRoot) return;
      this.editorRoot.render(
        <EditorWrapper
          division={this.getAttribute('division')         || ''}
          videotitle={this.getAttribute('videotitle')     || ''}
          videourl={this.getAttribute('videourl')         || ''}
          videoduration={this.getAttribute('videoduration') || ''}
          videoexpiry={this.getAttribute('videoexpiry')   || ''}
          videothumb={this.getAttribute('videothumb')     || ''}
          onSelect={(division: string, title: string, url: string, duration: string, expiryDate: string, thumbnailUrl: string) => {
            this.setAttribute('division',      division);
            this.setAttribute('videotitle',    title);
            this.setAttribute('videourl',      url);
            this.setAttribute('videoduration', duration);
            this.setAttribute('videoexpiry',   expiryDate);
            this.setAttribute('videothumb',    thumbnailUrl);
            this.doRenderEditor();
          }}
        />
      );
    }

    // ── Unmount ────────────────────────────────────────────────────────
    public unmountBlock(_container: HTMLElement): void {
      if (this.root)       { this.root.unmount();       this.root       = null; }
      if (this.editorRoot) { this.editorRoot.unmount();  this.editorRoot = null; }
    }

    // ── Attribute changes ──────────────────────────────────────────────
    public static get observedAttributes(): string[] {
      return ['division', 'videotitle', 'videourl', 'videoduration', 'videoexpiry', 'videothumb'];
    }

    public attributeChangedCallback(
      ...args: [string, string | undefined, string | undefined]
    ): void {
      super.attributeChangedCallback.apply(this, args);
      this.doRender();
      this.doRenderEditor();
    }
  };
};

const blockDefinition: BlockDefinition = {
  name: 'kroger-division-video-v12',
  factory,
  attributes: ['division', 'videotitle', 'videourl', 'videoduration', 'videoexpiry', 'videothumb'],
  blockLevel: 'block',
  configurationSchema,
  uiSchema,
  label: 'Video selector widget',
  iconUrl: icon,
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: pkg.author,
  version: pkg.version,
};

window.defineBlock(externalBlockDefinition);
