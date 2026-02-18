import { prisma } from "@/lib/prisma";
import { CompanyInvoicesClient } from "./company-invoices-client";

interface Props {
  params: Promise<{ company: string }>;
}

export default async function CompanyInvoicesPage({ params }: Props) {
  const { company } = await params;
  
  const companyMap: Record<string, string> = {
    'sofia-transport': 'SOFIA_TRANSPORT',
    'sofiane-transport': 'SOFIANE_TRANSPORT',
    'garage-expertise': 'GARAGE_EXPERTISE',
  };
  
  const dbCompany = companyMap[company] || company.toUpperCase();

  const invoices = await prisma.invoice.findMany({
    where: { company: dbCompany as any },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const counts = await prisma.invoice.groupBy({
    by: ['status'],
    _count: true,
    where: { company: dbCompany as any },
  });

  const result = {
    total: invoices.length,
    toProcess: counts.find((c) => c.status === "TO_PROCESS")?._count || 0,
    processing: counts.find((c) => c.status === "PROCESSING")?._count || 0,
    processed: counts.find((c) => c.status === "PROCESSED")?._count || 0,
    validated: counts.find((c) => c.status === "VALIDATED")?._count || 0,
  };

  return (
    <CompanyInvoicesClient 
      initialInvoices={invoices.map((inv) => ({
        ...inv,
        createdAt: inv.createdAt.toISOString(),
        date: inv.date?.toISOString() || null,
      }))}
      initialCounts={result}
      companyId={company}
    />
  );
}
