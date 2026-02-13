"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function MobileSidebar({
  children,
  role,
  isManager,
}: {
  children: React.ReactNode;
  role?: string;
  isManager?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on navigation
  const handleNavClick = () => setOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-zinc-900">
        <Link href="/dashboard">
          <Image src="/logo-light.png" alt="Prototipalo" width={472} height={236} className="h-18 w-auto dark:hidden" />
          <Image src="/logo-dark.png" alt="Prototipalo" width={472} height={236} className="hidden h-18 w-auto dark:block" />
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {open ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white transition-transform duration-200 ease-in-out md:hidden dark:bg-zinc-900 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
          <Link href="/dashboard" onClick={handleNavClick}>
            <Image src="/logo-light.png" alt="Prototipalo" width={472} height={236} className="h-18 w-auto dark:hidden" />
            <Image src="/logo-dark.png" alt="Prototipalo" width={472} height={236} className="hidden h-18 w-auto dark:block" />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <Link
            href="/dashboard"
            onClick={handleNavClick}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              pathname === "/dashboard"
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Projects
          </Link>
          <Link
            href="/dashboard/shipments"
            onClick={handleNavClick}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              pathname?.startsWith("/dashboard/shipments")
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Envios
          </Link>
          <Link
            href="/dashboard/printers"
            onClick={handleNavClick}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              pathname?.startsWith("/dashboard/printers")
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Printers
          </Link>
          <Link
            href="/dashboard/requests"
            onClick={handleNavClick}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              pathname?.startsWith("/dashboard/requests")
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Solicitudes
          </Link>

          {isManager && (
            <>
              {/* Separator */}
              <div className="my-2 border-t border-zinc-200 dark:border-zinc-800" />
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Compras
              </p>

              <Link
                href="/dashboard/purchases"
                onClick={handleNavClick}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname?.startsWith("/dashboard/purchases")
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                Lista de Compras
              </Link>
              <Link
                href="/dashboard/suppliers"
                onClick={handleNavClick}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname === "/dashboard/suppliers"
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Proveedores
              </Link>
              <Link
                href="/dashboard/suppliers/bank-statement"
                onClick={handleNavClick}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname?.startsWith("/dashboard/suppliers/bank-statement")
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Extracto bancario
              </Link>
            </>
          )}

          {role === "super_admin" && (
            <>
              <div className="my-2 border-t border-zinc-200 dark:border-zinc-800" />
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Admin
              </p>
              <Link
                href="/dashboard/users"
                onClick={handleNavClick}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname?.startsWith("/dashboard/users")
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Usuarios
              </Link>
            </>
          )}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
          {children}
        </div>
      </aside>
    </>
  );
}
