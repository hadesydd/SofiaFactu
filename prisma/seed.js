const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

// Generate UUID v4 using crypto
function uuidv4() {
  return crypto.randomUUID()
}

async function main() {
  console.log('🌱 Seeding database...')

  // Créer le cabinet comptable
  const cabinet = await prisma.user.upsert({
    where: { email: 'cabinet@demo.com' },
    update: {},
    create: {
      email: 'cabinet@demo.com',
      name: 'Cabinet Comptable Demo',
      role: 'CABINET',
    },
  })
  console.log('✅ Cabinet créé:', cabinet.email)

  // Créer un compte client
  const clientUser = await prisma.user.upsert({
    where: { email: 'client@demo.com' },
    update: {},
    create: {
      email: 'client@demo.com',
      name: 'Jean Dupont',
      role: 'CLIENT',
    },
  })
  console.log('✅ Client user créé:', clientUser.email)

  // Créer des clients pour le cabinet
  const clients = [
    {
      name: 'Boulangerie Martin',
      email: 'contact@boulangerie-martin.fr',
      siret: '12345678900012',
      adresse: '15 Rue de la République',
      codePostal: '75001',
      ville: 'Paris',
      telephone: '01 23 45 67 89',
      userId: clientUser.id,
    },
    {
      name: 'Entreprise Dupont SARL',
      email: 'contact@dupont-sarl.fr',
      siret: '98765432100021',
      adresse: '42 Avenue des Champs-Élysées',
      codePostal: '75008',
      ville: 'Paris',
      telephone: '01 98 76 54 32',
    },
    {
      name: 'Agence Immo Plus',
      email: 'contact@agence-immoplus.fr',
      siret: '45678912300034',
      adresse: '8 Boulevard Haussmann',
      codePostal: '75009',
      ville: 'Paris',
      telephone: '01 45 67 89 01',
    },
  ]

  for (const clientData of clients) {
    const client = await prisma.client.create({
      data: {
        ...clientData,
        cabinetId: cabinet.id,
        uploadToken: uuidv4(),
      },
    })
    console.log('✅ Client créé:', client.name)
  }

  console.log('\n🎉 Database seeded successfully!')
  console.log('\nComptes de démonstration:')
  console.log('- Cabinet: cabinet@demo.com / demo123')
  console.log('- Client: client@demo.com / demo123')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
