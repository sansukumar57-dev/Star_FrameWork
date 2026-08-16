import React, { useEffect, useState } from 'react'
import kprcasLogo from '../assets/kprcas.jpg'
import './LoadingScreen.css'

function getDepartment() {
  try {
    const raw = localStorage.getItem('stars_user')
    const user = raw ? JSON.parse(raw) : null
    return user?.department || user?.departmentName || user?.school || 'BCA'
  } catch {
    return 'BCA'
  }
}

export default function LoadingScreen({ onComplete, department: departmentProp }) {
  const [progress, setProgress] = useState(0)
  const department = departmentProp || getDepartment()

  useEffect(() => {
    const duration = 2500
    const intervalTime = 30
    const increment = 100 / (duration / intervalTime)

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment

        if (next >= 100) {
          clearInterval(interval)

          setTimeout(() => {
            onComplete?.()
          }, 300)

          return 100
        }

        return next
      })
    }, intervalTime)

    return () => clearInterval(interval)
  }, [onComplete])

  return (
    <div className="loading-screen">
      <div className="loader-content">
        <div className="loader-main">
          <div className="logo-container" aria-hidden="true">
            <div className="orbit orbit-one">
              <span className="orbit-dot blue-dot" />
            </div>

            <div className="orbit orbit-two">
              <span className="orbit-dot green-dot" />
            </div>

            <img src={kprcasLogo} alt="" className="kprcas-logo" />
          </div>

          <div className="brand">
            <p className="brand-college">KPR College of Arts Science and Research</p>
            <h1 className="brand-title">STARS-{department}</h1>
            <div className="brand-line" aria-hidden="true" />
            <p className="brand-tagline">Learn Beyond</p>
          </div>
        </div>

        <div
          className="progress"
          role="progressbar"
          aria-label="Loading STARS-BCA"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(progress)}
        >
          <div className="progress-track">
            <div className="progress-bar" style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <span className="progress-value">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  )
}
