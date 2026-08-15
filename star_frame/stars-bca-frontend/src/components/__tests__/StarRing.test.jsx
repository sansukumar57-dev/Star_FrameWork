import { render } from '@testing-library/react'
import StarRing from '../StarRing.jsx'
import { describe, it, expect } from 'vitest'

describe('StarRing smoke', () => {
  it('renders', () => {
    const { container } = render(<StarRing percent={60} expanded={false} trend="up" breakdown={[{ label: 'A', value: 50, display: '10 pts' }]} />)
    expect(container).toBeTruthy()
  })
  it('renders expanded', () => {
    const { container } = render(<StarRing percent={60} expanded trend="down" breakdown={[{ label: 'A', value: 50, display: '10 pts' }]} onToggle={() => {}} />)
    expect(container).toBeTruthy()
  })
})