/* ===== State ===== */
const SHAPE_COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const state = {
    image: null,
    scale: { defined: false, realLength: 1, unit: 'µm', pixels: 0, factor: 0, p1: null, p2: null },
    shapes: [],
    nextShapeId: 1,
    activeShapeType: 'ellipse',
    selectedShapeId: null,
    mode: 'IDLE',
    interaction: { drawingStart: null, activeHandle: null, dragStart: null, hoverHandle: null, hoverShapeId: null, polyPoints: [] },
    config: { zoomLevel: 5, handleSize: 8, rotationHandleDistance: 30 }
};

/* ===== DOM ===== */
const els = {
    fileInput: document.getElementById('fileInput'),
    fileName: document.getElementById('fileName'),
    btnSetScale: document.getElementById('btnSetScale'),
    btnReset: document.getElementById('btnReset'),
    btnAddShape: document.getElementById('btnAddShape'),
    scaleLength: document.getElementById('scaleLength'),
    scaleUnit: document.getElementById('scaleUnit'),
    scaleInfo: document.getElementById('scaleInfo'),
    drawHint: document.getElementById('drawHint'),
    shapeList: document.getElementById('shapeList'),
    mainCanvas: document.getElementById('mainCanvas'),
    zoomLens: document.getElementById('zoomLens'),
    zoomCanvas: document.getElementById('zoomCanvas'),
    statusBar: document.getElementById('statusBar'),
    canvasWrapper: document.getElementById('canvas-wrapper'),
    dragOverlay: document.getElementById('dragOverlay'),
    welcomeMessage: document.getElementById('welcomeMessage'),
    btnExportImage: document.getElementById('btnExportImage'),
    btnExportTxt: document.getElementById('btnExportTxt')
};
const ctx = els.mainCanvas.getContext('2d');
const zoomCtx = els.zoomCanvas.getContext('2d');

/* ===== Init ===== */
function init() {
    els.fileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });
    els.btnSetScale.addEventListener('click', startScaleSetting);
    els.btnReset.addEventListener('click', resetAll);
    els.btnAddShape.addEventListener('click', startAddShape);
    els.mainCanvas.addEventListener('mousedown', onMouseDown);
    els.mainCanvas.addEventListener('mousemove', onMouseMove);
    els.mainCanvas.addEventListener('mouseup', onMouseUp);
    els.mainCanvas.addEventListener('dblclick', onDblClick);
    els.mainCanvas.addEventListener('mouseleave', () => { els.zoomLens.style.display = 'none'; });
    els.scaleLength.addEventListener('input', updateScaleValues);
    els.scaleUnit.addEventListener('input', updateScaleValues);
    document.body.addEventListener('dragover', e => { e.preventDefault(); els.dragOverlay.style.display = 'flex'; });
    document.body.addEventListener('dragleave', e => { e.preventDefault(); if (!e.relatedTarget || e.target === els.dragOverlay) els.dragOverlay.style.display = 'none'; });
    document.body.addEventListener('drop', e => { e.preventDefault(); els.dragOverlay.style.display = 'none'; if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); });
    document.addEventListener('keydown', onKeyDown);
    els.zoomCanvas.width = 240; els.zoomCanvas.height = 240;
    updateDrawHint();
}

/* ===== File Handling ===== */
function processFile(file) {
    const isTiff = /\.tiff?$/i.test(file.name);
    if (!file.type.startsWith('image/') && !isTiff) { showStatus("Error: Please drop an image file."); return; }
    els.fileName.textContent = file.name;
    if (isTiff) {
        const reader = new FileReader();
        reader.onload = e => {
            const ifds = UTIF.decode(e.target.result); UTIF.decodeImage(e.target.result, ifds[0]);
            const rgba = UTIF.toRGBA8(ifds[0]), w = ifds[0].width, h = ifds[0].height;
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            const cx = c.getContext('2d'), id = cx.createImageData(w, h); id.data.set(rgba); cx.putImageData(id, 0, 0);
            state.image = c; onImageLoaded();
        };
        reader.readAsArrayBuffer(file);
    } else {
        const reader = new FileReader();
        reader.onload = ev => { const img = new Image(); img.onload = () => { state.image = img; onImageLoaded(); }; img.src = ev.target.result; };
        reader.readAsDataURL(file);
    }
}

