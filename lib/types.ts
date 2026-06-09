export type MatchView = "live" | "today" | "upcoming" | "finished";

export type MatchState =
  | "live"
  | "halftime"
  | "finished"
  | "upcoming"
  | "postponed"
  | "cancelled";

export type DataSource = "api" | "demo";

export interface TeamSnapshot {
  name: string;
  code?: string | null;
  logo?: string | null;
}

export interface MatchScore {
  home: number | null;
  away: number | null;
}

export interface NormalizedMatch {
  id: string;
  status: MatchState;
  statusLabel: string;
  minute: number | null;
  homeTeam: TeamSnapshot;
  awayTeam: TeamSnapshot;
  score: MatchScore;
  kickoff: string;
  group: string | null;
  venue: string | null;
  city: string | null;
}

export interface MatchResponse {
  mode: MatchView;
  updatedAt: string;
  source: DataSource;
  notice?: string;
  matches: NormalizedMatch[];
}
