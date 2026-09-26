import React from 'react';
import {
  Composition,
  staticFile,
  type CalculateMetadataFunction,
} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import scenesJson from './data/scenes.json';
import {AstroPresentation} from './components/AstroPresentation';
import type {PresentationProps, ResolvedScene, SceneData} from './types';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

const sourceScenes = scenesJson as SceneData[];

const fallbackScenes: ResolvedScene[] = sourceScenes.map((scene) => ({
  ...scene,
  resolvedDurationSeconds: scene.durationSeconds,
  hasAudio: false,
}));

const calculateMetadata: CalculateMetadataFunction<PresentationProps> = async ({
  props,
}) => {
  const resolvedScenes: ResolvedScene[] = await Promise.all(
    props.scenes.map(async (scene) => {
      if (!scene.audioFile) {
        return {
          ...scene,
          resolvedDurationSeconds: scene.durationSeconds,
          hasAudio: false,
        };
      }

      try {
        const audioSeconds = await getAudioDurationInSeconds(
          staticFile(scene.audioFile),
        );

        return {
          ...scene,
          resolvedDurationSeconds: Math.max(
            scene.durationSeconds,
            audioSeconds + 0.7,
          ),
          hasAudio: true,
        };
      } catch {
        return {
          ...scene,
          resolvedDurationSeconds: scene.durationSeconds,
          hasAudio: false,
        };
      }
    }),
  );

  const totalFrames = resolvedScenes.reduce(
    (sum, scene) =>
      sum + Math.max(1, Math.ceil(scene.resolvedDurationSeconds * FPS)),
    0,
  );

  return {
    durationInFrames: totalFrames,
    props: {scenes: resolvedScenes},
  };
};

export const RemotionRoot: React.FC = () => {
  const fallbackFrames = fallbackScenes.reduce(
    (sum, scene) =>
      sum + Math.max(1, Math.ceil(scene.resolvedDurationSeconds * FPS)),
    0,
  );

  return (
    <Composition
      id="AstroNarratedSlides"
      component={AstroPresentation}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={fallbackFrames}
      defaultProps={{scenes: fallbackScenes}}
      calculateMetadata={calculateMetadata}
    />
  );
};
