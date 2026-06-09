# Scores Coupe du Monde 2026

Site Next.js en français pour suivre les scores et le calendrier de la Coupe du Monde 2026.

Site publié :

```text
https://worldcup-live-2026.vercel.app
```

La v1 fonctionne en deux modes :

- `demo` : actif automatiquement si aucune cle API n'est configuree.
- `api` : actif quand `API_FOOTBALL_KEY` est ajoutée dans l'environnement serveur.

Note : le plan gratuit API-Football peut bloquer certaines saisons récentes ou futures.
Si la saison 2026 n'est pas disponible dans le forfait actif, le site garde les scores live
quand l'endpoint live répond, mais repasse en données demo pour le calendrier.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir :

```text
http://localhost:3000
```

## Variables d'environnement

Copier `.env.example` vers `.env.local`, puis remplir la clé API si disponible.

```bash
API_FOOTBALL_KEY=VotreCleApiFootball
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_LEAGUE=1
API_FOOTBALL_SEASON=2026
```

La clé reste côté serveur dans `app/api/matches/route.ts`; elle n'est jamais envoyée au navigateur.

## Route API

```text
GET /api/matches?view=live|today|upcoming|finished
```

Reponse normalisee :

```json
{
  "mode": "live",
  "updatedAt": "2026-06-09T20:00:00.000Z",
  "source": "demo",
  "matches": [
    {
      "id": "demo-mex-rsa-2026",
      "status": "upcoming",
      "statusLabel": "A venir",
      "minute": null,
      "homeTeam": { "name": "Mexique", "code": "MEX" },
      "awayTeam": { "name": "Afrique du Sud", "code": "RSA" },
      "score": { "home": null, "away": null },
      "kickoff": "2026-06-11T19:00:00.000Z",
      "group": "Groupe A",
      "venue": "Estadio Azteca",
      "city": "Mexico"
    }
  ]
}
```

## Publier sur GitHub + Vercel

1. Créer un nouveau dépôt GitHub.
2. Envoyer le contenu du dossier `worldcup-live` dans ce dépôt.
3. Dans Vercel, choisir `Add New Project`, puis importer le dépôt GitHub.
4. Ajouter les variables d'environnement dans `Project Settings > Environment Variables`.
5. Lancer le déploiement. Vercel détectera automatiquement Next.js.

## Verification avant publication

```bash
npm run build
```

Tester ensuite :

- `/` affiche l'interface en français.
- `/api/matches?view=live` répond même sans clé API.
- les filtres `Live`, `Aujourd'hui`, `A venir`, `Termines` ne cassent pas l'affichage.
- la clé API n'apparait pas dans le code client ni dans la réponse JSON.
