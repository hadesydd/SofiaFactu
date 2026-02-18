import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeFile } from "fs/promises"
import { mkdir } from "fs/promises"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const clientId = formData.get("clientId") as string

    if (!file || !clientId) {
      return NextResponse.json(
        { error: "Fichier ou client manquant" },
        { status: 400 }
      )
    }

    // Vérifier que le client existe
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!client) {
      return NextResponse.json(
        { error: "Client non trouvé" },
        { status: 404 }
      )
    }

    // Créer le dossier d'upload s'il n'existe pas
    const uploadDir = join(process.cwd(), "uploads", clientId)
    await mkdir(uploadDir, { recursive: true })

    // Générer un nom de fichier unique
    const fileExtension = file.name.split(".").pop()
    const fileName = `${uuidv4()}.${fileExtension}`
    const filePath = join(uploadDir, fileName)

    // Écrire le fichier
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // URL publique du fichier (à adapter selon votre configuration)
    const fileUrl = `/uploads/${clientId}/${fileName}`

    // Créer l'entrée dans la base de données
    const facture = await prisma.facture.create({
      data: {
        clientId,
        filename: fileName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        url: fileUrl,
        status: "EN_ATTENTE",
      },
    })

    return NextResponse.json({
      success: true,
      facture: {
        id: facture.id,
        url: fileUrl,
        originalName: facture.originalName,
      },
    })
  } catch (error) {
    console.error("Erreur upload:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'upload" },
      { status: 500 }
    )
  }
}
