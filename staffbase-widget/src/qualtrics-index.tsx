import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  BlockFactory,
  BlockDefinition,
  ExternalBlockDefinition,
  BaseBlock,
} from '@staffbase/widget-sdk';
import QualtricsWidget from './QualtricsWidget';
import pkg from '../package.json';

const icon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjNDY0QjUwIj48cGF0aCBkPSJNMTkgM0g1Yy0xLjEgMC0yIC45LTIgMnYxNGMwIDEuMS45IDIgMiAyaDE0YzEuMSAwIDItLjkgMi0yVjVjMC0xLjEtLjktMi0yLTJ6bTAgMTZINVY1aDE0djE0ek03IDEwaDF2MUg3em0wIDNoMXYxSDd6bTAtNmgxdjFIN3ptMyA2aDd2MUgxMHptMC0zaDF2MWgtMXptMC0zaDF2MWgtMXptMiAzaDV2MWgtNXptMC02aDV2MWgtNXoiLz48L3N2Zz4=';

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  return class QualtricsInterceptBlock extends BaseBlockClass implements BaseBlock {
    private root: Root | null = null;

    public renderBlock(container: HTMLElement): void {
      if (!this.root) this.root = createRoot(container);
      const user = (widgetApi as any)?.getUser?.() || {};
      const userId: string = user.id || user.externalId || 'anonymous';
      this.root.render(<QualtricsWidget userId={userId} />);
    }

    public renderBlockInEditor(container: HTMLElement): void {
      container.innerHTML = `
        <div style="padding:16px 20px;background:#eff6ff;border:1px dashed #93c5fd;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1d4ed8">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h1v1H7zm0 3h1v1H7zm0-6h1v1H7zm3 6h7v1h-7zm0-3h1v1h-1zm0-3h1v1h-1zm2 3h5v1h-5zm0-6h5v1h-5z"/>
            </svg>
            <strong style="font-size:13px;color:#1d4ed8;">Qualtrics Survey Intercept</strong>
          </div>
          <div style="font-size:12px;color:#374151;">Invisible on published pages — Qualtrics popup loads automatically.</div>
        </div>
      `;
    }

    public unmountBlock(_container: HTMLElement): void {
      if (this.root) { this.root.unmount(); this.root = null; }
    }

    public static get observedAttributes(): string[] { return []; }

    public attributeChangedCallback(
      ...args: [string, string | undefined, string | undefined]
    ): void {
      super.attributeChangedCallback.apply(this, args);
    }
  };
};

const blockDefinition: BlockDefinition = {
  name: 'kroger-qualtrics-intercept',
  factory,
  attributes: ['zoneurl', 'intercepttype'],
  blockLevel: 'block',
  label: 'Qualtrics Survey Intercept',
  iconUrl: icon,
  configurationSchema: {
    $schema: 'http://json-schema.org/draft-07/schema',
    type: 'object' as const,
    properties: {
      zoneurl:      { type: 'string' as const, title: 'Zone URL' },
      intercepttype: { type: 'string' as const, title: 'Intercept Type' },
    },
  },
  uiSchema: {
    zoneurl:       { 'ui:widget': 'hidden' },
    intercepttype: { 'ui:widget': 'hidden' },
  },
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: pkg.author,
  version: pkg.version,
};

window.defineBlock(externalBlockDefinition);
