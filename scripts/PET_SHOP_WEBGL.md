# Pet Shop WebGL — web sub → spawn/despawn

Minimal release path: subscribe on the web app → pet appears in the Unity farm → despawn when the subscription expires.

## Protocol

The farm page (`/pet-shop`) posts this to the Unity iframe:

```json
{
  "type": "ocr:subscriptions",
  "wallet": "0x55fe…",
  "pets": [
    {
      "slug": "cow",
      "name": "Bessie",
      "emoji": "🐄",
      "active": true,
      "endTime": 1710000000
    }
  ]
}
```

- **`active: true`** → Unity spawns the 3D prefab for `slug`
- **`active: false`** (or missing from active set) → Unity despawns it
- Poll interval on web: **8 seconds** (`useUnityPetStates`)

## Unity side

| File | Role |
|------|------|
| `Scenes/Farm.unity` | Farm-only scene (no wallet connect) |
| `Scripts/PetShop/OcrSubscriptionBridge.cs` | Receives `ocr:subscriptions` |
| `Scripts/PetShop/PetFarmSpawner.cs` | Spawn/despawn Suriyun prefabs by slug |
| `Assets/WebGLTemplates/OCRFarm/` | WebGL template — forwards parent `postMessage` to Unity |

## Export WebGL build

1. Open `open-creator-rails.unity/SampleProject` in Unity.
2. **File → Build Settings → WebGL**
3. For the pet-shop embed, enable **only** `Farm.unity` (disable `Loading` / `Demo` if you want a smaller build).
4. **Player Settings → WebGL → Resolution and Presentation → WebGL Template → OCRFarm** (forwards parent `postMessage` to `PetFarm.OnParentMessage`).
5. **Player Settings → Other → Managed Stripping Level → Minimal** (required for Nethereum/WebGL).
6. Build into the demo player folder:

   ```
   open-creator-rails.demo/public/pet-shop-player/
   ```

   Unity overwrites the placeholder `index.html` with the real loader.

7. Run the demo:

   ```bash
   cd open-creator-rails.demo
   pnpm dev:pet-shop
   ```

8. Connect wallet → subscribe on **Creators Hub** → open **My Little Farm** — pet should spawn in 3D.

## Placeholder player

Until you export WebGL, `/pet-shop-player/index.html` is a CSS/emoji fallback that uses the same `ocr:subscriptions` message. Useful for testing the web bridge without Unity.

## Editor testing (without WebGL)

1. Open `Farm.unity` and press Play.
2. Select **PetFarm** in the hierarchy.
3. Context menu on **Ocr Subscription Bridge** → **Debug/Simulate active cow**.
