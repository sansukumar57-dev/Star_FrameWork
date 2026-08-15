import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../utils/theme.jsx'
import { ToastProvider } from '../ToastProvider.jsx'
import StudentDashboardHome from '../../pages/StudentDashboardHome.jsx'

const student = { registerNumber: '2023BCA001', name: 'Arjun' }
const submissions = [
  { _id: '1', activityId: { _id: 'a1', activityName: 'Internship' }, status: 'Approved', pointsAwarded: 50, submittedAt: '2026-01-01T00:00:00Z', verifiedAt: '2026-01-05T00:00:00Z' },
]
const activities = [{ _id: 'a1', activityName: 'Internship', vertical: 'Vertical 1 - Academic Performance', maximumPoints: 100 }]

describe('StudentDashboardHome smoke', () => {
  it('renders with data', () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <ToastProvider>
            <StudentDashboardHome
              student={student}
              points={50}
              completed={1}
              pendingTasks={[]}
              pendingReview={0}
              submissions={submissions}
              recent={submissions}
              activities={activities}
            />
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>
    )
    expect(container).toBeTruthy()
  })
})