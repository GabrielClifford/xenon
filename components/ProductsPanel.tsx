'use client';

import { useState } from 'react';
import AllProducts from '@/components/products/AllProducts';
import CollectionsPage from '@/components/products/CollectionsPage';
import InventoryPage from '@/components/products/InventoryPage';
import PurchaseOrdersPage from '@/components/products/PurchaseOrdersPage';
import TransfersPage from '@/components/products/TransfersPage';

type Sub = 'all' | 'collections' | 'inventory' | 'purchase' | 'transfers';

const tabs: { id: Sub; label: string }[] = [
  { id: 'all', label: 'All products' },
  { id: 'collections', label: 'Collections' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'purchase', label: 'Purchase orders' },
  { id: 'transfers', label: 'Transfers' },
];

// The Products section.
export default function ProductsPanel({ businessId }: { businessId: string }) {
  const [sub, setSub] = useState<Sub>('all');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Products</h1>
        <p className="mt-1 text-sm text-slate-500">Add what you sell, organise it into collections and keep your stock right.</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Products sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            aria-current={sub === t.id ? 'page' : undefined}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${sub === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {sub === 'all' && <AllProducts businessId={businessId} />}
      {sub === 'collections' && <CollectionsPage businessId={businessId} />}
      {sub === 'inventory' && <InventoryPage businessId={businessId} />}
      {sub === 'purchase' && <PurchaseOrdersPage businessId={businessId} />}
      {sub === 'transfers' && <TransfersPage businessId={businessId} />}
    </div>
  );
}
