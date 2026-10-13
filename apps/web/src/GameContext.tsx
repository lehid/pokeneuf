import { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { GameStore } from './store';

export const GameStoreContext = createContext<StoreApi<GameStore> | null>(null);

export function useGame<T>(selector: (state: GameStore) => T): T {
  const store = useContext(GameStoreContext);
  if (!store) throw new Error('useGame must be used inside a GameStoreContext');
  return useStore(store, selector);
}
