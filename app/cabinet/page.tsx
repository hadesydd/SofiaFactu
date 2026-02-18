import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Building2 } from "lucide-react"
import Link from "next/link"

async function getInvoicesCount() {
  const total = await prisma.invoice.count()
  const pending = await prisma.invoice.count({
    where: {
      status: { in: ['TO_PROCESS', 'PROCESSING'] }
    }
  })
  return { total, pending }
}

async function getVendorsCount() {
  const vendors = await prisma.invoice.findMany({
    where: {
      vendor: { not: null }
    },
    select: {
      vendor: true
    },
    distinct: ['vendor']
  })
  return vendors.length
}

async function getRecentInvoices() {
  return await prisma.invoice.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  })
}

export default async function CabinetPage() {
  const { total: totalInvoices, pending: pendingInvoices } = await getInvoicesCount()
  const vendorsCount = await getVendorsCount()
  const recentInvoices = await getRecentInvoices()

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-gray-600">Gérez vos factures et fournisseurs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Factures</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">
              {pendingInvoices} en attente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvoices}</div>
            <p className="text-xs text-muted-foreground">
              À traiter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fournisseurs</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendorsCount}</div>
            <p className="text-xs text-muted-foreground">
              Différents fournisseurs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Factures récentes</h2>
        </div>
        <div className="divide-y">
          {recentInvoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>Aucune facture pour le moment</p>
              <Link href="/cabinet/invoices" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                Importer une facture
              </Link>
            </div>
          ) : (
            recentInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-600 font-semibold text-sm">
                      {(invoice.vendor || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{invoice.vendor || 'Fournisseur inconnu'}</h3>
                    <p className="text-sm text-gray-500">{invoice.originalName}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {invoice.amount && (
                    <span className="font-medium text-green-600">
                      {invoice.amount.toFixed(2)} €
                    </span>
                  )}
                  {invoice.status === 'TO_PROCESS' || invoice.status === 'PROCESSING' ? (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      À traiter
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Traité
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/cabinet/invoices">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium">Toutes les factures</h3>
                <p className="text-sm text-gray-500">Voir et gérer toutes les factures</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/cabinet/vendors">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium">Fournisseurs</h3>
                <p className="text-sm text-gray-500">Voir la liste des fournisseurs</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
