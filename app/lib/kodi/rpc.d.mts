export function kodiRpc(
  method: string,
  params?: Record<string, unknown>,
  id?: number,
): { jsonrpc: "2.0"; id: number; method: string; params?: Record<string, unknown> };
