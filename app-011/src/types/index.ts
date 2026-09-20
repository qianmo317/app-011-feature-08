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
  /** 按房间单独填的单价：matId -> roomId -> price，未填的房间用整项统一价 */
  priceOverrides?: Record<string, Record<string, number>>;
}

export interface WallSegment {
  roomId: string;
  index: number;
  p1: Pt;
  p2: Pt;
  lengthMm: number;
  angle: number;
}

/** 材料在某个房间的一行用量明细 */
export interface RoomMatLine {
  roomId: string;
  roomName: string;
  /** 部位，如 地面 / 墙面 / 踢脚线 */
  part: string;
  /** 计算基数（面积或长度） */
  base: number;
  /** 扣掉的洞口（面积或长度） */
  deduction: number;
  /** base/deduction 的展示单位 */
  baseUnit: string;
  lossRate: number;
  /** 含损耗的用量 */
  quantity: number;
}

export interface MaterialResult {
  matId: string;
  name: string;
  unit: Unit;
  quantity: number;
  totalPrice: number;
  details: string;
  roomLines: RoomMatLine[];
}
