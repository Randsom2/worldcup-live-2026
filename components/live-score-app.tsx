"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchResponse, MatchState, MatchView, NormalizedMatch } from "@/lib/types";

const viewOptions: Array<{ id: MatchView; label: string; empty: string }> = [
  { id: "live", label: "Live", empty: "Aucun match en direct pour le moment." },
  { id: "today", label: "Aujourd'hui", empty: "Aucun match prévu aujourd'hui." },
  { id: "upcoming", label: "À venir", empty: "Aucun match à venir dans le flux actuel." },
  { id: "finished", label: "Terminés", empty: "Aucun match terminé dans le flux actuel." },
];

const refreshIntervals: Record<MatchView, number> = {
  live: 30_000,
  today: 120_000,
  upcoming: 300_000,
  finished: 300_000,
};

export function LiveScoreApp() {
  const [view, setView] = useState<MatchView>("upcoming");
  const [data, setData] = useState<MatchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMatches() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/matches?view=${view}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Erreur ${response.status}`);
        }

        const payload = (await response.json()) as MatchResponse;
        if (!isCancelled) {
          setData(payload);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Erreur inconnue");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadMatches();
    const timer = window.setInterval(loadMatches, refreshIntervals[view]);

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [view]);

  const matches = data?.matches ?? [];
  const activeEmptyMessage = viewOptions.find((option) => option.id === view)?.empty;
  const liveCount = matches.filter((match) => match.status === "live" || match.status === "halftime").length;
  const nextKickoff = useMemo(() => getNextKickoff(matches), [matches]);

  return (
    <main className="page-shell">
      <section className="scoreboard">
        <header className="hero-band">
          <div>
            <p className="eyebrow">Coupe du Monde 2026</p>
            <h1>Scores en direct</h1>
            <p className="hero-copy">Calendrier, statuts et scores actualisés depuis un flux serveur sécurisé.</p>
          </div>

          <div className="source-panel" aria-label="Source des données">
            <span className={`source-dot ${data?.source === "api" ? "api" : "demo"}`} />
            <span>{data?.source === "api" ? "API-Football active" : "Mode demo"}</span>
            <small>{data ? `Maj ${formatUpdatedAt(data.updatedAt)}` : "Chargement"}</small>
          </div>
        </header>

        {data?.notice ? <p className="notice">{data.notice}</p> : null}
        {error ? <p className="notice error">Impossible de charger le flux : {error}</p> : null}

        <section className="controls" aria-label="Filtres de matchs">
          <div className="segmented">
            {viewOptions.map((option) => (
              <button
                key={option.id}
                className={option.id === view ? "active" : ""}
                type="button"
                aria-pressed={option.id === view}
                onClick={() => setView(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="summary-grid" aria-label="Résumé">
          <StatCard label="Matchs affichés" value={String(matches.length)} />
          <StatCard label="En direct" value={String(liveCount)} />
          <StatCard label="Prochain coup d'envoi" value={nextKickoff || "Non disponible"} />
        </section>

        <section className="match-section" aria-live="polite">
          {isLoading ? (
            <div className="empty-state">Chargement des matchs...</div>
          ) : matches.length > 0 ? (
            <div className="match-grid">
              {matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="empty-state">{activeEmptyMessage}</div>
          )}
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MatchCard({ match }: { match: NormalizedMatch }) {
  return (
    <article className="match-card">
      <div className="match-topline">
        <StatusBadge status={match.status} label={match.statusLabel} minute={match.minute} />
        <time dateTime={match.kickoff}>{formatKickoff(match.kickoff)}</time>
      </div>

      <div className="teams">
        <TeamLine team={match.homeTeam} score={match.score.home} />
        <TeamLine team={match.awayTeam} score={match.score.away} />
      </div>

      <div className="match-meta">
        <span>{match.group || "Competition"}</span>
        <span>{[match.venue, match.city].filter(Boolean).join(", ") || "Lieu à confirmer"}</span>
      </div>
    </article>
  );
}

function TeamLine({
  team,
  score,
}: {
  team: NormalizedMatch["homeTeam"];
  score: number | null;
}) {
  return (
    <div className="team-line">
      <span className="team-mark" aria-hidden="true">
        {team.logo ? <img src={team.logo} alt="" /> : initialsFor(team.name)}
      </span>
      <div>
        <strong>{team.name}</strong>
        {team.code ? <small>{team.code}</small> : null}
      </div>
      <span className="team-score">{score ?? "-"}</span>
    </div>
  );
}

function StatusBadge({
  status,
  label,
  minute,
}: {
  status: MatchState;
  label: string;
  minute: number | null;
}) {
  const suffix = minute ? ` ${minute}'` : "";

  return <span className={`status-badge ${status}`}>{label + suffix}</span>;
}

function getNextKickoff(matches: NormalizedMatch[]): string | null {
  const future = matches
    .filter((match) => match.status === "upcoming" || match.status === "postponed")
    .sort((first, second) => new Date(first.kickoff).getTime() - new Date(second.kickoff).getTime());

  return future[0] ? formatKickoff(future[0].kickoff) : null;
}

function formatKickoff(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
