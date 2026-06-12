export { HydroFoilPlayer } from './HydroFoilPlayer';
export {
  isRootOnlyMediaUrl,
  mediaOriginFromUrl,
  resolveMediaOrigin,
  resolveMediaUrl,
} from './media-url';
export {
  buildHydroFoilScriptEmbed,
  buildHydroFoilIframeEmbed,
  buildLiveEmbedPageUrl,
} from './embed';
export type {
  HydroFoilPlayerProps,
  HydroFoilPlaybackMode,
  HydroFoilScriptEmbedOptions,
  HydroFoilIframeEmbedOptions,
  LiveEmbedPageUrlOptions,
} from './types';

import { buildHydroFoilScriptEmbed } from './embed';

/** @deprecated Use buildHydroFoilScriptEmbed */
export function buildHlsEmbedCode(hlsUrl: string): string {
  return buildHydroFoilScriptEmbed({ src: hlsUrl, title: 'HydroFoil live' });
}
