import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './ui/AppLayout'
import { HomePage } from './views/HomePage'
import { RegistryPage } from './views/RegistryPage'
import { AssetPage } from './views/AssetPage'
import { AssetHistoryPage } from './views/AssetHistoryPage'
import { MyAssetsPage } from './views/MyAssetsPage'
import { MySubscriptionsPage } from './views/MySubscriptionsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'registry', element: <RegistryPage /> },
      { path: 'assets/:assetId', element: <AssetPage /> },
      { path: 'assets/:assetId/history', element: <AssetHistoryPage /> },
      { path: 'me/assets', element: <MyAssetsPage /> },
      { path: 'me/subscriptions', element: <MySubscriptionsPage /> },
    ],
  },
])

