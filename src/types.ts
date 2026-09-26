export type SceneType = 'hero' | 'metric' | 'compare' | 'process' | 'summary';

export type Metric = {
  value: string;
  label: string;
  delta?: string;
};

export type Comparison = {
  label: string;
  value: string;
  note?: string;
};

export type SceneData = {
  id: string;
  type: SceneType;
  kicker?: string;
  title: string;
  body?: string;
  bullets?: string[];
  metric?: Metric;
  left?: Comparison;
  right?: Comparison;
  steps?: string[];
  narration: string;
  audioFile?: string;
  durationSeconds: number;
  accent?: string;
};

export type ResolvedScene = SceneData & {
  resolvedDurationSeconds: number;
  hasAudio: boolean;
};

export type PresentationProps = {
  scenes: ResolvedScene[];
};
