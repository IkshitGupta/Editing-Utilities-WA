import { NativeModule, requireNativeModule } from 'expo';

import type {
  FrameResult,
  RenderResult,
  RenderSpec,
  SchoolMediaEvents,
  ShareOutcome,
  VideoInfo,
} from './SchoolMedia.types';

declare class SchoolMediaModule extends NativeModule<SchoolMediaEvents> {
  isAppInstalled(packageName: string): boolean;
  // When this installation was made, in ms since 1970. Updating keeps it; reinstalling changes it.
  installationTime(): number;
  getVideoInfo(uri: string): Promise<VideoInfo>;
  extractFrame(uri: string, timeMs: number): Promise<FrameResult>;
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
