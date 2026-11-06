# Blackzeldon Cockpit — SMC & Quantum Edge

Cockpit de trading **papier** (journal de trades, aucun ordre réel) : détection SMC/ICT, backtest local
de la règle, indicateurs de régime (Hurst, GARCH, Kalman…), mode Sniper micro-compte.
React 19 + Vite + Tailwind côté client, Express côté serveur.

> ⚠️ Outil d'aide à l'analyse, pas un conseil financier. Aucun gain n'est garanti. Les probabilités
> affichées sont des **estimations empiriques** issues d'un backtest local (voir « Ce que les chiffres
> veulent dire »).

## Démarrage

```bash
npm install
cp .env.example .env      # puis renseigne ADMIN_TOKEN (obligatoire en ligne) et tes clés
npm run dev               # http://localhost:3000
npm test                  # suite de tests du moteur
npm run build && NODE_ENV=production npm start
```

## Sources de données

Ordre : Twelve Data → Finnhub → Yahoo Finance. Le H4 est construit en agrégeant du 1h.
**Si aucune source ne répond, l'app n'invente rien** : `freshness = unavailable`, signaux et auto-trade bloqués.
Les indices synthétiques (Boom/Crash/Volatility…) n'ont **aucun flux** branché : ils sont listés mais désactivés.
`ALLOW_SIMULATOR=true` autorise des bougies aléatoires de démo (toujours étiquetées, signaux toujours bloqués).

Un signal n'est autorisé que si les données sont **live** (âge de la dernière bougie mesuré).

## Ce que les chiffres veulent dire

| Chiffre | Origine |
|---|---|
| Score de confluence (0-100) | Somme pondérée de 7 critères SMC, normalisée. Descriptif, pas prédictif. |
| Probabilité | Backtest walk-forward de la **même règle** sur l'historique chargé : SL structurel, TP1 = 1R, sans regard vers le futur, rétrécie vers 50 % (prior Beta(5,5)). Affichée avec `n`. **Hors coûts** (spread/slippage). Échantillons chevauchants. |
| Forecast | Même backtest par unité de temps ; « calibré » seulement si n ≥ 30, « insuffisant » si n < 12. |
| Indicateurs quantiques | Décrivent le régime (Hurst corrigé Anis-Lloyd/Peters, GARCH, Kalman, Markov…). Non validés comme prédicteurs. |
| Monte-Carlo | Bootstrap des rendements recentrés, graine déterministe, évalué sur les clôtures. |
| Kelly | Quart de Kelly pour un gain 1R, plafonné à 5 %, 0 si espérance négative. |
| Win rate / R | Calculés **uniquement** sur les trades du journal réellement clos. |

## Journal

Le serveur suit les prix et ferme les trades ouverts (SL ou TP1 touchés). Hypothèses pessimistes : SL et TP1
dans la même bougie ⇒ perte ; gap au-delà du SL exécuté à l'ouverture ; expiration après 36 h. « win » = TP1.
Persistance : `data/journal.json` (désactivable : `BZ_PERSIST=false`).

## Sécurité

* Routes sensibles (`/keys/*`, `/github/*`, `/telegram/*`, `/whatsapp/*`) : en-tête `x-admin-token` = `ADMIN_TOKEN`.
  Sans `ADMIN_TOKEN`, accessibles seulement depuis la machine locale. Le client demande le code une fois (sessionStorage).
* Limiteur de débit par IP, validation des entrées, symboles/intervalles en liste blanche.
* Les secrets restent côté serveur ; seul un aperçu masqué est renvoyé.
* La publication GitHub envoie le code réel (jamais `.env*`, `node_modules`, `data/`) dans un dépôt **privé** par défaut.

## Limites connues

* Gold : Yahoo fournit le contrat future `GC=F` (léger écart de base vs spot).
* Les Kill Zones sont définies en UTC fixe (elles ne suivent pas l'heure d'été) ; le Silver Bullet, lui, suit l'heure de New York.
* La valeur du pip du mode Sniper est une estimation par instrument : vérifie-la chez ton courtier.
* La divergence SMT n'est évaluée qu'en M5 avec une paire corrélée disponible (approximation sur 20 clôtures).
* Les bougies forex Finnhub peuvent nécessiter un plan payant ; le calendrier économique aussi.
* `legacy/` contient d'anciennes pages autonomes, non servies et non auditées.
