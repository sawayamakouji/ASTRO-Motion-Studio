import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {ResolvedScene} from '../types';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const GlassCard: React.FC<React.PropsWithChildren<{style?: React.CSSProperties}>> = ({
  children,
  style,
}) => (
  <div
    style={{
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.075)',
      boxShadow: '0 28px 80px rgba(0,0,0,0.28)',
      backdropFilter: 'blur(22px)',
      borderRadius: 34,
      ...style,
    }}
  >
    {children}
  </div>
);

const FadeUp: React.FC<
  React.PropsWithChildren<{delay?: number; distance?: number; style?: React.CSSProperties}>
> = ({children, delay = 0, distance = 36, style}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 16], [0, 1], clamp);
  const y = interpolate(frame, [delay, delay + 20], [distance, 0], clamp);

  return (
    <div style={{opacity, transform: `translateY(${y}px)`, ...style}}>
      {children}
    </div>
  );
};

const Equalizer: React.FC<{accent: string}> = ({accent}) => {
  const frame = useCurrentFrame();
  const bars = [0.8, 1.25, 0.95, 1.5, 1.08, 1.36, 0.88, 1.18];

  return (
    <div style={{display: 'flex', gap: 7, alignItems: 'center', height: 30}}>
      {bars.map((weight, i) => {
        const height = 7 + Math.abs(Math.sin(frame / 5 + i * 0.9)) * 21 * weight;
        return (
          <div
            key={i}
            style={{
              width: 4,
              height,
              borderRadius: 99,
              background: accent,
              opacity: 0.85,
            }}
          />
        );
      })}
    </div>
  );
};

