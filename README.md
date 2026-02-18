# Collecte Factures - MVP Cabinet Comptable

Plateforme de collecte de factures pour cabinets comptables, inspirée d'Émargence et Dext.

## 🚀 Stack Technique Moderne

- **Next.js 14** (App Router, Server Actions)
- **TypeScript** - Typage statique
- **Tailwind CSS** + **shadcn/ui** - UI moderne et accessible
- **PostgreSQL** + **Prisma ORM** - Base de données relationnelle
- **NextAuth.js v5** - Authentification sécurisée
- **React Dropzone** - Upload drag & drop
- **date-fns** - Manipulation des dates

## 📋 Prérequis

- Node.js 18+ (recommandé 20+)
- PostgreSQL (local ou cloud)
- npm ou yarn

## 🛠️ Installation

### 1. Cloner et installer

```bash
cd factures-mvp/my-app
npm install
```

### 2. Configurer la base de données

Créer un fichier `.env` à la racine:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/factures_mvp"

# NextAuth
AUTH_SECRET="votre-secret-tres-securise-ici-minimum-32-caracteres"
NEXTAUTH_URL="http://localhost:3000"
```

Créer la base de données PostgreSQL:
```bash
# Avec psql
createdb factures_mvp

# Ou avec pgAdmin, créer manuellement la base
```

### 3. Initialiser Prisma

```bash
# Générer le client Prisma
npx prisma generate

# Créer les tables
npx prisma migrate dev --name init

# OU push direct (pour dev rapide)
npx prisma db push
```

### 4. Peupler la base de données

```bash
node prisma/seed.js
```

Cela crée:
- 1 compte cabinet: `cabinet@demo.com` / `demo123`
- 1 compte client: `client@demo.com` / `demo123`
- 3 clients fictifs pour le cabinet

### 5. Lancer le serveur de développement

```bash
npm run dev
```

L'application est disponible sur **http://localhost:3000**

## 🎯 Fonctionnalités

### ✅ Déjà implémentées

1. **Authentification** - Login cabinet & client séparés
2. **Dashboard Cabinet** - Vue d'ensemble des clients
3. **Gestion Clients** - CRUD clients avec informations
4. **Upload de factures** - Drag & drop avec preview
5. **Lien d'upload public** - Token sécurisé pour clients sans compte
6. **Liste des factures** - Triées par client avec statut

### 🚧 À venir

- Export ZIP des factures
- OCR automatique des factures
- Notifications email
- Dashboard client avec historique
- API pour intégration comptable

## 📁 Structure du projet

```
my-app/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # Authentification
│   │   └── upload/               # API upload fichiers
│   ├── cabinet/                  # Espace cabinet
│   │   ├── clients/[id]/         # Détail client
│   │   └── page.tsx              # Dashboard
│   ├── client/                   # Espace client (à venir)
│   ├── upload/[token]/           # Page upload public
│   ├── login/                    # Page de connexion
│   └── layout.tsx                # Layout racine
├── components/
│   ├── ui/                       # Composants shadcn
│   ├── cabinet-nav.tsx           # Navigation cabinet
│   └── providers.tsx             # Providers React
├── lib/
│   ├── prisma.ts                 # Client Prisma
│   └── auth/                     # Config auth
├── prisma/
│   ├── schema.prisma             # Schéma DB
│   └── seed.js                   # Données initiales
└── public/                       # Fichiers statiques
```

## 🔐 Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| cabinet@demo.com | demo123 | Cabinet comptable |
| client@demo.com | demo123 | Client (compte utilisateur) |

## 🎨 Architecture des données

### Modèles Principaux

**User** (CABINET | CLIENT)
- Cabinet: peut créer des clients, voir toutes les factures
- Client: peut uploader ses propres factures

**Client** (Entreprise cliente)
- Appartient à un cabinet
- A un token d'upload unique
- Peut avoir un compte utilisateur associé

**Facture**
- Appartient à un client
- Stockage local (fichier) + métadonnées DB
- Statut: EN_ATTENTE | TRAITEE | ARCHIVEE

## 🚀 Déploiement

### Build de production

```bash
npm run build
npm start
```

### Variables d'environnement production

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="secret-production"
NEXTAUTH_URL="https://votre-domaine.com"

# Optionnel: AWS S3 pour stockage cloud
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="eu-west-3"
AWS_S3_BUCKET_NAME="votre-bucket"

# Optionnel: Email
RESEND_API_KEY="..."
```

## 🐛 Dépannage

### Erreur "Prisma Client could not be found"
```bash
npx prisma generate
```

### Erreur de connexion à la base
Vérifiez que PostgreSQL est démarré et que DATABASE_URL est correct.

### Upload ne fonctionne pas
Vérifiez que le dossier `uploads/` existe et est accessible en écriture.

## 📝 Notes de développement

- Les uploads sont stockés localement dans `/uploads/` (MVP)
- Pour la production, migrer vers AWS S3 ou équivalent
- Le mot de passe est en clair "demo123" pour le MVP (à remplacer par bcrypt)
- Les liens d'upload public utilisent des tokens UUID uniques

## 🤝 Contribution

Ce projet est un MVP. Pour étendre:
1. Fork le repo
2. Créer une branche: `git checkout -b feature/nouvelle-fonctionnalite`
3. Commit: `git commit -am 'Ajout feature'`
4. Push: `git push origin feature/nouvelle-fonctionnalite`
5. Créer une Pull Request

## 📄 Licence

MIT - Libre d'utilisation pour votre cabinet comptable.

---

**Développé avec ❤️ pour simplifier la vie des cabinets comptables**
