import { applyShadowStyles } from './utils';

export class TooltipHelper {
  private static instance: TooltipHelper;
  private container: HTMLElement | null = null;
  private wrapper: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;

  private constructor() {}

  static getInstance(): TooltipHelper {
    if (!TooltipHelper.instance) {
      TooltipHelper.instance = new TooltipHelper();
    }
    return TooltipHelper.instance;
  }

  initialize(css: string) {
    if (this.container) return; // Already initialized

    // Create host element
    this.container = document.createElement('div');
    this.container.id = 'prompt-manager-for-google-ai-studio-tooltip-container';
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '0';
    this.container.style.height = '0';
    this.container.style.zIndex = '2147483647'; // Max z-index
    this.container.style.pointerEvents = 'none'; // Pass through clicks

    document.body.appendChild(this.container);

    // Create shadow root
    this.shadow = this.container.attachShadow({ mode: 'open' });

    // Inject styles
    applyShadowStyles(this.shadow, css);

    // Create wrapper for content (where we will portal to)
    this.wrapper = document.createElement('div');
    // Ensure wrapper doesn't block clicks but children do
    this.wrapper.style.pointerEvents = 'auto'; 
    // Actually, TooltipContent is positioned absolutely, so wrapper size doesn't matter much
    // but we need to ensure the wrapper can hold the portal content.
    
    // We add the theme class to this wrapper
    this.wrapper.classList.add('font-sans'); // Add base font class if needed
    
    this.shadow.appendChild(this.wrapper);
  }

  getContainer(): HTMLElement {
    return this.wrapper || document.body;
  }

  setTheme(isDark: boolean) {
    if (!this.wrapper) return;
    
    if (isDark) {
      this.wrapper.classList.add('dark');
    } else {
      this.wrapper.classList.remove('dark');
    }
  }
}