function onImageLoaded() {
    els.mainCanvas.width = state.image.width; els.mainCanvas.height = state.image.height;
    els.canvasWrapper.classList.add('has-image'); els.welcomeMessage.classList.add('hidden');
    resetStateForNewImage(); els.btnSetScale.disabled = false;
    render(); showStatus("Image loaded. Set Scale first.");
}

function resetStateForNewImage() {
    state.scale.defined = false; state.scale.p1 = null; state.scale.p2 = null;
    state.shapes = []; state.nextShapeId = 1; state.selectedShapeId = null;
    state.mode = 'IDLE'; state.interaction = { drawingStart: null, activeHandle: null, dragStart: null, hoverHandle: null, hoverShapeId: null, polyPoints: [] };
    els.btnSetScale.classList.remove('active'); els.scaleInfo.textContent = "Scale not defined"; els.scaleInfo.style.color = "var(--warning)";
    els.btnAddShape.disabled = true; updateShapeList();
}

function resetAll() {
    els.fileInput.value = ''; els.fileName.textContent = 'No file selected';
    state.image = null; els.mainCanvas.width = 0; els.mainCanvas.height = 0;
    els.canvasWrapper.classList.remove('has-image'); els.welcomeMessage.classList.remove('hidden');
    els.btnSetScale.disabled = true; resetStateForNewImage(); render(); showStatus("Reset complete.");
}

/* ===== Scale ===== */
function startScaleSetting() {
    if (!state.image) return;
    state.mode = 'SETTING_SCALE_1'; state.scale.p1 = null; state.scale.p2 = null; state.scale.defined = false;
    els.btnSetScale.classList.add('active'); render(); showStatus("Click first point for scale bar.");
}
function updateScaleValues() {
    state.scale.realLength = parseFloat(els.scaleLength.value) || 0;
    state.scale.unit = els.scaleUnit.value || 'units';
    if (state.scale.defined) { calculateScaleFactor(); updateShapeList(); }
}
function calculateScaleFactor() {
    if (!state.scale.p1 || !state.scale.p2) return;
    const dx = state.scale.p2.x - state.scale.p1.x, dy = state.scale.p2.y - state.scale.p1.y;
    state.scale.pixels = Math.sqrt(dx * dx + dy * dy);
    state.scale.factor = state.scale.realLength / state.scale.pixels;
    els.scaleInfo.textContent = `1 px = ${state.scale.factor.toPrecision(4)} ${state.scale.unit}`;
    els.scaleInfo.style.color = "var(--text-muted)";
}

/* ===== Shape Type ===== */
function selectShapeType(type) {
    state.activeShapeType = type;
    document.querySelectorAll('.shape-type-selector .btn').forEach(b => b.classList.toggle('selected', b.dataset.type === type));
    updateDrawHint();
}
function updateDrawHint() {
    const hints = { ellipse: 'Click & drag on image to draw ellipse', rectangle: 'Click & drag on image to draw rectangle', polygon: 'Click to add vertices, double-click to close' };
    els.drawHint.textContent = hints[state.activeShapeType] || '';
}
function startAddShape() {
    if (!state.image || !state.scale.defined) return;
    if (state.activeShapeType === 'polygon') {
        state.mode = 'DRAWING_POLYGON'; state.interaction.polyPoints = [];
        showStatus("Click to add polygon vertices. Double-click to close.");
    } else {
        state.mode = 'DRAWING'; showStatus(`Click & drag to draw ${state.activeShapeType}.`);
    }
    els.btnAddShape.classList.add('active');
}

