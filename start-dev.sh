#!/bin/bash

echo "🚀 Démarrage du MVP Collecte Factures..."
echo ""

# Vérifier si on est dans le bon dossier
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: Vous devez être dans le dossier my-app"
    exit 1
fi

# Vérifier si PostgreSQL est disponible
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL n'est pas installé. Veuillez l'installer:"
    echo "   Ubuntu/Debian: sudo apt-get install postgresql"
    echo "   macOS: brew install postgresql"
    echo "   Windows: Télécharger depuis https://www.postgresql.org/download/windows/"
    exit 1
fi

echo "📦 Installation des dépendances..."
npm install

echo ""
echo "🔧 Configuration de Prisma..."
npx prisma generate

# Vérifier si la base de données existe
echo ""
echo "🗄️  Vérification de la base de données..."
if psql -U postgres -lqt | cut -d \| -f 1 | grep -qw factures_mvp; then
    echo "✅ Base de données factures_mvp existe déjà"
else
    echo "🆕 Création de la base de données..."
    createdb -U postgres factures_mvp
fi

echo ""
echo "📊 Migration de la base de données..."
npx prisma db push --accept-data-loss

echo ""
echo "🌱 Peuplement de la base de données..."
node prisma/seed.js

echo ""
echo "✅ Configuration terminée !"
echo ""
echo "🚀 Lancement du serveur de développement..."
echo ""
echo "📱 L'application sera disponible sur http://localhost:3000"
echo ""
echo "🔐 Comptes de démonstration:"
echo "   Cabinet: cabinet@demo.com / demo123"
echo "   Client:  client@demo.com / demo123"
echo ""

npm run dev
