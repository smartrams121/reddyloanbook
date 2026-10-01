'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { AuthUser } from '@/lib/auth'
import { Role } from '@/lib/constants'

interface AppShellProps {
  user: AuthUser
  children: React.ReactNode
}

interface BusinessInfo {
  id: string
  name: string
  city: string
}

export default function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [businesses, setBusinesses] = useState<BusinessInfo[]>([])
  const [pendingRegCount, setPendingRegCount] = useState(0)
  const [pendingResetCount, setPendingResetCount] = useState(0)

  const businessMatch = pathname.match(/^\/b\/([^/]+)/)
  const activeBusinessId = businessMatch?.[1] || user.activeBusinessId

  useEffect(() => {
    if (user.role === Role.OWNER) {
      fetch('/api/owner/businesses')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setBusinesses(data)
        })
        .catch(() => {})
    }
    if (user.role === Role.PLATFORM_ADMIN) {
      fetch('/api/admin/registration-requests/pending-count')
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.count === 'number') setPendingRegCount(data.count)
        })
        .catch(() => {})
      fetch('/api/admin/password-resets/pending-count')
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.count === 'number') setPendingResetCount(data.count)
        })
        .catch(() => {})
    }
    if (user.role === Role.OWNER) {
      fetch('/api/owner/password-resets/pending-count')
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.count === 'number') setPendingResetCount(data.count)
        })
        .catch(() => {})
    }
  }, [user.role])

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function handleBusinessSwitch(businessId: string) {
    if (businessId === '') {
      router.push('/dashboard')
    } else {
      router.push(`/b/${businessId}/dashboard`)
    }
  }

  const isOwnerOrAdmin = user.role === Role.OWNER || user.role === Role.BUSINESS_ADMIN

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 no-print">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            {/* Hamburger — All Features menu */}
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="All Features"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">₹</span>
              </div>
              <span className="font-semibold text-gray-900 hidden sm:block">Daily Finance</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick-link icons when a business is active */}
            {activeBusinessId && (
              <div className="flex items-center gap-1 mr-2">
                <Link href={`/b/${activeBusinessId}/customers`} className="flex flex-col items-center px-2 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title="Customers">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                  </svg>
                  <span className="text-[10px] leading-tight font-medium">Customers</span>
                </Link>
                <Link href={`/b/${activeBusinessId}/loans`} className="flex flex-col items-center px-2 py-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors" title="Loans">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                  </svg>
                  <span className="text-[10px] leading-tight font-medium">Loans</span>
                </Link>
                <Link href={`/b/${activeBusinessId}/posting`} className="flex flex-col items-center px-2 py-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors" title="Payments">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span className="text-[10px] leading-tight font-medium">Payments</span>
                </Link>
                <Link href={`/b/${activeBusinessId}/reports`} className="flex flex-col items-center px-2 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors" title="Reports">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <span className="text-[10px] leading-tight font-medium">Reports</span>
                </Link>
                <Link href={`/b/${activeBusinessId}/dashboard`} className="flex flex-col items-center px-2 py-1.5 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors" title="Dashboard">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                  </svg>
                  <span className="text-[10px] leading-tight font-medium">Dashboard</span>
                </Link>
              </div>
            )}

            {/* Business switcher for owners — right side */}
            {user.role === Role.OWNER && businesses.length > 0 && (
              <select
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-700 max-w-[140px]"
                value={activeBusinessId || ''}
                onChange={(e) => handleBusinessSwitch(e.target.value)}
              >
                <option value="">Select Business</option>
                {businesses.map((biz) => (
                  <option key={biz.id} value={biz.id}>
                    {biz.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-700 hidden sm:block">{user.fullName}</span>
            </button>
          </div>
        </div>

        {/* Profile dropdown */}
        {menuOpen && (
          <div className="absolute right-4 top-14 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
              <p className="text-xs text-gray-500">{user.role.replace(/_/g, ' ')}</p>
            </div>
            <Link
              href="/profile"
              onClick={() => setMenuOpen(false)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Profile & Settings
            </Link>
            <Link
              href="/contact-us"
              onClick={() => setMenuOpen(false)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Contact Us
            </Link>
            <Link
              href="/faq"
              onClick={() => setMenuOpen(false)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              FAQ
            </Link>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-danger-600 hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Slide-out All Features Nav */}
      {navOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setNavOpen(false)} />
          <nav className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200">
              <span className="font-semibold text-gray-900">All Features</span>
              <button onClick={() => setNavOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="py-2">
              {/* Owner-level links */}
              {user.role === Role.OWNER && (
                <NavSection title="Owner">
                  <NavLink href="/businesses/new" icon="➕" label="Register New Business" active={pathname === '/businesses/new'} />
                  {activeBusinessId && (
                    <NavLink href={`/b/${activeBusinessId}/users`} icon="👤" label="Manage Employees" active={pathname.startsWith(`/b/${activeBusinessId}/users`)} />
                  )}
                  <NavLink href="/password-resets" icon="🔑" label="Password Resets" active={pathname.startsWith('/password-resets')} badge={pendingResetCount} />
                </NavSection>
              )}

              {/* Business-scoped links — only when a business is selected */}
              {activeBusinessId && (
                <NavSection title={businesses.find(b => b.id === activeBusinessId)?.name || 'Business'}>
                  <NavLink href={`/b/${activeBusinessId}/villages`} icon="🏘️" label="Add Locations" active={pathname.startsWith(`/b/${activeBusinessId}/villages`)} />
                  {isOwnerOrAdmin && (
                    <>
                      <NavLink href={`/b/${activeBusinessId}/customers/new`} icon="➕" label="New Customer" active={pathname === `/b/${activeBusinessId}/customers/new`} />
                      <NavLink href={`/b/${activeBusinessId}/loans/new`} icon="📝" label="New Loan" active={pathname === `/b/${activeBusinessId}/loans/new`} />
                    </>
                  )}
                  <NavLink href={`/b/${activeBusinessId}/posting`} icon="💰" label="Record Payment" active={pathname === `/b/${activeBusinessId}/posting`} />
                  <NavLink href={`/b/${activeBusinessId}/posting/bulk`} icon="📋" label="Bulk Posting" active={pathname === `/b/${activeBusinessId}/posting/bulk`} />
                  {isOwnerOrAdmin && (
                    <>
                      <NavLink href={`/b/${activeBusinessId}/reports`} icon="📑" label="Reports" active={pathname.startsWith(`/b/${activeBusinessId}/reports`)} />
                      <NavLink href={`/b/${activeBusinessId}/settings`} icon="⚙️" label="Business Settings" active={pathname === `/b/${activeBusinessId}/settings`} />
                    </>
                  )}
                </NavSection>
              )}

              {/* If no business selected, prompt */}
              {!activeBusinessId && user.role !== Role.PLATFORM_ADMIN && (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-gray-500 mb-2">Select a business from the top-right dropdown to see all features.</p>
                </div>
              )}

              {/* Platform Admin links */}
              {user.role === Role.PLATFORM_ADMIN && (
                <NavSection title="Platform Admin">
                  <NavLink href="/admin/owners" icon="👥" label="Manage Owners" active={pathname.startsWith('/admin/owners')} />
                  <NavLink href="/admin/registration-requests" icon="📋" label="Registration Requests" active={pathname.startsWith('/admin/registration-requests')} badge={pendingRegCount} />
                  <NavLink href="/admin/password-resets" icon="🔑" label="Password Resets" active={pathname.startsWith('/admin/password-resets')} badge={pendingResetCount} />
                  <NavLink href="/admin/platform-settings" icon="⚙️" label="Platform Settings" active={pathname.startsWith('/admin/platform-settings')} />
                  <NavLink href="/profile" icon="👤" label="My Profile" active={pathname === '/profile'} />
                </NavSection>
              )}
            </div>
          </nav>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-4">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {activeBusinessId && user.role !== Role.PLATFORM_ADMIN && (
        <MobileBottomNav
          businessId={activeBusinessId}
          role={user.role}
          pathname={pathname}
        />
      )}

      {/* Click-outside to close profile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
      )}
    </div>
  )
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <p className="px-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
      {children}
    </div>
  )
}

function NavLink({ href, icon, label, active, badge }: { href: string; icon: string; label: string; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
        active ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
          {badge}
        </span>
      )}
    </Link>
  )
}

function MobileBottomNav({
  businessId,
  role,
  pathname,
}: {
  businessId: string
  role: Role
  pathname: string
}) {
  const base = `/b/${businessId}`

  const navItems = [
    { href: `${base}/dashboard`, label: 'Home', icon: HomeIcon },
    { href: `${base}/posting`, label: 'Collect', icon: CollectIcon },
    { href: `${base}/posting/bulk`, label: 'Bulk', icon: BulkIcon },
    { href: `${base}/more`, label: 'More', icon: MoreIcon },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 md:hidden no-print safe-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg min-w-[60px] ${
                isActive ? 'text-primary-600' : 'text-gray-500'
              }`}
            >
              <item.icon active={isActive} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function CollectIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function BulkIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
    </svg>
  )
}

function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  )
}
