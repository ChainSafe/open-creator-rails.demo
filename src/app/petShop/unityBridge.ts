export type UnityPetState = {
  slug: string
  name: string
  emoji: string
  active: boolean
  endTime: number | null
}

export type UnitySubscriptionMessage = {
  type: 'ocr:subscriptions'
  wallet: string | null
  pets: UnityPetState[]
}

export function postSubscriptionsToUnity(
  iframe: HTMLIFrameElement | null,
  payload: UnitySubscriptionMessage,
): void {
  if (!iframe?.contentWindow) return
  iframe.contentWindow.postMessage(payload, '*')
}
