import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../src/components/controls/Tabs'

function Views() {
  return (
    <Tabs defaultValue="notes">
      <TabsList aria-label="Views">
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
      </TabsList>
      <TabsContent value="notes">12 notes</TabsContent>
      <TabsContent value="files">3 files</TabsContent>
    </Tabs>
  )
}

describe('Tabs', () => {
  it('shows the panel of the selected tab', async () => {
    render(<Views />)
    expect(screen.getByRole('tab', { name: 'Notes' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('12 notes')
    await userEvent.click(screen.getByRole('tab', { name: 'Files' }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('3 files')
  })

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Views />)
    await user.tab()
    expect(screen.getByRole('tab', { name: 'Notes' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Files' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('3 files')
  })
})