/* ===== Geometry Helpers ===== */
function getMousePos(e) {
    const r = els.mainCanvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * els.mainCanvas.width / r.width, y: (e.clientY - r.top) * els.mainCanvas.height / r.height };
}
function rotatePoint(px, py, cx, cy, angle) {
    const c = Math.cos(angle), s = Math.sin(angle), dx = px - cx, dy = py - cy;
    return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}
function isPointInEllipse(px, py, sh) {
    const dx = px - sh.cx, dy = py - sh.cy, c = Math.cos(-sh.rotation), s = Math.sin(-sh.rotation);
    const rx = dx * c - dy * s, ry = dx * s + dy * c;
    return (rx * rx) / (sh.rx * sh.rx) + (ry * ry) / (sh.ry * sh.ry) <= 1;
}
function isPointInRect(px, py, sh) {
    const dx = px - sh.cx, dy = py - sh.cy, c = Math.cos(-sh.rotation), s = Math.sin(-sh.rotation);
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    return Math.abs(lx) <= sh.w / 2 && Math.abs(ly) <= sh.h / 2;
}
function isPointInPolygon(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
function isPointInShape(px, py, sh) {
    if (sh.type === 'ellipse') return isPointInEllipse(px, py, sh);
    if (sh.type === 'rectangle') return isPointInRect(px, py, sh);
    if (sh.type === 'polygon' && sh.closed) return isPointInPolygon(px, py, sh.points);
    return false;
}
function getShapeAtPoint(px, py) {
    for (let i = state.shapes.length - 1; i >= 0; i--) { if (isPointInShape(px, py, state.shapes[i])) return state.shapes[i]; }
    return null;
}
function findShape(id) { return state.shapes.find(s => s.id === id); }
function nextColor() { return SHAPE_COLORS[(state.nextShapeId - 1) % SHAPE_COLORS.length]; }

/* ===== Handle positions ===== */
function getHandlePositions(sh) {
    const handles = [];
    if (sh.type === 'ellipse') {
        handles.push({ type: 'center', x: sh.cx, y: sh.cy });
        [{ t: 'axis-right', dx: sh.rx, dy: 0 }, { t: 'axis-left', dx: -sh.rx, dy: 0 }, { t: 'axis-bottom', dx: 0, dy: sh.ry }, { t: 'axis-top', dx: 0, dy: -sh.ry }].forEach(p => {
            const r = rotatePoint(sh.cx + p.dx, sh.cy + p.dy, sh.cx, sh.cy, sh.rotation);
            handles.push({ type: p.t, x: r.x, y: r.y });
        });
        const rot = rotatePoint(sh.cx, sh.cy - sh.ry - state.config.rotationHandleDistance, sh.cx, sh.cy, sh.rotation);
        handles.push({ type: 'rotation', x: rot.x, y: rot.y });
    } else if (sh.type === 'rectangle') {
        handles.push({ type: 'center', x: sh.cx, y: sh.cy });
        [{ t: 'axis-right', dx: sh.w / 2, dy: 0 }, { t: 'axis-left', dx: -sh.w / 2, dy: 0 }, { t: 'axis-bottom', dx: 0, dy: sh.h / 2 }, { t: 'axis-top', dx: 0, dy: -sh.h / 2 }].forEach(p => {
            const r = rotatePoint(sh.cx + p.dx, sh.cy + p.dy, sh.cx, sh.cy, sh.rotation);
            handles.push({ type: p.t, x: r.x, y: r.y });
        });
        const rot = rotatePoint(sh.cx, sh.cy - sh.h / 2 - state.config.rotationHandleDistance, sh.cx, sh.cy, sh.rotation);
        handles.push({ type: 'rotation', x: rot.x, y: rot.y });
    } else if (sh.type === 'polygon') {
        if (sh.points && sh.points.length > 0) {
            sh.points.forEach((p, i) => handles.push({ type: 'vertex-' + i, x: p.x, y: p.y, idx: i }));
        }
    }
    return handles;
}
function getHandleAtPoint(px, py, sh) {
    const handles = getHandlePositions(sh), thr = state.config.handleSize + 4;
    for (const h of handles) { if (Math.hypot(px - h.x, py - h.y) <= thr) return h; }
    return null;
}

/* ===== Area Calculation ===== */
function calcShapeArea(sh) {
    const f = state.scale.factor;
    if (sh.type === 'ellipse') return Math.PI * sh.rx * f * sh.ry * f;
    if (sh.type === 'rectangle') return sh.w * f * sh.h * f;
    if (sh.type === 'polygon' && sh.closed && sh.points.length >= 3) {
        let area = 0; const pts = sh.points;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) area += (pts[j].x * f) * (pts[i].y * f) - (pts[i].x * f) * (pts[j].y * f);
        return Math.abs(area) / 2;
    }
    return 0;
}

