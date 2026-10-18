/** Freeze the workspace calendar day when an event occurs, even across later zone changes. */
export function trafficDay(at:string,zone:string) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at))
  const part=(name:string)=>parts.find(p=>p.type===name)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