export const Slide: React.FC<{
  scene: ResolvedScene;
  index: number;
  total: number;
  durationInFrames: number;
}> = ({scene, index, total, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const accent = scene.accent ?? '#6EE7F9';
  const enter = spring({
    fps,
    frame,
    config: {damping: 18, stiffness: 120, mass: 0.8},
  });
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - 15), durationInFrames],
    [1, 0],
    clamp,
  );
  const progress = ((index + frame / durationInFrames) / total) * 100;

  const baseText: React.CSSProperties = {
    fontFamily:
      '"Hiragino Sans", "Yu Gothic UI", "Yu Gothic", "Noto Sans JP", Arial, sans-serif',
    color: '#F8FAFC',
  };

  const renderMain = () => {
    if (scene.type === 'metric' && scene.metric) {
      return (
        <div style={{display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, alignItems: 'center'}}>
          <div>
            <FadeUp delay={4}>
              <div style={{fontSize: 70, lineHeight: 1.16, fontWeight: 800, maxWidth: 920}}>
                {scene.title}
              </div>
            </FadeUp>
            {scene.body ? (
              <FadeUp delay={13}>
                <div style={{fontSize: 30, lineHeight: 1.65, color: '#B8C5D6', marginTop: 34, maxWidth: 850}}>
                  {scene.body}
                </div>
              </FadeUp>
            ) : null}
          </div>
          <GlassCard style={{padding: 58, minHeight: 430, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <div style={{fontSize: 26, color: '#AFC0D3', marginBottom: 26}}>{scene.metric.label}</div>
            <div style={{fontSize: 128, fontWeight: 900, letterSpacing: -6, color: accent, lineHeight: 1}}>
              {scene.metric.value}
            </div>
            {scene.metric.delta ? (
              <div style={{fontSize: 30, marginTop: 28, color: '#E8EEF7'}}>{scene.metric.delta}</div>
            ) : null}
          </GlassCard>
        </div>
      );
    }

    if (scene.type === 'compare' && scene.left && scene.right) {
      return (
        <>
          <FadeUp delay={4}>
            <div style={{fontSize: 66, lineHeight: 1.16, fontWeight: 820, maxWidth: 1320}}>{scene.title}</div>
          </FadeUp>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 110px 1fr', gap: 28, alignItems: 'center', marginTop: 58}}>
            {[scene.left, scene.right].map((item, i) => (
              <React.Fragment key={item.label}>
                <GlassCard style={{padding: 42, minHeight: 275}}>
                  <div style={{fontSize: 24, color: '#9FB0C4'}}>{item.label}</div>
                  <div style={{fontSize: 74, fontWeight: 850, marginTop: 20, color: i === 0 ? accent : '#F8FAFC'}}>
                    {item.value}
                  </div>
                  {item.note ? <div style={{fontSize: 24, color: '#B8C5D6', marginTop: 18}}>{item.note}</div> : null}
                </GlassCard>
                {i === 0 ? (
                  <div style={{fontSize: 48, textAlign: 'center', color: '#6B7C91'}}>vs</div>
                ) : null}
              </React.Fragment>
            ))}
          </div>
          {scene.body ? <div style={{fontSize: 28, color: '#B8C5D6', marginTop: 36}}>{scene.body}</div> : null}
        </>
      );
    }

    if (scene.type === 'process' && scene.steps) {
      return (
        <>
          <FadeUp delay={3}>
            <div style={{fontSize: 72, lineHeight: 1.1, fontWeight: 850}}>{scene.title}</div>
          </FadeUp>
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${scene.steps.length}, 1fr)`, gap: 22, marginTop: 72}}>
            {scene.steps.map((step, i) => (
              <FadeUp key={step} delay={10 + i * 5}>
                <GlassCard style={{padding: 32, minHeight: 250}}>
                  <div style={{fontSize: 19, color: accent, fontWeight: 800, letterSpacing: 2}}>0{i + 1}</div>
                  <div style={{fontSize: 33, fontWeight: 750, lineHeight: 1.4, marginTop: 56}}>{step}</div>
                </GlassCard>
              </FadeUp>
            ))}
          </div>
        </>
      );
    }

    if (scene.type === 'summary' && scene.bullets) {
      return (
        <div style={{display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 64, alignItems: 'center'}}>
          <FadeUp delay={3}>
            <div>
              <div style={{fontSize: 72, fontWeight: 850, lineHeight: 1.12}}>{scene.title}</div>
              {scene.body ? <div style={{fontSize: 28, color: '#AFC0D3', marginTop: 34, lineHeight: 1.6}}>{scene.body}</div> : null}
            </div>
          </FadeUp>
          <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
            {scene.bullets.map((bullet, i) => (
              <FadeUp key={bullet} delay={10 + i * 6}>
                <GlassCard style={{padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 24}}>
                  <div style={{width: 16, height: 16, borderRadius: 99, background: accent, boxShadow: `0 0 24px ${accent}`}} />
                  <div style={{fontSize: 29, fontWeight: 700}}>{bullet}</div>
                </GlassCard>
              </FadeUp>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div style={{maxWidth: 1320}}>
        <FadeUp delay={2}>
          <div style={{fontSize: 92, fontWeight: 900, lineHeight: 1.06, letterSpacing: -3}}>
            {scene.title}
          </div>
        </FadeUp>
        {scene.body ? (
          <FadeUp delay={13}>
            <div style={{fontSize: 34, lineHeight: 1.6, marginTop: 42, color: '#B8C5D6', maxWidth: 1180}}>
              {scene.body}
            </div>
          </FadeUp>
        ) : null}
      </div>
    );
  };

  return (
    <AbsoluteFill
      style={{
        ...baseText,
        opacity: exit,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 82% 16%, rgba(44,102,130,0.34), transparent 34%), radial-gradient(circle at 8% 88%, rgba(88,54,120,0.28), transparent 34%), linear-gradient(135deg, #07111F 0%, #0A1627 58%, #101927 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 610,
          height: 610,
          borderRadius: '50%',
          right: -120 + Math.sin(frame / 48) * 30,
          top: -230 + Math.cos(frame / 58) * 24,
          background: accent,
          opacity: 0.08,
          filter: 'blur(60px)',
          transform: `scale(${0.92 + enter * 0.08})`,
        }}
      />

      <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: 'rgba(255,255,255,0.08)'}}>
        <div style={{width: `${Math.min(100, progress)}%`, height: '100%', background: accent}} />
      </div>

      <div style={{position: 'absolute', inset: '92px 112px 156px 112px', display: 'flex', flexDirection: 'column'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{fontSize: 18, fontWeight: 800, letterSpacing: 4, color: accent}}>
            {scene.kicker ?? 'ASTRO MOTION STUDIO'}
          </div>
          <div style={{fontSize: 20, color: '#708196'}}>
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </div>
        </div>

        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          {renderMain()}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 112,
          right: 112,
          bottom: 48,
          minHeight: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 36,
        }}
      >
        <div style={{display: 'flex', gap: 18, alignItems: 'center', minWidth: 0}}>
          <Equalizer accent={accent} />
          <div style={{fontSize: 22, lineHeight: 1.35, color: '#C6D2E0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 1220}}>
            {scene.narration}
          </div>
        </div>
        <div style={{fontSize: 16, color: '#718197', whiteSpace: 'nowrap'}}>AI narration</div>
      </div>
    </AbsoluteFill>
  );
};
