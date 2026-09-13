import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MemoryItem, Entity, CaptureInput, ItemType, EntityType } from '@/types';
import { captureService } from '@/services/captureService';
import { memoryService } from '@/services/memoryService';

interface BrainContextValue {
  items: MemoryItem[];
  entities: Entity[];
  isLoadingItems: boolean;
  isLoadingEntities: boolean;
  isCaptureModalOpen: boolean;
  openCaptureModal: () => void;
  closeCaptureModal: () => void;
  captureItem: (input: CaptureInput) => Promise<MemoryItem>;
  deleteItem: (id: string) => Promise<boolean>;
  refreshItems: (typeFilter?: ItemType) => Promise<void>;
  refreshEntities: (typeFilter?: EntityType) => Promise<void>;
}

const BrainContext = createContext<BrainContextValue | undefined>(undefined);

export const BrainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isLoadingEntities, setIsLoadingEntities] = useState(true);
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);

  const refreshItems = useCallback(async (typeFilter?: ItemType) => {
    setIsLoadingItems(true);
    try {
      const data = await captureService.getItemsByType(typeFilter);
      setItems(data);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  const refreshEntities = useCallback(async (typeFilter?: EntityType) => {
    setIsLoadingEntities(true);
    try {
      const data = await memoryService.getEntities(typeFilter);
      setEntities(data);
    } finally {
      setIsLoadingEntities(false);
    }
  }, []);

  useEffect(() => {
    refreshItems();
    refreshEntities();
  }, [refreshItems, refreshEntities]);

  // Global keyboard shortcut to open capture modal: Ctrl+K or Cmd+K or 'c' when not in input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCaptureModalOpen((prev) => !prev);
      } else if (!isInput && e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsCaptureModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openCaptureModal = () => setIsCaptureModalOpen(true);
  const closeCaptureModal = () => setIsCaptureModalOpen(false);

  const captureItem = async (input: CaptureInput): Promise<MemoryItem> => {
    const newItem = await captureService.captureItem(input);
    setItems((prev) => [newItem, ...prev]);
    return newItem;
  };

  const deleteItem = async (id: string): Promise<boolean> => {
    const success = await captureService.deleteItem(id);
    if (success) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
    return success;
  };

  return (
    <BrainContext.Provider
      value={{
        items,
        entities,
        isLoadingItems,
        isLoadingEntities,
        isCaptureModalOpen,
        openCaptureModal,
        closeCaptureModal,
        captureItem,
        deleteItem,
        refreshItems,
        refreshEntities,
      }}
    >
      {children}
    </BrainContext.Provider>
  );
};

export const useBrain = (): BrainContextValue => {
  const context = useContext(BrainContext);
  if (!context) {
    throw new Error('useBrain must be used within a BrainProvider');
  }
  return context;
};
