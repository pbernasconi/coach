import { useMemo, useState } from 'react'
import { BookOpen, Folder, Map as MapIcon, MoreHorizontal, NotebookPen, Plus, Settings, Users } from 'lucide-react'
import { Button } from '../../src/components/controls/Button'
import { IdleSessionWarning } from '../../src/components/feedback/IdleSessionWarning'
import { FlowFooter } from '../../src/components/layout/FlowFooter'
import { FlowFooterOutlet, FlowFooterSlotProvider, useFlowFooter } from '../../src/components/layout/FlowFooterSlot'
import { FlowShell } from '../../src/components/layout/FlowShell'
import { FullScreenWizard, type WizardStep } from '../../src/components/layout/FullScreenWizard'
import { PageHeader } from '../../src/components/layout/PageHeader'
import { SectionRail } from '../../src/components/layout/SectionRail'
import { StepHeader } from '../../src/components/layout/StepHeader'
import { WizardStepRail } from '../../src/components/layout/WizardStepRail'
import { Breadcrumb } from '../../src/components/navigation/Breadcrumb'
import { CollapsibleNavGroup } from '../../src/components/navigation/CollapsibleNavGroup'
import { FilterPills } from '../../src/components/navigation/FilterPills'
import { Sidebar, SidebarInset, SidebarRail, SidebarTrigger } from '../../src/components/navigation/Sidebar'
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '../../src/components/navigation/SidebarMenu'
import { SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from '../../src/components/navigation/SidebarMenuSub'
import { SidebarProvider } from '../../src/components/navigation/SidebarProvider'
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarSeparator,
} from '../../src/components/navigation/SidebarSections'
import { StepNav } from '../../src/components/navigation/StepNav'
import { PrintButton } from '../../src/components/print/PrintButton'
import { PrintDocument, PrintDocumentLayout } from '../../src/components/print/PrintDocument'
import { Grid, Specimen } from './Specimen'

const SECTIONS = [
  { key: 'profile', label: 'Profile' },
  { key: 'sharing', label: 'Sharing' },
  { key: 'export', label: 'Export' },
] as const

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open', count: 4 },
  { id: 'done', label: 'Done', count: 200, countIsExact: false },
]

const STEPS: WizardStep[] = [
  { id: 'people', label: 'People', content: <StepHeader eyebrow="Step 1" title="Who is coming?" focusOnChange={false} /> },
  { id: 'dates', label: 'Dates', content: <StepHeader eyebrow="Step 2" title="Pick the dates" focusOnChange={false} /> },
  { id: 'review', label: 'Review', content: <StepHeader eyebrow="Step 3" title="Review the trip" focusOnChange={false} /> },
]

/** A step that puts its own action in the flow's pinned footer. */
function FooterStep() {
  const footer = useMemo(
    () => (
      <FlowFooter>
        <span className="text-body text-ink-muted">3 files ready</span>
        <Button>Upload</Button>
      </FlowFooter>
    ),
    [],
  )
  useFlowFooter(footer)
  return <StepHeader title="Add files" description="Drop the trip photos here." focusOnChange={false} />
}

