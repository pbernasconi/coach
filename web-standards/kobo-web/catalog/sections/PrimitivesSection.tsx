import { useState } from 'react'
import { ChevronDown, CircleCheck, FileText, FolderPlus, Info } from 'lucide-react'
import { Button } from '../../src/components/controls/Button'
import { Checkbox, CheckboxField } from '../../src/components/controls/Checkbox'
import { ChoiceCard } from '../../src/components/controls/ChoiceCard'
import { CopyableValue } from '../../src/components/controls/CopyableValue'
import { CopyButton } from '../../src/components/controls/CopyButton'
import { RadioCards } from '../../src/components/controls/RadioCards'
import { RadioGroup, RadioGroupItem } from '../../src/components/controls/RadioGroup'
import { Switch } from '../../src/components/controls/Switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/controls/Tabs'
import { TextLink } from '../../src/components/controls/TextLink'
import { ToggleRow } from '../../src/components/controls/ToggleRow'
import { Avatar, AvatarFallback, AvatarImage } from '../../src/components/display/Avatar'
import { AvatarGroup } from '../../src/components/display/AvatarGroup'
import { getAvatarColor, getInitials } from '../../src/components/display/avatarInitials'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../src/components/display/Card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../src/components/display/Collapsible'
import { MaskedValue } from '../../src/components/display/MaskedValue'
import { Separator } from '../../src/components/display/Separator'
import { StepIndicator } from '../../src/components/display/StepIndicator'
import { TruncatedText } from '../../src/components/display/TruncatedText'
import { Label } from '../../src/components/fields/Label'
import { HelpTooltip } from '../../src/components/overlays/HelpTooltip'
import { StandardTooltip } from '../../src/components/overlays/StandardTooltip'
import {
  Tooltip,
  TooltipContent,
  TooltipIconTrigger,
  TooltipProvider,
  TooltipTrigger,
} from '../../src/components/overlays/Tooltip'
import { Grid, Specimen } from './Specimen'

const PEOPLE = [
  { initials: 'AP', name: 'Ada Park' },
  { initials: 'LM', name: 'Leo Marsh' },
  { initials: 'RO', name: 'Rina Oduya' },
  { initials: 'TS', name: 'Tomas Sel' },
  { initials: 'NV', name: 'Nora Vale' },
]

const REPEAT = [
  { id: 'daily', label: 'Every day' },
  { id: 'weekly', label: 'Every week' },
  { id: 'never', label: 'Never', disabled: true },
]

