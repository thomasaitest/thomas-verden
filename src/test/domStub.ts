/** Minimal canvas/document stub so procedural 3D scenes can be built in node (no WebGL, no DOM). */
export function installDomStub(): void {
  const ctx = new Proxy(
    {},
    {
      get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}),
      set: () => true,
    },
  );
  const canvas = () => ({ width: 0, height: 0, getContext: () => ctx, style: {} });
  (globalThis as unknown as { document: unknown }).document = { createElement: () => canvas() };
}
