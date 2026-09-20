import type { Room, Opening, MatSpec, MaterialResult, RoomMatLine } from '../types';
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

export function calcMaterials(
  rooms: Room[],
  openings: Opening[],
  materials: MatSpec[]
): MaterialResult[] {
  const merged = new Map<string, MaterialResult>();
  const matMap = new Map(materials.map((m) => [m.id, m]));

  const addEntry = (mat: MatSpec, line: RoomMatLine, detail: string) => {
    const existing = merged.get(mat.id);
    if (existing) {
      existing.quantity += line.quantity;
      existing.totalPrice += line.quantity * mat.price;
      existing.details += '; ' + detail;
      existing.roomLines.push(line);
    } else {
      merged.set(mat.id, {
        matId: mat.id,
        name: mat.name,
        unit: mat.unit,
        quantity: line.quantity,
        totalPrice: line.quantity * mat.price,
        details: detail,
        roomLines: [line],
      });
    }
  };

  for (const room of rooms) {
    const area = polygonArea(room.polygon);
    const perim = polygonPerimeter(room.polygon);
    const wallArea = perim * room.heightMm;

    const roomOpenings = openings.filter((o) => o.roomId === room.id);
    const openingArea = roomOpenings.reduce((sum, o) => sum + o.widthMm * o.heightMm, 0);
    const doorOpenings = roomOpenings.filter((o) => o.type === 'door' || o.type === 'sliding');
    const doorWidth = doorOpenings.reduce((sum, o) => sum + o.widthMm, 0);

    // 多边形坐标单位是 mm，换算成 m² / m 后再算用量
    const areaM2 = area / 1e6;
    const wallAreaM2 = wallArea / 1e6;
    const openingAreaM2 = openingArea / 1e6;
    const perimM = perim / 1000;
    const doorWidthM = doorWidth / 1000;

    const netWallAreaM2 = Math.max(0, wallAreaM2 - openingAreaM2);
    const netSkirtingLenM = Math.max(0, perimM - doorWidthM);

    // Floor
    const floorMat = matMap.get(room.floorMat);
    if (floorMat) {
      const qty = areaM2 * (1 + floorMat.lossRate);
      let detail = `房间"${room.name}"地面: ${areaM2.toFixed(2)}m² × (1+${(floorMat.lossRate * 100).toFixed(0)}%) = ${qty.toFixed(2)}${floorMat.unit}`;
      if (room.floorMat === 'tile_800') {
        const pcs = Math.ceil(qty / 0.64);
        detail += `，约${pcs}块`;
      } else if (room.floorMat === 'tile_300') {
        const pcs = Math.ceil(qty / 0.18);
        detail += `，约${pcs}块`;
      }
      addEntry(
        floorMat,
        {
          roomId: room.id,
          roomName: room.name,
          part: '地面',
          base: areaM2,
          deduction: 0,
          baseUnit: 'm²',
          lossRate: floorMat.lossRate,
          quantity: qty,
        },
        detail
      );
    }

    // Wall paint or wallpaper
    const wallMat = matMap.get(room.wallMat);
    if (wallMat) {
      const qty = netWallAreaM2 * (1 + wallMat.lossRate);
      const detail = `房间"${room.name}"墙面: (${perimM.toFixed(2)}m×${(room.heightMm / 1000).toFixed(2)}m - ${openingAreaM2.toFixed(2)}m²) × (1+${(wallMat.lossRate * 100).toFixed(0)}%) = ${qty.toFixed(2)}${wallMat.unit}`;
      addEntry(
        wallMat,
        {
          roomId: room.id,
          roomName: room.name,
          part: '墙面',
          base: wallAreaM2,
          deduction: Math.min(openingAreaM2, wallAreaM2),
          baseUnit: 'm²',
          lossRate: wallMat.lossRate,
          quantity: qty,
        },
        detail
      );
    }

    // Skirting (if not tile wall)
    if (room.wallMat !== 'tile_300') {
      const skMat = matMap.get('skirting');
      if (skMat) {
        const qty = netSkirtingLenM * (1 + skMat.lossRate);
        addEntry(
          skMat,
          {
            roomId: room.id,
            roomName: room.name,
            part: '踢脚线',
            base: perimM,
            deduction: Math.min(doorWidthM, perimM),
            baseUnit: 'm',
            lossRate: skMat.lossRate,
            quantity: qty,
          },
          `房间"${room.name}"踢脚线: (${perimM.toFixed(2)} - ${doorWidthM.toFixed(2)})m × (1+${(skMat.lossRate * 100).toFixed(0)}%) = ${qty.toFixed(2)}m`
        );
      }
    }
  }

  return Array.from(merged.values());
}

export function calcPaintBuckets(areaM2: number, coveragePerBucket: number): number {
  return Math.ceil(areaM2 / coveragePerBucket);
}