/** Cards, separators, avatars, toggles, tabs, links, copy buttons and tooltips. */
export function PrimitivesSection() {
  const [pinned, setPinned] = useState(true)
  const [sync, setSync] = useState(true)
  const [summary, setSummary] = useState(false)
  const [size, setSize] = useState('m')
  const [repeat, setRepeat] = useState('weekly')

  return (
    <TooltipProvider>
      <Grid>
        <Specimen title="Card">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Trip to Lisbon</CardTitle>
              <CardDescription>3 days · 4 people</CardDescription>
            </CardHeader>
            <CardContent className="text-body text-ink-muted">Flights, a flat near the river, a list of food spots.</CardContent>
            <CardFooter>
              <Button size="compact">Open</Button>
              <Button size="compact" variant="secondary">
                Share
              </Button>
            </CardFooter>
          </Card>
        </Specimen>
        <Specimen title="Separator">
          <div className="flex w-full flex-col gap-3">
            <p className="text-body text-ink">Recipes</p>
            <Separator />
            <div className="flex h-5 items-center gap-3 text-body text-ink-muted">
              <span>Notes</span>
              <Separator orientation="vertical" />
              <span>Tasks</span>
              <Separator orientation="vertical" />
              <span>Files</span>
            </div>
          </div>
        </Specimen>
        <Specimen title="Avatar and AvatarGroup">
          <Avatar>
            <AvatarImage src="/missing-photo.png" alt="" />
            <AvatarFallback className={getAvatarColor('ada')}>{getInitials('Ada Park')}</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback className="bg-brand text-on-brand">{getInitials('You Here')}</AvatarFallback>
          </Avatar>
          <AvatarGroup users={PEOPLE} />
          <AvatarGroup users={PEOPLE.slice(0, 2)} size="sm" />
        </Specimen>
        <Specimen title="StepIndicator">
          <div className="flex w-full flex-col gap-4">
            <StepIndicator currentStep={2} totalSteps={4} label="Pick a date" />
            <StepIndicator currentStep={1} totalSteps={3} />
          </div>
        </Specimen>
        <Specimen title="MaskedValue, CopyableValue and CopyButton">
          <div className="flex flex-col gap-2 text-body text-ink">
            <MaskedValue value="K7Q2-9F4M-X3TB" className="font-mono" />
            <MaskedValue value={null} mask="••X3TB" className="font-mono" />
            <CopyableValue value="INV-20431" />
            <CopyableValue value="+15551234567" display="+1 555 123 4567" mono={false} iconPosition="leading" />
            <span className="inline-flex items-center gap-2">
              Share link <CopyButton value="https://example.com/n/42" />
            </span>
          </div>
        </Specimen>
        <Specimen title="TruncatedText">
          <div className="flex w-full flex-col gap-1 text-body text-ink">
            <TruncatedText className="max-w-48">A short title</TruncatedText>
            <TruncatedText className="max-w-48">A much longer title that does not fit on one line here</TruncatedText>
            <TruncatedText>{''}</TruncatedText>
          </div>
        </Specimen>
        <Specimen title="Collapsible">
          <Collapsible className="w-full">
            <CollapsibleTrigger asChild>
              <Button variant="plain" size="compact" className="-ml-3 [&[data-state=open]>svg]:rotate-180">
                Show details <ChevronDown aria-hidden="true" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 text-body text-ink-muted">
              Made on 12 May. Last edit by Leo Marsh.
            </CollapsibleContent>
          </Collapsible>
        </Specimen>
        <Specimen title="Checkbox and CheckboxField">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id="cat-pin" checked={pinned} onCheckedChange={(next) => setPinned(next === true)} />
              <Label htmlFor="cat-pin">Pin to the top</Label>
            </div>
            <CheckboxField label="Email me a summary" description="Every Monday" defaultChecked />
            <CheckboxField label="Archived" disabled />
            <Checkbox aria-label="Some notes selected" checked="indeterminate" />
          </div>
        </Specimen>
        <Specimen title="Switch and ToggleRow">
          <div className="flex w-full flex-col">
            <div className="flex items-center gap-2 pb-2">
              <Switch id="cat-sync" checked={sync} onCheckedChange={setSync} />
              <Label htmlFor="cat-sync">Sync</Label>
              <Switch aria-label="Off and disabled" disabled />
            </div>
            <ToggleRow
              label="Daily summary"
              description="An email at 8 AM"
              help="We send it only on days with new notes."
              checked={summary}
              onCheckedChange={setSummary}
            />
            <ToggleRow label="Sounds" checked onCheckedChange={() => {}} disabled />
          </div>
        </Specimen>
        <Specimen title="RadioGroup and RadioCards">
          <div className="grid w-full gap-4">
            <RadioGroup value={size} onValueChange={setSize} aria-label="Text size" className="flex gap-4">
              {['s', 'm', 'l'].map((value) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem value={value} id={`cat-size-${value}`} />
                  <Label htmlFor={`cat-size-${value}`}>{value.toUpperCase()}</Label>
                </div>
              ))}
            </RadioGroup>
            <RadioCards aria-label="Repeat" options={REPEAT} value={repeat} onValueChange={setRepeat} />
          </div>
        </Specimen>
        <Specimen title="ChoiceCard">
          <div className="grid w-full gap-2">
            <ChoiceCard icon={FileText} label="Blank note" description="Start from nothing" />
            <ChoiceCard icon={FolderPlus} label="New folder" description="Group notes" disabled />
          </div>
        </Specimen>
        <Specimen title="Tabs">
          <Tabs defaultValue="notes" className="w-full">
            <TabsList aria-label="Views">
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="trash" disabled>
                Trash
              </TabsTrigger>
            </TabsList>
            <TabsContent value="notes" className="text-body text-ink-muted">
              12 notes
            </TabsContent>
            <TabsContent value="files" className="text-body text-ink-muted">
              3 files
            </TabsContent>
          </Tabs>
        </Specimen>
        <Specimen title="TextLink">
          <TextLink href="#guide">Read the guide</TextLink>
          <TextLink href="#terms" variant="muted">
            Terms
          </TextLink>
          <TextLink asChild>
            <a href="#slot">As a child link</a>
          </TextLink>
        </Specimen>
        <Specimen title="Tooltip, StandardTooltip and HelpTooltip" wide>
          <StandardTooltip content="Sort by name">
            <Button variant="outline" size="compact">
              Name
            </Button>
          </StandardTooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="compact">
                Dark
              </Button>
            </TooltipTrigger>
            <TooltipContent>Changes save on this device</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TooltipIconTrigger aria-label="Synced">
                <CircleCheck aria-hidden="true" className="text-success-ink" />
              </TooltipIconTrigger>
            </TooltipTrigger>
            <TooltipContent variant="card" showArrow className="max-w-60">
              <p className="font-semibold">Synced</p>
              <p className="mt-1 text-footnote text-ink-muted">Every device has the latest copy.</p>
            </TooltipContent>
          </Tooltip>
          <span className="inline-flex items-center gap-1.5 text-subhead font-semibold text-ink">
            Tag <HelpTooltip label="What is a tag?">Tags group notes across folders.</HelpTooltip>
          </span>
          <span className="inline-flex items-center gap-1.5 text-subhead font-semibold text-ink">
            Reading time{' '}
            <HelpTooltip label="About reading time" icon={<Info aria-hidden="true" />}>
              At 200 words a minute.
            </HelpTooltip>
          </span>
        </Specimen>
      </Grid>
    </TooltipProvider>
  )
}
