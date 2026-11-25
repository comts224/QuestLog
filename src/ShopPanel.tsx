import { useEffect, useState } from 'react'
import {
  collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { calculateReward, type Difficulty } from './strategies/rewardStrategy'
import { SHOP_ITEMS, dailyShopItems, koreaDayKey, type PaidItemId } from './shop/catalog'
import { JOBS, parseJobId, type JobId } from './jobs/starterEquipment'
import { EMPTY_SHOP, parseShop } from './shop/shopState'
import './ShopPanel.css'
import JobChangePanel from './JobChangePanel'

type Props = { userId: string; earnedGold: number }

/**
 * 구매는 Firestore 트랜잭션으로 중복 구매/잔액 충돌을 검사합니다.
 * 완료된 퀘스트는 거래 중 다시 읽어서 구매 시점의 보상 합계를 검증합니다.
 */
export default function ShopPanel({ userId, earnedGold }: Props) {
  const [shop, setShop] = useState(EMPTY_SHOP)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<PaidItemId | null>(null)
  const [error, setError] = useState('')
  const [job, setJob] = useState<JobId | null>(null)
  const [jobLoading, setJobLoading] = useState(true)
  const [today, setToday] = useState(koreaDayKey())

  useEffect(() => {
    setShop(EMPTY_SHOP)
    setLoading(true)
    setError('')
    return onSnapshot(doc(db, 'users', userId, 'shop', 'state'), (snapshot) => {
      setShop(parseShop(snapshot.data()))
      setLoading(false)
    }, () => {
      setError('상점 정보를 불러오지 못했습니다.')
      setLoading(false)
    })
  }, [userId])

  useEffect(() => {
    setJob(null)
    setJobLoading(true)
    return onSnapshot(doc(db, 'users', userId, 'profile', 'job'), snapshot => {
      setJob(parseJobId(snapshot.data()?.jobId))
      setJobLoading(false)
    }, () => {
      setError('직업 정보를 불러오지 못했습니다.')
      setJobLoading(false)
    })
  }, [userId])

  // 탭을 열어둔 채 자정이 지나거나 다시 돌아오면 상품을 갱신합니다.
  useEffect(() => {
    const refresh = () => setToday(koreaDayKey())
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const availableItems = dailyShopItems(job, today)
  const jobName = JOBS.find(entry => entry.id === job)?.name ?? '직업 선택 전'

  const balance = earnedGold - shop.spentGold

  async function purchase(itemId: PaidItemId) {
    if (loading || jobLoading || busy) return
    const item = SHOP_ITEMS.find((entry) => entry.id === itemId)
    if (!item || !availableItems.some(entry => entry.id === item.id) || shop.ownedItemIds.includes(item.id)) return
    if (balance < item.price) {
      setError('골드가 부족합니다. 퀘스트를 완료해 골드를 모아주세요.')
      return
    }
    setBusy(itemId)
    setError('')
    try {
      const walletRef = doc(db, 'users', userId, 'shop', 'state')
      // 거래 바깥에서 문서 목록을 조회한 뒤, 각 문서를 거래 안에서 다시 읽습니다.
      const questList = await getDocs(collection(db, 'users', userId, 'quests'))
      const questRefs = questList.docs.map((snapshot) => snapshot.ref)

      await runTransaction(db, async (transaction) => {
        const walletSnap = await transaction.get(walletRef)
        const jobSnap = await transaction.get(doc(db, 'users', userId, 'profile', 'job'))
        const actualJob = parseJobId(jobSnap.data()?.jobId)
        if (!dailyShopItems(actualJob, koreaDayKey()).some(entry => entry.id === item.id)) throw new Error('NOT_FOR_SALE')
        const current = parseShop(walletSnap.data())
        const questDocs = await Promise.all(questRefs.map((ref) => transaction.get(ref)))
        const actualEarned = questDocs.reduce((sum, questSnap) => {
          if (!questSnap.exists()) return sum
          const quest = questSnap.data()
          if (!quest.completed || !['쉬움', '보통', '어려움'].includes(quest.difficulty)) return sum
          return sum + calculateReward(quest.difficulty as Difficulty).gold
        }, 0)

        if (current.ownedItemIds.includes(item.id)) throw new Error('ALREADY_OWNED')
        if (actualEarned - current.spentGold < item.price) throw new Error('INSUFFICIENT_GOLD')

        transaction.set(walletRef, {
          ownedItemIds: [...current.ownedItemIds, item.id],
          spentGold: current.spentGold + item.price,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      })
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'NOT_FOR_SALE') setError('판매 목록이 변경되었습니다. 새로고침해 주세요.')
      else if (cause instanceof Error && cause.message === 'ALREADY_OWNED') setError('이미 구매한 아이템입니다.')
      else if (cause instanceof Error && cause.message === 'INSUFFICIENT_GOLD') setError('구매 가능한 골드가 부족합니다.')
      else setError('구매에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="panel shop-panel">
      <h2>🛍️ 모험가 상점</h2>
      <p className="shop-description">공통 상품과 현재 직업 전용 상품을 구매할 수 있습니다. 구매한 장비는 모험가 페이지에서 장착할 수 있습니다.</p>
      <p className="shop-balance">🪙 보유 골드: {balance} G</p>
      <p className="shop-rotation">📅 {today} (한국 시간) · {jobName} 전용 상품은 매일 자정에 3개 중 2개가 변경됩니다.</p>
      {(loading || jobLoading) && <p className="shop-message">인벤토리를 불러오는 중입니다...</p>}
      <div className="shop-grid">
        {availableItems.map((item) => {
          const owned = shop.ownedItemIds.includes(item.id)
          return (
            <article className="shop-item" key={item.id}>
              <div className="shop-item-symbol" aria-hidden="true">{item.emoji}</div>
              <h3>{item.name}</h3>
              <p className="shop-category">{item.job === null ? '공통 상품' : '직업 전용'}</p>
              <p>{item.description}</p>
              <p className="shop-price">{item.price} G</p>
              <button type="button" disabled={loading || jobLoading || busy !== null || owned || balance < item.price}
                onClick={() => { void purchase(item.id) }}>
                {owned ? '보유 중 ✓' : busy === item.id ? '구매 중...' : '구매'}
              </button>
            </article>
          )
        })}
      </div>
      <JobChangePanel userId={userId} earnedGold={earnedGold} />
      <p className="shop-message">🎒 보유한 구매 장비: {shop.ownedItemIds.length}개 (판매 종료된 상품도 유지됩니다)</p>
      {error && <p className="shop-error" role="alert">{error}</p>}
    </section>
  )
}
