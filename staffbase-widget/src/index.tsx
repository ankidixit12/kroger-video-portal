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
import { injectArticleCoverImage } from './services/articleCoverService';
import { setInstallationId, setPluginId, setStaffbaseBaseUrl } from './services/videoService';
import pkg from '../package.json';

// Extract installation ID from the script's own src URL.
// Staffbase serves plugin bundles from: .../plugin/files/{24-hex-id}/...
function resolveInstallationId(): string {
  try {
    const src = (document.currentScript as HTMLScriptElement | null)?.src ?? '';
    const fromSrc = src.match(/\/plugin\/files\/([a-f0-9]{24})\//i)?.[1];
    if (fromSrc) return fromSrc;

    // Fallback: data-plugin-id attribute on the <script> tag
    const fromAttr = (document.currentScript as HTMLScriptElement | null)
      ?.getAttribute('data-plugin-id') ?? '';
    if (fromAttr) return fromAttr;

    // Fallback: scan parent-window URL for an installations segment
    const href = (window.top as Window).location.href;
    const fromUrl = href.match(/installations\/([a-f0-9]{24})/i)?.[1];
    if (fromUrl) return fromUrl;
  } catch { /* cross-origin or SSR — ignore */ }
  return '';
}

// Resolve installation ID at script-load time while document.currentScript is still live
setInstallationId(resolveInstallationId());

const icon = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4NCjxwYXRoIGQ9Ik0zMiAyNS45OTk2TDQyLjQ0NiAzMi45NjM2QzQyLjU5NjYgMzMuMDYzOCA0Mi43NzE1IDMzLjEyMTMgNDIuOTUyMiAzMy4xMjk5QzQzLjEzMjkgMzMuMTM4NSA0My4zMTI1IDMzLjA5OCA0My40NzIgMzMuMDEyNkM0My42MzE1IDMyLjkyNzMgNDMuNzY0OCAzMi44MDAyIDQzLjg1NzggMzIuNjQ1MUM0My45NTA4IDMyLjQ4OTkgNDMuOTk5OSAzMi4zMTI0IDQ0IDMyLjEzMTZWMTUuNzM5NkM0NC4wMDAxIDE1LjU2MzYgNDMuOTUzNyAxNS4zOTA3IDQzLjg2NTYgMTUuMjM4NEM0My43Nzc0IDE1LjA4NjIgNDMuNjUwNyAxNC45NTk4IDQzLjQ5ODEgMTQuODcyMkM0My4zNDU2IDE0Ljc4NDUgNDMuMTcyNiAxNC43Mzg3IDQyLjk5NjYgMTQuNzM5M0M0Mi44MjA3IDE0LjczOTkgNDIuNjQ4IDE0Ljc4NjkgNDIuNDk2IDE0Ljg3NTZMMzIgMjAuOTk5NiIgc3Ryb2tlPSIjMDAwMDAwIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPg0KPHBhdGggZD0iTTI4IDEySDhDNS43OTA4NiAxMiA0IDEzLjc5MDkgNCAxNlYzMkM0IDM0LjIwOTEgNS43OTA4NiAzNiA4IDM2SDI4QzMwLjIwOTEgMzYgMzIgMzQuMjA5MSAzMiAzMlYxNkMzMiAxMy43OTA5IDMwLjIwOTEgMTIgMjggMTJaIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+DQo8L3N2Zz4NCg==';

const factory: BlockFactory = (BaseBlockClass, widgetApi) => {
  // Use the live Staffbase domain from the SDK (e.g. "https://krogertest.staffbase.com")
  try { setStaffbaseBaseUrl(widgetApi.getBranchInformation().webUrl); } catch { /* ignore */ }

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
      setPluginId(this.getAttribute('pluginid') || '');
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
      setPluginId(this.getAttribute('pluginid') || '');
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
            injectArticleCoverImage(url, thumbnailUrl);
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
      return ['pluginid', 'division', 'videotitle', 'videourl', 'videoduration', 'videoexpiry', 'videothumb'];
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
  attributes: ['pluginid', 'division', 'videotitle', 'videourl', 'videoduration', 'videoexpiry', 'videothumb'],
  blockLevel: 'block',
  configurationSchema,
  uiSchema,
  label: 'Kroger\nVideo',
  iconUrl: icon,
};

const externalBlockDefinition: ExternalBlockDefinition = {
  blockDefinition,
  author: pkg.author,
  version: pkg.version,
};

const _labelStyle = document.createElement('style');
_labelStyle.textContent = '.ui-commons__widget-menu__label { white-space: pre-line !important; }';
document.head.appendChild(_labelStyle);

window.defineBlock(externalBlockDefinition);
