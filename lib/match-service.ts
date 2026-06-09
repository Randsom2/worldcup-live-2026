import { demoMatches } from "@/lib/demo-matches";
import type { MatchResponse, MatchState, MatchView, NormalizedMatch } from "@/lib/types";

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";
const DEFAULT_LEAGUE = "1";
const DEFAULT_SEASON = "2026";
const PARIS_TIME_ZONE = "Europe/Paris";

const liveStatuses = new Set(["1H", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);
const finishedStatuses = new Set(["FT", "AET", "PEN"]);

interface ApiFootballTeam {
  name?: string;
  code?: string | null;
  logo?: string | null;
}

interface ApiFootballFixture {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
      long?: string;
      elapsed?: number | null;
    };
    venue?: {
      name?: string | null;
      city?: string | null;
    };
  };
  league?: {
    id?: number;
    round?: string | null;
  };
  teams?: {
    home?: ApiFootballTeam;
    away?: ApiFootballTeam;
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
}

interface ApiFootballPayload {
  response?: ApiFootballFixture[];
  errors?: Record<string, string> | string[];
}

export function resolveView(value: string | null): MatchView {
  if (value === "live" || value === "today" || value === "upcoming" || value === "finished") {
    return value;
  }

  return "live";
}

export async function getMatches(view: MatchView): Promise<MatchResponse> {
  const apiKey = process.env.API_FOOTBALL_KEY?.trim();

  if (!apiKey) {
    return getDemoResponse(view, "Mode demo : ajoutez API_FOOTBALL_KEY dans Vercel pour activer les vrais scores.");
  }

  try {
    const matches = await fetchApiMatches(view, apiKey);

    return {
      mode: view,
      updatedAt: new Date().toISOString(),
      source: "api",
      matches: filterMatchesByView(matches, view),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erreur inconnue";

    return getDemoResponse(
      view,
      `Mode demo : impossible de charger API-Football pour le moment (${detail}).`,
    );
  }
}

function getDemoResponse(view: MatchView, notice?: string): MatchResponse {
  return {
    mode: view,
    updatedAt: new Date().toISOString(),
    source: "demo",
    notice,
    matches: filterMatchesByView(demoMatches, view),
  };
}

async function fetchApiMatches(view: MatchView, apiKey: string): Promise<NormalizedMatch[]> {
  const baseUrl = (process.env.API_FOOTBALL_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const league = process.env.API_FOOTBALL_LEAGUE || DEFAULT_LEAGUE;
  const season = process.env.API_FOOTBALL_SEASON || DEFAULT_SEASON;
  const leagueId = Number.parseInt(league, 10);
  const url = new URL(`${baseUrl}/fixtures`);

  url.searchParams.set("timezone", PARIS_TIME_ZONE);

  if (view === "live") {
    url.searchParams.set("live", "all");
  } else {
    url.searchParams.set("league", league);
    url.searchParams.set("season", season);

    if (view === "today") {
      url.searchParams.set("date", getParisDateKey(new Date()));
    }

    if (view === "upcoming") {
      url.searchParams.set("next", "40");
    }

    if (view === "finished") {
      url.searchParams.set("last", "40");
    }
  }

  const response = await fetch(url, {
    headers: {
      "x-apisports-key": apiKey,
    },
    next: {
      revalidate: view === "live" ? 25 : 300,
    },
  });

  const payload = (await response.json()) as ApiFootballPayload;

  if (!response.ok || hasApiErrors(payload.errors)) {
    throw new Error(`reponse API ${response.status}`);
  }

  return (payload.response || [])
    .filter((fixture) => view !== "live" || !Number.isFinite(leagueId) || fixture.league?.id === leagueId)
    .map(normalizeFixture)
    .filter((fixture): fixture is NormalizedMatch => fixture !== null);
}

function normalizeFixture(fixture: ApiFootballFixture): NormalizedMatch | null {
  const id = fixture.fixture?.id;
  const kickoff = fixture.fixture?.date;
  const homeTeam = fixture.teams?.home;
  const awayTeam = fixture.teams?.away;

  if (!id || !kickoff || !homeTeam?.name || !awayTeam?.name) {
    return null;
  }

  const statusShort = fixture.fixture?.status?.short || "NS";
  const state = normalizeStatus(statusShort);
  const minute = state === "live" || state === "halftime" ? fixture.fixture?.status?.elapsed ?? null : null;

  return {
    id: String(id),
    status: state,
    statusLabel: labelForState(state),
    minute,
    homeTeam: {
      name: homeTeam.name,
      code: homeTeam.code || null,
      logo: homeTeam.logo || null,
    },
    awayTeam: {
      name: awayTeam.name,
      code: awayTeam.code || null,
      logo: awayTeam.logo || null,
    },
    score: {
      home: fixture.goals?.home ?? null,
      away: fixture.goals?.away ?? null,
    },
    kickoff,
    group: fixture.league?.round || null,
    venue: fixture.fixture?.venue?.name || null,
    city: fixture.fixture?.venue?.city || null,
  };
}

function normalizeStatus(shortStatus: string): MatchState {
  if (liveStatuses.has(shortStatus)) return "live";
  if (shortStatus === "HT") return "halftime";
  if (finishedStatuses.has(shortStatus)) return "finished";
  if (shortStatus === "PST") return "postponed";
  if (shortStatus === "CANC" || shortStatus === "ABD" || shortStatus === "WO") return "cancelled";
  return "upcoming";
}

function labelForState(state: MatchState): string {
  const labels: Record<MatchState, string> = {
    live: "Live",
    halftime: "Mi-temps",
    finished: "Terminé",
    upcoming: "À venir",
    postponed: "Reporté",
    cancelled: "Annulé",
  };

  return labels[state];
}

export function filterMatchesByView(matches: NormalizedMatch[], view: MatchView): NormalizedMatch[] {
  const now = new Date();
  const todayKey = getParisDateKey(now);

  return matches
    .filter((match) => {
      if (view === "live") return match.status === "live" || match.status === "halftime";
      if (view === "today") return getParisDateKey(new Date(match.kickoff)) === todayKey;
      if (view === "finished") return match.status === "finished";
      return match.status === "upcoming" || match.status === "postponed";
    })
    .sort((first, second) => {
      const firstTime = new Date(first.kickoff).getTime();
      const secondTime = new Date(second.kickoff).getTime();
      return view === "finished" ? secondTime - firstTime : firstTime - secondTime;
    });
}

function getParisDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";

  return `${year}-${month}-${day}`;
}

function hasApiErrors(errors: ApiFootballPayload["errors"]): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  return Object.keys(errors).length > 0;
}
