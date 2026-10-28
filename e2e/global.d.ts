export {}

declare global {
  interface Window {
    __kurio?: { socketClients(): Array<{ id: number; userId: string | null }> } & Record<string, unknown>
  }
}
