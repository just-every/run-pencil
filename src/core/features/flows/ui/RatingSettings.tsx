type Props = {
  settings: Record<string, unknown>
  onChangeSettings: (settings: Record<string, unknown>) => void
  disabled: boolean
}

/** Start changes update both bounds together, preserving the number of steps. */
export function RatingSettings({ settings, onChangeSettings, disabled }: Props) {
  const min = settings.min === undefined ? 1 : settings.min
  const max = settings.max === undefined ? 5 : settings.max
  const steps = typeof min === 'number' && typeof max === 'number' ? max - min + 1 : undefined
  const setLabel = (key: string, value: string) => {
    const next = { ...settings }
    if (value === '') delete next[key]
    else next[key] = value
    onChangeSettings(next)
  }

  return <>
    <div className="ledger-filters">
      <label className="inspector-field">Start at<select aria-label="Start at"
        className="text-input"
        disabled={disabled}
        value={min === 0 || min === 1 ? min : ''}
        onChange={event => {
          const start = Number(event.target.value)
          onChangeSettings({ ...settings, min: start, max: typeof steps === 'number' ? start + steps - 1 : max })
        }}
      ><option value="" disabled>Choose a start</option><option value={0}>0</option><option value={1}>1</option></select></label>
      <label className="inspector-field">Number of steps<select aria-label="Number of steps"
        className="text-input"
        disabled={disabled}
        value={typeof steps === 'number' && Number.isInteger(steps) && steps >= 2 && steps <= 11 ? steps : ''}
        onChange={event => onChangeSettings({ ...settings, max: typeof min === 'number' ? min + Number(event.target.value) - 1 : undefined })}
      ><option value="" disabled>Choose 2 to 11 steps</option>{Array.from({ length: 10 }, (_, index) => index + 2).map(count => <option key={count} value={count}>{count}</option>)}</select></label>
    </div>
    {([['lowLabel', 'Low label'], ['middleLabel', 'Middle label'], ['highLabel', 'High label']] as const).map(([key, label]) => <label className="inspector-field" key={key}>{label}<input
      className="text-input"
      disabled={disabled}
      type="text"
      maxLength={100}
      value={typeof settings[key] === 'string' ? settings[key] : ''}
      onChange={event => setLabel(key, event.target.value)}
    /></label>)}
  </>
}
