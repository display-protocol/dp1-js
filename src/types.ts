export interface DPVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export interface HydrationParams {
  [key: string]: string;
}

export interface PlaylistSchedule {
  byDisplayAt?: boolean;
}

export interface PlaylistItem {
  source: string;
  displayAt?: string;
  [key: string]: unknown;
}

export interface Playlist {
  dpVersion: string;
  title: string;
  items: PlaylistItem[];
  schedule?: PlaylistSchedule;
  [key: string]: unknown;
}
