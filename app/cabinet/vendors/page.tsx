import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, ExternalLink } from "lucide-react"
import Link from "next/link"

async function getVendors() {
  const invoices = await prisma.invoice.findMany({
    where: {
      vendor: { not: null }
    },
    select: {
      vendor: true,
      amount: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  const vendorMap = new Map<string, { 
    name: string; 
    totalAmount: number; 
    invoiceCount: number; 
    pendingCount: number;
    lastInvoice: Date;
  }>()

  for (const invoice of invoices) {
    if (!invoice.vendor) continue
    
    const existing = vendorMap.get(invoice.vendor)
    if (existing) {
      existing.invoiceCount++
      existing.totalAmount += invoice.amount || 0
      if (invoice.status === 'TO_PROCESS' || invoice.status === 'PROCESSING') {
        existing.pendingCount++
      }
      if (invoice.createdAt > existing.lastInvoice) {
        existing.lastInvoice = invoice.createdAt
      }
    } else {
      vendorMap.set(invoice.vendor, {
        name: invoice.vendor,
        totalAmount: invoice.amount || 0,
        invoiceCount: 1,
        pendingCount: (invoice.status === 'TO_PROCESS' || invoice.status === 'PROCESSING') ? 1 : 0,
        lastInvoice: invoice.createdAt
      })
    }
  }

  return Array.from(vendorMap.values()).sort((a, b) => b.invoiceCount - a.invoiceCount)
}

export default async function VendorsPage() {
  const vendors = await getVendors()

  const totalInvoices = vendors.reduce((acc, v) => acc + v.invoiceCount, 0)
  const totalPending = vendors.reduce((acc, v) => acc + v.pendingCount, 0)
  const totalAmount = vendors.reduce((acc, v) => acc + v.totalAmount, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Fournisseurs</h1>
          <p className="text-muted-foreground">
            {vendors.length} fournisseur{vendors.length > 1 ? 's' : ''} • {totalInvoices} facture{totalInvoices > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fournisseurs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendors.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Factures en attente</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Montant Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Liste des fournisseurs</h2>
        </div>
        <div className="divide-y">
          {vendors.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>Aucun fournisseur enregistré</p>
            </div>
          ) : (
            vendors.map((vendor) => (
              <div
                key={vendor.name}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-600 font-semibold">
                      {vendor.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{vendor.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{vendor.invoiceCount} facture{vendor.invoiceCount > 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span>{vendor.totalAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {vendor.pendingCount > 0 && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      {vendor.pendingCount} en attente
                    </Badge>
                  )}
                  <Link href={`/cabinet/invoices?vendor=${encodeURIComponent(vendor.name)}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Voir les factures
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
