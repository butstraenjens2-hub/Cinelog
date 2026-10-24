/** JSON-RPC 2.0 body for a viewer's own Kodi. */

export function kodiRpc(method, params, id = 1) {
  const body = { jsonrpc: "2.0", id, method: String(method) };
  if (params && typeof params === "object") body.params = params;
  return body;
}