/* ===== Mouse Handlers ===== */
function onMouseDown(e) {
    if (!state.image) return;
    const pos = getMousePos(e);
    // Scale
    if (state.mode === 'SETTING_SCALE_1') { state.scale.p1 = pos; state.mode = 'SETTING_SCALE_2'; showStatus("Click second point."); render(); return; }
    if (state.mode === 'SETTING_SCALE_2') {
        state.scale.p2 = pos; state.scale.defined = true; state.mode = 'IDLE';
        els.btnSetScale.classList.remove('active'); calculateScaleFactor();
        els.btnAddShape.disabled = false; showStatus("Scale set. Click 'Add Shape' to draw."); render(); return;
    }
    // Polygon drawing
    if (state.mode === 'DRAWING_POLYGON') { state.interaction.polyPoints.push(pos); render(); return; }
    // Rect/Ellipse drawing
    if (state.mode === 'DRAWING') { state.interaction.drawingStart = pos; return; }
    // Handle interaction on selected shape
    if (state.selectedShapeId) {
        const sh = findShape(state.selectedShapeId);
        if (sh) {
            const h = getHandleAtPoint(pos.x, pos.y, sh);
            if (h) {
                if (h.type === 'rotation') state.mode = 'ROTATING';
                else if (h.type === 'center') state.mode = 'DRAGGING_SHAPE';
                else if (h.type.startsWith('vertex-')) state.mode = 'DRAGGING_VERTEX';
                else state.mode = 'RESIZING_HANDLE';
                state.interaction.activeHandle = h;
                state.interaction.dragStart = { x: pos.x, y: pos.y, shape: JSON.parse(JSON.stringify(sh)) };
                render(); return;
            }
        }
    }
    // Click on any shape
    const clicked = getShapeAtPoint(pos.x, pos.y);
    if (clicked) {
        state.selectedShapeId = clicked.id;
        state.mode = 'DRAGGING_SHAPE';
        state.interaction.activeHandle = { type: 'center' };
        state.interaction.dragStart = { x: pos.x, y: pos.y, shape: JSON.parse(JSON.stringify(clicked)) };
        updateShapeList(); render(); return;
    }
    // Deselect
    state.selectedShapeId = null; updateShapeList(); render();
}

