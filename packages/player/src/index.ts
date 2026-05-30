export { HydroFoilPlayer } from './HydroFoilPlayer';
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
} from './types';

import { buildHydroFoilScriptEmbed } from './embed';

/** @deprecated Use buildHydroFoilScriptEmbed */
export function buildHlsEmbedCode(hlsUrl: string): string {
  return buildHydroFoilScriptEmbed({ src: hlsUrl, title: 'HydroFoil live' });
}
