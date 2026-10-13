/** Convert a wall-clock value in a workspace zone, rejecting DST gaps/ambiguous times. */
export function zonedInstant(local: string, zone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local)
  if (!match) throw new Error('Choose a valid date and time.')
  const [, y, mo, d, h, mi, sec = '00'] = match
  const desired = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec))
  if (new Date(desired).toISOString().slice(0, 19) !== `${y}-${mo}-${d}T${h}:${mi}:${sec}`) throw new Error('Choose a valid calendar date and time.')
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  const wall = (instant: number) => {
    const fields = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]))
    return Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day), Number(fields.hour), Number(fields.minute), Number(fields.second))
  }
  let instant = desired
  for (let attempt = 0; attempt < 4; attempt++) instant += desired - wall(instant)
  if (wall(instant) !== desired) throw new Error(`That time does not exist in ${zone}. Choose another time.`)
  for (let minutes = 15; minutes <= 180; minutes += 15) {
    if (wall(instant - minutes * 60000) === desired || wall(instant + minutes * 60000) === desired) throw new Error(`That time occurs twice in ${zone}. Choose an unambiguous time.`)
  }
  return new Date(instant).toISOString()
}
export function dayBoundary(day: string, zone: string, end = false) {
  if (!end) return zonedInstant(`${day}T00:00`, zone)
  const next = new Date(`${day}T12:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return new Date(Date.parse(zonedInstant(`${next.toISOString().slice(0, 10)}T00:00`, zone)) - 1).toISOString()
}

/** Empty deadlines use the stable location, never a name from an arbitrary era. */
export function timeZoneName(zone: string, local = '') {
  const canonical = new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone
  const location = canonical === 'UTC' ? 'Coordinated Universal Time' : `${canonical.split('/').at(-1)!.replaceAll('_', ' ')} time`
  if (!local) return location
  const instant = zonedInstant(local, zone)
  if (canonical === 'UTC') return location
  return new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longGeneric' })
    .formatToParts(new Date(instant)).find(part => part.type === 'timeZoneName')!.value
}