/** A neutral app sidebar, shaped like the app sidebars it comes from: brand, search, groups, a pinned footer. */
function SampleSidebar() {
  return (
    // The transform makes the fixed sidebar position against this box, not the window.
    <div className="h-[26rem] w-full transform-gpu overflow-hidden rounded-card border border-line">
      <SidebarProvider cookieName={null} className="h-full min-h-0">
        <Sidebar collapsible="icon" className="h-full">
          <SidebarHeader>
            <p className="px-2 text-headline group-data-[collapsible=icon]:hidden">Atlas</p>
            <SidebarInput aria-label="Search" placeholder="Search" className="group-data-[collapsible=icon]:hidden" />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Library</SidebarGroupLabel>
              <SidebarGroupAction aria-label="Add a page">
                <Plus aria-hidden="true" />
              </SidebarGroupAction>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive tooltip="Notes">
                      <a href="#layout">
                        <NotebookPen aria-hidden="true" />
                        <span>Notes</span>
                      </a>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>12</SidebarMenuBadge>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Trips">
                      <a href="#layout">
                        <MapIcon aria-hidden="true" />
                        <span>Trips</span>
                      </a>
                    </SidebarMenuButton>
                    <SidebarMenuAction showOnHover aria-label="More for Trips">
                      <MoreHorizontal aria-hidden="true" />
                    </SidebarMenuAction>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#layout" isActive>
                          Lisbon
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#layout">Kyoto</SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <CollapsibleNavGroup label="Projects" icon={Folder} badgeCount={2}>
                      <SidebarMenuButton asChild size="compact">
                        <a href="#layout">Garden</a>
                      </SidebarMenuButton>
                      <SidebarMenuButton asChild size="compact">
                        <a href="#layout">Kitchen</a>
                      </SidebarMenuButton>
                    </CollapsibleNavGroup>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Shared</SidebarGroupLabel>
              <SidebarMenuSkeleton showIcon />
              <SidebarMenuSkeleton showIcon />
            </SidebarGroup>
          </SidebarContent>
          <SidebarSeparator />
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Settings">
                  <Settings aria-hidden="true" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="p-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-body text-ink-muted">⌘B or the trigger shrinks the sidebar to icons.</span>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

/** Page and flow layout, navigation, the sidebar, the idle warning and the print shell. */
export function LayoutSection() {
  const [section, setSection] = useState<(typeof SECTIONS)[number]['key']>('profile')
  const [filter, setFilter] = useState('open')
  const [step, setStep] = useState(1)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [session, setSession] = useState<'off' | 'on' | 'ended'>('off')

  return (
    <Grid>
      <Specimen title="PageHeader and Breadcrumb" wide>
        <div className="flex w-full flex-col gap-3">
          <Breadcrumb items={[{ label: 'Home', href: '#layout' }, { label: 'Trips', link: <a href="#layout" /> }, { label: 'Lisbon' }]} />
          <PageHeader
            title="Lisbon"
            description="Seven days in May with Ada and Jun."
            actions={
              <>
                <Button variant="secondary">Share</Button>
                <Button>Add a day</Button>
              </>
            }
          />
        </div>
      </Specimen>
      <Specimen title="FilterPills">
        <FilterPills
          filters={FILTERS}
          activeFilter={filter}
          onFilterChange={setFilter}
          onRemoveFilter={() => setFilter('all')}
          onAddFilter={() => {}}
        />
      </Specimen>
      <Specimen title="StepNav: vertical and horizontal">
        <div className="flex w-full flex-col gap-4">
          <StepNav steps={STEPS} currentStep={step} onStepClick={setStep} aria-label="Progress" />
          <StepNav steps={STEPS} currentStep={step} onStepClick={setStep} orientation="horizontal" showCheckmarks aria-label="Progress, compact" />
        </div>
      </Specimen>
      <Specimen title="SectionRail" wide>
        <SectionRail sections={SECTIONS} activeKey={section} onSelect={setSection} ariaLabel="Settings sections" className="w-full">
          <p className="text-body text-ink-muted">
            The <span className="font-semibold text-ink">{section}</span> pane. The divider keeps its length.
          </p>
        </SectionRail>
      </Specimen>
      <Specimen title="Sidebar (sample app sidebar, collapsible to icons)" wide>
        <SampleSidebar />
      </Specimen>
      <Specimen title="CollapsibleNavGroup">
        <div className="w-56">
          <CollapsibleNavGroup label="People" icon={Users} href="#layout" isActive>
            <SidebarMenuSubButton href="#layout">Ada Park</SidebarMenuSubButton>
            <SidebarMenuSubButton href="#layout">Jun Ito</SidebarMenuSubButton>
          </CollapsibleNavGroup>
          <CollapsibleNavGroup label="Recipes" icon={BookOpen}>
            <SidebarMenuSubButton href="#layout">Bread</SidebarMenuSubButton>
          </CollapsibleNavGroup>
        </div>
      </Specimen>
      <Specimen title="WizardStepRail">
        <div className="[&>nav]:block">
          <WizardStepRail steps={STEPS} currentStep={step} onStepChange={setStep} />
        </div>
      </Specimen>
      <Specimen title="FlowShell with a footer from a step (FlowFooterSlot)" wide>
        <FlowFooterSlotProvider>
          <FlowShell
            className="h-80 w-full rounded-card border border-line"
            brand="Atlas"
            title="New trip"
            onClose={() => {}}
            onBack={() => {}}
            backLabel="Back to trips"
            footer={<FlowFooterOutlet fallback={<FlowFooter justify="end"><Button>Next</Button></FlowFooter>} />}
          >
            <div className="mx-auto max-w-2xl px-4 py-6">
              <FooterStep />
            </div>
          </FlowShell>
        </FlowFooterSlotProvider>
      </Specimen>
      <Specimen title="FullScreenWizard: in a box and full screen" wide>
        <div className="flex w-full flex-col gap-3">
          <div className="flex h-[26rem] w-full flex-col overflow-hidden rounded-card border border-line">
            <FullScreenWizard steps={STEPS} currentStep={step} onStepChange={setStep} onClose={() => {}} onComplete={() => {}} presentation="dialog" />
          </div>
          <Button variant="secondary" onClick={() => setWizardOpen(true)}>
            Open full screen (Esc closes)
          </Button>
          {wizardOpen && (
            <div className="fixed inset-0 z-modal">
              <FullScreenWizard
                title="New trip"
                steps={STEPS}
                currentStep={step}
                onStepChange={setStep}
                onClose={() => setWizardOpen(false)}
                onComplete={() => setWizardOpen(false)}
                labels={{ submit: 'Save trip' }}
              />
            </div>
          )}
        </div>
      </Specimen>
      <Specimen title="IdleSessionWarning (20 s session, warns at 15 s)">
        <Button variant="secondary" onClick={() => setSession('on')} disabled={session === 'on'}>
          Start a short session
        </Button>
        <span className="text-body text-ink-muted">{session === 'ended' ? 'Signed out.' : session === 'on' ? 'Wait 5 seconds.' : ''}</span>
        {session === 'on' && (
          <IdleSessionWarning
            timeoutMs={20_000}
            warnBeforeMs={15_000}
            lastActivityAtMs={() => Number.NEGATIVE_INFINITY}
            onExtend={() => new Promise((resolve) => setTimeout(resolve, 600))}
            onTimeout={() => setSession('ended')}
          />
        )}
      </Specimen>
      <Specimen title="PrintButton and PrintDocument">
        <PrintButton label="Print" />
        <PrintButton />
        <PrintDocument title="Trip to Lisbon" meta="May 3 – May 9" logo="Atlas" footer="Atlas travel notes">
          <p>Day 1: Alfama and the castle.</p>
        </PrintDocument>
      </Specimen>
      <Specimen title="PrintDocumentLayout (the printed page)" wide>
        <div className="w-full rounded-card border border-line bg-surface p-8">
          <PrintDocumentLayout
            title="Trip to Lisbon"
            meta="May 3 – May 9"
            logo="Atlas"
            printedAt="Printed May 1, 2026, 8:00 AM"
            notice="Shared copy (read only)"
            footer="Atlas travel notes"
          >
            <p>Day 1: Alfama and the castle. Day 2: Belém.</p>
          </PrintDocumentLayout>
        </div>
      </Specimen>
    </Grid>
  )
}
