import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import PixelCharacter, { type CharacterEquipment } from './PixelCharacter'
import './EquipmentCustomizer.css'

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
    ],
  },
  {
    slot: 'outfit' as const,
    label: '의상',
    options: [
      { value: 'basic', label: '기본 의상' },
      { value: 'cape', label: '분홍 망토' },
    ],
  },
  {
    slot: 'accessory' as const,
    label: '액세서리',
    options: [
      { value: 'none', label: '착용 안 함' },
      { value: 'star', label: '별 장식' },
    ],
  },
]

function normalizeEquipment(raw: Record<string, unknown> | undefined): Required<CharacterEquipment> {
  return {
    hat: raw?.hat === 'wizard' ? 'wizard' : 'none',
    outfit: raw?.outfit === 'cape' ? 'cape' : 'basic',
    accessory: raw?.accessory === 'star' ? 'star' : 'none',
  }
}

/**
 * 무료 기본 장비의 장착 상태만 관리합니다.
 * Firestore 경로: users/{userId}/equipment/current
 * 상점 구매/소유권 확인/골드 차감은 다음 단계에서 구현합니다.
 */
export default function EquipmentCustomizer({ userId }: { userId: string }) {
  const [equipment, setEquipment] = useState<Required<CharacterEquipment>>(DEFAULT_EQUIPMENT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  async function equip(slot: Slot, value: string) {
    if (loading || saving) return
    const choice = CHOICES.find((item) => item.slot === slot)
    if (!choice?.options.some((option) => option.value === value)) return
    if (equipment[slot] === value) return

    const nextEquipment = { ...equipment, [slot]: value } as Required<CharacterEquipment>
    setSaving(true)
    setError('')

    try {
      // 한 문서에 현재 장착 상태 전체를 저장합니다.
      await setDoc(
        doc(db, 'users', userId, 'equipment', 'current'),
        { ...nextEquipment, updatedAt: serverTimestamp() },
        { merge: true },
      )
      // 최종 화면 상태는 onSnapshot을 통해 서버 데이터와 동기화됩니다.
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
        <p className="equipment-hint">기본 지급 장비입니다. 골드를 사용하지 않습니다.</p>
        {CHOICES.map((choice) => (
          <label className="equipment-row" key={choice.slot}>
            <span>{choice.label}</span>
            <select
              aria-label={`${choice.label} 장착`}
              value={equipment[choice.slot]}
              disabled={loading || saving}
              onChange={(event) => { void equip(choice.slot, event.target.value) }}
            >
              {choice.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ))}
        {loading && <p className="equipment-hint">장비를 불러오는 중...</p>}
        {saving && <p className="equipment-hint">장비 저장 중...</p>}
        {error && <p className="equipment-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
