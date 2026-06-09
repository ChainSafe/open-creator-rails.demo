/**
 * Human-readable subscriber id paired with the wallet in `subscriberHash(subscriberId, address)`.
 * Keep this constant across subscribe, indexer lists, status reads, and cancel signatures.
 */
export const DEMO_SUBSCRIBER_ID = 'demo'

/** x402 gasless path — must match `open-creator-rails.x402-adapter` `deriveSubscriberId`. */
export const X402_SUBSCRIBER_ID = 'ocr-permit-v1'
