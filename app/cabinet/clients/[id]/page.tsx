import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Download, 
  FileText, 
  CheckCircle, 
  Clock,
  Mail,
  Building,
  Eye
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

async function getClient(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      factures: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  })
  return client
}

async function getVendorInvoices(vendorName: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      vendor: vendorName
    },
    orderBy: {
      createdAt: "desc",
    },
  })
  return invoices
}

export default async function ClientPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id)

  if (!client) {
    notFound()
  }

  const facturesEnAttente = client.factures.filter(f => f.status === "EN_ATTENTE")
  const facturesTraitees = client.factures.filter(f => f.status === "TRAITEE")
  
  // Get invoices for this vendor (if it's a vendor)
  const vendorInvoices = client.name ? await getVendorInvoices(client.name) : []
  const invoicesPending = vendorInvoices.filter(i => i.status === "TO_PROCESS" || i.status === "PROCESSING")
  const invoicesProcessed = vendorInvoices.filter(i => i.status === "PROCESSED" || i.status === "VALIDATED")

  // Generate upload link for client
  const uploadLink = `${process.env.NEXT_PUBLIC_NEXTAUTH_URL || 'http://localhost:3000'}/upload/${client.uploadToken}`

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/cabinet">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            {client.name}
            {vendorInvoices.length > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                <Building className="mr-1 h-3 w-3" />
                Fournisseur
              </Badge>
            )}
          </h1>
          {client.email && <p className="text-gray-600">{client.email}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client information */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold text-lg">Informations</h2>
            
            {client.siret && (
              <div>
                <p className="text-sm text-gray-500">SIRET</p>
                <p className="font-medium font-mono">{client.siret}</p>
              </div>
            )}
            
            {client.adresse && (
              <div>
                <p className="text-sm text-gray-500">Adresse</p>
                <p className="font-medium">{client.adresse}</p>
                {client.codePostal && client.ville && (
                  <p className="font-medium">{client.codePostal} {client.ville}</p>
                )}
              </div>
            )}
            
            {client.telephone && (
              <div>
                <p className="text-sm text-gray-500">Téléphone</p>
                <p className="font-medium">{client.telephone}</p>
              </div>
            )}

            {/* Show vendor info if this is a vendor */}
            {vendorInvoices.length > 0 && vendorInvoices[0]?.vendor && (
              <div>
                <p className="text-sm text-gray-500">Fournisseur</p>
                <p className="font-medium text-sm">{vendorInvoices[0]?.vendor}</p>
              </div>
            )}

            <Separator />

            <div>
              <p className="text-sm text-gray-500 mb-2">Lien d&apos;upload client</p>
              <a 
                href={uploadLink}
                target="_blank"
                className="block bg-gray-100 p-2 rounded text-xs text-blue-600 hover:underline truncate"
              >
                {uploadLink}
              </a>
              <p className="text-xs text-gray-500 mt-2">
                Partagez ce lien avec votre client pour uploader ses factures
              </p>
            </div>

            <Button variant="outline" className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Envoyer par email
            </Button>
          </CardContent>
        </Card>

        {/* Invoices list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vendor Invoices (from Invoice model) */}
          {vendorInvoices.length > 0 && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-lg">
                  Factures fournisseurs ({vendorInvoices.length})
                </h2>
                {invoicesPending.length > 0 && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                    <Clock className="mr-1 h-3 w-3" />
                    {invoicesPending.length} en attente
                  </Badge>
                )}
              </div>

              <div className="space-y-3">
                {vendorInvoices.map((invoice) => (
                  <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {invoice.originalName}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>{(invoice.size / 1024).toFixed(1)} Ko</span>
                              <span>•</span>
                              <span>
                                {format(new Date(invoice.createdAt), "dd MMMM yyyy", { locale: fr })}
                              </span>
                              {invoice.vendor && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono">{invoice.vendor}</span>
                                </>
                              )}
                            </div>
                            {invoice.amount && (
                              <p className="text-sm font-medium text-green-600">
                                {invoice.amount.toFixed(2)} €
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {invoice.status === "TO_PROCESS" || invoice.status === "PROCESSING" ? (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              <Clock className="mr-1 h-3 w-3" />
                              À traiter
                            </Badge>
                          ) : invoice.status === "PROCESSED" || invoice.status === "VALIDATED" ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Traitée
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-red-100 text-red-800">
                              Erreur
                            </Badge>
                          )}
                          
                          {invoice.confidence && (
                            <span className={`text-xs px-2 py-1 rounded ${
                              invoice.confidence >= 80 ? 'bg-green-100 text-green-700' :
                              invoice.confidence >= 50 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {invoice.confidence}%
                            </span>
                          )}
                          
                          <Link href={invoice.filePath} target="_blank">
                            <Button variant="outline" size="sm">
                              <Eye className="mr-1 h-3 w-3" />
                              Voir
                            </Button>
                          </Link>
                          <Link href={invoice.filePath} target="_blank">
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Regular client invoices (from Facture model) */}
          {client.factures.length > 0 && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-lg">
                  Factures ({client.factures.length})
                </h2>
                {facturesEnAttente.length > 0 && (
                  <Button>
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger toutes ({facturesEnAttente.length})
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {client.factures.map((facture) => (
                  <Card key={facture.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {facture.originalName}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>{(facture.size / 1024).toFixed(1)} Ko</span>
                              <span>•</span>
                              <span>
                                {format(new Date(facture.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}
                              </span>
                            </div>
                            {facture.montant && (
                              <p className="text-sm font-medium text-green-600">
                                {facture.montant.toFixed(2)} €
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {facture.status === "EN_ATTENTE" ? (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                              <Clock className="mr-1 h-3 w-3" />
                              En attente
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Traitée
                            </Badge>
                          )}
                          
                          <Link href={facture.url} target="_blank">
                            <Button variant="outline" size="sm">
                              Voir
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* No invoices */}
          {vendorInvoices.length === 0 && client.factures.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500">Aucune facture pour le moment</p>
                <p className="text-sm text-gray-400 mt-2">
                  Le client n'a pas encore uploadé de factures
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
