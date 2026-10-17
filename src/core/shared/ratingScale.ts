export type RatingScale = {
  min: number
  max: number
  steps: number
  lowLabel: string
  middleLabel: string
  highLabel: string
}

/** Omitted bounds retain the original five-star scale. Explicit bounds must be valid. */
export function ratingSettingsValid(settings: Record<string, unknown>) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false
  const min = settings.min === undefined ? 1 : settings.min
  const max = settings.max === undefined ? 5 : settings.max
  if (typeof min !== 'number' || typeof max !== 'number' || !Number.isInteger(min) || !Number.isInteger(max)) return false
  const steps = max - min + 1
  return (min === 0 || min === 1) && steps >= 2 && steps <= 11 &&
    ['lowLabel', 'middleLabel', 'highLabel'].every(key => settings[key] === undefined ||
      (typeof settings[key] === 'string' && settings[key].length <= 100))
}

/** Read the published numeric bounds and labels without changing their meaning. */
export function ratingScale(settings: Record<string, unknown>): RatingScale {
  if (!ratingSettingsValid(settings)) throw new RangeError('Choose a scale starting at 0 or 1, with 2 to 11 steps and labels up to 100 characters.')
  const min = settings.min === undefined ? 1 : settings.min as number
  const max = settings.max === undefined ? 5 : settings.max as number
  return {
    min,
    max,
    steps: max - min + 1,
    lowLabel: settings.lowLabel as string | undefined ?? '',
    middleLabel: settings.middleLabel as string | undefined ?? '',
    highLabel: settings.highLabel as string | undefined ?? '',
  }
}
