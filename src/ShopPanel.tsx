import { useEffect, useState } from 'react'
import {
  collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { calculateReward, type Difficulty } from './strategies/rewardStrategy'
import { SHOP_ITEMS, type PaidItemId } from './shop/catalog'
import { EMPTY_SHOP, parseShop } from './shop/shopState'
import './ShopPanel.css'

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

  const balance = earnedGold - shop.spentGold

  async function purchase(itemId: PaidItemId) {
    if (loading || busy) return
    const item = SHOP_ITEMS.find((entry) => entry.id === itemId)
    if (!item || shop.ownedItemIds.includes(item.id)) return
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
      if (cause instanceof Error && cause.message === 'ALREADY_OWNED') setError('이미 구매한 아이템입니다.')
      else if (cause instanceof Error && cause.message === 'INSUFFICIENT_GOLD') setError('구매 가능한 골드가 부족합니다.')
      else setError('구매에 실패했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="panel shop-panel">
      <h2>🛍️ 모험가 상점</h2>
      <p className="shop-description">퀘스트로 모은 골드로 장비를 구매해 보세요. 구매한 장비는 위의 장비 장착 메뉴에 나타납니다.</p>
      <p className="shop-balance">🪙 보유 골드: {balance} G</p>
      {loading && <p className="shop-message">인벤토리를 불러오는 중입니다...</p>}
      <div className="shop-grid">
        {SHOP_ITEMS.map((item) => {
          const owned = shop.ownedItemIds.includes(item.id)
          return (
            <article className="shop-item" key={item.id}>
              <div className="shop-item-symbol" aria-hidden="true">{item.slot === 'hat' ? '👑' : item.slot === 'outfit' ? '🧥' : '🌙'}</div>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <p className="shop-price">{item.price} G</p>
              <button type="button" disabled={loading || busy !== null || owned || balance < item.price}
                onClick={() => { void purchase(item.id) }}>
                {owned ? '보유 중 ✓' : busy === item.id ? '구매 중...' : '구매'}
              </button>
            </article>
          )
        })}
      </div>
      <p className="shop-message">🎒 인벤토리: {shop.ownedItemIds.length} / {SHOP_ITEMS.length}개 구매</p>
      {error && <p className="shop-error" role="alert">{error}</p>}
    </section>
  )
}
