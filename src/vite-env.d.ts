/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN?: string
  readonly VITE_RPC_URL?: string
  readonly VITE_REGISTRY_ADDRESS?: string
  readonly VITE_INDEXER_URL?: string
  readonly VITE_MOCK_API_URL?: string
  readonly VITE_PET_SHOP_DEMO?: string
  readonly VITE_UNITY_PLAYER_URL?: string
  readonly VITE_X402_FACILITATOR_URL?: string
  /** Pet shop: `direct` | `gasless` | `both` (default `both` when x402 URL set). */
  readonly VITE_PET_SHOP_PAYMENT_MODE?: string
}

