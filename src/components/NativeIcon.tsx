export type NativeIconName = 'hourglass' | 'check' | 'edit' | 'refresh' | 'flag' | 'game' | 'group' | 'invite';

const paths: Record<NativeIconName, string> = {
  hourglass: 'M6 2h12v6c0 2.21-1.79 4-4 4 2.21 0 4 1.79 4 4v6H6v-6c0-2.21 1.79-4 4-4-2.21 0-4-1.79-4-4V2zm2 2v4c0 1.1.9 2 2 2h4c1.1 0 2-.9 2-2V4H8zm8 16v-4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v4h8z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1 1 0 0 0 0-1.42l-2.5-2.5a1 1 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-1.79z',
  refresh: 'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  flag: 'M5 3v18h2v-7h10l-1-4 1-4H7V3H5z',
  game: 'M7 6h10c1.66 0 3 1.34 3 3v6c0 1.66-1.34 3-3 3h-1.5l-2-2h-3l-2 2H7c-1.66 0-3-1.34-3-3V9c0-1.66 1.34-3 3-3zm1 3v2H6v2h2v2h2v-2h2v-2h-2V9H8zm7 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  group: 'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  invite: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zM6 10V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
};

export function NativeIcon({ name, className = '' }: { name: NativeIconName; className?: string }) {
  return <svg className={`native-icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
