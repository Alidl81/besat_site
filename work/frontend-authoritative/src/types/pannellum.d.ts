declare module "pannellum";

type PannellumViewer = {
  destroy: () => void;
  on: (event: string, callback: () => void) => PannellumViewer;
};

interface Window {
  pannellum?: {
    viewer: (
      container: string | HTMLElement,
      config: Record<string, unknown>,
    ) => PannellumViewer;
  };
}
