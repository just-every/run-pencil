// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, vi } from 'vitest'
import { contract } from '../../../test/contract'
import { NotificationsPanel } from './NotificationsPanel'
import { notificationApi } from './useNotifications'
vi.mock('./useNotifications',async()=>{const actual=await vi.importActual<typeof import('./useNotifications')>('./useNotifications');return actual})
afterEach(()=>{cleanup();vi.restoreAllMocks()})
contract(['NOTIFY-002'],'current operator can choose Immediately or Off; failed deliveries retry and unknown resend requires duplicate confirmation',async()=>{
  const read=vi.spyOn(notificationApi,'read').mockResolvedValue({mode:'immediately',failureReason:null,senderError:null,deliveries:[{id:'failed',status:'failed',reason:'Provider rejected the message.',attempts:1,updatedAt:'2026-10-11T09:30:00.000Z',recipient:'owner@example.test'},{id:'unknown',status:'unknown',reason:'Provider outcome is unknown.',attempts:1,updatedAt:'2026-10-11T09:30:00.000Z',recipient:'owner@example.test'}]})
  const set=vi.spyOn(notificationApi,'set').mockResolvedValue({mode:'off',failureReason:null,senderError:null,deliveries:[]}),retry=vi.spyOn(notificationApi,'retry').mockResolvedValue()
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
  render(<NotificationsPanel flowId="flow" timeZone="UTC"/>)
  expect(await screen.findByLabelText('Email me about completed responses')).toHaveValue('immediately')
  expect(screen.getByText('Provider rejected the message.')).toBeVisible()
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(retry).toHaveBeenCalledWith('failed',false))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Send again'})).toBeEnabled())
  fireEvent.click(screen.getByRole('button',{name:'Send again'}));expect(confirm).toHaveBeenCalled();expect(retry).toHaveBeenCalledTimes(1)
  confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:'Send again'}));await waitFor(()=>expect(retry).toHaveBeenCalledWith('unknown',true))
  await waitFor(()=>expect(screen.getByLabelText('Email me about completed responses')).toBeEnabled())
  read.mockResolvedValue({mode:'off',failureReason:null,senderError:null,deliveries:[]})
  fireEvent.change(screen.getByLabelText('Email me about completed responses'),{target:{value:'off'}})
  await waitFor(()=>expect(set).toHaveBeenCalledWith('flow','off'))
  expect(await screen.findByText('Your notification preference is saved.')).toBeVisible()
})
contract(['NOTIFY-002','NOTIFY-004'],'sender failure is visible and Off prevents retry',async()=>{
  vi.spyOn(notificationApi,'read').mockResolvedValue({mode:'off',failureReason:'Operator mailbox rejected mail.',senderError:'MAIL_FROM must be a no-reply address.',deliveries:[{id:'failed',status:'failed',reason:'Mail rejected',attempts:1,updatedAt:'2026-10-11T09:30:00.000Z',recipient:'owner@example.test'}]})
  render(<NotificationsPanel flowId="flow" timeZone="UTC"/>)
  expect(await screen.findByText('MAIL_FROM must be a no-reply address.')).toBeVisible()
  expect(screen.getByRole('button',{name:'Retry'})).toBeDisabled()
  expect(screen.getByText('Your choice applies only to your account and this flow.')).toBeVisible()
  expect(screen.queryByText(/Daily digest is not available/)).not.toBeInTheDocument()
})
