"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { FileText, Users, Settings, LogOut, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function CabinetNav({ user }: { user: any }) {
  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/cabinet" className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl">MonCabinet</span>
            </Link>
            
            <div className="hidden md:flex ml-10 space-x-4">
              <Link
                href="/cabinet"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-900 hover:bg-gray-100"
              >
                <Users className="h-4 w-4" />
                Clients
              </Link>
              <Link
                href="/cabinet/invoices"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <Inbox className="h-4 w-4" />
                Boîte de réception
              </Link>
              <Link
                href="/cabinet/factures"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <FileText className="h-4 w-4" />
                Toutes les factures
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.email}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}
