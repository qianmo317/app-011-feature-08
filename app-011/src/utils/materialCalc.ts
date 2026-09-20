import type { Room, Opening, MatSpec, MaterialResult, MaterialRoomLine, Unit } from '../types';
import { polygonArea, polygonPerimeter } from './geometry';

export const DEFAULT_MATS: MatSpec[] = [
  { id: 'paint', name: '乳胶漆', unit: 'm2', coverage: 12, lossRate: 0.05, price: 35 },
  { id: 'primer', name: '底漆', unit: 'm2', coverage: 14, lossRate: 0.05, price: 25 },
  { id: 'tile_800', name: '瓷砖800×800', unit: 'pcs', coverage: 0.64, lossRate: 0.08, price: 85 },
  { id: 'tile_300', name: '瓷砖300×600', unit: 'pcs', coverage: 0.18, lossRate: 0.1, price: 12 },
  { id: 'floor', name: '木地板', unit: 'm2', coverage: 1, lossRate: 0.05, price: 180 },
  { id: 'wallpaper', name: '壁纸(0.53m×10m)', unit: 'roll', coverage: 5, lossRate: 0.15, price: 120 },
  { id: 'skirting', name: '踢脚线', unit: 'm', coverage: 1, lossRate: 0.03, price: 25 },
];

/** matId -> roomId -> 自定义单价 */
export type RoomPriceMap = Record<string, Record<string, number>>;

interface RoomLineDraft {
  matId: string;
  name: string;
  unit: Unit;
  roomId: string;
  roomName: string;
  gross: number;
  deduct: number;
  measureUnit: string;
  lossRate: number;
  quantity: number;
  detail: string;
}

export function calcMaterials(
  rooms: Room[],
  openings: Opening[],
  materials: MatSpec[],
  roomPrices: RoomPriceMap = {}
): MaterialResult[] {
  const drafts: RoomLineDraft[] = [];
  const matMap = new Map(materials.map((m) => [m.id, m]));

  for (const room of rooms) {
    const area = polygonArea(room.polygon);
    const perim = polygonPerimeter(room.polygon);
    const wallArea = perim * room.heightMm;

    const roomOpenings = openings.filter((o) => o.roomId === room.id);
    const openingArea = roomOpenings.reduce((sum, o) => sum + o.widthMm * o.heightMm, 0);
    const doorOpenings = roomOpenings.filter((o) => o.type === 'door' || o.type === 'sliding');
    const doorWidth = doorOpenings.reduce((sum, o) => sum + o.widthMm, 0);

    const netWallArea = Math.max(0, wallArea - openingArea);
    const netSkirtingLen = Math.max(0, perim - doorWidth);

    // Floor
    const floorMat = matMap.get(room.floorMat);
    if (floorMat) {
      const qty = area * (1 + floorMat.lossRate);
      let detail = `房间"${room.name}"地面: ${area.toFixed(2)}m² × (1+${(floorMat.lossRate * 100).toFixed(0)}%) = ${qty.toFixed(2)}${floorMat.unit}`;
      if (room.floorMat === 'tile_800') {
        const pcs = Math.ceil(qty / 0.64);
        detail += `，约${pcs}块`;
      } else if (room.floorMat === 'tile_300') {
        const pcs = Math.ceil(qty / 0.18);
        detail += `，约${pcs}块`;
      }
      drafts.push({
        matId: floorMat.id,
        name: floorMat.name,
        unit: floorMat.unit,
        roomId: room.id,
        roomName: room.name,
        gross: area,
        deduct: 0,
        measureUnit: 'm²',
        lossRate: floorMat.lossRate,
        quantity: qty,
        detail,
      });
    }

    // Wall paint or wallpaper
    const wallMat = matMap.get(room.wallMat);
    if (wallMat) {
      const qty = netWallArea * (1 + wallMat.lossRate);
      const detail = `房间"${room.name}"墙面: (${perim.toFixed(0)}mm×${room.heightMm}mm - ${openingArea.toFixed(0)}mm²) × (1+${(wallMat.lossRate * 100).toFixed(0)}%) = ${qty.toFixed(2)}${wallMat.unit}`;
      drafts.push({
        matId: wallMat.id,
        name: wallMat.name,
        unit: wallMat.unit,
        roomId: room.id,
        roomName: room.name,
        gross: wallArea,
        deduct: openingArea,
        measureUnit: 'mm²',
        lossRate: wallMat.lossRate,
        quantity: qty,
        detail,
      });
    }

    // Skirting (if not tile wall)
    if (room.wallMat !== 'tile_300') {
      const skMat = matMap.get('skirting');
      if (skMat) {
        const qty = netSkirtingLen * (1 + skMat.lossRate);
        drafts.push({
          matId: skMat.id,
          name: skMat.name,
          unit: skMat.unit,
          roomId: room.id,
          roomName: room.name,
          gross: perim,
          deduct: doorWidth,
          measureUnit: 'mm',
          lossRate: skMat.lossRate,
          quantity: qty,
          detail: `房间"${room.name}"踢脚线: (${perim.toFixed(0)} - ${doorWidth.toFixed(0)})mm × (1+${(skMat.lossRate * 100).toFixed(0)}%) = ${qty.toFixed(2)}m`,
        });
      }
    }
  }

  // Merge same materials, keeping one line per room
  const merged = new Map<string, MaterialResult>();
  for (const d of drafts) {
    const override = roomPrices[d.matId]?.[d.roomId];
    const basePrice = matMap.get(d.matId)?.price ?? 0;
    const price = override ?? basePrice;
    const line: MaterialRoomLine = {
      roomId: d.roomId,
      roomName: d.roomName,
      gross: d.gross,
      deduct: d.deduct,
      measureUnit: d.measureUnit,
      lossRate: d.lossRate,
      quantity: d.quantity,
      price,
      overridden: override != null,
      totalPrice: d.quantity * price,
      detail: d.detail,
    };
    const existing = merged.get(d.matId);
    if (existing) {
      existing.quantity += d.quantity;
      existing.totalPrice += line.totalPrice;
      existing.details += '; ' + d.detail;
      existing.roomLines.push(line);
    } else {
      merged.set(d.matId, {
        matId: d.matId,
        name: d.name,
        unit: d.unit,
        quantity: d.quantity,
        totalPrice: line.totalPrice,
        details: d.detail,
        roomLines: [line],
      });
    }
  }

  return Array.from(merged.values());
}

export function calcPaintBuckets(areaM2: number, coveragePerBucket: number): number {
  return Math.ceil(areaM2 / coveragePerBucket);
}
