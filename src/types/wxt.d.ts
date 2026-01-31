/// <reference types="wxt/client" />

declare module "wxt/client" {
  export function defineUnlistedScript(
    callback: (ctx: any) => void | Promise<void>
  ): any;
}

// Auto-imports for WXT
declare const defineBackground: (handler: () => void) => void;
declare const defineContentScript: (config: any) => any;
declare const defineUnlistedScript: (handler: (ctx: any) => void | Promise<void>) => any;
declare const browser: typeof chrome;

