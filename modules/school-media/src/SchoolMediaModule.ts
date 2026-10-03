import { NativeModule, requireNativeModule } from 'expo';

import type {
  RenderResult,
  RenderSpec,
  SchoolMediaEvents,
  ShareOutcome,
  VideoInfo,
} from './SchoolMedia.types';

declare class SchoolMediaModule extends NativeModule<SchoolMediaEvents> {
  isAppInstalled(packageName: string): boolean;
  getVideoInfo(uri: string): Promise<VideoInfo>;
  renderVideo(spec: RenderSpec): Promise<RenderResult>;
  cancelRender(): Promise<void>;
  shareFiles(
    uris: string[],
    mimeType: string,
    packageName: string | null,
    chooserTitle: string
  ): Promise<ShareOutcome>;
}

export default requireNativeModule<SchoolMediaModule>('SchoolMedia');
