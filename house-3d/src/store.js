import { create } from 'zustand'

export const useStore = create((set) => ({
  unit: 'A', // 'A' or 'B'
  viewMode: 'top', // 'top' or 'walkthrough'
  furnitureEnabled: true,
  wallColor: '#ffffff',
  floorMaterial: 'wood', // 'wood' or 'tiles'
  
  setUnit: (unit) => set({ unit }),
  toggleViewMode: () => set((state) => ({ 
    viewMode: state.viewMode === 'top' ? 'walkthrough' : 'top' 
  })),
  toggleFurniture: () => set((state) => ({ 
    furnitureEnabled: !state.furnitureEnabled 
  })),
  setWallColor: (wallColor) => set({ wallColor }),
  setFloorMaterial: (floorMaterial) => set({ floorMaterial }),
}))
