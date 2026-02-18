import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Pour le MVP, on laisse passer toutes les requêtes
  // L'authentification sera gérée côté page
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
