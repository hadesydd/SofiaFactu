"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  X, 
  Loader2,
  AlertCircle
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FileWithProgress {
  file: File
  id: string
  progress: number
  status: "pending" | "uploading" | "success" | "error"
  error?: string
}

export function ClientUpload({ 
  clientId, 
  clientName,
  cabinetName 
}: { 
  clientId: string
  clientName: string
  cabinetName: string
}) {
  const [files, setFiles] = useState<FileWithProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      progress: 0,
      status: "pending" as const,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const uploadFiles = async () => {
    if (files.length === 0) return
    
    setIsUploading(true)
    
    for (const fileData of files.filter(f => f.status === "pending")) {
      setFiles(prev => prev.map(f => 
        f.id === fileData.id ? { ...f, status: "uploading" } : f
      ))

      try {
        // Créer un FormData pour l'upload
        const formData = new FormData()
        formData.append("file", fileData.file)
        formData.append("clientId", clientId)

        // Simulation de progression
        for (let progress = 0; progress <= 90; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100))
          setFiles(prev => prev.map(f => 
            f.id === fileData.id ? { ...f, progress } : f
          ))
        }

        // Upload réel vers l'API
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error("Erreur lors de l'upload")
        }

        setFiles(prev => prev.map(f => 
          f.id === fileData.id 
            ? { ...f, progress: 100, status: "success" } 
            : f
        ))
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileData.id 
            ? { ...f, status: "error", error: "Erreur lors de l'upload" } 
            : f
        ))
      }
    }

    setIsUploading(false)
  }

  const allUploaded = files.length > 0 && files.every(f => f.status === "success")
  const hasErrors = files.some(f => f.status === "error")

  return (
    <div className="space-y-6">
      {/* Zone de drop */}
      <Card 
        {...getRootProps()} 
        className={`border-2 border-dashed cursor-pointer transition-colors ${
          isDragActive 
            ? "border-blue-500 bg-blue-50" 
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <CardContent className="p-12">
          <input {...getInputProps()} />
          <div className="text-center">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <Upload className="h-12 w-12" />
            </div>
            <p className="mt-4 text-lg font-medium text-gray-900">
              {isDragActive 
                ? "Déposez les fichiers ici" 
                : "Glissez-déposez vos factures ici"
              }
            </p>
            <p className="mt-2 text-sm text-gray-500">
              ou cliquez pour sélectionner des fichiers
            </p>
            <p className="mt-1 text-xs text-gray-400">
              PDF, PNG, JPG jusqu'à 10 Mo
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Liste des fichiers */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-gray-900">
            Fichiers ({files.length})
          </h3>
          
          {files.map((fileData) => (
            <Card key={fileData.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {fileData.file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(fileData.file.size / 1024).toFixed(1)} Ko
                      </p>
                      
                      {fileData.status === "uploading" && (
                        <div className="mt-2">
                          <Progress value={fileData.progress} className="h-2" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {fileData.status === "success" && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {fileData.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    {!isUploading && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(fileData.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {fileData.error && (
                  <p className="mt-2 text-sm text-red-600">
                    {fileData.error}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Alertes */}
      {hasErrors && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Certaines factures n'ont pas pu être uploadées. Veuillez réessayer.
          </AlertDescription>
        </Alert>
      )}

      {allUploaded && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Toutes vos factures ont été envoyées avec succès ! Le cabinet {cabinetName} les recevra sous peu.
          </AlertDescription>
        </Alert>
      )}

      {/* Bouton d'upload */}
      {files.length > 0 && !allUploaded && (
        <Button 
          onClick={uploadFiles} 
          className="w-full"
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Envoyer {files.filter(f => f.status === "pending").length} facture{files.filter(f => f.status === "pending").length > 1 ? 's' : ''}
            </>
          )}
        </Button>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
        <h4 className="font-medium mb-2">Conseils pour de bonnes factures :</h4>
        <ul className="space-y-1 list-disc list-inside">
          <li>Prenez la photo dans un endroit bien éclairé</li>
          <li>Assurez-vous que tous les textes sont lisibles</li>
          <li>Évitez les reflets et les ombres</li>
          <li>Prenez la photo de face (pas en biais)</li>
        </ul>
      </div>
    </div>
  )
}
