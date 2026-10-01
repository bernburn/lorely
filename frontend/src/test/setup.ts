import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(cleanup)
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: () => {}, configurable: true })
Object.defineProperty(window, 'scrollTo', { value: () => {}, configurable: true })
