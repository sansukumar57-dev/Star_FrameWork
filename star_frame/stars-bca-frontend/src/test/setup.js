import '@testing-library/jest-dom/vitest'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverMock

class DOMMatrixReadOnlyMock {
  constructor(transform) {
    if (transform && transform.includes('matrix')) {
      const values = transform.replace('matrix(', '').replace(')', '').split(',').map(Number)
      this.a = values[0]
      this.b = values[1]
      this.c = values[2]
      this.d = values[3]
      this.e = values[4]
      this.f = values[5]
    } else {
      this.a = 1
      this.b = 0
      this.c = 0
      this.d = 1
      this.e = 0
      this.f = 0
    }
  }
}
globalThis.DOMMatrixReadOnly = globalThis.DOMMatrixReadOnly || DOMMatrixReadOnlyMock