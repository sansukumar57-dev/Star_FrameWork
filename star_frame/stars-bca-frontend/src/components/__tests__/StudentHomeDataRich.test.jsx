import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../utils/theme.jsx'
import { ToastProvider } from '../ToastProvider.jsx'
import StudentDashboardHome from '../../pages/StudentDashboardHome.jsx'

const VERTICALS = [
  'Vertical 1 - Academic Performance',
  'Vertical 2 - Innovation & Research',
  'Vertical 3 - Leadership & Governance',
  'Vertical 4 - Community Engagement',
  'Vertical 5 - Cultural & Sports',
  'Vertical 6 - Professional Development',
  'Vertical 7 - Entrepreneurship',
  'Vertical 8 - Global Exposure',
  'Vertical 9 - Social Responsibility',
  'Vertical 10 - Digital Skills',
]

const student = { registerNumber: '2023BCA001', name: 'Arjun', department: 'BCA' }

const activities = VERTICALS.map((v, i) => ({ _id: `act-${i}`, activityName: `Activity ${i + 1}`, vertical: v, maximumPoints: 100 }))

const submissions = VERTICALS.map((v, i) => ({
  _id: `sub-${i}`,
  activityId: { _id: `act-${i}`, activityName: `Activity ${i + 1}` },
  status: 'Approved',
  pointsAwarded: (i + 1) * 10,
  submittedAt: '2026-01-01T00:00:00Z',
  verifiedAt: '2026-01-05T00:00:00Z',
}))

describe('StudentDashboardHome data-rich render', () => {
  beforeEach(() => {
    vi.stubGlobal('getStudentLeaderboard', undefined)
  })

  it('renders with approved submissions across all verticals without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <ToastProvider>
            <StudentDashboardHome
              student={student}
              points={360}
              completed={8}
              pendingTasks={[]}
              pendingReview={2}
              submissions={submissions}
              recent={submissions.slice(0, 4)}
              activities={activities}
            />
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
    expect(screen.queryByText(/Something went wrong/i)).toBeNull()
  })

  it('renders with empty data (no crash)', () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <ToastProvider>
            <StudentDashboardHome
              student={student}
              points={0}
              completed={0}
              pendingTasks={[]}
              pendingReview={0}
              submissions={[]}
              recent={[]}
              activities={[]}
            />
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })
})
