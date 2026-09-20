export interface Pt {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  polygon: Pt[];
  heightMm: number;
  floorMat: string;
  wallMat: string;
}

export type OpeningType = 'door' | 'window' | 'arch' | 'sliding';

export interface Opening {
  id: string;
  roomId: string;
  wallIndex: number;
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  type: OpeningType;
}

export type OutletKind = 'socket' | 'switch' | 'net' | 'light' | 'water';

export interface Outlet {
  id: string;
  wallKey: string;
  xMm: number;
  heightMm: number;
  kind: OutletKind;
  circuit?: string;
}

export type Unit = 'm2' | 'm' | 'kg' | 'roll' | 'pcs';

export interface MatSpec {
  id: string;
  name: string;
  unit: Unit;
  coverage?: number;
  lossRate: number;
  price: number;
}

export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  rooms: Room[];
  openings: Opening[];
  outlets: Outlet[];
  materials: MatSpec[];
  /** 按房间自定义单价：matId -> roomId -> price，未设置的房间用整项统一价 */
  roomPrices?: Record<string, Record<string, number>>;
}

export interface WallSegment {
  roomId: string;
  index: number;
  p1: Pt;
  p2: Pt;
  lengthMm: number;
  angle: number;
}

export interface MaterialRoomLine {
  roomId: string;
  roomName: string;
  /** 扣洞口前的基量（地面面积 / 墙面展开 / 踢脚线延长） */
  gross: number;
  /** 洞口扣减 */
  deduct: number;
  /** gross/deduct 的计量单位（与现有计算口径一致） */
  measureUnit: string;
  lossRate: number;
  /** 用量 = (gross - deduct) × (1 + lossRate) */
  quantity: number;
  /** 生效单价：房间自定义价优先，否则整项统一价 */
  price: number;
  overridden: boolean;
  totalPrice: number;
  detail: string;
}

export interface MaterialResult {
  matId: string;
  name: string;
  unit: Unit;
  quantity: number;
  totalPrice: number;
  details: string;
  roomLines: MaterialRoomLine[];
}