function onMouseMove(e) {
    if (!state.image) return;
    const pos = getMousePos(e);
    // Drawing rect/ellipse
    if (state.mode === 'DRAWING' && state.interaction.drawingStart) {
        const s = state.interaction.drawingStart;
        // Preview shape (not yet added to state.shapes — draw directly)
        render();
        const x = Math.min(s.x, pos.x), y = Math.min(s.y, pos.y), w = Math.abs(pos.x - s.x), h = Math.abs(pos.y - s.y);
        if (state.activeShapeType === 'ellipse') {
            ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
            ctx.strokeStyle = nextColor(); ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
        } else {
            ctx.strokeStyle = nextColor(); ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
        }
        updateZoom(pos); return;
    }
    // Drawing polygon preview
    if (state.mode === 'DRAWING_POLYGON' && state.interaction.polyPoints.length > 0) {
        render();
        const pts = state.interaction.polyPoints, col = nextColor();
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
        pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); });
        updateZoom(pos); return;
    }
    // Dragging shape
    if (state.mode === 'DRAGGING_SHAPE' && state.selectedShapeId) {
        const sh = findShape(state.selectedShapeId), orig = state.interaction.dragStart.shape;
        const dx = pos.x - state.interaction.dragStart.x, dy = pos.y - state.interaction.dragStart.y;
        if (sh.type === 'polygon') { sh.points = orig.points.map(p => ({ x: p.x + dx, y: p.y + dy })); }
        else { sh.cx = orig.cx + dx; sh.cy = orig.cy + dy; }
        render(); updateZoom(pos); return;
    }
    // Resizing handle
    if (state.mode === 'RESIZING_HANDLE' && state.selectedShapeId) {
        const sh = findShape(state.selectedShapeId), orig = state.interaction.dragStart.shape, h = state.interaction.activeHandle;
        const dx = pos.x - orig.cx, dy = pos.y - orig.cy;
        const c = Math.cos(-orig.rotation), s = Math.sin(-orig.rotation);
        const lx = dx * c - dy * s, ly = dx * s + dy * c;
        if (sh.type === 'ellipse') {
            if (h.type === 'axis-right' || h.type === 'axis-left') sh.rx = Math.max(5, Math.abs(lx));
            else sh.ry = Math.max(5, Math.abs(ly));
        } else if (sh.type === 'rectangle') {
            if (h.type === 'axis-right' || h.type === 'axis-left') sh.w = Math.max(10, Math.abs(lx) * 2);
            else sh.h = Math.max(10, Math.abs(ly) * 2);
        }
        render(); updateZoom(pos); updateShapeList(); return;
    }
    // Dragging vertex
    if (state.mode === 'DRAGGING_VERTEX' && state.selectedShapeId) {
        const sh = findShape(state.selectedShapeId); sh.points[state.interaction.activeHandle.idx] = { x: pos.x, y: pos.y };
        render(); updateZoom(pos); updateShapeList(); return;
    }
    // Rotating
    if (state.mode === 'ROTATING' && state.selectedShapeId) {
        const sh = findShape(state.selectedShapeId), orig = state.interaction.dragStart.shape;
        sh.rotation = Math.atan2(pos.y - orig.cy, pos.x - orig.cx) - Math.PI / 2;
        render(); updateZoom(pos); return;
    }
    // Hover detection
    state.interaction.hoverHandle = null; state.interaction.hoverShapeId = null;
    if (state.selectedShapeId) {
        const sh = findShape(state.selectedShapeId);
        if (sh) { const h = getHandleAtPoint(pos.x, pos.y, sh); if (h) state.interaction.hoverHandle = { shapeId: sh.id, handle: h }; }
    }
    if (!state.interaction.hoverHandle) {
        const hov = getShapeAtPoint(pos.x, pos.y);
        if (hov) state.interaction.hoverShapeId = hov.id;
    }
    // Cursor
    if (state.interaction.hoverHandle) {
        const t = state.interaction.hoverHandle.handle.type;
        els.mainCanvas.style.cursor = t === 'rotation' ? 'grab' : t === 'center' ? 'move' : 'pointer';
    } else if (state.interaction.hoverShapeId) { els.mainCanvas.style.cursor = 'move'; }
    else if (state.mode === 'DRAWING' || state.mode === 'DRAWING_POLYGON') { els.mainCanvas.style.cursor = 'crosshair'; }
    else { els.mainCanvas.style.cursor = 'default'; }
    render(); updateZoom(pos);
}

