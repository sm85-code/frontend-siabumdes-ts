import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'
import Layout from '@/components/Layout'
import Spinner from '@/components/Spinner'
import {
  ROLES_AUDIT_LOG,
  ROLES_COA,
  ROLES_INVENTORY,
  ROLES_LEDGER,
  ROLES_ORG_PROFILE,
  ROLES_REPORTS,
  ROLES_UNIT_USAHA,
  ROLES_USERS,
} from '@/config/roles'
import { AuthProvider, useAuth } from '@/lib/auth'
import type { Role } from '@/types'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const ChangePasswordPage = lazy(() => import('@/pages/ChangePasswordPage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const UnitUsahaPage = lazy(() => import('@/pages/UnitUsahaPage'))
const UsersPage = lazy(() => import('@/pages/UsersPage'))
const AuditLogPage = lazy(() => import('@/pages/AuditLogPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))
const ReportsPerUnitPage = lazy(() => import('@/pages/ReportsPerUnitPage'))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'))
const LedgerPage = lazy(() => import('@/pages/LedgerPage'))
const AccountsPage = lazy(() => import('@/pages/AccountsPage'))
const InventoryPage = lazy(() => import('@/pages/InventoryPage'))
const OrgProfilePage = lazy(() => import('@/pages/OrgProfilePage'))

function PageFallback() {
  return (
    <div className="page-loader">
      <Spinner column size={56} label="Menyiapkan dasbor keuangan..." />
    </div>
  )
}

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary context="page">
      <Suspense fallback={<PageFallback />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageFallback />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace state={{ from: location }} />
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <div className="App">
      <ErrorBoundary context="app">
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                path="/"
                element={
                  <LazyPage>
                    <LandingPage />
                  </LazyPage>
                }
              />
              <Route
                path="/login"
                element={
                  <LazyPage>
                    <LoginPage />
                  </LazyPage>
                }
              />
              <Route
                path="/change-password"
                element={
                  <Protected>
                    <LazyPage>
                      <ChangePasswordPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/profile"
                element={
                  <Protected>
                    <LazyPage>
                      <ProfilePage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <Protected>
                    <LazyPage>
                      <DashboardPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/transactions"
                element={
                  <Protected>
                    <LazyPage>
                      <TransactionsPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/reports"
                element={
                  <Protected roles={ROLES_REPORTS}>
                    <LazyPage>
                      <ReportsPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/reports/per-unit"
                element={
                  <Protected>
                    <LazyPage>
                      <ReportsPerUnitPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/ledger"
                element={
                  <Protected roles={ROLES_LEDGER}>
                    <LazyPage>
                      <LedgerPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/unit-usaha"
                element={
                  <Protected roles={ROLES_UNIT_USAHA}>
                    <LazyPage>
                      <UnitUsahaPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/mitra"
                element={<Navigate to="/dashboard" replace />}
              />
              <Route
                path="/accounts"
                element={
                  <Protected roles={ROLES_COA}>
                    <LazyPage>
                      <AccountsPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/inventory"
                element={
                  <Protected roles={ROLES_INVENTORY}>
                    <LazyPage>
                      <InventoryPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/audit-log"
                element={
                  <Protected roles={ROLES_AUDIT_LOG}>
                    <LazyPage>
                      <AuditLogPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/users"
                element={
                  <Protected roles={ROLES_USERS}>
                    <LazyPage>
                      <UsersPage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route
                path="/profil-bumdes"
                element={
                  <Protected roles={ROLES_ORG_PROFILE}>
                    <LazyPage>
                      <OrgProfilePage />
                    </LazyPage>
                  </Protected>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  )
}
