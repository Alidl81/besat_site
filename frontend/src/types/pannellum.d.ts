declare module "pannellum";

type PannellumViewer = {
  destroy: () => void;
  on: (event: string, callback: () => void) => PannellumViewer;
  mouseEventToCoords: (event: MouseEvent) => [number, number];
  setYaw: (yaw: number, animated?: boolean | number) => PannellumViewer;
  setPitch: (pitch: number, animated?: boolean | number) => PannellumViewer;
  setHfov: (hfov: number, animated?: boolean | number) => PannellumViewer;
  getYaw: () => number;
  getPitch: () => number;
  getHfov: () => number;
  loadScene: (sceneId: string) => PannellumViewer;
};

interface Window {
  pannellum?: {
    viewer: (
      container: string | HTMLElement,
      config: Record<string, unknown>,
    ) => PannellumViewer;
  };
}
