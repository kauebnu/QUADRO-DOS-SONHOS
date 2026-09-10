/**
 * Stub usado só no build de prévia (arquivo único).
 * Não há service worker para registrar quando o app roda solto.
 */
export function registerSW(_options?: unknown): (reload?: boolean) => Promise<void> {
  return async () => {}
}