function onMouseUp(e) {
    if (state.mode === 'DRAWING' && state.interaction.drawingStart) {
        const pos = getMousePos(e), s = state.interaction.drawingStart;
        const x = Math.min(s.x, pos.x), y = Math.min(s.y, pos.y), w = Math.abs(pos.x - s.x), h = Math.abs(pos.y - s.y);
        if (w > 5 && h > 5) {
            const color = nextColor();
            if (state.activeShapeType === 'ellipse') {
                state.shapes.push({ id: state.nextShapeId++, type: 'ellipse', cx: x + w / 2, cy: y + h / 2, rx: w / 2, ry: h / 2, rotation: 0, color });
            } else {
                state.shapes.push({ id: state.nextShapeId++, type: 'rectangle', cx: x + w / 2, cy: y + h / 2, w, h, rotation: 0, color });
            }
            state.selectedShapeId = state.nextShapeId - 1;
            showStatus(`${state.activeShapeType} added.`);
        } else { showStatus("Shape too small. Try again."); }
        state.mode = 'IDLE'; state.interaction.drawingStart = null;
        els.btnAddShape.classList.remove('active'); updateShapeList(); render(); return;
    }
    if (state.mode === 'DRAGGING_SHAPE' || state.mode === 'RESIZING_HANDLE' || state.mode === 'ROTATING' || state.mode === 'DRAGGING_VERTEX') {
        state.mode = 'IDLE'; state.interaction.activeHandle = null; state.interaction.dragStart = null;
        updateShapeList(); render();
    }
}

function onDblClick(e) {
    if (state.mode === 'DRAWING_POLYGON' && state.interaction.polyPoints.length >= 3) {
        const color = nextColor();
        state.shapes.push({ id: state.nextShapeId++, type: 'polygon', points: [...state.interaction.polyPoints], closed: true, color });
        state.selectedShapeId = state.nextShapeId - 1;
        state.mode = 'IDLE'; state.interaction.polyPoints = [];
        els.btnAddShape.classList.remove('active');
        showStatus("Polygon added."); updateShapeList(); render();
    }
}

function onKeyDown(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedShapeId && state.mode === 'IDLE') {
        deleteShape(state.selectedShapeId); e.preventDefault();
    }
    if (e.key === 'Escape') {
        if (state.mode === 'DRAWING_POLYGON') { state.mode = 'IDLE'; state.interaction.polyPoints = []; els.btnAddShape.classList.remove('active'); }
        if (state.mode === 'DRAWING') { state.mode = 'IDLE'; state.interaction.drawingStart = null; els.btnAddShape.classList.remove('active'); }
        state.selectedShapeId = null; updateShapeList(); render();
    }
}

function deleteShape(id) {
    state.shapes = state.shapes.filter(s => s.id !== id);
    if (state.selectedShapeId === id) state.selectedShapeId = null;
    updateShapeList(); render(); showStatus("Shape deleted.");
}

/* ===== Rendering ===== */
function render() {
    ctx.clearRect(0, 0, els.mainCanvas.width, els.mainCanvas.height);
    if (!state.image) return;
    ctx.drawImage(state.image, 0, 0);
    drawScale(ctx);
    state.shapes.forEach(sh => drawShape(ctx, sh, sh.id === state.selectedShapeId));
}

function drawScale(context) {
    if (state.scale.p1) { context.beginPath(); context.arc(state.scale.p1.x, state.scale.p1.y, 4, 0, Math.PI * 2); context.fillStyle = '#f59e0b'; context.fill(); }
    if (state.scale.p1 && state.scale.p2) {
        context.beginPath(); context.moveTo(state.scale.p1.x, state.scale.p1.y); context.lineTo(state.scale.p2.x, state.scale.p2.y);
        context.strokeStyle = '#f59e0b'; context.lineWidth = 2; context.stroke();
        context.beginPath(); context.arc(state.scale.p2.x, state.scale.p2.y, 4, 0, Math.PI * 2); context.fillStyle = '#f59e0b'; context.fill();
    }
}

