import React, { useState, useEffect } from 'react'
import { getSubmissionComments, addSubmissionComment } from '../utils/api.js'
import { Button, Textarea, Spinner } from './UI.jsx'

/* Hallmark · genre: editorial · macrostructure: Workbench · design-system: design.md · designed-as-app */

export default function CommentThread({ submissionId, currentUser }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!submissionId) return
    setLoading(true)
    getSubmissionComments(submissionId)
      .then((res) => setComments(res?.data || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [submissionId])

  async function handleSend() {
    if (!text.trim() || submitting) return
    setSubmitting(true)
    const optimistic = {
      _id: 'temp-' + Date.now(),
      authorName: currentUser?.name || 'You',
      authorRole: currentUser?.role || 'student',
      text: text.trim(),
      createdAt: new Date().toISOString(),
    }
    setComments((prev) => [...prev, optimistic])
    setText('')
    try {
      const res = await addSubmissionComment(submissionId, optimistic.text)
      setComments((prev) => prev.map((c) => c._id === optimistic._id ? (res?.data?.[res.data.length - 1] || optimistic) : c))
    } catch {
      setComments((prev) => prev.filter((c) => c._id !== optimistic._id))
      setText(optimistic.text)
    } finally {
      setSubmitting(false)
    }
  }

  function relativeTime(dateStr) {
    const diff = now - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div className="rounded-lg border border-rule bg-card">
      <div className="border-b border-rule px-4 py-3">
        <p className="font-display text-sm font-semibold text-ink">Comments {comments.length > 0 && <span className="font-mono text-xs text-slate-400">({comments.length})</span>}</p>
      </div>
      <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-4"><Spinner size="sm" /></div>
        ) : comments.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-2">No comments yet</p>
        ) : comments.map((c) => (
          <div key={c._id} className="flex gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[10px] font-semibold text-paper">
              {(c.authorName || '?')[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{c.authorName}</span>
                <span className="rounded-full border border-rule px-1.5 py-0.font-mono text-[9px] uppercase tracking-wider text-slate-400">{c.authorRole}</span>
                <span className="text-[10px] text-slate-400">{relativeTime(c.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-slate-600">{c.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-rule px-4 py-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="mb-2"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSend} disabled={!text.trim() || submitting} loading={submitting}>Send</Button>
        </div>
      </div>
    </div>
  )
}
