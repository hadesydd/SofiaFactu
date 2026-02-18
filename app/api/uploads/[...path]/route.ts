import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = join(process.cwd(), "uploads", ...params.path)
    
    // Vérifier que le fichier existe
    if (!existsSync(filePath)) {
      return new NextResponse("Fichier non trouvé", { status: 404 })
    }

    // Lire le fichier
    const file = await readFile(filePath)
    
    // Déterminer le type MIME
    const ext = filePath.split(".").pop()?.toLowerCase()
    let contentType = "application/octet-stream"
    
    switch (ext) {
      case "pdf":
        contentType = "application/pdf"
        break
      case "jpg":
      case "jpeg":
        contentType = "image/jpeg"
        break
      case "png":
        contentType = "image/png"
        break
      case "gif":
        contentType = "image/gif"
        break
    }

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${params.path[params.path.length - 1]}"`,
      },
    })
  } catch (error) {
    console.error("Erreur lors de la lecture du fichier:", error)
    return new NextResponse("Erreur lors de la lecture du fichier", { status: 500 })
  }
}