function drawShape(context, sh, isSelected) {
    const color = isSelected ? '#3b82f6' : sh.color;
    const fillAlpha = isSelected ? 'rgba(59,130,246,0.1)' : hexToRgba(sh.color, 0.1);
    context.save();
    if (sh.type === 'ellipse') {
        context.translate(sh.cx, sh.cy); context.rotate(sh.rotation);
        context.beginPath(); context.ellipse(0, 0, sh.rx, sh.ry, 0, 0, 2 * Math.PI);
        context.fillStyle = fillAlpha; context.fill();
        context.strokeStyle = color; context.lineWidth = isSelected ? 3 : 2; context.stroke();
    } else if (sh.type === 'rectangle') {
        context.translate(sh.cx, sh.cy); context.rotate(sh.rotation);
        context.beginPath(); context.rect(-sh.w / 2, -sh.h / 2, sh.w, sh.h);
        context.fillStyle = fillAlpha; context.fill();
        context.strokeStyle = color; context.lineWidth = isSelected ? 3 : 2; context.stroke();
    } else if (sh.type === 'polygon' && sh.points.length > 0) {
        context.beginPath(); context.moveTo(sh.points[0].x, sh.points[0].y);
        sh.points.slice(1).forEach(p => context.lineTo(p.x, p.y));
        if (sh.closed) context.closePath();
        context.fillStyle = fillAlpha; context.fill();
        context.strokeStyle = color; context.lineWidth = isSelected ? 3 : 2; context.stroke();
    }
    context.restore();
    if (isSelected) drawHandles(context, sh);
}

function drawHandles(context, sh) {
    const handles = getHandlePositions(sh), hs = state.config.handleSize;
    handles.forEach(h => {
        const isHov = state.interaction.hoverHandle && state.interaction.hoverHandle.handle.type === h.type;
        const col = isHov ? '#fbbf24' : '#ffffff';
        context.beginPath();
        if (h.type === 'rotation') {
            const topDist = sh.type === 'ellipse' ? sh.ry : sh.h / 2;
            const top = rotatePoint(sh.cx, sh.cy - topDist, sh.cx, sh.cy, sh.rotation);
            context.moveTo(top.x, top.y); context.lineTo(h.x, h.y);
            context.strokeStyle = col; context.lineWidth = 1; context.setLineDash([4, 4]); context.stroke(); context.setLineDash([]);
            context.beginPath(); context.arc(h.x, h.y, hs, 0, Math.PI * 2); context.fillStyle = col; context.fill(); context.strokeStyle = '#000'; context.lineWidth = 2; context.stroke();
        } else if (h.type === 'center') {
            context.moveTo(h.x - hs, h.y); context.lineTo(h.x + hs, h.y); context.moveTo(h.x, h.y - hs); context.lineTo(h.x, h.y + hs);
            context.strokeStyle = col; context.lineWidth = 2; context.stroke();
        } else if (h.type.startsWith('vertex-')) {
            context.arc(h.x, h.y, 5, 0, Math.PI * 2); context.fillStyle = col; context.fill(); context.strokeStyle = '#000'; context.lineWidth = 1.5; context.stroke();
        } else {
            context.rect(h.x - hs / 2, h.y - hs / 2, hs, hs); context.fillStyle = col; context.fill(); context.strokeStyle = '#000'; context.lineWidth = 2; context.stroke();
        }
    });
}

function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
}

