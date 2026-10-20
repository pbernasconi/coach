import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sidebar, SidebarInset, SidebarRail, SidebarTrigger } from '../src/components/navigation/Sidebar'
import { SidebarProvider } from '../src/components/navigation/SidebarProvider'
import {
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '../src/components/navigation/SidebarMenu'
import { SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from '../src/components/navigation/SidebarMenuSub'
import { SidebarContent, SidebarGroup, SidebarGroupLabel } from '../src/components/navigation/SidebarSections'
import { useSidebar } from '../src/components/navigation/useSidebar'

const stubViewport = (mobile: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: mobile,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )

function Nav({ collapsible = 'none' as 'none' | 'offcanvas' | 'icon' }) {
  return (
    <SidebarProvider cookieName={null}>
      <Sidebar collapsible={collapsible}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Library</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive>
                  <a href="/notes">Notes</a>
                </SidebarMenuButton>
                <SidebarMenuBadge>4</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/trips">Trips</a>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton href="/trips/lisbon">Lisbon</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        {collapsible !== 'none' && <SidebarRail />}
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
        <StateProbe />
      </SidebarInset>
    </SidebarProvider>
  )
}

function StateProbe() {
  const { state } = useSidebar()
  return <p>state: {state}</p>
}

describe('Sidebar', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the static sidebar on a desktop, with the current page marked', () => {
    stubViewport(false)
    render(<Nav />)
    expect(screen.getByRole('link', { name: 'Notes' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Trips' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Lisbon' })).toHaveAttribute('href', '/trips/lisbon')
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('is a closed drawer on a phone that the trigger opens', async () => {
    stubViewport(true)
    render(<Nav />)
    expect(screen.queryByRole('link', { name: 'Notes' })).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: 'Toggle sidebar' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    const drawer = screen.getByRole('dialog', { name: 'Sidebar' })
    expect(drawer).toContainElement(screen.getByRole('link', { name: 'Notes' }))
  })

  it('collapses and expands from the trigger, the rail and ⌘B', async () => {
    stubViewport(false)
    render(<Nav collapsible="icon" />)
    expect(screen.getByText('state: expanded')).toBeInTheDocument()
    // The rail is pointer-only (tabIndex -1); the trigger reports the state.
    const [rail, trigger] = screen.getAllByRole('button', { name: 'Toggle sidebar' })
    if (!rail || !trigger) throw new Error('missing toggles')
    expect(rail).toHaveAttribute('tabindex', '-1')
    await userEvent.click(trigger)
    expect(screen.getByText('state: collapsed')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(rail)
    expect(screen.getByText('state: expanded')).toBeInTheDocument()
    await userEvent.click(rail)
    expect(screen.getByText('state: collapsed')).toBeInTheDocument()
    await userEvent.keyboard('{Meta>}b{/Meta}')
    expect(screen.getByText('state: expanded')).toBeInTheDocument()
    await userEvent.keyboard('{Control>}b{/Control}')
    expect(screen.getByText('state: collapsed')).toBeInTheDocument()
  })

  it('keeps the state in a cookie, and follows a controlled open prop', async () => {
    stubViewport(false)
    const onOpenChange = vi.fn()
    render(
      <SidebarProvider open={false} onOpenChange={onOpenChange} cookieName="nav_open">
        <SidebarTrigger />
        <StateProbe />
      </SidebarProvider>,
    )
    expect(screen.getByText('state: collapsed')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(document.cookie).toContain('nav_open=true')
  })

  it('shows placeholder rows', () => {
    stubViewport(false)
    const { container } = render(
      <SidebarProvider cookieName={null}>
        <SidebarMenuSkeleton showIcon />
      </SidebarProvider>,
    )
    expect(container.querySelectorAll('[data-sidebar^="menu-skeleton-"]')).toHaveLength(2)
  })

  it('throws a clear error outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<SidebarTrigger />)).toThrow('useSidebar must be used within a SidebarProvider.')
  })
})
