import { create } from 'zustand';
import type { Notification } from '@/types';

type UiState = {
  notifications: Notification[];
  notify: (title: string, kind?: Notification['kind']) => void;
  dismiss: (id: string) => void;
};

export const useUiStore = create<UiState>(set => ({
  notifications: [],
  notify: (title, kind = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set(state => ({ notifications: [...state.notifications, { id, title, kind }] }));
    window.setTimeout(() => set(state => ({ notifications: state.notifications.filter(item => item.id !== id) })), 4500);
  },
  dismiss: id => set(state => ({ notifications: state.notifications.filter(item => item.id !== id) })),
}));
