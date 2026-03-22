# EduCRM Africa 🎓

CRM conçu spécifiquement pour les écoles de formation supérieure privées en Afrique subsaharienne.

## Stack technique

- **Frontend**: Next.js 15 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js Server Actions & Route Handlers
- **ORM**: Prisma 6
- **Base de données**: PostgreSQL
- **Auth**: NextAuth.js v5 (Auth.js)
- **Drag & Drop**: @hello-pangea/dnd
- **Charts**: Recharts
- **Notifications**: Sonner

## Démarrage rapide

### Prérequis

- Node.js 20+
- PostgreSQL 15+
- pnpm (recommandé) ou npm

### Installation

```bash
# 1. Cloner le projet
git clone <repo-url>
cd educrm

# 2. Installer les dépendances
pnpm install

# 3. Configurer l'environnement
cp .env.example .env
# → Éditer .env avec votre DATABASE_URL et NEXTAUTH_SECRET

# 4. Générer le secret NextAuth
openssl rand -base64 32
# → Copier la valeur dans NEXTAUTH_SECRET

# 5. Créer la base de données
pnpm db:push

# 6. Seed des données de démo
pnpm db:seed

# 7. Lancer le serveur de développement
pnpm dev
```

### Accès démo

```
Email:    admin@ism-dakar.sn
Password: demo2026
```

## Structure du projet

```
src/
├── app/
│   ├── (auth)/            # Pages login, register
│   ├── (dashboard)/       # Layout avec sidebar
│   │   ├── pipeline/      # Kanban board recrutement
│   │   ├── inbox/         # Messagerie unifiée
│   │   ├── students/      # Gestion étudiants
│   │   ├── payments/      # Suivi paiements
│   │   ├── analytics/     # Dashboards
│   │   └── settings/      # Paramètres
│   └── api/               # Route handlers
├── components/
│   ├── layout/            # Sidebar, Header
│   ├── pipeline/          # KanbanBoard, LeadCard, Modal
│   └── ui/                # StatCard, Badge, Button
├── lib/
│   ├── auth.ts            # NextAuth config
│   ├── prisma.ts          # Prisma client singleton
│   └── utils.ts           # Helpers (formatCFA, dates, etc.)
└── styles/
    └── globals.css        # Tailwind + composants custom
```

## Modules

| Module | Statut | Description |
|--------|--------|-------------|
| Pipeline | ✅ MVP | Kanban drag & drop, lead scoring, CRUD |
| Dashboard | ✅ MVP | Stats, charts, funnel |
| Communication | 🔜 Sprint 2 | WhatsApp API, SMS, inbox unifié |
| Scolarité | 🔜 Sprint 3 | Inscriptions, paiements, notes |
| Reporting | 🔜 Sprint 4 | Dashboards avancés par rôle |

## Déploiement

```bash
# Vercel (recommandé)
vercel deploy

# Ou build manuel
pnpm build
pnpm start
```

## Licence

Propriétaire — © 2026
