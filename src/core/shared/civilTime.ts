/** Civil labels never depend on the process/browser zone. */
export function civilParts(instant:Date,zone:string) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant)
  const v=Object.fromEntries(parts.map(p=>[p.type,p.value]))
  return {day:`${v.year}-${v.month}-${v.day}`,time:`${v.hour}:${v.minute}`}
}
export function nextDay(day:string) {return new Date(Date.parse(`${day}T12:00:00Z`)+86400_000).toISOString().slice(0,10)}
/** Earliest occurrence in a fold; first representable time after a gap. A skipped civil day has no separate opening. */
export function civilOpening(day:string,time:string,zone:string) {
  const desired=Date.parse(`${day}T${time}:00Z`)
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
  const wall=(at:number)=>{const p=Object.fromEntries(formatter.formatToParts(new Date(at)).map(v=>[v.type,v.value]));return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`)}
  const offsets=new Set([-36,0,36].map(h=>{const at=desired+h*3600_000;return wall(at)-at}))
  const candidates=[...offsets].map(offset=>desired-offset)
  const exact=candidates.filter(at=>wall(at)===desired).sort((a,b)=>a-b)
  if(exact.length)return new Date(exact[0]).toISOString()
  // At most the size of a civil gap; minute precision matches the workspace window setting.
  let at=Math.min(...candidates)
  const end=Math.max(...candidates)
  for(;at<=end;at+=60_000)if(wall(at)>=desired)return new Date(at).toISOString()
  throw new Error('No civil opening found.')
}
export function nextOpening(after:string,zone:string,start:string,lastDay?:string) {
  let day=civilParts(new Date(after),zone).day
  for(let i=0;i<4;i++,day=nextDay(day)) {
    const at=civilOpening(day,start,zone),actual=civilParts(new Date(at),zone).day
    if(at>after && actual===day && day!==lastDay)return {at,day}
  }
  throw new Error('No next daily opening found.')
}
