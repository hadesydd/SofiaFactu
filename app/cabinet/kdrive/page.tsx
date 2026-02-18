import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Cloud, FolderUp, Link2, RefreshCw, Check, AlertCircle } from "lucide-react"

export default function KDrivePage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">kDrive</h1>
          <p className="text-muted-foreground">
            Connectez votre kDrive Infomaniak pour synchroniser vos factures
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Statut</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gray-400"></div>
              <span className="text-sm text-gray-500">Non connecté</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dernière synchro</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-400">-</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fichiers synchronisés</CardTitle>
            <FolderUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Connexion kDrive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-blue-800 font-medium">
                Connectez votre kDrive pour synchroniser automatiquement vos factures
              </p>
              <p className="text-xs text-blue-600">
                kDrive est une solution de stockage cloud suisse proposée par Infomaniak. 
                Vos données sont hébergées en Suisse et bénéficient d'une protection maximale.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Fonctionnalités</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Import automatique des factures
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Synchronisation bidirectionnelle
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Organisation par dossiers
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  OCR automatique sur les nouveaux fichiers
                </li>
              </ul>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium mb-2">Configuration</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-gray-400" />
                  API Token requis
                </li>
                <li className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-gray-400" />
                  Sélection du dossier source
                </li>
                <li className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-gray-400" />
                  Fréquence de synchronisation
                </li>
                <li className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-gray-400" />
                  Gestion des doublons
                </li>
              </ul>
            </div>
          </div>

          <Button className="w-full md:w-auto">
            <Cloud className="mr-2 h-4 w-4" />
            Connecter kDrive
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-600">
            Pour connecter votre kDrive, vous aurez besoin d'un token API Infomaniak.
            Vous pouvez générer ce token depuis votre manager Infomaniak.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="https://manager.infomaniak.com" target="_blank" rel="noopener noreferrer">
                Accéder au Manager Infomaniak
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://api.infomaniak.com/doc" target="_blank" rel="noopener noreferrer">
                Documentation API
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
