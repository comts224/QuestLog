import { useEffect, useState } from 'react'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import PixelCharacter, { type CharacterEquipment } from './PixelCharacter'
import AppearanceCustomizer from './AppearanceCustomizer'
import { DEFAULT_APPEARANCE, type CharacterAppearance } from './appearance/palette'
import './EquipmentCustomizer.css'
import { FREE_EQUIPMENT, SHOP_ITEMS, isOwnedEquipment } from './shop/catalog'
import { JOBS, JOB_GEAR_CHOICES, STARTER_GEAR, isJobStarter, parseJobId, type JobId } from './jobs/starterEquipment'
import { EMPTY_SHOP, parseShop } from './shop/shopState'

type Slot = 'hat' | 'outfit' | 'accessory'

const DEFAULT_EQUIPMENT: Required<CharacterEquipment> = {
  hat: 'none',
  outfit: 'basic',
  accessory: 'none',
}

const BASE_CHOICES = [
  { slot: 'hat' as const, label: '모자', options: [
    { value: 'none', label: '착용 안 함' },
    { value: 'wizard', label: '마법사 모자 (기존 무료)' },
    { value: 'crown', label: '황금 왕관 (상점)' },
  ] },
  { slot: 'outfit' as const, label: '의상', options: [
    { value: 'basic', label: '기본 의상' },
    { value: 'cape', label: '분홍 망토 (기존 무료)' },
    { value: 'forest', label: '숲의 의상 (상점)' },
  ] },
  { slot: 'accessory' as const, label: '액세서리', options: [
    { value: 'none', label: '착용 안 함' },
    { value: 'star', label: '별 장식 (기존 무료)' },
    { value: 'moon', label: '달빛 장식 (상점)' },
  ] },
]
const KNOWN_HATS = ['none','wizard','crown','straw','helmet','hood']
const KNOWN_OUTFITS = ['basic','cape','forest','overalls','mageRobe','armor','doctorCoat','clericRobe']
const KNOWN_ACCESSORIES = ['none','star','moon','medicalBag','holySymbol']

function normalizeEquipment(raw: Record<string, unknown> | undefined): Required<CharacterEquipment> {
  return {
    hat: (KNOWN_HATS.includes(String(raw?.hat)) ? raw?.hat : 'none') as Required<CharacterEquipment>['hat'],
    outfit: (KNOWN_OUTFITS.includes(String(raw?.outfit)) ? raw?.outfit : 'basic') as Required<CharacterEquipment>['outfit'],
    accessory: (KNOWN_ACCESSORIES.includes(String(raw?.accessory)) ? raw?.accessory : 'none') as Required<CharacterEquipment>['accessory'],
  }
}

/**
 * 기본 지급 장비와 상점 구매 장비를 장착/해제합니다.
 * Firestore 경로: users/{userId}/equipment/current
 * 유료 장비는 구매 소유권을 트랜잭션 안에서 다시 확인합니다.
 */