/* ===== Shape List UI ===== */
function updateShapeList() {
    const hasShapes = state.shapes.length > 0;
    els.btnExportImage.disabled = !hasShapes;
    els.btnExportTxt.disabled = !hasShapes;
    if (!hasShapes) { els.shapeList.innerHTML = '<div class="empty-list">No shapes yet</div>'; return; }
    const f = state.scale.factor, unit = state.scale.unit;
    const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const typeLabels = { ellipse: '⬮ Ellipse', rectangle: '▭ Rectangle', polygon: '⬠ Polygon' };
    els.shapeList.innerHTML = state.shapes.map(sh => {
        const area = (state.scale.defined && f > 0) ? `${fmt(calcShapeArea(sh))} ${unit}²` : '—';
        const sel = sh.id === state.selectedShapeId ? ' selected' : '';
        return `<div class="shape-item${sel}" onclick="selectShape(${sh.id})">
            <div class="shape-color" style="background:${sh.color}"></div>
            <div class="shape-info"><span class="shape-name">${typeLabels[sh.type]} #${sh.id}</span><br><span class="shape-area">${area}</span></div>
            <button class="btn-delete" onclick="event.stopPropagation();deleteShape(${sh.id})" title="Delete">✕</button></div>`;
    }).join('');
}
function selectShape(id) { state.selectedShapeId = id; updateShapeList(); render(); }

/* ===== Zoom ===== */
function updateZoom(pos) {
    const ls = 240, z = state.config.zoomLevel; els.zoomLens.style.display = 'block';
    const sw = ls / z, sh = ls / z; zoomCtx.imageSmoothingEnabled = false; zoomCtx.clearRect(0, 0, ls, ls);
    zoomCtx.drawImage(els.mainCanvas, pos.x - sw / 2, pos.y - sh / 2, sw, sh, 0, 0, ls, ls);
    zoomCtx.strokeStyle = 'rgba(255,255,255,0.5)'; zoomCtx.lineWidth = 1;
    zoomCtx.beginPath(); zoomCtx.moveTo(ls / 2, 0); zoomCtx.lineTo(ls / 2, ls); zoomCtx.moveTo(0, ls / 2); zoomCtx.lineTo(ls, ls / 2); zoomCtx.stroke();
}

function showStatus(msg) {
    els.statusBar.textContent = msg; els.statusBar.classList.add('visible');
    if (state.statusTimeout) clearTimeout(state.statusTimeout);
    state.statusTimeout = setTimeout(() => els.statusBar.classList.remove('visible'), 4000);
}

/* ===== Export ===== */
function exportImage() {
    if (!state.image || state.shapes.length === 0) return;
    const prevSel = state.selectedShapeId;
    state.selectedShapeId = null;
    render();
    const link = document.createElement('a');
    link.download = 'shapes_export.png';
    link.href = els.mainCanvas.toDataURL('image/png');
    link.click();
    state.selectedShapeId = prevSel;
    render();
    showStatus('Image exported.');
}

function exportTxt() {
    if (state.shapes.length === 0) return;
    const f = state.scale.factor, unit = state.scale.unit;
    const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const typeLabels = { ellipse: 'Ellipse', rectangle: 'Rectangle', polygon: 'Polygon' };
    const lines = ['ShapeAreaCalc - Area Report', '==========================='];
    if (state.scale.defined) lines.push(`Scale: ${state.scale.realLength} ${unit}  (1 px = ${state.scale.factor.toPrecision(4)} ${unit})`);
    if (els.fileName.textContent !== 'No file selected') lines.push(`Image: ${els.fileName.textContent}`);
    lines.push('');
    let total = 0;
    state.shapes.forEach(sh => {
        const area = (state.scale.defined && f > 0) ? calcShapeArea(sh) : 0;
        total += area;
        const areaStr = (state.scale.defined && f > 0) ? `${fmt(area)} ${unit}²` : '—';
        lines.push(`#${sh.id}  ${typeLabels[sh.type].padEnd(10)} ${areaStr}`);
    });
    lines.push('---------------------------');
    lines.push(`Total:      ${(state.scale.defined && f > 0) ? `${fmt(total)} ${unit}²` : '—'}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = 'shapes_area_report.txt';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    showStatus('TXT exported.');
}

init();
