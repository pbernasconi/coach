import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReviewDisclosure } from '../src/components/data/ReviewDisclosure'

describe('ReviewDisclosure', () => {
  it('renders the fine print as a paragraph', () => {
    render(<ReviewDisclosure>When you select Publish, the page is visible to everyone with the link.</ReviewDisclosure>)
    const text = screen.getByText('When you select Publish, the page is visible to everyone with the link.')
    expect(text.tagName).toBe('P')
  })
})
