declare module 'mpegts.js' {
  const mpegts: {
    isSupported: () => boolean;
    createPlayer: (
      mediaDataSource: {
        type: string;
        url: string;
        isLive?: boolean;
        hasAudio?: boolean;
        hasVideo?: boolean;
      },
      config?: Record<string, unknown>
    ) => {
      attachMediaElement: (element: HTMLMediaElement) => void;
      load: () => void;
      play: () => Promise<void>;
      pause: () => void;
      unload: () => void;
      detachMediaElement: () => void;
      destroy: () => void;
      on: (event: string, handler: () => void) => void;
      off: (event: string, handler: () => void) => void;
    };
    Events: { ERROR: string };
  };
  export default mpegts;
}
