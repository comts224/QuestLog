import type { DocumentData } from 'firebase/firestore'
import { SHOP_ITEMS, type PaidItemId } from './catalog'

export type ShopState = { ownedItemIds: PaidItemId[]; spentGold: number }
export const EMPTY_SHOP: ShopState = { ownedItemIds: [], spentGold: 0 }

/** Firestore 데이터는 외부 입력이므로 화면에서 사용할 필드만 정규화합니다. */
export function parseShop(data: DocumentData | undefined): ShopState {
  const ownedItemIds = SHOP_ITEMS
    .filter((item) => Array.isArray(data?.ownedItemIds) && data.ownedItemIds.includes(item.id))
    .map((item) => item.id)
  const spent = data?.spentGold
  return {
    ownedItemIds,
    spentGold: typeof spent === 'number' && Number.isSafeInteger(spent) && spent >= 0 ? spent : 0,
  }
}
