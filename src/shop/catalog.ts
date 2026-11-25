import type { JobId } from '../jobs/starterEquipment'

/** 저장된 아이템 ID는 변경하지 마세요. 기존 구매 내역과 연결됩니다. */
export const SHOP_ITEMS = [
  { id: 'crown', slot: 'hat', name: '황금 왕관', price: 20, description: '반짝이는 왕관', emoji: '👑', job: null },
  { id: 'forest', slot: 'outfit', name: '숲의 의상', price: 30, description: '숲빛 망토', emoji: '🧥', job: null },
  { id: 'moon', slot: 'accessory', name: '달빛 장식', price: 15, description: '푸른 달 장식', emoji: '🌙', job: null },
  { id: 'harvestHat', slot: 'hat', name: '수확제 밀짚모자', price: 25, description: '황금 리본이 달린 농부 모자', emoji: '🌻', job: 'farmer' },
  { id: 'fieldCoat', slot: 'outfit', name: '풍요의 작업복', price: 35, description: '튼튼한 초록 작업복', emoji: '🌿', job: 'farmer' },
  { id: 'wheatCharm', slot: 'accessory', name: '밀 이삭 장식', price: 20, description: '작은 황금 이삭', emoji: '🌾', job: 'farmer' },
  { id: 'arcaneHat', slot: 'hat', name: '신비의 마법모', price: 25, description: '청록빛 보석 장식', emoji: '🔮', job: 'mage' },
  { id: 'cosmicRobe', slot: 'outfit', name: '별무리 로브', price: 35, description: '밤하늘색 로브', emoji: '🌌', job: 'mage' },
  { id: 'crystalOrb', slot: 'accessory', name: '수정 구슬', price: 20, description: '푸르게 빛나는 수정', emoji: '🔹', job: 'mage' },
  { id: 'royalHelm', slot: 'hat', name: '왕실 수호 투구', price: 25, description: '금빛 문양의 투구', emoji: '🪖', job: 'knight' },
  { id: 'crimsonArmor', slot: 'outfit', name: '진홍 갑옷', price: 35, description: '붉게 빛나는 갑옷', emoji: '🛡️', job: 'knight' },
  { id: 'guardianBadge', slot: 'accessory', name: '수호 기사 휘장', price: 20, description: '은빛 휘장', emoji: '🎖️', job: 'knight' },
  { id: 'careCap', slot: 'hat', name: '치유사의 모자', price: 25, description: '청록 의료 모자', emoji: '🩹', job: 'doctor' },
  { id: 'healerCoat', slot: 'outfit', name: '치유사의 가운', price: 35, description: '깨끗한 하늘색 가운', emoji: '🥼', job: 'doctor' },
  { id: 'medicineKit', slot: 'accessory', name: '응급 치료함', price: 20, description: '붉은 십자가 치료함', emoji: '🧰', job: 'doctor' },
  { id: 'haloHood', slot: 'hat', name: '빛의 두건', price: 25, description: '푸른 띠의 두건', emoji: '🕊️', job: 'cleric' },
  { id: 'sunRobe', slot: 'outfit', name: '태양의 예복', price: 35, description: '금빛 예복', emoji: '☀️', job: 'cleric' },
  { id: 'blessedCharm', slot: 'accessory', name: '축복의 부적', price: 20, description: '작게 빛나는 성물', emoji: '✨', job: 'cleric' },
] as const

export type PaidItemId = (typeof SHOP_ITEMS)[number]['id']
export type EquipmentSlot = 'hat' | 'outfit' | 'accessory'

export const FREE_EQUIPMENT: Record<EquipmentSlot, readonly string[]> = {
  hat: ['none', 'wizard'],
  outfit: ['basic', 'cape'],
  accessory: ['none', 'star'],
}

export function isOwnedEquipment(slot: EquipmentSlot, itemId: string, ownedIds: readonly string[]) {
  if (FREE_EQUIPMENT[slot].includes(itemId)) return true
  return SHOP_ITEMS.some((item) => item.id === itemId && item.slot === slot && ownedIds.includes(item.id))
}

/** 한국 시간 YYYY-MM-DD 문자열. 브라우저가 다른 지역에 있어도 동일합니다. */
export function koreaDayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (name: string) => parts.find(item => item.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** 직업마다 전용 상품 3개 중 하루에 2개를 판매합니다. 서버 스케줄러가 필요 없습니다. */
export function dailyShopItems(job: JobId | null, dateKey: string) {
  const common = SHOP_ITEMS.filter(item => item.job === null)
  if (!job) return common
  const variants = SHOP_ITEMS.filter(item => item.job === job)
  const day = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86400000)
  if (!Number.isFinite(day)) return common
  const excludedIndex = ((day % variants.length) + variants.length) % variants.length
  return [...common, ...variants.filter((_, index) => index !== excludedIndex)]
}
