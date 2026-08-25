# Hôtel El Aziz — Backend (Node.js + Express + PostgreSQL + JWT)

API pour le site de l'Hôtel El Aziz : chambres, réservations avec vérification
réelle de disponibilité, offres, comptes clients et authentification admin.

## Installation

Prérequis : Node.js 18+ et PostgreSQL installés (localement ou via un service
comme Render / Railway / Supabase).

```bash
npm install
cp .env.example .env
# → éditez .env : DATABASE_URL, JWT_SECRET, etc.

npm run db:migrate   # crée les tables
npm run db:seed      # insère les 5 chambres, des offres, et le compte admin
npm run dev           # démarre le serveur sur http://localhost:4000
```

Le compte admin créé par le seed utilise `SEED_ADMIN_USERNAME` /
`SEED_ADMIN_PASSWORD` définis dans `.env` (par défaut `admin` / `changeme123`
— **à changer avant toute mise en production**).

## Endpoints

### Chambres (public)
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/rooms` | Liste des 5 chambres |
| GET | `/api/rooms/:slug` | Détail d'une chambre |
| GET | `/api/rooms/:slug/availability?checkin=&checkout=` | Disponibilité réelle sur une période |

### Réservations
| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/bookings` | — | Créer une réservation (vérifie la disponibilité avant d'insérer) |
| GET | `/api/bookings/:reservationNumber` | — | Suivre une réservation par son numéro (ELAZIZ-XXXXXX) |
| GET | `/api/bookings/mine` | client | Réservations du client connecté |
| GET | `/api/bookings?status=` | admin | Liste toutes les réservations |
| PATCH | `/api/bookings/:id` | admin | Changer le statut / paiement |

### Offres (public)
| GET | `/api/offers` | Offres actives |

### Comptes clients
| POST | `/api/auth/register` | Créer un compte |
| POST | `/api/auth/login` | Connexion, retourne un JWT |
| GET | `/api/auth/me` | client — profil courant |

### Administration
| POST | `/api/admin/login` | Connexion admin, retourne un JWT |
| GET | `/api/admin/me` | admin — vérifie le token |
| GET | `/api/admin/stats` | admin — chiffres du tableau de bord |

Pour les routes protégées, envoyez le token dans l'en-tête :
```
Authorization: Bearer <token>
```

## Comment la disponibilité fonctionne

Chaque type de chambre a un `total_units` (nombre d'unités physiques de ce
type dans l'hôtel, ex. 8 "Chambre Double"). À chaque demande de réservation,
l'API additionne les `rooms_count` des réservations existantes qui se
chevauchent avec les dates demandées, et refuse la réservation si le nombre
d'unités déjà prises + demandées dépasse `total_units`. C'est fait dans une
transaction avec verrou (`FOR UPDATE`) pour éviter les doubles réservations
simultanées.

## Connecter le frontend React

Dans le projet frontend, remplacez les données statiques
(`src/data/rooms.js`) par des appels à cette API, par exemple :

```js
const res = await fetch('http://localhost:4000/api/rooms')
const rooms = await res.json()
```

Pensez à définir `CORS_ORIGIN` dans `.env` sur l'URL du frontend
(`http://localhost:5173` en développement).
