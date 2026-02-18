import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Wrench, Package, FileText, ArrowRight } from "lucide-react";

const companies = [
  {
    id: "sofia-transport",
    name: "Sofia Transport",
    description: "Transporteur logistique",
    icon: Truck,
    color: "blue",
    dbKey: "SOFIA_TRANSPORT" as const,
  },
  {
    id: "sofiane-transport",
    name: "Sofiane Transport",
    description: "Transporteur logistique",
    icon: Truck,
    color: "orange",
    dbKey: "SOFIANE_TRANSPORT" as const,
  },
  {
    id: "garage-expertise",
    name: "Garage Expertise",
    description: "Réparation et expertise automobile",
    icon: Wrench,
    color: "green",
    dbKey: "GARAGE_EXPERTISE" as const,
  },
];

const colorClasses: Record<string, {
  bg: string;
  icon: string;
  border: string;
  text: string;
}> = {
  blue: {
    bg: "bg-blue-50",
    icon: "bg-blue-100 text-blue-600",
    border: "border-blue-200 hover:border-blue-400",
    text: "text-blue-600",
  },
  orange: {
    bg: "bg-orange-50",
    icon: "bg-orange-100 text-orange-600",
    border: "border-orange-200 hover:border-orange-400",
    text: "text-orange-600",
  },
  green: {
    bg: "bg-green-50",
    icon: "bg-green-100 text-green-600",
    border: "border-green-200 hover:border-green-400",
    text: "text-green-600",
  },
};

export default function CabinetPage() {
  return (
    <div className="space-y-8">
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Bienvenue sur SofiaFactu
        </h1>
        <p className="text-gray-600">
          Sélectionnez une société pour gérer ses factures
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4">
        {companies.map((company) => {
          const colors = colorClasses[company.color];
          const Icon = company.icon;
          
          return (
            <Link 
              key={company.id} 
              href={`/cabinet/${company.id}`}
              className="block"
            >
              <Card className={`${colors.border} border-2 transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer h-full`}>
                <CardHeader className={`${colors.bg} pb-4`}>
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl ${colors.icon}`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <ArrowRight className={`h-5 w-5 ${colors.text}`} />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <CardTitle className="text-xl mb-1">{company.name}</CardTitle>
                  <p className="text-sm text-gray-500">{company.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="text-center mt-12">
        <p className="text-sm text-gray-400">
          Chaque société dispose de son propre coffre de factures.
          <br />
          Les factures sont automatiquement triées par l'OCR.
        </p>
      </div>
    </div>
  );
}
