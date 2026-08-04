export const COLORS = {
  blurple: '#5865f2',
  blurpleHover: '#4752c4',
  blurpleSoft: '#aab3ff',
  green: '#23a559',
  red: '#f23f43',
  amber: '#f0b132',
  bg: '#2b2d31',
  bg2: '#232428',
  bg3: '#1e1f22',
  border: '#3f4147',
  borderSoft: '#35373c',
  text: '#f2f3f5',
  muted: '#96989d',
  mutedBright: '#b5bac1'
} as const;

export const WATCH_TASKS = ['WATCH_VIDEO', 'WATCH_VIDEO_ON_MOBILE', 'WATCH_VIDEO_ON_DESKTOP'];

export const RUNNABLE_TASKS = [
  'WATCH_VIDEO',
  'WATCH_VIDEO_ON_MOBILE',
  'WATCH_VIDEO_ON_DESKTOP',
  'PLAY_ON_DESKTOP',
  'PLAY_ON_DESKTOP_V2',
  'STREAM_ON_DESKTOP',
  'PLAY_ACTIVITY',
  'PLAY_ON_XBOX',
  'PLAY_ON_PLAYSTATION',
  'CLOUD_GAMING_ACTIVITY'
] as const;

export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
