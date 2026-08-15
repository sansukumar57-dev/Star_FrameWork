import React from 'react'
import { Button } from './UI.jsx'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className="w-full max-w-md rounded-lg border border-rose-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 font-mono text-lg text-rose-600">!</div>
          <h1 className="mt-3 font-display text-lg font-semibold text-ink">Something went wrong</h1>
          <p className="mt-2 break-words font-mono text-xs leading-relaxed text-slate-500">
            {this.state.error.message || String(this.state.error)}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Reload page</Button>
            <Button variant="ghost" onClick={() => this.setState({ error: null })}>Try again</Button>
          </div>
        </div>
      </div>
    )
  }
}