export default function EquipmentCustomizer({ userId }: { userId: string }) {
  const [equipment, setEquipment] = useState<Required<CharacterEquipment>>(DEFAULT_EQUIPMENT)
  const [appearance, setAppearance] = useState<CharacterAppearance>(DEFAULT_APPEARANCE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [job, setJob] = useState<JobId | null>(null)
  const [jobLoading, setJobLoading] = useState(true)
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

  // 직업을 이미 선택한 기존 계정도 한 번만 직업 장비를 지급합니다.
  // 구매 내역과 기존 인벤토리는 삭제하지 않습니다.
  useEffect(() => {
    setJob(null)
    setJobLoading(true)
    const jobRef = doc(db, 'users', userId, 'profile', 'job')
    return onSnapshot(jobRef, (snapshot) => {
      setJob(parseJobId(snapshot.data()?.jobId))
      setJobLoading(false)
    }, () => {
      setError('직업 정보를 불러오지 못했습니다.')
      setJobLoading(false)
    })
  }, [userId])

  useEffect(() => {
    if (!job) return
    const equipmentRef = doc(db, 'users', userId, 'equipment', 'current')
    const jobRef = doc(db, 'users', userId, 'profile', 'job')
    void runTransaction(db, async transaction => {
      const jobSnapshot = await transaction.get(jobRef)
      const actualJob = parseJobId(jobSnapshot.data()?.jobId)
      const equipmentSnapshot = await transaction.get(equipmentRef)
      if (!actualJob || equipmentSnapshot.data()?.starterJobId === actualJob) return
      transaction.set(equipmentRef, {
        ...STARTER_GEAR[actualJob],
        starterJobId: actualJob,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    }).catch(() => setError('직업 기본 장비를 지급하지 못했습니다. 새로고침해 주세요.'))
  }, [userId, job])

  const choices = BASE_CHOICES.map((choice) => ({
    ...choice,
    options: [...choice.options,
      ...(job ? JOB_GEAR_CHOICES[job].filter(item => item.slot === choice.slot).map(item => ({ value: item.value, label: item.label })) : []),
    ].filter((option, index, arr) => arr.findIndex(entry => entry.value === option.value) === index),
  }))

  async function equip(slot: Slot, value: string) {
    if (loading || saving || shopLoading || jobLoading || !job) return
    const choice = choices.find((item) => item.slot === slot)
    if (!choice?.options.some((option) => option.value === value)) return
    if (equipment[slot] === value) return
    if (!isOwnedEquipment(slot, value, shop.ownedItemIds) && !isJobStarter(job, slot, value)) {
      setError('상점에서 먼저 아이템을 구매해 주세요.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const equipmentRef = doc(db, 'users', userId, 'equipment', 'current')
      const shopRef = doc(db, 'users', userId, 'shop', 'state')
      const jobRef = doc(db, 'users', userId, 'profile', 'job')
      await runTransaction(db, async (transaction) => {
        const shopSnapshot = await transaction.get(shopRef)
        const jobSnapshot = await transaction.get(jobRef)
        const actualJob = parseJobId(jobSnapshot.data()?.jobId)
        const ownedIds = parseShop(shopSnapshot.data()).ownedItemIds
        if (!isOwnedEquipment(slot, value, ownedIds) && !isJobStarter(actualJob, slot, value)) throw new Error('NOT_OWNED')
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
        <PixelCharacter equipment={equipment} appearance={appearance} />
      </div>

      <AppearanceCustomizer userId={userId} onAppearanceChange={setAppearance} />

      <div className="equipment-controls">
        <h3>장비 장착</h3>
        <p className="equipment-hint">현재 직업: {JOBS.find(item => item.id === job)?.name ?? '선택 전'} · 직업 기본 장비는 무료 지급됩니다.</p>
        <p className="equipment-hint">기본 장비는 무료입니다. 상점 장비는 구매 후 장착할 수 있습니다.</p>
        {choices.map((choice) => (
          <label className="equipment-row" key={choice.slot}>
            <span>{choice.label}</span>
            <select
              aria-label={`${choice.label} 장착`}
              value={equipment[choice.slot]}
              disabled={loading || saving || shopLoading || jobLoading || !job}
              onChange={(event) => { void equip(choice.slot, event.target.value) }}
            >
              {choice.options.map((option) => {
                const owned = FREE_EQUIPMENT[choice.slot].includes(option.value) ||
                  SHOP_ITEMS.some((item) => item.id === option.value && shop.ownedItemIds.includes(item.id)) ||
                  isJobStarter(job, choice.slot, option.value)
                return <option key={option.value} value={option.value} disabled={!owned}>
                  {option.label}{owned ? '' : ' · 미보유'}
                </option>
              })}
            </select>
          </label>
        ))}
        {(loading || shopLoading || jobLoading) && <p className="equipment-hint">장비와 인벤토리를 불러오는 중...</p>}
        {saving && <p className="equipment-hint">장비 저장 중...</p>}
        {error && <p className="equipment-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
