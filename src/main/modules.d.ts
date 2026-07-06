/// <reference types="vite/client" />

declare module '*.sql?raw' {
  const sql: string
  export default sql
}

declare module '*.png?asset' {
  /** electron-vite asset import: absolute path to the emitted file. */
  const path: string
  export default path
}
