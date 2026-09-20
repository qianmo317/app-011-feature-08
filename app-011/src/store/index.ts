import { create } from 'zustand';
import type { Plan, Room, Opening, Outlet, MatSpec } from '../types';
import { DEFAULT_MATS } from '../utils/materialCalc';

interface AppState {
  plans: Plan[];
  currentPlanId: string | null;
  scale: number;
  setScale: (s: number) => void;
  addPlan: (name: string) => string;
  deletePlan: (id: string) => void;
  getPlan: (id: string) => Plan | undefined;
  updatePlan: (id: string, updater: (plan: Plan) => Plan) => void;
  addRoom: (planId: string, room: Room) => void;
  updateRoom: (planId: string, roomId: string, updater: (room: Room) => Room) => void;
  deleteRoom: (planId: string, roomId: string) => void;
  addOpening: (planId: string, opening: Opening) => void;
  deleteOpening: (planId: string, openingId: string) => void;
  addOutlet: (planId: string, outlet: Outlet) => void;
  deleteOutlet: (planId: string, outletId: string) => void;
  updateMaterials: (planId: string, mats: MatSpec[]) => void;
  /** 设置某个房间某材料的自定义单价，price 为 null 时恢复整项统一价 */
  setRoomPrice: (planId: string, matId: string, roomId: string, price: number | null) => void;
  /** 清除某材料的所有房间自定义价，回到整项统一价 */
  clearRoomPrices: (planId: string, matId: string) => void;
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useStore = create<AppState>((set, get) => ({
  plans: [],
  currentPlanId: null,
  scale: 1,

  setScale: (s) => set({ scale: s }),

  addPlan: (name) => {
    const id = genId();
    const plan: Plan = {
      id,
      name,
      createdAt: Date.now(),
      rooms: [],
      openings: [],
      outlets: [],
      materials: [...DEFAULT_MATS],
      roomPrices: {},
    };
    set((state) => ({ plans: [...state.plans, plan], currentPlanId: id }));
    return id;
  },

  deletePlan: (id) =>
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== id),
      currentPlanId: state.currentPlanId === id ? null : state.currentPlanId,
    })),

  getPlan: (id) => get().plans.find((p) => p.id === id),

  updatePlan: (id, updater) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === id ? updater(p) : p)),
    })),

  addRoom: (planId, room) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, rooms: [...p.rooms, room] } : p
      ),
    })),

  updateRoom: (planId, roomId, updater) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, rooms: p.rooms.map((r) => (r.id === roomId ? updater(r) : r)) }
          : p
      ),
    })),

  deleteRoom: (planId, roomId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              rooms: p.rooms.filter((r) => r.id !== roomId),
              openings: p.openings.filter((o) => o.roomId !== roomId),
            }
          : p
      ),
    })),

  addOpening: (planId, opening) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, openings: [...p.openings, opening] } : p
      ),
    })),

  deleteOpening: (planId, openingId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, openings: p.openings.filter((o) => o.id !== openingId) }
          : p
      ),
    })),

  addOutlet: (planId, outlet) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId ? { ...p, outlets: [...p.outlets, outlet] } : p
      ),
    })),

  deleteOutlet: (planId, outletId) =>
    set((state) => ({
      plans: state.plans.map((p) =>
        p.id === planId
          ? { ...p, outlets: p.outlets.filter((o) => o.id !== outletId) }
          : p
      ),
    })),

  updateMaterials: (planId, mats) =>
    set((state) => ({
      plans: state.plans.map((p) => (p.id === planId ? { ...p, materials: mats } : p)),
    })),

  setRoomPrice: (planId, matId, roomId, price) =>
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p;
        const roomPrices = { ...(p.roomPrices || {}) };
        const matPrices = { ...(roomPrices[matId] || {}) };
        if (price == null) {
          delete matPrices[roomId];
        } else {
          matPrices[roomId] = price;
        }
        if (Object.keys(matPrices).length === 0) {
          delete roomPrices[matId];
        } else {
          roomPrices[matId] = matPrices;
        }
        return { ...p, roomPrices };
      }),
    })),

  clearRoomPrices: (planId, matId) =>
    set((state) => ({
      plans: state.plans.map((p) => {
        if (p.id !== planId) return p;
        const roomPrices = { ...(p.roomPrices || {}) };
        delete roomPrices[matId];
        return { ...p, roomPrices };
      }),
    })),
}));
