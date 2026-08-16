import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../../utils/theme.jsx'
import Shell from '../Shell.jsx'

const renderShell = (props) =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <Shell role="faculty" userName="Priya" department="CS" {...props}>
          <p>page content</p>
        </Shell>
      </ThemeProvider>
    </MemoryRouter>
  )

describe('Shell', () => {
  it('renders role portal title and user name', () => {
    renderShell()
    expect(screen.getByText('Faculty Portal')).toBeInTheDocument()
    expect(screen.getByText('Priya')).toBeInTheDocument()
  })

  it('renders nav links for the role', () => {
    renderShell()
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Review Submissions').length).toBeGreaterThan(0)
  })

  it('shows a badge count when badges are provided', () => {
    renderShell({ badges: { '/faculty/reviews': 3 } })
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
  })

  it('does not show a badge when count is zero', () => {
    renderShell({ badges: { '/faculty/reviews': 0 } })
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('renders children', () => {
    renderShell()
    expect(screen.getByText('page content')).toBeInTheDocument()
  })
})
