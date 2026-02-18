import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ClientUpload } from "./client-upload"

async function getClientByToken(token: string) {
  const client = await prisma.client.findUnique({
    where: { uploadToken: token },
    include: {
      cabinet: {
        select: {
          name: true,
        },
      },
    },
  })
  return client
}

export default async function UploadPage({ params }: { params: { token: string } }) {
  const client = await getClientByToken(params.token)

  if (!client) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Envoi de factures
          </h1>
          <p className="mt-2 text-gray-600">
            {client.cabinet.name} - {client.name}
          </p>
        </div>

        <ClientUpload 
          clientId={client.id} 
          clientName={client.name}
          cabinetName={client.cabinet.name || ""}
        />
      </div>
    </div>
  )
}
