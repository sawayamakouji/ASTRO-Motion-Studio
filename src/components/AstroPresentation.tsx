import React from 'react';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import {FPS} from '../Root';
import type {PresentationProps} from '../types';
import {Slide} from './Slide';

export const AstroPresentation: React.FC<PresentationProps> = ({scenes}) => {
  let cursor = 0;

  return (
    <AbsoluteFill style={{backgroundColor: '#07111F'}}>
      {scenes.map((scene, index) => {
        const durationInFrames = Math.max(
          1,
          Math.ceil(scene.resolvedDurationSeconds * FPS),
        );
        const from = cursor;
        cursor += durationInFrames;

        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={durationInFrames}
            name={scene.title}
          >
            <Slide
              scene={scene}
              index={index}
              total={scenes.length}
              durationInFrames={durationInFrames}
            />
            {scene.hasAudio && scene.audioFile ? (
              <Audio src={staticFile(scene.audioFile)} volume={0.96} />
            ) : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
