/// <reference types="vite/client" />
declare module "*?inline" {
  const content: string;
  export default content;
}

declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare module "*.gif" {
  const src: string;
  export default src;
}
