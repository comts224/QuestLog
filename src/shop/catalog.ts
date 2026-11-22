/** 상점 아이템 ID는 저장된 데이터의 식별자이므로 변경하지 마세요. */
export const SHOP_ITEMS = [
  { id: 'crown', slot: 'hat', name: '황금 왕관', price: 20, description: '반짝이는 왕관' },
  { id: 'forest', slot: 'outfit', name: '숲의 의상', price: 30, description: '숲빛 망토' },
  { id: 'moon', slot: 'accessory', name: '달빛 장식', price: 15, description: '푸른 달 장식' },
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
