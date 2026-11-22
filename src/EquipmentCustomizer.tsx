import { useEffect, useState } from 'react'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import PixelCharacter, { type CharacterEquipment } from './PixelCharacter'
import './EquipmentCustomizer.css'
import { FREE_EQUIPMENT, SHOP_ITEMS, isOwnedEquipment } from './shop/catalog'
import { EMPTY_SHOP, parseShop } from './shop/shopState'

type Slot = 'hat' | 'outfit' | 'accessory'

const DEFAULT_EQUIPMENT: Required<CharacterEquipment> = {
  hat: 'none',
  outfit: 'basic',
  accessory: 'none',
}

const CHOICES = [
  {
    slot: 'hat' as const,
    label: '모자',
    options: [
      { value: 'none', label: '착용 안 함' },
      { value: 'wizard', label: '마법사 모자' },
      { value: 'crown', label: '황금 왕관 (상점)' },
    ],
  },
  {
    slot: 'outfit' as const,
    label: '의상',
    options: [
      { value: 'basic', label: '기본 의상' },
      { value: 'cape', label: '분홍 망토' },
      { value: 'forest', label: '숲의 의상 (상점)' },
    ],
  },
  {
    slot: 'accessory' as const,
    label: '액세서리',
    options: [
      { value: 'none', label: '착용 안 함' },
      { value: 'star', label: '별 장식' },
      { value: 'moon', label: '달빛 장식 (상점)' },
    ],
  },
]

function normalizeEquipment(raw: Record<string, unknown> | undefined): Required<CharacterEquipment> {
  return {
    hat: raw?.hat === 'wizard' || raw?.hat === 'crown' ? raw.hat : 'none',
    outfit: raw?.outfit === 'cape' || raw?.outfit === 'forest' ? raw.outfit : 'basic',
    accessory: raw?.accessory === 'star' || raw?.accessory === 'moon' ? raw.accessory : 'none',
  }
}

/**
 * 기본 지급 장비와 상점 구매 장비를 장착/해제합니다.
 * Firestore 경로: users/{userId}/equipment/current
 * 유료 장비는 구매 소유권을 트랜잭션 안에서 다시 확인합니다.
 */
export default function EquipmentCustomizer({ userId }: { userId: string }) {
  const [equipment, setEquipment] = useState<Required<CharacterEquipment>>(DEFAULT_EQUIPMENT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [shop, setShop] = useState(EMPTY_SHOP)
  const [shopLoading, setShopLoading] = useState(true)

  useEffect(() => {
    setEquipment(DEFAULT_EQUIPMENT)
    setLoading(true)
    setError('')

    const equipmentDoc = doc(db, 'users', userId, 'equipment', 'current')
    return onSnapshot(
      equipmentDoc,
      (snapshot) => {
        setEquipment(normalizeEquipment(snapshot.data()))
        setLoading(false)
      },
      () => {
        setError('장비 정보를 불러오지 못했습니다.')
        setLoading(false)
      },
    )
  }, [userId])

  useEffect(() => {
    setShop(EMPTY_SHOP)
    setShopLoading(true)
    return onSnapshot(doc(db, 'users', userId, 'shop', 'state'), (snapshot) => {
      setShop(parseShop(snapshot.data()))
      setShopLoading(false)
    }, () => {
      setError('인벤토리를 불러오지 못했습니다.')
      setShopLoading(false)
    })
  }, [userId])

  async function equip(slot: Slot, value: string) {
    if (loading || saving || shopLoading) return
    const choice = CHOICES.find((item) => item.slot === slot)
    if (!choice?.options.some((option) => option.value === value)) return
    if (equipment[slot] === value) return
    if (!isOwnedEquipment(slot, value, shop.ownedItemIds)) {
      setError('상점에서 먼저 아이템을 구매해 주세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const equipmentRef = doc(db, 'users', userId, 'equipment', 'current')
      const shopRef = doc(db, 'users', userId, 'shop', 'state')
      await runTransaction(db, async (transaction) => {
        const shopSnapshot = await transaction.get(shopRef)
        const ownedIds = parseShop(shopSnapshot.data()).ownedItemIds
        if (!isOwnedEquipment(slot, value, ownedIds)) throw new Error('NOT_OWNED')
        const equipmentSnapshot = await transaction.get(equipmentRef)
        const currentEquipment = normalizeEquipment(equipmentSnapshot.data())
        const nextEquipment = { ...currentEquipment, [slot]: value }
        transaction.set(equipmentRef, { ...nextEquipment, updatedAt: serverTimestamp() }, { merge: true })
      })
    } catch {
      setError('장비 저장에 실패했습니다. 다시 선택해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="equipment-customizer">
      <div className="character-image">
        <PixelCharacter equipment={equipment} />
      </div>

      <div className="equipment-controls">
        <h3>장비 장착</h3>
        <p className="equipment-hint">기본 장비는 무료입니다. 상점 장비는 구매 후 장착할 수 있습니다.</p>
        {CHOICES.map((choice) => (
          <label className="equipment-row" key={choice.slot}>
            <span>{choice.label}</span>
            <select
              aria-label={`${choice.label} 장착`}
              value={equipment[choice.slot]}
              disabled={loading || saving || shopLoading}
              onChange={(event) => { void equip(choice.slot, event.target.value) }}
            >
              {choice.options.map((option) => {
                const owned = FREE_EQUIPMENT[choice.slot].includes(option.value) ||
                  SHOP_ITEMS.some((item) => item.id === option.value && shop.ownedItemIds.includes(item.id))
                return <option key={option.value} value={option.value} disabled={!owned}>
                  {option.label}{owned ? '' : ' · 미보유'}
                </option>
              })}
            </select>
          </label>
        ))}
        {(loading || shopLoading) && <p className="equipment-hint">장비와 인벤토리를 불러오는 중...</p>}
        {saving && <p className="equipment-hint">장비 저장 중...</p>}
        {error && <p className="equipment-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
