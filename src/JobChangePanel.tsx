import { useEffect, useState } from 'react'
import { collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { calculateReward, type Difficulty } from './strategies/rewardStrategy'
import { JOBS, STARTER_GEAR, parseJobId, type JobId } from './jobs/starterEquipment'
import { EMPTY_SHOP, parseShop } from './shop/shopState'
import './JobChangePanel.css'

const TICKET_PRICE = 100

type Props = { userId: string; earnedGold: number }

/**
 * 직업 변경권 구매 및 1회 사용.
 * - 구매: users/{uid}/shop/state 문서의 누적 사용 골드와 보유 변경권을 원자적으로 갱신
 * - 사용: 변경권/직업/기본장비 문서를 같은 트랜잭션에서 갱신
 * 이전에 구매한 아이템 목록은 변경하지 않습니다.
 */
export default function JobChangePanel({ userId, earnedGold }: Props) {
  const [shop, setShop] = useState(EMPTY_SHOP)
  const [job, setJob] = useState<JobId | null>(null)
  const [selected, setSelected] = useState<JobId>('mage')
  const [shopLoading, setShopLoading] = useState(true)
  const [jobLoading, setJobLoading] = useState(true)
  const [busy, setBusy] = useState<'buy' | 'change' | null>(null)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setShop(EMPTY_SHOP)
    setShopLoading(true)
    return onSnapshot(doc(db, 'users', userId, 'shop', 'state'), (snapshot) => {
      setShop(parseShop(snapshot.data()))
      setShopLoading(false)
    }, () => {
      setError('직업 변경권 정보를 불러올 수 없습니다.')
      setShopLoading(false)
    })
  }, [userId])

  useEffect(() => {
    setJob(null)
    setJobLoading(true)
    return onSnapshot(doc(db, 'users', userId, 'profile', 'job'), (snapshot) => {
      setJob(parseJobId(snapshot.data()?.jobId))
      setJobLoading(false)
    }, () => {
      setError('현재 직업 정보를 불러올 수 없습니다.')
      setJobLoading(false)
    })
  }, [userId])

  const loading = shopLoading || jobLoading
  const balance = earnedGold - shop.spentGold

  async function buyTicket() {
    if (loading || busy || !job || shop.jobChangeTickets > 0 || balance < TICKET_PRICE) return
    setBusy('buy')
    setError('')
    setNotice('')
    try {
      const walletRef = doc(db, 'users', userId, 'shop', 'state')
      // 기존 장비 구매 로직과 동일하게 퀘스트 보상을 거래 시점에 재검증합니다.
      const quests = await getDocs(collection(db, 'users', userId, 'quests'))
      const questRefs = quests.docs.map((snapshot) => snapshot.ref)
      await runTransaction(db, async (transaction) => {
        const walletSnap = await transaction.get(walletRef)
        const current = parseShop(walletSnap.data())
        const questDocs = await Promise.all(questRefs.map(ref => transaction.get(ref)))
        const earned = questDocs.reduce((total, questSnap) => {
          if (!questSnap.exists()) return total
          const quest = questSnap.data()
          if (!quest.completed || !['쉬움','보통','어려움'].includes(quest.difficulty)) return total
          return total + calculateReward(quest.difficulty as Difficulty).gold
        }, 0)
        if (current.jobChangeTickets > 0) throw new Error('ALREADY_HAVE_TICKET')
        if (earned - current.spentGold < TICKET_PRICE) throw new Error('NOT_ENOUGH_GOLD')
        transaction.set(walletRef, {
          spentGold: current.spentGold + TICKET_PRICE,
          jobChangeTickets: current.jobChangeTickets + 1,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      })
      setNotice('직업 변경권 1장을 구매했습니다. 원하는 때 사용할 수 있습니다.')
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'ALREADY_HAVE_TICKET') setError('이미 직업 변경권을 보유하고 있습니다.')
      else if (cause instanceof Error && cause.message === 'NOT_ENOUGH_GOLD') setError('골드가 부족합니다.')
      else setError('직업 변경권 구매에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(null)
    }
  }

  async function changeJob() {
    if (loading || busy || !job || !open || selected === job || shop.jobChangeTickets < 1) return
    const name = JOBS.find(item => item.id === selected)?.name ?? selected
    if (!window.confirm(`직업 변경권 1장을 사용하여 ${name}(으)로 변경할까요?`)) return
    setBusy('change')
    setError('')
    setNotice('')
    try {
      const walletRef = doc(db, 'users', userId, 'shop', 'state')
      const jobRef = doc(db, 'users', userId, 'profile', 'job')
      const equipmentRef = doc(db, 'users', userId, 'equipment', 'current')
      await runTransaction(db, async (transaction) => {
        // Firestore는 모든 읽기를 먼저 수행해야 하므로 get을 모아서 호출합니다.
        const walletSnap = await transaction.get(walletRef)
        const jobSnap = await transaction.get(jobRef)
        await transaction.get(equipmentRef)
        const current = parseShop(walletSnap.data())
        const actualJob = parseJobId(jobSnap.data()?.jobId)
        if (!actualJob) throw new Error('NO_JOB')
        if (actualJob === selected) throw new Error('SAME_JOB')
        if (current.jobChangeTickets < 1) throw new Error('NO_TICKET')
        transaction.set(walletRef, {
          jobChangeTickets: current.jobChangeTickets - 1,
          updatedAt: serverTimestamp(),
        }, { merge: true })
        transaction.set(jobRef, {
          jobId: selected,
          changedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
        // 기존 구매 아이템은 그대로 소유하되 현재 착용 장비는 새 직업의 기본 장비로 교체합니다.
        transaction.set(equipmentRef, {
          ...STARTER_GEAR[selected],
          starterJobId: selected,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      })
      setOpen(false)
      setNotice(`${name}(으)로 직업을 변경했습니다!`)
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'NO_TICKET') setError('직업 변경권을 보유하고 있지 않습니다.')
      else if (cause instanceof Error && cause.message === 'SAME_JOB') setError('현재 직업과 다른 직업을 선택해 주세요.')
      else setError('직업 변경에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(null)
    }
  }

  const currentName = JOBS.find(item => item.id === job)?.name ?? '선택 전'
  return (
    <section className="job-change-panel" aria-label="직업 변경권 상점">
      <div className="job-change-head">
        <div>
          <h3>📜 직업 변경권</h3>
          <p>현재 직업: <strong>{currentName}</strong> · 변경권 보유: <strong>{shop.jobChangeTickets}장</strong></p>
        </div>
        <strong>{TICKET_PRICE} G</strong>
      </div>
      <p className="job-change-help">직업 변경권을 구매해 두었다가 원하는 때 한 번 사용할 수 있습니다. 변경하면 새 직업 기본 장비를 지급합니다.</p>
      <div className="job-change-actions">
        <button type="button" onClick={() => { void buyTicket() }} disabled={loading || busy !== null || !job || shop.jobChangeTickets > 0 || balance < TICKET_PRICE}>
          {busy === 'buy' ? '구매 중...' : shop.jobChangeTickets > 0 ? '변경권 보유 중 ✓' : `변경권 구매 (${TICKET_PRICE} G)`}
        </button>
        <button type="button" onClick={() => { setOpen(value => !value); setError(''); setNotice('') }} disabled={loading || busy !== null || shop.jobChangeTickets < 1}>
          {open ? '직업 선택 닫기' : '변경권 사용하기'}
        </button>
      </div>
      {open && shop.jobChangeTickets > 0 && (
        <div className="job-change-options">
          <label htmlFor="questlog-new-job">변경할 직업</label>
          <select id="questlog-new-job" value={selected} onChange={event => setSelected(event.target.value as JobId)} disabled={busy !== null}>
            {JOBS.map(option => <option key={option.id} value={option.id} disabled={option.id === job}>{option.emoji} {option.name}{option.id === job ? ' (현재 직업)' : ''}</option>)}
          </select>
          <button type="button" onClick={() => { void changeJob() }} disabled={busy !== null || selected === job}>{busy === 'change' ? '변경 중...' : '직업 변경 확정 · 변경권 1장 사용'}</button>
          <p>취소하거나 창을 닫으면 변경권은 소비되지 않습니다.</p>
        </div>
      )}
      {notice && <p className="job-change-success" role="status">{notice}</p>}
      {error && <p className="job-change-error" role="alert">{error}</p>}
      <p className="job-change-note">이전 직업의 구매 장비는 인벤토리에 보관됩니다. 다른 직업의 무료 기본 장비는 현재 직업일 때만 다시 장착할 수 있습니다.</p>
    </section>
  )
}
