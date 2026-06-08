import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './ui/AppLayout'
import { CreatorConsoleParentRoute } from './ui/CreatorConsoleParentRoute'
import { RegistryPage } from './views/RegistryPage'
import { AssetPage } from './views/AssetPage'
import { AssetHistoryPage } from './views/AssetHistoryPage'
import { CreatorConsole } from './views/CreatorConsole'
import { MySubscriptionsPage } from './views/MySubscriptionsPage'
import { PetShopPage } from './views/PetShopPage'
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <RegistryPage /> },
      { path: 'pet-shop', element: <PetShopPage /> },
      { path: 'hub', element: <RegistryPage /> },
      { path: 'assets/:assetId', element: <AssetPage /> },
      { path: 'assets/:assetId/history', element: <AssetHistoryPage /> },
      {
        path: 'creator-console',
        element: <CreatorConsoleParentRoute />,
        children: [{ index: true, element: <CreatorConsole /> }],
      },
      { path: 'subscriptions', element: <MySubscriptionsPage /> },
    ],
  },
])

