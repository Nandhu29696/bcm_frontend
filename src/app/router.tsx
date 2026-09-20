import { createBrowserRouter, Link, Navigate } from 'react-router-dom'

import { page } from '@/app/lazy'

import { AppLayout } from '@/app/AppLayout'
import { ForgotPasswordPage, ResetPasswordPage } from '@/features/auth/PasswordPages'
import { LoginPage } from '@/features/auth/LoginPage'
import { PendingPage } from '@/features/auth/PendingPage'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { SsoCallbackPage } from '@/features/auth/SsoCallbackPage'
import { ROLE } from '@/features/auth/types'
import { HealthPage } from '@/features/system/HealthPage'
import { PlaceholderPage } from '@/features/system/PlaceholderPage'

const ProfilePage = page(() => import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const NotificationLogPage = page(() => import('@/features/admin/NotificationLogPage').then((m) => ({ default: m.NotificationLogPage })))
const UsersPage = page(() => import('@/features/admin/UsersPage').then((m) => ({ default: m.UsersPage })))
const CostCodeListPage = page(() => import('@/features/estates/CostCodeListPage').then((m) => ({ default: m.CostCodeListPage })))
const EstateListPage = page(() => import('@/features/estates/EstateListPage').then((m) => ({ default: m.EstateListPage })))
const PlanEditorPage = page(() => import('@/features/editor/PlanEditorPage').then((m) => ({ default: m.PlanEditorPage })))
const CostCodeDetailPage = page(() => import('@/features/plans/CostCodeDetailPage').then((m) => ({ default: m.CostCodeDetailPage })))
const ReviewQueuePage = page(() => import('@/features/review/ReviewQueuePage').then((m) => ({ default: m.ReviewQueuePage })))
const DashboardPage = page(() => import('@/features/insights/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const HelpPage = page(() => import('@/features/insights/HelpPage').then((m) => ({ default: m.HelpPage })))
const ReportsPage = page(() => import('@/features/insights/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const CrisisEventPage = page(() => import('@/features/operations/CrisisEventPage').then((m) => ({ default: m.CrisisEventPage })))
const CrisisPage = page(() => import('@/features/operations/CrisisPage').then((m) => ({ default: m.CrisisPage })))
const TestDetailPage = page(() => import('@/features/operations/TestDetailPage').then((m) => ({ default: m.TestDetailPage })))
const TestsPage = page(() => import('@/features/operations/TestsPage').then((m) => ({ default: m.TestsPage })))

/**
 * Routes mirror the user journey. Screens arrive with their phase:
 *   Phase 1  /login, /auth/:provider/callback, /forgot-password   [done]
 *   Phase 2  /estates, /estates/:estateId/cost-codes              [done]
 *   Phase 3  /cost-codes/:id  (edit, coordinator, versions, history)   [done]
 *   Phase 4  /plan-versions/:id  (section tabs)                       [done]
 */
export const router = createBrowserRouter([
  // --- public ---
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/auth/:provider/callback', element: <SsoCallbackPage /> },
  {
    path: '/pending',
    element: (
      <ProtectedRoute>
        <PendingPage />
      </ProtectedRoute>
    ),
  },

  // --- authenticated ---
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/estates" replace /> },
      { path: 'estates', element: <EstateListPage /> },
      { path: 'estates/:estateId/cost-codes', element: <CostCodeListPage /> },
      { path: 'cost-codes/:costCodeId', element: <CostCodeDetailPage /> },
      { path: 'plan-versions/:planVersionId', element: <PlanEditorPage /> },
      { path: 'reviews', element: <ReviewQueuePage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'tests', element: <TestsPage /> },
      { path: 'tests/:testId', element: <TestDetailPage /> },
      { path: 'crisis', element: <CrisisPage /> },
      { path: 'crisis/:eventId', element: <CrisisEventPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      {
        path: 'admin/users',
        element: (
          <ProtectedRoute roles={[ROLE.ADMIN]}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin/notifications',
        element: (
          <ProtectedRoute roles={[ROLE.ADMIN]}>
            <NotificationLogPage />
          </ProtectedRoute>
        ),
      },
      { path: 'system/health', element: <HealthPage /> },
      {
        path: '*',
        element: (
          <PlaceholderPage title="Page not found" phase="" description="There is nothing at this address. It may have moved, or the link may be wrong.">
            <Link to="/estates" className="text-sm font-medium text-brand-700 hover:underline">
              Back to estates
            </Link>
          </PlaceholderPage>
        ),
      },
    ],
  },
])
