import { Fragment, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore } from '../store';
import { calcMaterials, calcPaintBuckets } from '../utils/materialCalc';
import { polygonPerimeter } from '../utils/geometry';
import type { MatSpec } from '../types';

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

  const roomPrices = plan.roomPrices || {};
  const results = calcMaterials(plan.rooms, plan.openings, plan.materials, roomPrices);
  const totalPrice = results.reduce((s, r) => s + r.totalPrice, 0);
  const overrideTotal = results.reduce(
    (s, r) => s + r.roomLines.filter((l) => l.overridden).length,
    0
  );

  const isOpen = (matId: string, overrideCount: number) =>
    expanded[matId] ?? overrideCount > 0;

  const setAll = (v: boolean) => {
    const next: Record<string, boolean> = {};
    results.forEach((r) => {
      next[r.matId] = v;
    });
    setExpanded(next);
  };

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
    const price = parseFloat(editRoomPrice);
    if (!isNaN(price)) {
      setRoomPrice(plan.id, matId, roomId, price);
    }
    setEditingRoom(null);
  };

  const copyTable = () => {
    const lines = ['材料名称\t房间\t单位\t数量\t单价\t总价\t说明'];
    for (const r of results) {
      const mat = plan.materials.find((m) => m.id === r.matId);
      lines.push(
        `${r.name}\t合计(${r.roomLines.length}个房间)\t${r.unit}\t${r.quantity.toFixed(2)}\t${mat?.price || 0}\t${r.totalPrice.toFixed(2)}\t`
      );
      for (const l of r.roomLines) {
        lines.push(
          `\t${l.roomName}\t${r.unit}\t${l.quantity.toFixed(2)}\t${l.price}\t${l.totalPrice.toFixed(2)}\t${l.detail}`
        );
      }
    }
    lines.push(`\t\t\t\t总计:\t${totalPrice.toFixed(2)}`);
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
        <span>
          房间自定义价: <strong>{overrideTotal}</strong> 项
        </span>
        <span>
          预算总计: <strong style={{ color: '#e74c3c', fontSize: 18 }}>¥{totalPrice.toFixed(2)}</strong>
        </span>
      </div>

      <div className="toolbar no-print">
        <button className="btn btn-primary" onClick={copyTable}>
          复制表格文本
        </button>
        <button className="btn btn-secondary" onClick={() => setAll(true)}>
          全部展开
        </button>
        <button className="btn btn-secondary" onClick={() => setAll(false)}>
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
              <th>计算明细（面积 · 洞口 · 损耗）</th>
              <th>用量</th>
              <th>占比</th>
              <th>单价</th>
              <th>总价</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const mat = plan.materials.find((m) => m.id === r.matId);
              const isEditing = editingMat === r.matId;
              const overrideCount = r.roomLines.filter((l) => l.overridden).length;
              const open = isOpen(r.matId, overrideCount);
              return (
                <Fragment key={r.matId}>
                  <tr>
                    <td>
                      <span
                        className="row-toggle"
                        onClick={() => setExpanded((prev) => ({ ...prev, [r.matId]: !open }))}
                      >
                        {open ? '▼' : '▶'}
                      </span>
                      <strong>{r.name}</strong>
                      {overrideCount > 0 && (
                        <span className="override-tag">{overrideCount}个房间自定</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: '#999' }}>
                      {r.roomLines.length} 个房间 · 损耗 {((mat?.lossRate || 0) * 100).toFixed(0)}%
                    </td>
                    <td>
                      {r.quantity.toFixed(2)} {r.unit}
                    </td>
                    <td>100%</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          onBlur={() => handlePriceUpdate(r.matId)}
                          onKeyDown={(e) => e.key === 'Enter' && handlePriceUpdate(r.matId)}
                          autoFocus
                          style={{ width: 80 }}
                        />
                      ) : (
                        <span
                          onClick={() => { setEditingMat(r.matId); setEditPrice(String(mat?.price || 0)); }}
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          title="点击修改整项统一价"
                        >
                          ¥{mat?.price.toFixed(2) || 0}
                        </span>
                      )}
                      {overrideCount > 0 && <div className="bom-hint">统一价</div>}
                    </td>
                    <td>¥{r.totalPrice.toFixed(2)}</td>
                    <td>
                      <button className="btn btn-secondary" onClick={() => { setEditingMat(r.matId); setEditPrice(String(mat?.price || 0)); }}>
                        改价
                      </button>{' '}
                      {overrideCount > 0 && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => clearRoomPrices(plan.id, r.matId)}
                          title="清除该材料所有房间自定义价"
                        >
                          恢复统一价
                        </button>
                      )}
                    </td>
                  </tr>
                  {open &&
                    r.roomLines.map((l) => {
                      const share = r.quantity > 0 ? (l.quantity / r.quantity) * 100 : 0;
                      const editingThis =
                        editingRoom?.matId === r.matId && editingRoom?.roomId === l.roomId;
                      return (
                        <tr key={l.roomId} className="bom-room-row">
                          <td style={{ paddingLeft: 28 }}>└ {l.roomName}</td>
                          <td>
                            面积 {l.gross.toFixed(2)}
                            {l.measureUnit} · 扣洞口 {l.deduct.toFixed(2)}
                            {l.measureUnit} · 损耗 {(l.lossRate * 100).toFixed(0)}%
                            <div className="bom-detail">{l.detail}</div>
                          </td>
                          <td>
                            {l.quantity.toFixed(2)} {r.unit}
                          </td>
                          <td>
                            {share.toFixed(1)}%
                            <div className="share-bar">
                              <div style={{ width: `${share}%` }} />
                            </div>
                          </td>
                          <td>
                            {editingThis ? (
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
                                className={l.overridden ? 'price-override' : ''}
                                onClick={() => {
                                  setEditingRoom({ matId: r.matId, roomId: l.roomId });
                                  setEditRoomPrice(String(l.price));
                                }}
                                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                title="点击设置该房间单独单价"
                              >
                                ¥{l.price.toFixed(2)}
                              </span>
                            )}
                            {l.overridden && <span className="override-tag">自定</span>}
                          </td>
                          <td>¥{l.totalPrice.toFixed(2)}</td>
                          <td>
                            {l.overridden && (
                              <button
                                className="btn-link"
                                onClick={() => setRoomPrice(plan.id, r.matId, l.roomId, null)}
                                title="该房间恢复使用整项统一价"
                              >
                                用统一价
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold', background: '#f8f9fa' }}>
              <td colSpan={5}>合计</td>
              <td colSpan={2}>¥{totalPrice.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <PaintCalc rooms={plan.rooms} openings={plan.openings} materials={plan.materials} />
    </div>
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
