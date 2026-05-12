export interface DPVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export interface HydrationParams {
  [key: string]: string;
}
