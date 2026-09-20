import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import { calcMaterials, calcPaintBuckets } from '../utils/materialCalc';
import { polygonPerimeter } from '../utils/geometry';
import type { MatSpec, MaterialResult } from '../types';

export default function BOM() {
  const { id } = useParams<{ id: string }>();
  const { getPlan, updateMaterials, setRoomPrice, clearRoomPrices } = useStore();
  const plan = getPlan(id!);
  const [editingMat, setEditingMat] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editingRoom, setEditingRoom] = useState<{ matId: string; roomId: string } | null>(null);
  const [editRoomPrice, setEditRoomPrice] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!plan) {
    return <div className="card">方案不存在</div>;
  }

  const results = calcMaterials(plan.rooms, plan.openings, plan.materials);
  const matMap = new Map(plan.materials.map((m) => [m.id, m]));
  const overrides = plan.priceOverrides ?? {};

  /** 某材料在某房间的实际单价：填过房间价用房间价，否则用整项统一价 */
  const priceFor = (matId: string, roomId: string) =>
    overrides[matId]?.[roomId] ?? matMap.get(matId)?.price ?? 0;

  /** 材料总价 = 各房间用量 × 各自单价 之和 */
  const matTotal = (r: MaterialResult) =>
    r.roomLines.reduce((s, l) => s + l.quantity * priceFor(r.matId, l.roomId), 0);

  const totalPrice = results.reduce((s, r) => s + matTotal(r), 0);
  const overrideCount = Object.values(overrides).reduce(
    (s, rooms) => s + Object.keys(rooms).length,
    0
  );

  const handlePriceUpdate = (matId: string) => {
    const price = parseFloat(editPrice);
    if (isNaN(price)) return;
    updateMaterials(
      plan.id,
      plan.materials.map((m) => (m.id === matId ? { ...m, price } : m))
    );
    setEditingMat(null);
  };

  const handleRoomPriceUpdate = (matId: string, roomId: string) => {
    const v = editRoomPrice.trim();
    if (v === '') {
      // 留空 = 清除房间价，回到整项统一价
      setRoomPrice(plan.id, matId, roomId, undefined);
    } else {
      const price = parseFloat(v);
      if (isNaN(price)) return;
      setRoomPrice(plan.id, matId, roomId, price);
    }
    setEditingRoom(null);
  };

  const toggleAll = (open: boolean) => {
    const next: Record<string, boolean> = {};
    for (const r of results) next[r.matId] = open;
    setExpanded(next);
  };

  const fmtBase = (v: number, unit: string) => `${v.toFixed(2)}${unit}`;

  const copyTable = () => {
    const lines = ['材料名称\t房间/部位\t基数\t扣洞口\t损耗\t数量\t单位\t占比\t单价\t总价'];
    for (const r of results) {
      const mat = matMap.get(r.matId);
      lines.push(
        `${r.name}\t整项\t\t\t${((mat?.lossRate ?? 0) * 100).toFixed(0)}%\t${r.quantity.toFixed(2)}\t${r.unit}\t100%\t${mat?.price ?? 0}\t${matTotal(r).toFixed(2)}`
      );
      for (const l of r.roomLines) {
        lines.push(
          `${r.name}\t${l.roomName}·${l.part}\t${fmtBase(l.base, l.baseUnit)}\t${l.deduction > 0 ? fmtBase(l.deduction, l.baseUnit) : '-'}\t${(l.lossRate * 100).toFixed(0)}%\t${l.quantity.toFixed(2)}\t${r.unit}\t${((l.quantity / r.quantity) * 100).toFixed(1)}%\t${priceFor(r.matId, l.roomId)}\t${(l.quantity * priceFor(r.matId, l.roomId)).toFixed(2)}`
        );
      }
    }
    lines.push(`\t\t\t\t\t\t\t\t总计:\t${totalPrice.toFixed(2)}`);
    navigator.clipboard.writeText(lines.join('\n'));
    alert('已复制为制表符分隔文本，可粘贴到Word/Excel');
  };

  return (
    <div>
      <h2 className="page-title">{plan.name} - 材料清单与预算</h2>

      <div className="tabs">
        <Link to={`/plan/${id}`} className="tab">
          平面绘制
        </Link>
        <Link to={`/plan/${id}/walls`} className="tab">
          墙面点位
        </Link>
        <Link to={`/plan/${id}/bom`} className="tab active">
          材料清单
        </Link>
        <Link to={`/plan/${id}/print`} className="tab">
          导出打印
        </Link>
      </div>

      <div className="info-bar">
        <span>
          材料项: <strong>{results.length}</strong>
        </span>
        {overrideCount > 0 && (
          <span>
            房间单独价: <strong style={{ color: '#e67e22' }}>{overrideCount} 项</strong>
          </span>
        )}
        <span>
          预算总计: <strong style={{ color: '#e74c3c', fontSize: 18 }}>¥{totalPrice.toFixed(2)}</strong>
        </span>
      </div>

      <div className="toolbar no-print">
        <button className="btn btn-primary" onClick={copyTable}>
          复制表格文本
        </button>
        <button className="btn btn-secondary" onClick={() => toggleAll(true)}>
          全部展开
        </button>
        <button className="btn btn-secondary" onClick={() => toggleAll(false)}>
          全部收起
        </button>
        <Link className="btn btn-secondary" to={`/plan/${id}/print`}>
          打印视图
        </Link>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>材料 / 房间</th>
              <th>基数</th>
              <th>扣洞口</th>
              <th>损耗</th>
              <th>数量</th>
              <th>占比</th>
              <th>单价</th>
              <th>总价</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const mat = matMap.get(r.matId);
              const isEditing = editingMat === r.matId;
              const isOpen = !!expanded[r.matId];
              const matOverrides = overrides[r.matId] ?? {};
              const matOverrideCount = Object.keys(matOverrides).length;
              return (
                <MatRows
                  key={r.matId}
                  r={r}
                  mat={mat}
                  isOpen={isOpen}
                  isEditing={isEditing}
                  editPrice={editPrice}
                  matOverrideCount={matOverrideCount}
                  total={matTotal(r)}
                  onToggle={() => setExpanded((e) => ({ ...e, [r.matId]: !e[r.matId] }))}
                  onStartEdit={() => {
                    setEditingMat(r.matId);
                    setEditPrice(String(mat?.price || 0));
                  }}
                  onEditPriceChange={setEditPrice}
                  onPriceUpdate={() => handlePriceUpdate(r.matId)}
                  onClearRoomPrices={() => clearRoomPrices(plan.id, r.matId)}
                >
                  {isOpen &&
                    r.roomLines.map((l) => {
                      const overridden = matOverrides[l.roomId] !== undefined;
                      const price = priceFor(r.matId, l.roomId);
                      const isRoomEditing =
                        editingRoom?.matId === r.matId && editingRoom?.roomId === l.roomId;
                      return (
                        <tr key={`${r.matId}-${l.roomId}`} className={`room-row${overridden ? ' overridden' : ''}`}>
                          <td className="room-name">
                            └ {l.roomName} · {l.part}
                            {overridden && <span className="override-badge">已改价</span>}
                          </td>
                          <td>{fmtBase(l.base, l.baseUnit)}</td>
                          <td>{l.deduction > 0 ? `-${fmtBase(l.deduction, l.baseUnit)}` : '-'}</td>
                          <td>{(l.lossRate * 100).toFixed(0)}%</td>
                          <td>
                            {l.quantity.toFixed(2)} {r.unit}
                          </td>
                          <td>{((l.quantity / r.quantity) * 100).toFixed(1)}%</td>
                          <td>
                            {isRoomEditing ? (
                              <input
                                type="number"
                                value={editRoomPrice}
                                onChange={(e) => setEditRoomPrice(e.target.value)}
                                onBlur={() => handleRoomPriceUpdate(r.matId, l.roomId)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRoomPriceUpdate(r.matId, l.roomId)}
                                autoFocus
                                style={{ width: 80 }}
                              />
                            ) : (
                              <span
                                className={overridden ? 'price-overridden' : ''}
                                onClick={() => {
                                  setEditingRoom({ matId: r.matId, roomId: l.roomId });
                                  setEditRoomPrice(String(price));
                                }}
                                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                title="点击单独填这个房间的单价，留空则回到整项统一价"
                              >
                                ¥{price.toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td>¥{(l.quantity * price).toFixed(2)}</td>
                          <td>
                            {overridden && (
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '2px 8px', fontSize: 12 }}
                                onClick={() => setRoomPrice(plan.id, r.matId, l.roomId, undefined)}
                              >
                                恢复
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </MatRows>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold', background: '#f8f9fa' }}>
              <td colSpan={7}>合计</td>
              <td colSpan={2}>¥{totalPrice.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
          点击材料行左侧箭头可按房间展开/收起；展开后点击房间行的单价可单独填价，留空即回到整项统一价。
        </div>
      </div>

      <PaintCalc rooms={plan.rooms} openings={plan.openings} materials={plan.materials} />
    </div>
  );
}

function MatRows({
  r,
  mat,
  isOpen,
  isEditing,
  editPrice,
  matOverrideCount,
  total,
  onToggle,
  onStartEdit,
  onEditPriceChange,
  onPriceUpdate,
  onClearRoomPrices,
  children,
}: {
  r: MaterialResult;
  mat: MatSpec | undefined;
  isOpen: boolean;
  isEditing: boolean;
  editPrice: string;
  matOverrideCount: number;
  total: number;
  onToggle: () => void;
  onStartEdit: () => void;
  onEditPriceChange: (v: string) => void;
  onPriceUpdate: () => void;
  onClearRoomPrices: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr>
        <td>
          <span className="mat-toggle" onClick={onToggle} title={isOpen ? '收起' : '按房间展开'}>
            {isOpen ? '▼' : '▶'}
          </span>
          {r.name}
          {matOverrideCount > 0 && (
            <span className="override-badge">{matOverrideCount}个房间单独价</span>
          )}
        </td>
        <td>-</td>
        <td>-</td>
        <td>{((mat?.lossRate ?? 0) * 100).toFixed(0)}%</td>
        <td>
          {r.quantity.toFixed(2)} {r.unit}
        </td>
        <td>100%</td>
        <td>
          {isEditing ? (
            <input
              type="number"
              value={editPrice}
              onChange={(e) => onEditPriceChange(e.target.value)}
              onBlur={onPriceUpdate}
              onKeyDown={(e) => e.key === 'Enter' && onPriceUpdate()}
              autoFocus
              style={{ width: 80 }}
            />
          ) : (
            <span onClick={onStartEdit} style={{ cursor: 'pointer', textDecoration: 'underline' }} title="整项统一价，点击修改">
              ¥{mat?.price.toFixed(2) || 0}
            </span>
          )}
        </td>
        <td>¥{total.toFixed(2)}</td>
        <td>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onStartEdit}>
              改价
            </button>
            {matOverrideCount > 0 && (
              <button
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={onClearRoomPrices}
                title="清除该材料所有房间的单独单价"
              >
                恢复统一价
              </button>
            )}
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}

function PaintCalc({
  rooms,
  openings,
  materials,
}: {
  rooms: { id: string; name: string; polygon: { x: number; y: number }[]; heightMm: number }[];
  openings: { roomId: string; widthMm: number; heightMm: number }[];
  materials: MatSpec[];
}) {
  const paintMat = materials.find((m) => m.id === 'paint');
  const primerMat = materials.find((m) => m.id === 'primer');
  if (!paintMat) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: 12, fontSize: 16 }}>油漆用量详细计算</h3>
      {rooms.map((room) => {
        const perim = polygonPerimeter(room.polygon);
        const wallArea = perim * room.heightMm;
        const roomOpenings = openings.filter((o) => o.roomId === room.id);
        const openingArea = roomOpenings.reduce((s, o) => s + o.widthMm * o.heightMm, 0);
        const netArea = Math.max(0, wallArea - openingArea);
        const buckets = calcPaintBuckets(netArea / 1000000, paintMat.coverage || 12);
        const primerBuckets = primerMat ? calcPaintBuckets(netArea / 1000000, primerMat.coverage || 14) : 0;

        return (
          <div key={room.id} style={{ marginBottom: 12, padding: 12, background: '#f8f9fa', borderRadius: 4 }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>{room.name}</div>
            <div style={{ fontSize: 13, color: '#666' }}>
              周长{perim.toFixed(0)}mm × 层高{room.heightMm}mm = {wallArea.toFixed(0)}mm²
              <br />
              扣门窗{openingArea.toFixed(0)}mm² → 净面积{netArea.toFixed(0)}mm² ({(netArea / 1000000).toFixed(2)}m²)
              <br />
              面漆: {buckets}桶 (每桶覆盖{paintMat.coverage}m²)
              {primerMat && <span> | 底漆: {primerBuckets}桶</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
