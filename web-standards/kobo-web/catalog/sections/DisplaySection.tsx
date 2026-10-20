import {
  Meter,
  MoneyDisplay,
  StatTile,
  formatCompactMoney,
  formatDelta,
  formatMultiple,
  formatNumber,
  formatPercent,
  meterTone,
  statDelta,
} from '../../src'
import { Grid, Specimen } from './Specimen'

const ROWS = [
  ['formatNumber(1234567)', formatNumber(1234567)],
  ['formatPercent(12.345)', formatPercent(12.345)],
  ['formatMultiple(1.456)', formatMultiple(1.456)],
  ['formatDelta(-0.4, 1, " pts")', formatDelta(-0.4, 1, ' pts')],
  ['formatCompactMoney(2.4e9)', formatCompactMoney(2.4e9)],
  ['formatCompactMoney(45600, { scale: "thousands" })', formatCompactMoney(45600, { scale: 'thousands' })],
  ['formatNumber(null)', formatNumber(null)],
] as const

/** Money, stat tiles, meters and number formats. */
export function DisplaySection() {
  return (
    <Grid>
      <Specimen title="StatTile" wide>
        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="Open tasks" value="18" unit="/ 24" delta={statDelta(3, '+3')} note="this week" />
          <StatTile label="Spend" value={formatCompactMoney(1_240_000)} delta={statDelta(-0.08, '−8%')} note="vs last month" />
          <StatTile
            label="Wait time"
            value="4.2"
            unit="min"
            delta={statDelta(-0.6, formatDelta(-0.6), { goodWhen: 'down' })}
          />
          <StatTile label="Trips" value="7" delta={statDelta(0, 'no change')} />
        </div>
      </Specimen>
      <Specimen title="MoneyDisplay">
        <div className="flex flex-col gap-1 text-headline">
          <MoneyDisplay cents={129900} />
          <MoneyDisplay cents={-4599} />
          <MoneyDisplay cents={852} signed />
          <MoneyDisplay cents={-852} signed />
          <MoneyDisplay cents={null} />
          <MoneyDisplay cents={100} currency="EUR" />
        </div>
      </Specimen>
      <Specimen title="Meter">
        <div className="flex w-full flex-col gap-3">
          {[0.24, 0.62, 0.91].map((value) => (
            <div key={value} className="flex items-center gap-3">
              <Meter value={value} tone={meterTone(value)} label="Storage used" className="flex-1" />
              <span className="w-10 text-right text-footnote tabular-nums text-ink-muted">{formatPercent(value * 100, 0)}</span>
            </div>
          ))}
          <Meter value={0.5} size="md" label="Progress" />
        </div>
      </Specimen>
      <Specimen title="Number formats" wide>
        <dl className="grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-body">
          {ROWS.map(([call, text]) => (
            <div key={call} className="contents">
              <dt className="font-mono text-footnote text-ink-muted">{call}</dt>
              <dd className="text-right tabular-nums">{text}</dd>
            </div>
          ))}
        </dl>
      </Specimen>
    </Grid>
  )
}
