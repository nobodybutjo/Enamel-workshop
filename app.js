// 画布和上下文
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.querySelector('.canvas-wrapper');
let sourceImage = null;
let originalImageData = null;
let patternLayerCanvas = null; // 保存渲染好的图案层，避免重新渲染时跳动
let patternScale = 1; // 图案缩放比例
let randomSeed = 12345; // 随机种子，用于固定随机数生成
let dotColorMap = new Map(); // 存储每个点的位置和颜色信息，用于颜色替换
let colorReplacements = new Map(); // 存储用户手动替换的颜色映射 (旧颜色key -> 新颜色)
let isDirectImageMode = false; // 新增：标记当前是否为直接贴图模式（非遗灵感）
let animalCounter = 1;
let plantCounter = 1;
let selectedColorIndexToReplace = null;
let currentAppMode = 'manual'; 
let workshopPatternIndex = 0;

const MM_TO_PX = 300 / 25.4;

function mmToPx(mm) {
    return Math.round(mm * MM_TO_PX);
}

function pxToMm(px) {
    return Math.round(px / MM_TO_PX);
}

let isAIMode = false;

// 简单的伪随机数生成器（使用种子）
function seededRandom() {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
}

// 节流函数：限制函数执行频率
function throttle(func, delay) {
    let timeoutId = null;
    let lastExecTime = 0;
    return function(...args) {
        const currentTime = Date.now();
        
        // 如果距离上次执行时间超过delay，立即执行
        if (currentTime - lastExecTime > delay) {
            func.apply(this, args);
            lastExecTime = currentTime;
        } else {
            // 否则，设置延迟执行
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
                lastExecTime = Date.now();
            }, delay - (currentTime - lastExecTime));
        }
    };
}

// 节流渲染函数（用于滑块拖动时的实时反馈）
// 注意：这个函数会在 renderPointillism 定义之后被初始化
let throttledRender = null;

// 控制参数
const params = {
    canvasWidth: 800,
    canvasHeight: 600,
    colorCount: 4,
    dotSize: 2.5,
    dotDensity: 70,
    randomness: 3,
    sizeVariation: 20,
    category: 'plants', // letters, animals, plants, geometric, abstract
    opacity: 'opaque',
    temperature: 'high',
    firing: 'glossy',
    baseMaterial: 'silver',
    designType: 'pendant', // free, pendant, irregular, flower
    pendantShape: 'circle', // circle, ellipse, ring
    patternOffsetX: 0, // 图案X偏移量（像素）
    patternOffsetY: 0,  // 图案Y偏移量（像素）
    patternScale: 1,   // 图案缩放比例
    canvasBackgroundColor: '#ffffff' // 画布背景颜色
};


const presetColorCards = [
    {
        id: 'color-card-a',
        name: '暮光花园',
        description: '清新复古的暖调配色',
        colors: [
            { code: 'o1116', name: '粉红', r: 250, g: 160, b: 180, opacity: 95 },
            { code: 'o1609', name: '松石绿', r: 50, g: 180, b: 170, opacity: 94 },
            { code: 'o1304', name: '铬黄', r: 220, g: 200, b: 80, opacity: 92 },
            { code: 'o1103', name: '玫瑰红', r: 200, g: 50, b: 80, opacity: 96 }
        ]
    },
    {
        id: 'color-card-b',
        name: '香芋葡萄',
        description: '深浅交织的柔和紫调',
        colors: [
            { code: 'o1118', name: '百花紫', r: 140, g: 80, b: 120, opacity: 94 },
            { code: 'o1703', name: '藕荷紫', r: 200, g: 180, b: 220, opacity: 94 },
            { code: 'o1305', name: '米黄', r: 250, g: 240, b: 200, opacity: 92 },
            { code: 'o1417', name: '钢青色', r: 50, g: 70, b: 90, opacity: 92 }
        ]
    },
    {
        id: 'color-card-c',
        name: '日出蓝调',
        description: '平衡活力与沉稳的对比配色',
        colors: [
            { code: 'o1301', name: '正黄', r: 255, g: 220, b: 0, opacity: 95 },
            { code: 'o1805', name: '深灰', r: 50, g: 50, b: 50, opacity: 96 },
            { code: 'o1503', name: '天青蓝', r: 30, g: 100, b: 180, opacity: 94 },
            { code: 'o1504', name: '亮浅蓝', r: 200, g: 230, b: 255, opacity: 90 }
        ]
    },
    {
        id: 'color-card-d',
        name: '自然韵律',
        description: '简洁自然的黄绿配色',
        colors: [
            { code: 'o1409', name: '黄绿', r: 150, g: 220, b: 100, opacity: 95 },
            { code: 'o1817', name: '牙釉', r: 255, g: 250, b: 240, opacity: 92 },
            { code: 'o1405', name: '正绿', r: 0, g: 150, b: 80, opacity: 94 },
            { code: 't1206', name: '透黄', r: 255, g: 200, b: 0, opacity: 88 }
        ]
    }
];

// 使用第一个预设色卡的4个颜色作为默认颜色
let selectedColors = presetColorCards[0].colors.map(color => ({ ...color }));

// 获取画布背景色
function getCanvasBackgroundColor() {
    return params.canvasBackgroundColor;
}

// 初始化画布大小
function initCanvas() {
    canvas.width = params.canvasWidth;
    canvas.height = params.canvasHeight;
    const bgColor = getCanvasBackgroundColor();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
}


function isPointInShape(x, y, width, height) {
    if (params.designType === 'free') return true;
    const cx = width / 2, cy = height / 2;
    const dx = x - cx, dy = y - cy;

    if (params.pendantShape === 'circle') {
        return (dx*dx + dy*dy) <= Math.pow(Math.min(width, height)/2, 2);
    } else if (params.pendantShape === 'ellipse') {
        // 椭圆判定：(x^2 / rx^2) + (y^2 / ry^2) <= 1
        const rx = width / 2, ry = height / 2;
        return (dx*dx)/(rx*rx) + (dy*dy)/(ry*ry) <= 1;
    } else if (params.pendantShape === 'ring') {
        const distSq = dx*dx + dy*dy;
        const or = Math.min(width, height)/2, ir = or/2;
        return distSq <= or*or && distSq >= ir*ir;
    }
    return true;
}

function triggerRender() {
    // 基础状态保护
    if (!sourceImage || !originalImageData) {
        const bgColor = getCanvasBackgroundColor();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawDefaultBorder(ctx, canvas.width, canvas.height);
        return;
    }

    if (currentAppMode === 'workshop') {
        renderWorkshopMode(); 
    } else if (typeof isDirectImageMode !== 'undefined' && isDirectImageMode) {
        renderDirectImage(); // 把直贴逻辑封装一下
    } else {
        renderPointillism(); 
    }
}

function resizeCanvas() {
    canvas.width = params.canvasWidth;
    canvas.height = params.canvasHeight;
    
    const bgColor = getCanvasBackgroundColor();
    const ctx = canvas.getContext('2d');

    // 1. 无论何时，先彻底清空画布像素
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (sourceImage && originalImageData) {
        // 如果有图案，直接交给调度中心重绘
        triggerRender();
    } else {
        // --- 修复点：切换模式（无图）时的镂空逻辑 ---
        if (params.designType === 'pendant' && params.pendantShape === 'ring') {
            const cx = canvas.width / 2, cy = canvas.height / 2;
            const or = Math.min(canvas.width, canvas.height) / 2;
            const ir = or / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, or, 0, Math.PI * 2);
            ctx.moveTo(cx + ir, cy);
            ctx.arc(cx, cy, ir, 0, Math.PI * 2, true);
            ctx.fillStyle = bgColor;
            ctx.fill(); // 只填充圆环带孔区域
            ctx.restore();
        } else {
            // 自由、圆、椭圆模式：直接画满
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        // 补画边框
        drawDefaultBorder(ctx, canvas.width, canvas.height);
    }
}

function renderDirectImage() {
    const bgColor = params.canvasBackgroundColor;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const baseFitScale = Math.max(canvas.width / sourceImage.width, canvas.height / sourceImage.height);
    
    const finalW = sourceImage.width * baseFitScale * params.patternScale;
    const finalH = sourceImage.height * baseFitScale * params.patternScale;
    
    // 居中绘制并应用偏移
    const x = (canvas.width - finalW) / 2 + params.patternOffsetX;
    const y = (canvas.height - finalH) / 2 + params.patternOffsetY;

    ctx.drawImage(sourceImage, x, y, finalW, finalH);
    
    if (params.designType === 'pendant') applyShapeMask(ctx, canvas.width, canvas.height);
    drawDefaultBorder(ctx, canvas.width, canvas.height);
}

// 绘制形状边界（用于预览）
function drawShapeBoundary() {
    if (params.designType !== 'pendant') return;
    
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    switch (params.pendantShape) {
        case 'circle':
            ctx.beginPath();
            ctx.arc(centerX, centerY, Math.min(width, height) / 2, 0, Math.PI * 2);
            ctx.stroke();
            break;
            
        case 'ellipse':
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, width / 2, height / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
            
        case 'ring':
            ctx.beginPath();
            const outerRadius = Math.min(width, height) / 2;
            const innerRadius = outerRadius / 2;
            ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
            ctx.moveTo(centerX + innerRadius, centerY);
            ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
            ctx.stroke();
            break;
    }
    
    ctx.setLineDash([]);
}

// 更新参数显示
function updateValueDisplay(id, value) {
    const display = document.getElementById(id + 'Value');
    if (display) {
        display.textContent = Math.round(value * 10) / 10;
    }
}

// 初始化所有控件
function initControls() {
    // 初始化颜色调色板
    initColorPalette();
    
    // 初始化过滤器按钮
    initFilterButtons();
    
    // 初始化设计类型（设置默认状态）
    updateCanvasForDesignType();
    
    // 初始化材料选择
    initMaterialSwatches();
    
    // 初始化画布底色选择
    initCanvasBackgroundControls();
    
    // 初始化图案类型和类别
    initPatternControls();
    
    // 初始化点大小滑块
    initDotSizeSlider();
    
    // 初始化滑块
    initSliders();
    
    // 初始化设计尺寸输入
    initDesignSize();
    
    // 初始化导航按钮
    initNavButtons();
    
    // 初始化拖拽功能
    initDragPattern();
    
    // 初始化问号图标展开说明
    initHelpIcons();
    
    syncControlsWithParams();
}

// 初始化图案拖拽功能
function initDragPattern() {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startOffsetX = 0;
    let startOffsetY = 0;
    let hasMoved = false; // 标记是否移动了鼠标（用于区分点击和拖拽）
    
    // 检查事件目标是否是交互控件（滑块、输入框等）
    function isInteractiveControl(target) {
        if (!target) return false;
        const tagName = target.tagName.toLowerCase();
        const type = target.type;
        
        // 检查是否是滑块、输入框、按钮等交互控件
        if (tagName === 'input' && (type === 'range' || type === 'number' || type === 'text')) {
            return true;
        }
        if (tagName === 'button' || tagName === 'select' || tagName === 'textarea') {
            return true;
        }
        
        // 检查是否在交互控件内部（向上查找父元素）
        let parent = target.parentElement;
        while (parent && parent !== document.body) {
            if (parent.classList.contains('control-group') || 
                parent.classList.contains('right-panel') ||
                parent.tagName.toLowerCase() === 'input' ||
                parent.tagName.toLowerCase() === 'button' ||
                parent.tagName.toLowerCase() === 'select') {
                return true;
            }
            parent = parent.parentElement;
        }
        
        return false;
    }
    
    canvas.addEventListener('mousedown', (e) => {
        if (!sourceImage) return; // 没有图案时不拖拽
        if (isInteractiveControl(e.target)) return; // 如果是交互控件，不处理拖拽
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        startOffsetX = params.patternOffsetX;
        startOffsetY = params.patternOffsetY;
        
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        if (isInteractiveControl(e.target)) {
            if (isDragging) {
                isDragging = false;
                canvas.style.cursor = 'grab';
            }
            return;
        }
        
        const moveDistance = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));
        if (moveDistance > 5) {
            hasMoved = true;
        }
        
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const deltaX = (e.clientX - startX) * scaleX;
        const deltaY = (e.clientY - startY) * scaleY;
        
        params.patternOffsetX = startOffsetX + deltaX;
        params.patternOffsetY = startOffsetY + deltaY;
        
        triggerRender(); 
    });
    
    document.addEventListener('mouseup', (e) => {
        if (isDragging) {
            // 如果是在交互控件上释放鼠标，不处理点击事件
            if (!isInteractiveControl(e.target)) {
                isDragging = false;
                canvas.style.cursor = 'grab';
                
                // 如果没有移动，认为是点击，检测颜色
                if (!hasMoved && sourceImage) {
                    handleCanvasClick(e);
                }
            } else {
                isDragging = false;
                canvas.style.cursor = 'grab';
            }
        }
    });
    
    // 设置鼠标样式提示
    canvas.addEventListener('mouseenter', () => {
        if (sourceImage) {
            canvas.style.cursor = 'grab';
        }
    });
    
    canvas.addEventListener('mouseleave', () => {
        if (!isDragging) {
            canvas.style.cursor = 'default';
        }
    });
}
function initDefaultDesign() {

    // 默认吊坠
    params.designType = 'pendant';
    params.pendantShape = 'circle';

    // 激活吊坠按钮
    document.querySelectorAll('[data-design-type]').forEach(btn=>{
        btn.classList.remove('active');
        if(btn.dataset.designType === 'pendant'){
            btn.classList.add('active');
        }
    });

    // 显示吊坠子选项
    const pendantOptions = document.getElementById('pendantOptions');
    if(pendantOptions){
        pendantOptions.style.display = 'block';
    }

    // 激活圆形按钮
    document.querySelectorAll('[data-pendant-shape]').forEach(btn=>{
        btn.classList.remove('active');
        if(btn.dataset.pendantShape === 'circle'){
            btn.classList.add('active');
        }
    });

    // 关键：更新画布
    updateCanvasForDesignType();

}

// 处理画布点击事件（用于颜色替换）
// 1. 处理画布点击：找到点击的点属于哪个亮度阶梯
function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    
    let nearestDot = null;
    let minDistance = Infinity;
    const searchRadius = Math.max(params.dotSize * 3, 20); // 搜索半径
    
    for (const [key, dot] of dotColorMap.entries()) {
        const distance = Math.sqrt(Math.pow(dot.x - clickX, 2) + Math.pow(dot.y - clickY, 2));
        if (distance < searchRadius && distance < minDistance) {
            minDistance = distance;
            nearestDot = dot;
        }
    }
    
    if (nearestDot !== null && nearestDot.index !== undefined) {
        showColorReplaceModal(nearestDot.index);
    }
}

// 2. 显示换色对话框
function showColorReplaceModal(targetIndex) {
    selectedColorIndexToReplace = targetIndex; 

    const modal = document.getElementById('colorReplaceModal');
    if (!modal) {
        createColorReplaceModal();
    }
    
    // 自动更新标题，告知用户当前点选的是调色板中第几个色阶
    const header = document.querySelector('#colorReplaceModal h3');
    if (header) header.innerText = `替换色阶区域：${targetIndex + 1}`;
    
    updateColorReplacePalette();
    document.getElementById('colorReplaceModal').style.display = 'block';
}

// 3. 执行替换并重绘
function replaceColor(targetIndex, newColor) {
    if (!sourceImage || !originalImageData) return;
    
    // 存储颜色替换索引映射
    colorReplacements.set(targetIndex, { r: newColor.r, g: newColor.g, b: newColor.b });
    
    // 【核心修复】使用调度中心，它会自动根据 currentAppMode 选择正确的渲染器
    triggerRender(); 
}

// 顺便修改 updateColorReplacePalette 里的点击事件
function updateColorReplacePalette() {
    const palette = document.getElementById('colorReplacePalette');
    if (!palette) return;
    palette.innerHTML = '';
    const colors = getColorsFromPaletteDOM();
    colors.forEach((color) => {
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';
        colorItem.style.cursor = 'pointer';
        colorItem.innerHTML = `
            <div class="color-swatch" style="background-color: rgb(${color.r}, ${color.g}, ${color.b});"></div>
            <div class="color-info"><div class="color-name">${color.name}</div></div>
        `;
        colorItem.addEventListener('click', () => {
            // 传入索引进行替换
            replaceColor(selectedColorIndexToReplace, color);
            document.getElementById('colorReplaceModal').style.display = 'none';
        });
        palette.appendChild(colorItem);
    });
}

// 创建颜色替换模态框
function createColorReplaceModal() {
    const modal = document.createElement('div');
    modal.id = 'colorReplaceModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>选择替换颜色</h3>
                <span class="close-modal" onclick="document.getElementById('colorReplaceModal').style.display='none'">&times;</span>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 15px;">请从左侧调色板中选择一个颜色来替换当前颜色</p>
                <div class="color-palette" id="colorReplacePalette">
                    <!-- 颜色将通过JavaScript动态添加 -->
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('colorReplaceModal').style.display='none'">取消</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // 关闭模态框
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // 初始化颜色选择列表
    updateColorReplacePalette();
    
    // 每次显示模态框时更新颜色列表
    const observer = new MutationObserver(() => {
        if (modal.style.display === 'block') {
            updateColorReplacePalette();
        }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
}

// 从左侧调色板DOM元素提取颜色信息
function getColorsFromPaletteDOM() {
    const palette = document.getElementById('colorPalette');
    if (!palette) return [];
    const colors = [];
    const colorItems = palette.querySelectorAll('.color-item');
    colorItems.forEach(item => {
        const swatch = item.querySelector('.color-swatch');
        if (!swatch) return;
        const bg = swatch.style.backgroundColor;
        const rgb = bg.match(/\d+/g);
        if (!rgb) return;
        
        const labelEl = item.querySelector('.color-label');
        const name = labelEl ? labelEl.textContent.trim() : '未命名颜色';
        
        colors.push({ 
            r: parseInt(rgb[0]), g: parseInt(rgb[1]), b: parseInt(rgb[2]), 
            name: name 
        });
    });
    return colors;
}

function showColorReplaceModal(targetColor) {
    selectedColorToReplace = targetColor;
    const colors = getColorsFromPaletteDOM();
    const hex = colorToHex(targetColor);
    const found = colors.find(c => colorToHex(c) === hex);

    const modal = document.getElementById('colorReplaceModal') || createColorReplaceModal();
    const header = document.querySelector('#colorReplaceModal h3');
    if (header) header.innerText = `替换颜色：${found ? found.name : "选择的颜色"}`;
    
    updateColorReplacePalette();
    document.getElementById('colorReplaceModal').style.display = 'block';
}

// 更新颜色替换调色板
function updateColorReplacePalette() {
    const palette = document.getElementById('colorReplacePalette');
    if (!palette) return;
    
    palette.innerHTML = '';
    
    // 从左侧调色板DOM读取颜色，而不是从selectedColors变量
    const colors = getColorsFromPaletteDOM();
    
    colors.forEach((color, index) => {
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';
        colorItem.style.cursor = 'pointer';
        const isEnamel = color.code !== undefined;
        // 使用background-color以便CSS渐变可以叠加
        const swatchStyle = `background-color: rgb(${color.r}, ${color.g}, ${color.b});`;
        colorItem.innerHTML = `
            <div class="color-swatch" style="${swatchStyle}"></div>
            <div class="color-info">
                ${color.code ? `<div class="color-code">${color.code}</div>` : ''}
                <div class="color-name">${color.name}</div>
                ${!isEnamel ? `<div class="color-rgb">RGB(${color.r},${color.g},${color.b})</div>` : ''}
            </div>
        `;
        colorItem.addEventListener('click', () => {
            // 替换颜色
            replaceColor(selectedColorToReplace, { r: color.r, g: color.g, b: color.b });
            document.getElementById('colorReplaceModal').style.display = 'none';
        });
        palette.appendChild(colorItem);
    });
}

function colorToHex(color) {
    if (!color) return '';
    const r = Math.round(color.r).toString(16).padStart(2, '0');
    const g = Math.round(color.g).toString(16).padStart(2, '0');
    const b = Math.round(color.b).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toLowerCase();
}

function updatePatternPosition() {
    // 直接调用 renderPointillism()，因为现在使用固定种子不会跳动
    renderPointillism();
}

// 初始化颜色调色板
function initColorPalette() {
    const palette = document.getElementById('colorPalette');
    palette.innerHTML = '';
    
    selectedColors.forEach((color, index) => {
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';
        colorItem.dataset.index = index;
        
        // 检查是否是珐琅釉料（有code属性）
        const mainLabel = color.code ? color.code : color.name;
        
        // 2. 设置颜色背景
        const swatchStyle = `background-color: rgb(${color.r}, ${color.g}, ${color.b});`;
        
        // 3. 生成 HTML
        // 注意：这里我们只用了一个 .color-label，而不是原来那一堆 name/code/rgb
        colorItem.innerHTML = `
            <div class="color-swatch" style="${swatchStyle}"></div>
            <div class="color-info">
                <div class="color-label">${mainLabel}</div>
            </div>
        `;
        colorItem.addEventListener('click', () => {
            document.querySelectorAll('.color-item').forEach(item => item.classList.remove('selected'));
            colorItem.classList.add('selected');
        });
        palette.appendChild(colorItem);
    });
}

function cloneColors(colors) {
    return colors.map(color => ({ ...color }));
}

function syncControlsWithParams() {
    const widthInput = document.getElementById('designWidth');
    const heightInput = document.getElementById('designHeight');
    if (widthInput) widthInput.value = pxToMm(params.canvasWidth);
    if (heightInput) heightInput.value = pxToMm(params.canvasHeight);
    
    const colorCountSlider = document.getElementById('colorCount');
    if (colorCountSlider) {
        colorCountSlider.value = params.colorCount;
        document.getElementById('colorCountValue').textContent = params.colorCount;
    }

    const dotSizeSlider = document.getElementById('dotSize');
    if (dotSizeSlider) {
        dotSizeSlider.value = params.dotSize;
        document.getElementById('dotSizeValue').textContent = params.dotSize;
    }
    
    const dotDensitySlider = document.getElementById('dotDensity');
    if (dotDensitySlider) {
        dotDensitySlider.value = params.dotDensity;
        const labels = ['稀疏', '较稀疏', '中等', '较密集', '密集'];
        const index = Math.floor((params.dotDensity - 10) / 22.5);
        document.getElementById('dotDensityValue').textContent = labels[Math.min(Math.max(index, 0), 4)];
    }
    
    const randomnessSlider = document.getElementById('randomness');
    if (randomnessSlider) {
        randomnessSlider.value = params.randomness;
        document.getElementById('randomnessValue').textContent = params.randomness;
    }
    
    const patternScaleSlider = document.getElementById('patternScale');
    const patternScaleValue = document.getElementById('patternScaleValue');
    if (patternScaleSlider && patternScaleValue) {
        const displayVal = Math.round(params.patternScale * 100);
        patternScaleSlider.value = displayVal; // 同步滑块位置到实际参数
        patternScaleValue.textContent = displayVal + '%'; // 同步文字显示
    }
}

// 初始化问号图标展开说明功能
function initHelpIcons() {
    const helpIcons = document.querySelectorAll('.help-icon');
    helpIcons.forEach(icon => {
        // 使用hover事件
        icon.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            const tooltip = icon.nextElementSibling;
            if (tooltip && tooltip.classList.contains('help-tooltip')) {
                // 先隐藏所有其他工具提示
                document.querySelectorAll('.help-tooltip').forEach(t => {
                    if (t !== tooltip) {
                        t.style.opacity = '0';
                        t.style.visibility = 'hidden';
                        t.style.transform = 'translateY(-5px)';
                    }
                });
                // 显示当前工具提示
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
                tooltip.style.transform = 'translateY(0)';
            }
        });
        
        icon.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            const tooltip = icon.nextElementSibling;
            if (tooltip && tooltip.classList.contains('help-tooltip')) {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
                tooltip.style.transform = 'translateY(-5px)';
            }
        });
    });
}

// 初始化过滤器按钮
function initFilterButtons() {
    document.querySelectorAll('[data-design-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            const designType = btn.dataset.designType;
            
            // 切换按钮高亮
            btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            params.designType = designType;
            
            // UI 面板显隐控制
            const pendantOptions = document.getElementById('pendantOptions');
            const normalDesignType = document.getElementById('normalDesignType');
            
            if (designType === 'pendant') {
                pendantOptions.style.display = 'block';
                // 如果当前没有选中的形状，默认选圆形
                if (!params.pendantShape) params.pendantShape = 'circle';
            } else {
                pendantOptions.style.display = 'none';
            }

            // 执行核心更新
            updateCanvasForDesignType();
        });
    });

    // 吊坠形状子按钮逻辑保持不变...
    document.querySelectorAll('[data-pendant-shape]').forEach(btn => {
        btn.addEventListener('click', () => {
            params.pendantShape = btn.dataset.pendantShape;
            btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateCanvasForDesignType();
        });
    });
}
    
    
    // 处理原有的过滤器按钮（如果还有的话）
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            const value = btn.dataset.value;
            
            // 移除同组其他按钮的active状态
            btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            params[filter] = value;
        });
    });


function updateCanvasForDesignType() {
    const widthInput = document.getElementById('designWidth');
    const heightInput = document.getElementById('designHeight');
    
    // --- 【核心修改 1】：强制重置所有 CSS 表现 ---
    canvas.style.clipPath = 'none';
    canvas.style.webkitClipPath = 'none'; // 兼容浏览器
    canvas.style.borderRadius = '0';
    canvas.style.background = 'none';
    canvas.style.border = 'none';

    if (params.designType === 'free') {
        widthInput.disabled = false;
        heightInput.disabled = false;
        // 同步尺寸逻辑...
        canvas.style.border = '1px solid #dddddd'; 

    } else if (params.designType === 'pendant') {
        widthInput.disabled = true;
        heightInput.disabled = true;
        
        let size = (params.pendantShape === 'ellipse') ? [30, 40] : [40, 40];
        params.canvasWidth = Math.round(size[0] * MM_TO_PX);
        params.canvasHeight = Math.round(size[1] * MM_TO_PX);
        
        switch (params.pendantShape) {
            case 'circle':
                canvas.style.clipPath = 'circle(50%)';
                break;
            case 'ellipse':
                canvas.style.clipPath = 'ellipse(50% 50%)';
                break;
            case 'ring':
                // 圆环绝对不能加 CSS clipPath，因为我们要看中间的孔
                break;
        }
    }
    resizeCanvas();
}

// 初始化材料选择
function initMaterialSwatches() {
    document.querySelectorAll('.material-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.material-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            params.baseMaterial = swatch.dataset.material;
        });
    });
}

// 初始化画布底色选择控件
let canvasColorInputHandler = null;

// 记录植物样式索引用于轮播三种花叶方案
let plantStyleIndex = 0;

function initCanvasBackgroundControls() {
    const canvasColorInput = document.getElementById('canvasBackgroundColor');
    
    if (!canvasColorInput) return;
    
    // 如果已经存在事件处理器，先移除
    if (canvasColorInputHandler) {
        canvasColorInput.removeEventListener('input', canvasColorInputHandler);
        canvasColorInput.removeEventListener('change', canvasColorInputHandler);
    }
    
    // 设置初始值
    canvasColorInput.value = params.canvasBackgroundColor;
    
    // 创建新的事件处理器
    canvasColorInputHandler = (e) => {
        const newColor = e.target.value;
        params.canvasBackgroundColor = newColor;
        updateCanvasBackground();
    };
    
    // 添加事件监听器
    canvasColorInput.addEventListener('input', canvasColorInputHandler);
    canvasColorInput.addEventListener('change', canvasColorInputHandler);
}

// 更新画布背景
function updateCanvasBackground() {
    const bgColor = getCanvasBackgroundColor();
    
    // 如果没有图像，直接更新画布背景
    if (!sourceImage || !originalImageData) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 如果是异形或吊坠模式，需要重新绘制形状
        if (params.designType === 'irregular') {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = bgColor;
            if (params.irregularShape === 'irregularA') {
                createIrregularAPath(ctx, canvas.width, canvas.height);
            } else if (params.irregularShape === 'irregularB') {
                createIrregularBPath(ctx, canvas.width, canvas.height);
            }
            ctx.fill();
            drawDefaultBorder(ctx, canvas.width, canvas.height);
        } else if (params.designType === 'pendant' && params.pendantShape === 'ring') {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const outerRadius = Math.min(canvas.width, canvas.height) / 2;
            const innerRadius = outerRadius / 2;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
            ctx.moveTo(centerX + innerRadius, centerY);
            ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
            ctx.fill();
        }
    } else {
        // 如果有图像，重新渲染
        renderPointillism();
    }
}

// 初始化图案类型和类别
function initPatternControls() {
    // 图案类型
    document.querySelectorAll('.pattern-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            params.patternType = btn.dataset.type;
        });
    });
    
    // 类别
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            params.category = btn.dataset.category;
        });
    });
}

// 初始化点大小滑块
function initDotSizeSlider() {
    const dotSizeSlider = document.getElementById('dotSize');
    if (dotSizeSlider) {
        dotSizeSlider.addEventListener('input', (e) => {
            params.dotSize = parseFloat(e.target.value);
            const valueDisplay = document.getElementById('dotSizeValue');
            if (valueDisplay) valueDisplay.textContent = params.dotSize;
            
            triggerRender(); // 修改这里
        });
    }
}

// 初始化滑块事件监听
function initSliders() {
    // ... 其他滑块逻辑保持不变 ...

    // 找到图案大小滑块
    const patternScaleSlider = document.getElementById('patternScale');
    const patternScaleValue = document.getElementById('patternScaleValue');
    
    if (patternScaleSlider) {
        patternScaleSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            // 1. 更新全局参数 (100 -> 1.0)
            params.patternScale = val / 100;
            
            // 2. 实时更新界面显示的百分比
            if (patternScaleValue) {
                patternScaleValue.textContent = val + '%';
            }
            
            // 3. 触发重绘
            if (sourceImage) {
                triggerRender();
            }
        });
    }
    
    // 其他滑块的统一调度修改（确保都调用 triggerRender）
    ['colorCount', 'dotDensity', 'randomness'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                params[id] = parseFloat(e.target.value);
                updateValueDisplay(id, params[id]);
                if (sourceImage) triggerRender();
            });
        }
    });
}

// 初始化设计尺寸输入
function initDesignSize() {
    const widthInput = document.getElementById('designWidth');
    const heightInput = document.getElementById('designHeight');
    
    const handleManualSizeChange = () => {
        if (params.designType === 'free') {
            const w = parseFloat(widthInput.value);
            const h = parseFloat(heightInput.value);
            if (w > 0 && h > 0) {
                params.canvasWidth = Math.round(w * MM_TO_PX);
                params.canvasHeight = Math.round(h * MM_TO_PX);
                resizeCanvas();
            }
        }
    };

    widthInput.addEventListener('input', handleManualSizeChange);
    heightInput.addEventListener('input', handleManualSizeChange);
}

// 初始化导航按钮
function initNavButtons() {
    const projectFileInput = document.getElementById('projectFileInput');
    const loadBtn = document.getElementById('loadBtn');
    
    if (loadBtn && projectFileInput) {
        loadBtn.addEventListener('click', () => {
            projectFileInput.click();
        });
        
        projectFileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                loadProjectFile(file);
                projectFileInput.value = '';
            }
        });
    }
    
    document.getElementById('saveBtn').addEventListener('click', () => {
        const data = {
            params: params,
            colors: selectedColors,
            imageData: canvas.toDataURL()
        };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'enamel-design.json';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    });
    
    document.getElementById('exportBtn').addEventListener('click', () => {
        // 创建临时画布用于导出（应用形状裁剪）
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 复制当前画布内容
        tempCtx.drawImage(canvas, 0, 0);
        
        // 如果是异形模式，应用形状裁剪
        if (params.designType === 'irregular') {
            applyShapeMask(tempCtx, tempCanvas.width, tempCanvas.height);
        }
        
        const link = document.createElement('a');
        link.download = 'enamel-design.png';
        link.href = tempCanvas.toDataURL();
        link.click();
    });
}

function loadProjectFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            applyProjectData(data);
            alert('工程文件已加载');
        } catch (error) {
            console.error('加载工程文件失败:', error);
            alert('工程文件格式不正确，请确认后重新加载。');
        }
    };
    reader.onerror = () => {
        alert('读取工程文件失败，请重试。');
    };
    reader.readAsText(file);
}

function applyProjectData(data) {
    if (data.params) {
        Object.assign(params, data.params);
        updateCanvasForDesignType();
        syncControlsWithParams();
    }
    
    if (Array.isArray(data.colors) && data.colors.length) {
        selectedColors = data.colors.map(color => ({ ...color }));
        initColorPalette();
    }
    
    colorReplacements.clear();
    
    if (data.imageData) {
        loadImageFromDataUrl(data.imageData, () => {
            renderPointillism();
        });
    } else {
        sourceImage = null;
        originalImageData = null;
        updateCanvasBackground();
    }
}

function loadImageFromDataUrl(dataUrl, callback) {
    const img = new Image();
    img.onload = () => {
        sourceImage = img;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        originalImageData = tempCtx.getImageData(0, 0, img.width, img.height);
        if (typeof callback === 'function') callback();
    };
    img.onerror = () => {
        alert('载入工程中的图像数据失败，将使用当前设置重新渲染。');
        sourceImage = null;
        originalImageData = null;
        updateCanvasBackground();
    };
    img.src = dataUrl;
}

function loadPatternImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`无法加载图片: ${src}`));
        img.src = src;
    });
}

// 【重写】主生成设计函数
async function generatePattern() {
    params.patternOffsetX = 0;
    params.patternOffsetY = 0;
    
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = params.canvasWidth;
    tempCanvas.height = params.canvasHeight;
    const tempCtx = tempCanvas.getContext('2d');

    // 重要：确保 tempCtx 开始时是完全透明的
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    try {
        if (params.category === 'animals' || params.category === 'plants') {
            // 1-2 轮播逻辑
            let currentIndex;
            if (params.category === 'animals') {
                currentIndex = animalCounter;
                animalCounter = (animalCounter % 3) + 1;
            } else {
                currentIndex = plantCounter;
                plantCounter = (plantCounter % 8) + 1;
            }

            const imgPath = `images/patterns/${params.category.slice(0, -1)}_${currentIndex}.png`;
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.crossOrigin = "anonymous";
                i.onload = () => resolve(i);
                i.onerror = () => reject(new Error("加载失败: " + imgPath));
                i.src = imgPath;
            });

            const scale = Math.min(tempCanvas.width / img.width, tempCanvas.height / img.height) * 0.8;
            const x = (tempCanvas.width - img.width * scale) / 2;
            const y = (tempCanvas.height - img.height * scale) / 2;
            tempCtx.drawImage(img, x, y, img.width * scale, img.height * scale);
            
        } else {
            // 字母和几何：这些是算法画的
            generateComplexPattern(tempCtx, params.category, tempCanvas.width, tempCanvas.height);
        }

        // 提取带 Alpha 通道的 ImageData
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // 传递给主流程
        sourceImage = new Image();
        sourceImage.onload = () => {
            originalImageData = imageData;
            isDirectImageMode = false;
            colorReplacements.clear();
            renderPointillism();
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        };
        sourceImage.src = tempCanvas.toDataURL();

    } catch (err) {
        console.error(err);
        alert("图案生成失败，请确认 images/patterns/ 文件夹下有对应的 PNG 图片。");
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

// 【重写】算法生成调度（仅保留字母和几何）
function generateComplexPattern(ctx, category, width, height) {
    // 1. 彻底清除背景，保持透明
    ctx.clearRect(0, 0, width, height);

    // 2. 调用具体的绘制函数
    // 注意：我们不再传递 palette，让它们内部用灰度绘制
    if (category === 'letters') {
        generateLetterPattern(ctx, width, height);
    } else {
        generateGeometricPattern(ctx, width, height);
    }
}


// 生成字母图案
// 【紧凑版】生成字母图案
function generateLetterPattern(ctx, width, height) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'S', 'R', 'M', 'K', 'M', 'Z', 'L', 'W', 'Y', 'X'];
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const centerX = width / 2;
    const centerY = height / 2;
    const size = Math.min(width, height);

    // 1. 绘制底纹装饰 (浅灰色 - 映射到较亮色)
    // 缩小了藤蔓的延伸范围
    ctx.strokeStyle = "rgb(180, 180, 180)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);
        ctx.beginPath();
        // 起点更靠近中心，终点在 0.28 左右
        ctx.moveTo(size * 0.05, 0);
        ctx.bezierCurveTo(size * 0.15, -size * 0.15, size * 0.25, size * 0.15, size * 0.28, 0);
        ctx.stroke();
        ctx.restore();
    }

    // 2. 绘制精致外框 (中灰色 - 映射到中间色)
    // 半径从 0.38 缩小到 0.31
    ctx.strokeStyle = "rgb(110, 110, 110)";
    ctx.lineWidth = 2.5;
    
    // 内部主圈
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.31, 0, Math.PI * 2);
    ctx.stroke();

    // 外部珠边装饰点
    // 半径从 0.42 缩小到 0.34
    ctx.fillStyle = "rgb(110, 110, 110)";
    for (let i = 0; i < 16; i++) { // 增加了点的数量，让圆环更细密
        const angle = (i / 16) * Math.PI * 2;
        const px = centerX + Math.cos(angle) * size * 0.34;
        const py = centerY + Math.sin(angle) * size * 0.34;
        ctx.beginPath();
        ctx.arc(px, py, size * 0.012, 0, Math.PI * 2);
        ctx.fill();
    }

    // 3. 绘制主字母 (纯黑色 - 映射到最深色)
    // 字体大小微调以适应缩小的外框
    const fontSize = size * 0.5;
    ctx.font = `italic bold ${fontSize}px "Georgia", "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fillText(letter, centerX, centerY);
    
    // 字母勾边 (高亮感)
    ctx.strokeStyle = "rgb(200, 200, 200)";
    ctx.lineWidth = 0.8;
    ctx.strokeText(letter, centerX, centerY);
}




function getPlantColors(palette) {
    const defaultColors = [
        palette[0] || { r: 223, g: 166, b: 255 },
        palette[1] || { r: 60, g: 180, b: 120 },
        palette[2] || { r: 250, g: 200, b: 90 },
        palette[3] || { r: 40, g: 140, b: 90 }
    ];
    
    const greens = palette.filter(c => c.g >= c.r && c.g >= c.b && c.g > 80);
    const nonGreens = palette.filter(c => !(c.g >= c.r && c.g >= c.b && c.g > 80));
    
    const leafPrimary = greens[0] || defaultColors[1];
    const leafSecondary = greens[1] || defaultColors[3];
    const petalPrimary = nonGreens[0] || defaultColors[0];
    const petalAccent = nonGreens[1] || defaultColors[2];
    
    return {
        leafPrimary,
        leafSecondary,
        petalPrimary,
        petalAccent
    };
}

function clampColorValue(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}


function generateGeometricPattern(ctx, width, height) {
    const numShapes = 3 + Math.floor(Math.random() * 2);
    
    for (let i = 0; i < numShapes; i++) {
        const x = width * (0.2 + Math.random() * 0.6);
        const y = height * (0.2 + Math.random() * 0.6);
        const size = Math.min(width, height) * (0.1 + Math.random() * 0.2);
        
        // 【关键】使用灰度阶梯：0, 50, 100, 150... 
        // 这样 renderPointillism 会把它们映射到调色盘的不同颜色上
        const grayValue = Math.floor((i / numShapes) * 200); 
        ctx.fillStyle = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
        
        ctx.beginPath();
        const points = 5 + Math.floor(Math.random() * 4);
        for (let j = 0; j < points; j++) {
            const angle = (j / points) * Math.PI * 2 + Math.random() * 0.5;
            const radius = size * (0.7 + Math.random() * 0.3);
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }
    
    // 绘制黑色的装饰线条
    ctx.strokeStyle = "rgb(0, 0, 0)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
        const x1 = width * (0.2 + Math.random() * 0.6);
        const y1 = height * (0.2 + Math.random() * 0.6);
        const x2 = width * (0.2 + Math.random() * 0.6);
        const y2 = height * (0.2 + Math.random() * 0.6);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
}


// 转换为灰度图
function convertToGrayscale(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
        // data[i + 3] 保持 alpha 不变
    }
}

// 从图像数据中提取颜色调色板
function extractColorPalette(imageData, colorCount) {
    const data = imageData.data;
    const colors = [];
    const step = Math.floor(data.length / (colorCount * 4 * 100)); // 采样
    
    for (let i = 0; i < data.length; i += step * 4) {
        if (i + 3 < data.length) {
            colors.push({
                r: data[i],
                g: data[i + 1],
                b: data[i + 2]
            });
        }
    }
    
    // 使用K-means简化版进行颜色聚类
    return kMeansColors(colors, colorCount);
}

// 简化的K-means颜色聚类
function kMeansColors(colors, k) {
    if (colors.length === 0) return [];
    
    // 初始化聚类中心（随机选择）
    let centroids = [];
    for (let i = 0; i < k; i++) {
        const randomIndex = Math.floor(Math.random() * colors.length);
        centroids.push({ ...colors[randomIndex] });
    }
    
    // 迭代几次
    for (let iter = 0; iter < 10; iter++) {
        const clusters = Array(k).fill(null).map(() => []);
        
        // 分配颜色到最近的聚类中心
        colors.forEach(color => {
            let minDist = Infinity;
            let nearestCluster = 0;
            centroids.forEach((centroid, idx) => {
                const dist = colorDistance(color, centroid);
                if (dist < minDist) {
                    minDist = dist;
                    nearestCluster = idx;
                }
            });
            clusters[nearestCluster].push(color);
        });
        
        // 更新聚类中心
        centroids = clusters.map(cluster => {
            if (cluster.length === 0) {
                return { r: 128, g: 128, b: 128 };
            }
            const sum = cluster.reduce((acc, color) => ({
                r: acc.r + color.r,
                g: acc.g + color.g,
                b: acc.b + color.b
            }), { r: 0, g: 0, b: 0 });
            return {
                r: Math.round(sum.r / cluster.length),
                g: Math.round(sum.g / cluster.length),
                b: Math.round(sum.b / cluster.length)
            };
        });
    }
    
    return centroids;
}

// 计算颜色距离
function colorDistance(c1, c2) {
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

// 从颜色库中选择指定数量的颜色
function getPaletteFromColorLibrary(count) {
    // 从selectedColors中选择指定数量的颜色
    const colors = [...selectedColors];
    const selected = [];
    
    // 如果需要的颜色数量大于等于可用颜色，返回所有颜色
    if (count >= colors.length) {
        return colors.map(c => ({ r: c.r, g: c.g, b: c.b }));
    }
    
    // 否则均匀选择
    const step = colors.length / count;
    for (let i = 0; i < count; i++) {
        const index = Math.floor(i * step);
        selected.push({ r: colors[index].r, g: colors[index].g, b: colors[index].b });
    }
    
    return selected;
}

// 根据提示词内容智能选择颜色（语义匹配）
function getSemanticColors(prompt, count) {
    const lowerPrompt = prompt.toLowerCase();
    const colors = [...selectedColors];
    const selected = [];
    
    // 定义颜色语义映射
    const colorSemantics = {
        // 黄色/橙色系（向日葵、太阳、柠檬等）
        yellow: ['sunflower', 'sun', 'lemon', '向日葵', '太阳', '柠檬', '黄色', '金黄', 'gold', 'amber', '琥珀'],
        orange: ['orange', 'orange', 'carrot', '橙色', '胡萝卜', 'copper', '铜色'],
        // 绿色系（叶子、植物、草等）
        green: ['leaf', 'plant', 'grass', 'tree', 'green', '叶子', '植物', '草', '树', '绿色', '翡翠', 'emerald', 'mint', '薄荷'],
        // 红色系（玫瑰、樱桃、苹果等）
        red: ['rose', 'cherry', 'apple', 'red', '玫瑰', '樱桃', '苹果', '红色', 'ruby', '红宝石'],
        // 蓝色系（天空、海洋、鸟等）
        blue: ['sky', 'ocean', 'sea', 'bird', 'blue', '天空', '海洋', '鸟', '蓝色', 'sapphire', '蓝宝石', 'turquoise', '绿松石'],
        // 紫色系（葡萄、薰衣草等）
        purple: ['grape', 'lavender', 'purple', '葡萄', '薰衣草', '紫色', 'amethyst', '紫水晶'],
        // 棕色系（树干、土地等）
        brown: ['tree', 'trunk', 'brown', 'wood', '树', '树干', '棕色', 'wood', 'copper', '铜色'],
        // 粉色系（花、花瓣等）
        pink: ['flower', 'petal', 'pink', '花', '花瓣', '粉色', 'rose', '玫瑰']
    };
    
    // 计算每种颜色的匹配度
    const colorScores = colors.map((color, index) => {
        let score = 0;
        const colorName = color.name.toLowerCase();
        
        // 检查颜色名称和提示词的匹配
        for (const [semantic, keywords] of Object.entries(colorSemantics)) {
            const hasKeyword = keywords.some(keyword => lowerPrompt.includes(keyword));
            const hasColorName = keywords.some(keyword => colorName.includes(keyword));
            
            if (hasKeyword || hasColorName) {
                // 根据语义类型加分
                if (semantic === 'yellow' || semantic === 'orange') {
                    if (lowerPrompt.includes('sunflower') || lowerPrompt.includes('向日葵')) score += 10;
                    if (lowerPrompt.includes('flower') || lowerPrompt.includes('花')) score += 5;
                }
                if (semantic === 'green') {
                    if (lowerPrompt.includes('leaf') || lowerPrompt.includes('叶子') || lowerPrompt.includes('plant') || lowerPrompt.includes('植物')) score += 10;
                }
                if (semantic === 'red' || semantic === 'pink') {
                    if (lowerPrompt.includes('rose') || lowerPrompt.includes('玫瑰') || lowerPrompt.includes('flower') || lowerPrompt.includes('花')) score += 8;
                }
                if (semantic === 'blue') {
                    if (lowerPrompt.includes('bird') || lowerPrompt.includes('鸟') || lowerPrompt.includes('sky') || lowerPrompt.includes('天空')) score += 8;
                }
                score += 3; // 基础匹配分
            }
        }
        
        return { color, index, score };
    });
    
    // 按分数排序
    colorScores.sort((a, b) => b.score - a.score);
    
    // 选择前count个颜色，如果分数为0则随机选择
    const highScoreColors = colorScores.filter(c => c.score > 0);
    
    if (highScoreColors.length > 0) {
        // 优先选择高分颜色
        for (let i = 0; i < Math.min(count, highScoreColors.length); i++) {
            selected.push({
                r: highScoreColors[i].color.r,
                g: highScoreColors[i].color.g,
                b: highScoreColors[i].color.b
            });
        }
        
        // 如果还需要更多颜色，从剩余颜色中补充
        if (selected.length < count) {
            const remaining = colorScores.filter(c => !selected.some(s => 
                s.r === c.color.r && s.g === c.color.g && s.b === c.color.b
            ));
            for (let i = 0; i < Math.min(count - selected.length, remaining.length); i++) {
                selected.push({
                    r: remaining[i].color.r,
                    g: remaining[i].color.g,
                    b: remaining[i].color.b
                });
            }
        }
    } else {
        // 如果没有匹配，使用原来的均匀选择方法
        return getPaletteFromColorLibrary(count);
    }
    
    return selected;
}

// 找到最接近调色板的颜色
function findNearestColor(color, palette) {
    if (palette.length === 0) return { r: 128, g: 128, b: 128 };
    
    let minDist = Infinity;
    let nearest = palette[0];
    palette.forEach(paletteColor => {
        const dist = colorDistance(color, paletteColor);
        if (dist < minDist) {
            minDist = dist;
            nearest = paletteColor;
        }
    });
    return nearest;
}

// 生成颜色的key（用于颜色替换映射）
function getColorKey(color) {
    const r = Math.round(color.r);
    const g = Math.round(color.g);
    const b = Math.round(color.b);
    return `${r},${g},${b}`;
}

// 检查颜色是否匹配（考虑容差）
function colorsMatch(color1, color2, tolerance = 10) {
    const distance = Math.sqrt(
        Math.pow(color1.r - color2.r, 2) +
        Math.pow(color1.g - color2.g, 2) +
        Math.pow(color1.b - color2.b, 2)
    );
    return distance <= tolerance;
}

// 应用颜色替换映射
function applyColorReplacement(color) {
    const key = colorToHex(color);
    if (colorReplacements.has(key)) {
        return colorReplacements.get(key);
    }
    return color;
}

// 绘制不同形状的点（模拟珐琅碎料）- 圆形、椭圆、三角形等平滑色块
function drawIrregularDot(ctx, x, y, baseSize, color, randomFunc = Math.random) {
    // 根据randomness参数计算点大小的变化范围
    // randomness = 1: 效果类似原来randomness = 3 (0.51 到 1.49倍)
    // randomness = 10: 0.02 到 2.0倍
    const randomness = Math.max(1, Math.min(10, params.randomness || 3));
    // 线性插值：从randomness=1时的0.51-1.49范围，到randomness=10时的0.02-2.0范围
    const minMultiplier = 0.51 - (randomness - 1) * (0.51 - 0.02) / 9;
    const maxMultiplier = 1.49 + (randomness - 1) * (2.0 - 1.49) / 9;
    const multiplierRange = maxMultiplier - minMultiplier;
    
    // 计算点的大小（添加大小变化，点和点之间大小不同）
    const sizeVariation = (randomFunc() - 0.5) * params.sizeVariation * 0.2;
    const dotSize = Math.max(1, baseSize * (minMultiplier + randomFunc() * multiplierRange) + sizeVariation);
    
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.save();
    ctx.translate(x, y);
    
    // 随机选择形状类型
    const shapeType = randomFunc();
    
    if (shapeType < 0.4) {
        // 圆形（40%概率）
        ctx.beginPath();
        ctx.arc(0, 0, dotSize, 0, Math.PI * 2);
        ctx.fill();
    } else if (shapeType < 0.7) {
        // 椭圆形（30%概率）
        const rotation = randomFunc() * Math.PI * 2;
        const radiusX = dotSize * (0.8 + randomFunc() * 0.4);
        const radiusY = dotSize * (0.8 + randomFunc() * 0.4);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
    } else if (shapeType < 0.85) {
        // 圆角三角形（15%概率）
        const rotation = randomFunc() * Math.PI * 2;
        ctx.rotate(rotation);
        ctx.beginPath();
        const radius = dotSize;
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        // 使用圆角
        ctx.fill();
    } else {
        // 圆角矩形/方形（15%概率）
        const rotation = randomFunc() * Math.PI * 2;
        const width = dotSize * (1.2 + randomFunc() * 0.6);
        const height = dotSize * (1.2 + randomFunc() * 0.6);
        ctx.rotate(rotation);
        ctx.beginPath();
        const cornerRadius = Math.min(width, height) * 0.2;
        roundRect(ctx, -width/2, -height/2, width, height, cornerRadius);
        ctx.fill();
    }
    
    ctx.restore();
}

// 绘制圆角矩形
function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// 渲染点彩画
function renderPointillism() {
    if (!sourceImage || !originalImageData) return;

    // 1. 铺底：彻底清除并填充背景
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bgColor = getCanvasBackgroundColor();
    
    // 如果是圆环，先画镂空底
    if (params.designType === 'pendant' && params.pendantShape === 'ring') {
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const or = Math.min(canvas.width, canvas.height) / 2, ir = or / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, or, 0, Math.PI * 2);
        ctx.moveTo(cx + ir, cy);
        ctx.arc(cx, cy, ir, 0, Math.PI * 2, true);
        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.restore();
    } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const palette = getPaletteFromColorLibrary(params.colorCount);
    const sortedPalette = [...palette].sort((a, b) => (a.r+a.g+a.b) - (b.r+b.g+b.b));
    const isWet = params.patternType === 'wet';
    const spacing = isWet ? 1 : Math.max(1, 20 - (params.dotDensity / 100) * 18);
    const data = originalImageData.data;
    
    // originalImageData 的原始尺寸 (由 resizeCanvas 产生)
    const imgW = originalImageData.width;
    const imgH = originalImageData.height;

    randomSeed = 12345;
    dotColorMap.clear();

    // 绘制循环
    for (let y = 0; y < canvas.height; y += spacing) {
        for (let x = 0; x < canvas.width; x += spacing) {
            
            // 形状过滤
            if (!isPointInShape(x, y, canvas.width, canvas.height)) continue;

            // --- 采样坐标计算修复 ---
            // 确保偏移和缩放是以当前画布中心为基准
            const sampleX = Math.floor((x - canvas.width / 2) / params.patternScale + imgW / 2 - params.patternOffsetX / params.patternScale);
            const sampleY = Math.floor((y - canvas.height / 2) / params.patternScale + imgH / 2 - params.patternOffsetY / params.patternScale);

            if (sampleX < 0 || sampleX >= imgW || sampleY < 0 || sampleY >= imgH) continue;
            
            const idx = (sampleY * imgW + sampleX) * 4;
            if (data[idx + 3] < 10) continue; 

            // 颜色映射逻辑...
            const gray = (data[idx] + data[idx+1] + data[idx+2]) / 3;
            let colorIdx = Math.min(Math.floor((gray/256) * sortedPalette.length), sortedPalette.length - 1);
            let color = colorReplacements.has(colorIdx) ? colorReplacements.get(colorIdx) : sortedPalette[colorIdx];

            if (isWet) {
                ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
                ctx.fillRect(x, y, spacing + 0.2, spacing + 0.2);
            } else {
                const px = x + (seededRandom() - 0.5) * params.randomness * 0.2 * spacing;
                const py = y + (seededRandom() - 0.5) * params.randomness * 0.2 * spacing;
                drawIrregularDot(ctx, px, py, params.dotSize, color, seededRandom);
            }
            dotColorMap.set(`${Math.round(x)},${Math.round(y)}`, { x, y, index: colorIdx });
        }
    }
    
    // 最终应用遮罩（确保 Ring 模式边缘干净）并画边框
    if (params.designType !== 'free' && params.pendantShape === 'ring') {
        applyShapeMask(ctx, canvas.width, canvas.height);
    }
    drawDefaultBorder(ctx, canvas.width, canvas.height);
}


(function initThrottledRender() {
    if (throttledRender === null) {
        throttledRender = throttle(() => {
            if (sourceImage) {
                // 🚀 同样让它去调 resizeCanvas，以保持模式判断的一致性
                resizeCanvas();
            }
        }, 50); 
    }
})();

// 应用形状遮罩（裁剪形状外的部分）
function applyShapeMask(ctx, width, height) {
    if (params.designType !== 'pendant' && params.designType !== 'irregular') return;
    
    // 创建一个临时画布来应用遮罩
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const centerX = width / 2;
    const centerY = height / 2;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            
            // 检查点是否在形状内
            if (!isPointInShape(x, y, width, height)) {
                // 将形状外的像素设为透明
                data[index] = 255;     // R
                data[index + 1] = 255; // G
                data[index + 2] = 255; // B
                data[index + 3] = 0;   // A - 设为透明
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// 绘制默认浅灰色描边（用于吊坠模式和异形模式，始终显示）
function drawDefaultBorder(ctx, width, height) {
    ctx.strokeStyle = '#cccccc'; 
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    if (params.designType === 'free') {
        // 只有自由模式画矩形框
        ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    } 
    else if (params.designType === 'pendant') {
        const centerX = width / 2;
        const centerY = height / 2;
        const borderOffset = 0.5;
        
        switch (params.pendantShape) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(centerX, centerY, Math.min(width, height) / 2 - borderOffset, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'ellipse':
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, width / 2 - borderOffset, height / 2 - borderOffset, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'ring':
                // 圆环绘制内外两个圈
                const outerR = Math.min(width, height) / 2 - borderOffset;
                const innerR = outerR / 2;
                ctx.beginPath();
                ctx.arc(centerX, centerY, outerR, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(centerX, centerY, innerR, 0, Math.PI * 2);
                ctx.stroke();
                break;
        }
    } else if (params.designType === 'irregular') {
        if (params.irregularShape === 'irregularA') createIrregularAPath(ctx, width, height);
        else if (params.irregularShape === 'irregularB') createIrregularBPath(ctx, width, height);
        ctx.stroke();
    }
}

// 绘制圆环模式的白色底（用于初始化）
function drawRingWhiteBackground(ctx, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = Math.min(width, height) / 2;
    const innerRadius = outerRadius / 2;
    
    const bgColor = getCanvasBackgroundColor();
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.moveTo(centerX + innerRadius, centerY);
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
    ctx.fill();
}

// 绘制默认描边和阴影（用于吊坠模式和异形模式初始化）
function drawDefaultBorderAndShadow() {
    drawDefaultBorder(ctx, canvas.width, canvas.height);
}

// 绘制默认异形轮廓（用于初始化时显示异形形状）
function drawDefaultOutline() {
    if (params.designType !== 'irregular') return;
    
    // 填充背景色
    const bgColor = getCanvasBackgroundColor();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 应用异形遮罩（裁剪形状外的部分）
    applyShapeMask(ctx, canvas.width, canvas.height);
    
    // 绘制异形轮廓描边
    drawDefaultBorder(ctx, canvas.width, canvas.height);
}

// 上传图片处理
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // 重置图案偏移量
    params.patternOffsetX = 0;
    params.patternOffsetY = 0;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // 调整图片大小以适应画布
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // 计算缩放比例以保持宽高比
            const scale = Math.min(
                canvas.width / img.width,
                canvas.height / img.height
            );
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const offsetX = (canvas.width - scaledWidth) / 2;
            const offsetY = (canvas.height - scaledHeight) / 2;
            
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, canvas.width, canvas.height);
            tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
            
            // 保持彩色，不转换为灰度图
            const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
            
            // 保存图像数据
            sourceImage = img;
            isDirectImageMode = false; 
            originalImageData = imageData;
            
            // 清除颜色替换映射（加载新图片时）
            colorReplacements.clear();
            
            // 调整画布尺寸
            canvas.width = params.canvasWidth;
            canvas.height = params.canvasHeight;
            
            // 渲染点彩画
            renderPointillism();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 下载画作
function downloadCanvas() {
    // 创建临时画布用于导出（应用形状裁剪）
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 复制当前画布内容
    tempCtx.drawImage(canvas, 0, 0);
    
    // 如果是异形模式，应用形状裁剪
    if (params.designType === 'irregular') {
        applyShapeMask(tempCtx, tempCanvas.width, tempCanvas.height);
    }
    
    const link = document.createElement('a');
    link.download = 'pointillism-art.png';
    link.href = tempCanvas.toDataURL();
    link.click();
}

// 重置参数
function resetParams() {
    params.canvasWidth = 800;
    params.canvasHeight = 600;
    params.colorCount = 3;
    params.patternScale = 1;
    
    // 重置颜色为第一个预设色卡的4个颜色
    selectedColors = cloneColors(presetColorCards[0].colors);
    initColorPalette();
    params.dotSize = 2.5;
    params.dotDensity = 70;
    params.randomness = 3;
    params.sizeVariation = 20;
    
    // 更新设计尺寸输入
    const mmToPx = 3.78;
    document.getElementById('designWidth').value = Math.round(params.canvasWidth / mmToPx);
    document.getElementById('designHeight').value = Math.round(params.canvasHeight / mmToPx);
    
    // 更新颜色数量滑块
    document.getElementById('colorCount').value = params.colorCount;
    document.getElementById('colorCountValue').textContent = params.colorCount;
    
    // 更新点大小滑块
    document.getElementById('dotSize').value = params.dotSize;
    document.getElementById('dotSizeValue').textContent = params.dotSize;
    
    // 更新点密度滑块
    document.getElementById('dotDensity').value = params.dotDensity;
    const labels = ['稀疏', '较稀疏', '中等', '较密集', '密集'];
    const index = Math.floor((params.dotDensity - 10) / 22.5);
    document.getElementById('dotDensityValue').textContent = labels[Math.min(Math.max(index, 0), 4)];
    
    // 更新随机性滑块
    document.getElementById('randomness').value = params.randomness;
    document.getElementById('randomnessValue').textContent = params.randomness;
    
    // 调整画布尺寸
    resizeCanvas();
    
    // 重新渲染画布
    if (sourceImage && originalImageData) {
        renderPointillism();
    }
}

// 珐琅釉料颜色库（国产景泰蓝系列釉料 - 唐恩）
const colorLibrary = [
    // ========== 1101-1606 ==========
    { code: 'o1101', name: '深珊瑚红', r: 180, g: 30, b: 40, isTransparent: false },
    { code: 'o1102', name: '浅珊瑚红', r: 220, g: 60, b: 70, isTransparent: false },
    { code: 'o1103', name: '玫瑰红', r: 200, g: 50, b: 80, isTransparent: false },
    { code: 'o1104', name: '辰砂', r: 150, g: 40, b: 60, isTransparent: false },
    { code: 'o1105', name: '玫红', r: 190, g: 45, b: 75, isTransparent: false },
    { code: 'o1106', name: '桃红', r: 240, g: 140, b: 160, isTransparent: false },
    { code: 'o1107', name: '深粉', r: 200, g: 100, b: 120, isTransparent: false },
    { code: 'o1109', name: '浅粉', r: 255, g: 230, b: 240, isTransparent: false },
    { code: 'o1110', name: '浅紫红', r: 240, g: 200, b: 220, isTransparent: false },
    { code: 't1111', name: '透殷红', r: 160, g: 20, b: 30, isTransparent: true },
    { code: 'o1112', name: '大红', r: 220, g: 20, b: 30, isTransparent: false },
    { code: 'o1113', name: '珊瑚红', r: 240, g: 80, b: 90, isTransparent: false },
    { code: 'o1114', name: '赭红', r: 140, g: 50, b: 40, isTransparent: false },
    { code: 'o1115', name: '绛红', r: 120, g: 20, b: 40, isTransparent: false },
    { code: 'o1116', name: '粉红', r: 250, g: 160, b: 180, isTransparent: false },
    { code: 'o1117', name: '紫红', r: 200, g: 80, b: 120, isTransparent: false },
    { code: 'o1118', name: '百花紫', r: 140, g: 80, b: 120, isTransparent: false },
    { code: 'o1201', name: '橘红', r: 240, g: 100, b: 50, isTransparent: false },
    { code: 'o1202', name: '橘黄', r: 255, g: 140, b: 40, isTransparent: false },
    { code: 'o1205', name: '土黄', r: 200, g: 170, b: 120, isTransparent: false },
    { code: 't1206', name: '透黄', r: 255, g: 200, b: 0, isTransparent: true },
    { code: 'o1301', name: '正黄', r: 255, g: 220, b: 0, isTransparent: false },
    { code: 'o1302', name: '橙黄', r: 255, g: 160, b: 30, isTransparent: false },
    { code: 'o1303', name: '金桔', r: 220, g: 100, b: 20, isTransparent: false },
    { code: 'o1304', name: '铬黄', r: 220, g: 200, b: 80, isTransparent: false },
    { code: 'o1305', name: '米黄', r: 250, g: 240, b: 200, isTransparent: false },
    { code: 'o1306', name: '浅淡黄', r: 255, g: 250, b: 220, isTransparent: false },
    { code: 'o1401', name: '墨绿', r: 20, g: 40, b: 30, isTransparent: false },
    { code: 'o1403', name: '大绿', r: 0, g: 120, b: 60, isTransparent: false },
    { code: 'o1404', name: '浅墨绿', r: 40, g: 80, b: 60, isTransparent: false },
    { code: 'o1405', name: '正绿', r: 0, g: 150, b: 80, isTransparent: false },
    { code: 'o1406', name: '翠绿', r: 0, g: 180, b: 100, isTransparent: false },
    { code: 'o1407', name: '军绿', r: 80, g: 100, b: 60, isTransparent: false },
    { code: 'o1408', name: '玉绿', r: 100, g: 200, b: 140, isTransparent: false },
    { code: 'o1409', name: '黄绿', r: 150, g: 220, b: 100, isTransparent: false },
    { code: 'o1410', name: '浅淡绿', r: 220, g: 250, b: 220, isTransparent: false },
    { code: 't1411', name: '透亮绿', r: 0, g: 200, b: 100, isTransparent: true },
    { code: 'o1412', name: '墨绿', r: 15, g: 35, b: 25, isTransparent: false },
    { code: 'o1413', name: '复古蓝绿', r: 60, g: 120, b: 100, isTransparent: false },
    { code: 't1415', name: '透绿', r: 50, g: 180, b: 120, isTransparent: true },
    { code: 'o1416', name: '复古蓝', r: 40, g: 80, b: 120, isTransparent: false },
    { code: 'o1417', name: '钢青色', r: 50, g: 70, b: 90, isTransparent: false },
    
    // ========== 1607-1820 ==========
    { code: 't1418', name: '金星绿', r: 20, g: 50, b: 30, isTransparent: true },
    { code: 'o1501', name: '亮天蓝', r: 100, g: 200, b: 255, isTransparent: false },
    { code: 'o1502', name: '牵牛花蓝', r: 80, g: 150, b: 220, isTransparent: false },
    { code: 'o1503', name: '天青蓝', r: 30, g: 100, b: 180, isTransparent: false },
    { code: 'o1504', name: '亮浅蓝', r: 200, g: 230, b: 255, isTransparent: false },
    { code: 'o1601', name: '深邃蓝', r: 10, g: 20, b: 50, isTransparent: false },
    { code: 'o1602', name: '百花兰', r: 60, g: 40, b: 120, isTransparent: false },
    { code: 'o1603', name: '宝石蓝', r: 30, g: 50, b: 140, isTransparent: false },
    { code: 'o1604', name: '青金蓝(深)', r: 20, g: 40, b: 100, isTransparent: false },
    { code: 'o1605', name: '孔雀蓝', r: 0, g: 120, b: 150, isTransparent: false },
    { code: 'o1606', name: '浅灰蓝', r: 150, g: 170, b: 190, isTransparent: false },
    { code: 'o1607', name: '天蓝', r: 100, g: 180, b: 240, isTransparent: false },
    { code: 'o1608', name: '松石绿', r: 50, g: 180, b: 170, isTransparent: false },
    { code: 'o1609', name: '松石绿', r: 50, g: 180, b: 170, isTransparent: false },
    { code: 'o1610', name: '亮青蓝', r: 80, g: 220, b: 240, isTransparent: false },
    { code: 'o1611', name: '藏青色', r: 15, g: 25, b: 60, isTransparent: false },
    { code: 't1612', name: '海蓝(透明)', r: 30, g: 100, b: 180, isTransparent: true },
    { code: 'o1613', name: '青金蓝(浅)', r: 60, g: 100, b: 160, isTransparent: false },
    { code: 'o1614', name: '亮蓝', r: 50, g: 120, b: 200, isTransparent: false },
    { code: 'o1615', name: '青金蓝', r: 40, g: 70, b: 130, isTransparent: false },
    { code: 'o1616', name: '青金石', r: 35, g: 60, b: 120, isTransparent: false },
    { code: 'o1701', name: '灰紫', r: 120, g: 100, b: 130, isTransparent: false },
    { code: 't1702', name: '百花紫', r: 100, g: 50, b: 120, isTransparent: true },
    { code: 'o1703', name: '藕荷紫', r: 200, g: 180, b: 220, isTransparent: false },
    { code: 't1704', name: '驼色', r: 180, g: 150, b: 120, isTransparent: true },
    { code: 'o1801', name: '大黑', r: 0, g: 0, b: 0, isTransparent: false },
    { code: 'o1802', name: '正黑', r: 0, g: 0, b: 0, isTransparent: false },
    { code: 'o1803', name: '瓷白', r: 255, g: 255, b: 255, isTransparent: false },
    { code: 'o1804', name: '花白', r: 255, g: 255, b: 255, isTransparent: false },
    { code: 'o1805', name: '深灰', r: 50, g: 50, b: 50, isTransparent: false },
    { code: 'o1806', name: '浅灰', r: 180, g: 180, b: 180, isTransparent: false },
    { code: 'o1807', name: '深棕色', r: 60, g: 40, b: 25, isTransparent: false },
    { code: 'o1808', name: '亮棕', r: 150, g: 100, b: 70, isTransparent: false },
    { code: 'o1809', name: '椰褐', r: 120, g: 80, b: 50, isTransparent: false },
    { code: 'o1810', name: '咖啡', r: 100, g: 60, b: 40, isTransparent: false },
    { code: 'o1811', name: '棕色', r: 130, g: 90, b: 60, isTransparent: false },
    { code: 'o1812', name: '红金星', r: 100, g: 40, b: 30, isTransparent: false },
    { code: 'o1813', name: '蓝金星', r: 30, g: 50, b: 100, isTransparent: false },
    { code: 'o1814', name: '半透白', r: 250, g: 250, b: 250, isTransparent: false },
    { code: 'o1815', name: '瓷花白', r: 255, g: 255, b: 255, isTransparent: false },
    { code: 't1816', name: '铜白透', r: 255, g: 250, b: 240, isTransparent: true },
    { code: 'o1817', name: '牙釉', r: 255, g: 250, b: 240, isTransparent: false },
    { code: 'o1819', name: '铜白底', r: 255, g: 255, b: 255, isTransparent: false },
    { code: 'o1820', name: '灰蓝', r: 140, g: 160, b: 180, isTransparent: false }
];

// 初始化颜色选择器
function initColorPicker() {
    const colorGrid = document.getElementById('colorLibraryGrid');
    colorGrid.innerHTML = '';
    
    colorLibrary.forEach((color, index) => {
        const colorItem = document.createElement('div');
        colorItem.className = 'color-library-item';
        // 使用background-color而不是backgroundColor，以便CSS渐变可以叠加
        colorItem.style.background = `rgb(${color.r}, ${color.g}, ${color.b})`;
        colorItem.dataset.index = index;
        // 显示商品代码和名称
        const displayName = color.code ? `${color.code} ${color.name}` : color.name;
        colorItem.title = displayName;
        
        // 添加文字标签显示代码和名称
        const label = document.createElement('div');
        label.className = 'enamel-label';
        label.innerHTML = `
            <div class="enamel-code">${color.code || ''}</div>
            <div class="enamel-name">${color.name}</div>
        `;
        colorItem.appendChild(label);
        
        colorItem.addEventListener('click', () => {
            document.querySelectorAll('.color-library-item').forEach(item => item.classList.remove('selected'));
            colorItem.classList.add('selected');
            // 更新自定义颜色选择器
            const hex = rgbToHex(color.r, color.g, color.b);
            document.getElementById('customColorInput').value = hex;
            document.getElementById('colorNameInput').value = displayName;
        });
        colorGrid.appendChild(colorItem);
    });
    
    // 模态框关闭
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // 确认添加颜色
    document.getElementById('confirmColorBtn').addEventListener('click', () => {
        const selected = document.querySelector('.color-library-item.selected');
        let color;
        
        if (selected) {
            const index = parseInt(selected.dataset.index);
            color = colorLibrary[index];
        } else {
            // 使用自定义颜色
            const hex = document.getElementById('customColorInput').value;
            const rgb = hexToRgb(hex);
            const name = document.getElementById('colorNameInput').value || '自定义颜色';
            color = { name, r: rgb.r, g: rgb.g, b: rgb.b };
        }
        
        selectedColors.push({
            name: color.name,
            code: color.code || undefined,
            r: color.r,
            g: color.g,
            b: color.b,
            opacity: 90
        });
        
        initColorPalette();
        document.getElementById('colorPickerModal').style.display = 'none';
    });
    
    // 取消
    document.getElementById('cancelColorBtn').addEventListener('click', () => {
        document.getElementById('colorPickerModal').style.display = 'none';
    });
}

function populateColorCardList() {
    const list = document.getElementById('colorCardList');
    if (!list) return;
    list.innerHTML = '';
    presetColorCards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'color-card';
        const swatches = card.colors.map(color => 
            `<span style="background-color: rgb(${color.r}, ${color.g}, ${color.b});"></span>`
        ).join('');
        cardEl.innerHTML = `
            <h4>${card.name}</h4>
            <p>${card.description}</p>
            <div class="color-card-swatches">${swatches}</div>
            <button data-card-id="${card.id}">应用</button>
        `;
        cardEl.querySelector('button').addEventListener('click', () => {
            applyColorCard(card.id);
            const modal = document.getElementById('colorCardModal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
        list.appendChild(cardEl);
    });
}

function initColorCardModal() {
    const openBtn = document.getElementById('colorCardBtn');
    const modal = document.getElementById('colorCardModal');
    if (!openBtn || !modal) return;
    populateColorCardList();
    openBtn.addEventListener('click', () => {
        modal.style.display = 'block';
    });
}

function applyColorCard(cardId) {
    const card = presetColorCards.find(item => item.id === cardId);
    if (!card) return;

    selectedColors = cloneColors(card.colors);
    params.colorCount = Math.min(10, Math.max(2, selectedColors.length));
    
    initColorPalette();
    syncControlsWithParams(); // 同步 UI 显示
    
    if (sourceImage) {
        triggerRender(); 
    }
}

function initReferenceColorImport() {
    const triggerBtn = document.getElementById('extractFromImageBtn');
    const fileInput = document.getElementById('colorReferenceInput');
    if (!triggerBtn || !fileInput) return;
    triggerBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
    });
    fileInput.addEventListener('change', handleReferenceColorFile);
}

function handleReferenceColorFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const palette = extractPaletteFromImage(img, Math.min(6, Math.max(3, params.colorCount)));
            if (palette.length) {
                selectedColors = palette;
                params.colorCount = palette.length;
                initColorPalette();
                syncControlsWithParams();
                alert('已根据参考图生成新的色卡，并替换当前调色盘。');
            } else {
                alert('未能从该图片中提取有效颜色，请尝试清晰度更高的图片。');
            }
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function extractPaletteFromImage(img, desiredCount = 5) {
    const tempCanvas = document.createElement('canvas');
    const maxEdge = 250;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    tempCanvas.width = Math.max(1, Math.round(img.width * scale));
    tempCanvas.height = Math.max(1, Math.round(img.height * scale));
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    const totalPixels = data.length / 4;
    const targetSamples = 2000;
    const pixelStep = Math.max(1, Math.floor(totalPixels / targetSamples));
    const byteStep = pixelStep * 4;
    const buckets = new Map();
    
    for (let i = 0; i < data.length; i += byteStep) {
        const alpha = data[i + 3];
        if (alpha < 200) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`;
        if (!buckets.has(key)) {
            buckets.set(key, { r: 0, g: 0, b: 0, count: 0 });
        }
        const bucket = buckets.get(key);
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
        bucket.count += 1;
    }
    
    return Array.from(buckets.values())
        .filter(bucket => bucket.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, desiredCount)
        .map((bucket, index) => ({
            name: `取色 ${index + 1}`,
            r: Math.round(bucket.r / bucket.count),
            g: Math.round(bucket.g / bucket.count),
            b: Math.round(bucket.b / bucket.count),
            opacity: 95
        }));
}

function initModeSwitcher() {
    const buttons = document.querySelectorAll('.mode-btn');
    const mainTitle = document.querySelector('.nav-title h1');
    const standardBg = document.getElementById('standardBgControl');
    const workshopBg = document.getElementById('workshopBgControl');
    const materialSection = document.getElementById('materialSection');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextMode = btn.dataset.mode;
            
            // 跨模式切换清空
            if (nextMode !== currentAppMode) {
                sourceImage = null;
                originalImageData = null;
                colorReplacements.clear();
                dotColorMap.clear();
                params.patternOffsetX = 0;
                params.patternOffsetY = 0;
                params.patternScale = (nextMode === 'workshop') ? 1.0 : 1;
            }

            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentAppMode = nextMode;
            
            const workshopTitleArea = document.getElementById('workshopTitleArea');
            const defaultToolbar = document.getElementById('defaultToolbar');
            const workshopToolbar = document.getElementById('workshopToolbar');
            const patternControls = document.querySelector('.pattern-controls');

            if (currentAppMode === 'workshop') {
    // --- 进入工作坊模式 ---
    if (mainTitle) mainTitle.innerText = '散点花卉主题体验';
    if (workshopTitleArea) workshopTitleArea.style.display = 'block';
    if (materialSection) materialSection.style.display = 'none';
    
    // 1. 切换底色工具显示
    standardBg.style.display = 'none';
    workshopBg.style.display = 'block';
    
    // 2. 隐藏不必要的控制组
    defaultToolbar.style.display = 'none';
    workshopToolbar.style.display = 'block';
    patternControls.style.display = 'none';

    // --- 【核心修复：强制 UI 选中吊坠和圆形】 ---
    params.designType = 'pendant';
    params.pendantShape = 'circle'; // 默认回圆型，因为圆环被禁用了
    params.patternScale = 1.0; 
    params.patternOffsetX = 0;
    params.patternOffsetY = 0;
    colorReplacements.clear();

    // 更新“设计类型”按钮的高亮（选中吊坠，隐藏自由）
    document.querySelectorAll('[data-design-type]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.designType === 'pendant') btn.classList.add('active');
        if (btn.dataset.designType === 'free') btn.style.display = 'none';
    });

    // 更新“吊坠形状”按钮的高亮（选中圆形，隐藏圆环）
    document.querySelectorAll('[data-pendant-shape]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.pendantShape === 'circle') btn.classList.add('active');
        if (btn.dataset.pendantShape === 'ring') btn.style.display = 'none';
    });

    // 确保吊坠子选项面板是打开的
    const pendantOptions = document.getElementById('pendantOptions');
    if (pendantOptions) pendantOptions.style.display = 'block';

    // 3. 载入第一个图案
    workshopPatternIndex = 0; 
    generateWorkshopPattern(); 
            } else {
                // --- 退出工作坊 ---
                if (mainTitle) mainTitle.innerText = '我的珐琅工坊';
                if (workshopTitleArea) workshopTitleArea.style.display = 'none';
                if (materialSection) materialSection.style.display = 'block';

                // 切换底色工具
                standardBg.style.display = 'block';
                workshopBg.style.display = 'none';
                
                defaultToolbar.style.display = 'block';
                workshopToolbar.style.display = 'none';
                patternControls.style.display = 'flex'; 
                
                document.querySelector('[data-design-type="free"]').style.display = 'inline-block';
                document.querySelector('[data-pendant-shape="ring"]').style.display = 'inline-block';
                
                if (currentAppMode === 'ai') enterAIMode(); else exitAIMode();
            }
            
            updateCanvasForDesignType();
            syncControlsWithParams(); 
        });
    });
}

function enterAIMode() {
    isAIMode = true;
    document.body.classList.add('ai-mode-active');
    const notice = document.getElementById('aiModeNotice');
    if (notice) notice.style.display = 'block';
}

function exitAIMode() {
    isAIMode = false;
    document.body.classList.remove('ai-mode-active');
    const notice = document.getElementById('aiModeNotice');
    if (notice) notice.style.display = 'none';
}

// 打开颜色选择器
function openColorPicker() {
    document.getElementById('colorPickerModal').style.display = 'block';
    // 清除之前的选择
    document.querySelectorAll('.color-library-item').forEach(item => item.classList.remove('selected'));
    document.getElementById('colorNameInput').value = '';
    document.getElementById('customColorInput').value = '#ffffff';
}

// RGB转Hex
function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

// Hex转RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

// 初始化AI生成功能
function initAIGenerate() {
    // 加载保存的API Key
    loadSavedApiKeys();
    
    document.getElementById('generateAIBtn').addEventListener('click', () => {
        document.getElementById('aiGenerateModal').style.display = 'block';
    });
    
    // API类型切换
    document.getElementById('aiApiType').addEventListener('change', (e) => {
        const apiKeyGroup = document.getElementById('apiKeyGroup');
        const apiType = e.target.value;
        if (apiType === 'demo' || apiType === 'pollinations') {
            apiKeyGroup.style.display = 'none';
        } else {
            apiKeyGroup.style.display = 'block';
            // 加载对应API的保存的Key
            const savedKey = getSavedApiKey(apiType);
            if (savedKey) {
                document.getElementById('apiKeyInput').value = savedKey;
            }
        }
    });
    
    // 切换API Key显示/隐藏
    document.getElementById('toggleApiKeyBtn').addEventListener('click', () => {
        const input = document.getElementById('apiKeyInput');
        const btn = document.getElementById('toggleApiKeyBtn');
        if (input.type === 'password') {
            input.type = 'text';
            btn.textContent = '隐藏';
        } else {
            input.type = 'password';
            btn.textContent = '显示';
        }
    });
    
    // 确认AI生成
    document.getElementById('confirmAIGenerateBtn').addEventListener('click', () => {
        const prompt = document.getElementById('aiPromptInput').value;
        const apiType = document.getElementById('aiApiType').value;
        const apiKey = document.getElementById('apiKeyInput').value;
        
        if (!prompt.trim()) {
            alert('请输入提示词');
            return;
        }
        
        if (apiType !== 'demo' && apiType !== 'pollinations' && !apiKey.trim()) {
            alert('请输入API Key');
            return;
        }
        
        // 保存API Key到本地存储
        if (apiType !== 'demo' && apiType !== 'pollinations' && apiKey.trim()) {
            saveApiKey(apiType, apiKey);
        }
        
        document.getElementById('aiGenerateModal').style.display = 'none';
        generateAIPattern(prompt, apiType, apiKey);
    });
    
    // 取消
    document.getElementById('cancelAIGenerateBtn').addEventListener('click', () => {
        document.getElementById('aiGenerateModal').style.display = 'none';
    });
}

// AI生成图案
async function generateAIPattern(prompt, apiType, apiKey) {
    // 重置图案偏移量
    params.patternOffsetX = 0;
    params.patternOffsetY = 0;
    
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingText = loadingIndicator.querySelector('p');
    loadingIndicator.style.display = 'block';
    
    try {
        let imageData;
        
        if (apiType === 'pollinations') {
            // Pollinations.ai API (免费，无需API Key)
            loadingText.textContent = '正在生成图像，请耐心等待...';
            imageData = await generateWithPollinations(prompt);
        } else if (apiType === 'demo') {
            // 演示模式：使用改进的本地生成（不显示长时间等待提示）
            loadingText.textContent = '正在生成图像，请耐心等待...';
            imageData = await generateLocalAIPattern(prompt);
        } else if (apiType === 'huggingface') {
            // Hugging Face API
            loadingText.textContent = '正在调用Hugging Face API...（可能需要30-60秒）';
            imageData = await generateWithHuggingFace(prompt, apiKey);
        } else if (apiType === 'replicate') {
            // Replicate API
            loadingText.textContent = '正在调用Replicate API...（可能需要30-60秒）';
            imageData = await generateWithReplicate(prompt, apiKey);
        }
        
        if (imageData) {
            // 如果是Pollinations.ai生成的图像，进行颜色匹配处理
            if (apiType === 'pollinations' && imageData.imageData) {
                // 根据提示词智能匹配颜色
                const semanticPalette = getSemanticColors(prompt, params.colorCount);
                // 将图像颜色映射到语义调色板
                applyColorMapping(imageData.imageData, semanticPalette);
            }
            
            // 加载到主画布
            const img = new Image();
            img.onload = () => {
                sourceImage = img;
                originalImageData = imageData.imageData || imageData;
                // 清除颜色替换映射（加载新图片时）
                colorReplacements.clear();
                canvas.width = params.canvasWidth;
                canvas.height = params.canvasHeight;
                renderPointillism();
                loadingIndicator.style.display = 'none';
            };
            img.src = imageData.canvas.toDataURL();
        }
    } catch (error) {
        console.error('AI生成失败:', error);
        loadingIndicator.style.display = 'none';
        
        // 检查网络连接状态
        const isOnline = navigator.onLine;
        let errorMessage = 'AI生成失败: ' + error.message;
        
        if (!isOnline) {
            errorMessage += '\n\n检测到网络连接已断开，请检查您的网络设置。';
        } else if (apiType === 'pollinations') {
            errorMessage += '\n\n解决方案：\n' +
                '1. 检查网络连接是否稳定\n' +
                '2. 稍后重试（服务可能暂时繁忙）\n' +
                '3. 切换到"演示模式"进行本地生成（无需网络）\n' +
                '4. 如果问题持续，可能是Pollinations.ai服务暂时不可用';
        } else {
            errorMessage += '\n\n请检查网络连接后重试，或切换到演示模式。';
        }
        
        alert(errorMessage);
    }
}

// 本地AI生成（改进版，基于提示词生成更清晰的图案）
async function generateLocalAIPattern(prompt) {
    return new Promise((resolve) => {
        setTimeout(() => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = params.canvasWidth;
            tempCanvas.height = params.canvasHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            // 填充白色背景
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // 根据提示词智能选择颜色
            const lowerPrompt = prompt.toLowerCase();
            const palette = getSemanticColors(prompt, Math.min(8, selectedColors.length));
            
            // 根据提示词生成具体图案
            if (lowerPrompt.includes('sunflower') || lowerPrompt.includes('向日葵')) {
                generateSunflowerPattern(tempCtx, tempCanvas.width, tempCanvas.height, palette);
            } else if (lowerPrompt.includes('rose') || lowerPrompt.includes('玫瑰')) {
                generateRosePattern(tempCtx, tempCanvas.width, tempCanvas.height, palette);
            } else if (lowerPrompt.includes('butterfly') || lowerPrompt.includes('蝴蝶')) {
                generateButterflyPattern(tempCtx, tempCanvas.width, tempCanvas.height, palette);
            } else if (lowerPrompt.includes('bird') || lowerPrompt.includes('鸟')) {
                generateBirdPattern(tempCtx, tempCanvas.width, tempCanvas.height, palette);
            } else if (lowerPrompt.includes('flower') || lowerPrompt.includes('花')) {
                generateFlowerPattern(tempCtx, tempCanvas.width, tempCanvas.height, palette);
            } else if (lowerPrompt.includes('leaf') || lowerPrompt.includes('叶子') || lowerPrompt.includes('plant') || lowerPrompt.includes('植物')) {
                generateLeafPattern(tempCtx, tempCanvas.width, tempCanvas.height, palette);
            } else if (lowerPrompt.includes('geometric') || lowerPrompt.includes('几何')) {
                generateGeometricPattern(tempCtx, tempCanvas.width, tempCanvas.height, palette);
            } else if (lowerPrompt.includes('abstract') || lowerPrompt.includes('抽象')) {
                generateAbstractPattern(tempCtx, tempCanvas.width, tempCanvas.height, palette);
            } else {
                // 默认生成花朵图案
                generateFlowerPattern(tempCtx, tempCanvas.width, tempCanvas.height, palette);
            }
            
            // 如果是负片模式，反转颜色
            if (params.patternType === 'negative') {
                const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                invertColors(imageData);
                tempCtx.putImageData(imageData, 0, 0);
            }
            
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            resolve({ canvas: tempCanvas, imageData });
        }, 1500);
    });
}

// 检测网络连接状态
function checkNetworkConnection() {
    if (!navigator.onLine) {
        return { online: false, message: '网络连接已断开' };
    }
    return { online: true, message: '网络连接正常' };
}

// Pollinations.ai API生成（免费，无需API Key，带重试机制）
async function generateWithPollinations(prompt, retryCount = 0) {
    // 检查网络连接
    const networkStatus = checkNetworkConnection();
    if (!networkStatus.online && retryCount === 0) {
        throw new Error('网络连接已断开，请检查您的网络设置后重试。');
    }
    
    const maxRetries = 4; // 增加到最多重试4次
    const timeout = 120000; // 增加到120秒超时
    // 指数退避：每次重试前等待更长时间（秒）
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 最多等待10秒
    
    return new Promise((resolve, reject) => {
        try {
            // 限制尺寸，Pollinations.ai推荐使用标准尺寸以提高速度
            // 将尺寸调整为标准尺寸（512, 768, 1024等）
            let width = params.canvasWidth;
            let height = params.canvasHeight;
            
            // 标准化尺寸到最接近的标准尺寸
            const standardSizes = [512, 768, 1024];
            width = standardSizes.reduce((prev, curr) => 
                Math.abs(curr - width) < Math.abs(prev - width) ? curr : prev
            );
            height = standardSizes.reduce((prev, curr) => 
                Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev
            );
            
            // 限制最大尺寸以提高速度
            width = Math.min(width, 1024);
            height = Math.min(height, 1024);
            
            // Pollinations.ai API格式: https://image.pollinations.ai/prompt/{prompt}?width={width}&height={height}
            // 对prompt进行URL编码
            const encodedPrompt = encodeURIComponent(prompt);
            // 添加时间戳避免缓存问题，特别是在网络切换后
            const timestamp = Date.now();
            const apiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&nologo=true&enhance=true&t=${timestamp}`;
            
            console.log(`调用Pollinations.ai API (尝试 ${retryCount + 1}/${maxRetries + 1}):`, apiUrl);
            if (retryCount > 0) {
                console.log(`网络状态: ${networkStatus.message}`);
            }
            
            let timeoutId;
            let isResolved = false;
            
            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                isResolved = true;
            };
            
            // 超时处理
            timeoutId = setTimeout(() => {
                if (!isResolved) {
                    cleanup();
                    // 如果还有重试次数，自动重试（带指数退避）
                    if (retryCount < maxRetries) {
                        console.log(`请求超时，${retryDelay/1000}秒后重试 (${retryCount + 1}/${maxRetries})...`);
                        setTimeout(() => {
                            generateWithPollinations(prompt, retryCount + 1)
                                .then(resolve)
                                .catch(reject);
                        }, retryDelay);
                    } else {
                        reject(new Error('请求超时（120秒）。Pollinations.ai服务可能较慢或网络不稳定，请检查网络连接后重试，或使用演示模式。'));
                    }
                }
            }, timeout);
            
            // 尝试加载图像的函数
            const tryLoadImage = () => {
                // 使用Image对象加载，避免CORS问题
                const img = new Image();
                
                // 设置跨域属性
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    if (isResolved) return;
                    cleanup();
                    
                    try {
                        // 创建临时画布来绘制图像
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = params.canvasWidth; // 使用原始尺寸
                        tempCanvas.height = params.canvasHeight;
                        const tempCtx = tempCanvas.getContext('2d');
                        
                        // 填充白色背景
                        tempCtx.fillStyle = '#ffffff';
                        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                        
                        // 计算缩放比例以保持宽高比
                        const scale = Math.min(
                            tempCanvas.width / img.width,
                            tempCanvas.height / img.height
                        );
                        const scaledWidth = img.width * scale;
                        const scaledHeight = img.height * scale;
                        const offsetX = (tempCanvas.width - scaledWidth) / 2;
                        const offsetY = (tempCanvas.height - scaledHeight) / 2;
                        
                        // 绘制图像
                        tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
                        
                        // 获取图像数据
                        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                        
                        resolve({ canvas: tempCanvas, imageData });
                    } catch (error) {
                        console.error('处理图像时出错:', error);
                        reject(new Error('处理图像时出错: ' + (error.message || '未知错误')));
                    }
                };
                
                img.onerror = (error) => {
                    if (isResolved) return;
                    console.error('Image加载失败:', error);
                    
                    // 如果直接加载失败，尝试使用fetch + CORS代理
                    fetchWithProxy(apiUrl, timeout)
                        .then(blob => loadImageFromBlob(blob))
                        .then(result => {
                            if (!isResolved) {
                                cleanup();
                                resolve(result);
                            }
                        })
                        .catch(err => {
                            if (!isResolved) {
                                cleanup();
                                // 如果还有重试次数，自动重试（带指数退避）
                                if (retryCount < maxRetries) {
                                    console.log(`加载失败，${retryDelay/1000}秒后重试 (${retryCount + 1}/${maxRetries})...`);
                                    setTimeout(() => {
                                        generateWithPollinations(prompt, retryCount + 1)
                                            .then(resolve)
                                            .catch(reject);
                                    }, retryDelay);
                                } else {
                                    reject(new Error('Pollinations.ai生成失败: ' + (err.message || '无法加载图像。服务可能较慢或网络不稳定，请检查网络连接后重试，或使用演示模式。')));
                                }
                            }
                        });
                };
                
                // 开始加载图像
                img.src = apiUrl;
            };
            
            // 首次尝试
            tryLoadImage();
            
        } catch (error) {
            console.error('Pollinations.ai生成失败:', error);
            // 如果还有重试次数，自动重试（带指数退避）
            if (retryCount < maxRetries) {
                console.log(`发生错误，${retryDelay/1000}秒后重试 (${retryCount + 1}/${maxRetries})...`);
                setTimeout(() => {
                    generateWithPollinations(prompt, retryCount + 1)
                        .then(resolve)
                        .catch(reject);
                }, retryDelay);
            } else {
                reject(new Error('Pollinations.ai生成失败: ' + (error.message || '未知错误。请检查网络连接后重试，或使用演示模式。')));
            }
        }
    });
}

// 应用颜色映射（将图像颜色映射到语义调色板）
function applyColorMapping(imageData, targetPalette) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // 跳过白色背景
        if (data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250) continue;
        
        const pixelColor = {
            r: data[i],
            g: data[i + 1],
            b: data[i + 2]
        };
        
        // 找到调色板中最接近的颜色
        const nearestColor = findNearestColor(pixelColor, targetPalette);
        
        data[i] = nearestColor.r;
        data[i + 1] = nearestColor.g;
        data[i + 2] = nearestColor.b;
    }
}

// 使用CORS代理获取图像（备用方案）
async function fetchWithProxy(url, timeout = 60000) {
    // 尝试直接fetch
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            return await response.blob();
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('请求超时');
        }
        console.warn('直接请求失败:', error);
    }
    
    // 如果直接请求失败，尝试使用多个CORS代理（增加备用选项）
    const proxyUrls = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];
    
    for (const proxyUrl of proxyUrls) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(proxyUrl, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                return await response.blob();
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            console.warn('代理请求失败:', proxyUrl, error);
            continue;
        }
    }
    
    throw new Error('所有请求方式都失败了');
}

// Hugging Face API生成
async function generateWithHuggingFace(prompt, apiKey) {
    // 这里需要实际的API调用
    // 示例：使用Hugging Face Inference API
    const response = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            inputs: prompt,
            parameters: {
                width: params.canvasWidth,
                height: params.canvasHeight
            }
        })
    });
    
    if (!response.ok) {
        throw new Error('Hugging Face API调用失败');
    }
    
    const blob = await response.blob();
    return await loadImageFromBlob(blob);
}

// Replicate API生成
async function generateWithReplicate(prompt, apiKey) {
    // 这里需要实际的API调用
    // 示例：使用Replicate API
    const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            version: "stability-ai/stable-diffusion",
            input: {
                prompt: prompt,
                width: params.canvasWidth,
                height: params.canvasHeight
            }
        })
    });
    
    if (!response.ok) {
        throw new Error('Replicate API调用失败');
    }
    
    const data = await response.json();
    // 需要轮询获取结果
    // 这里简化处理
    throw new Error('Replicate API集成需要完整的轮询逻辑');
}

// 保存API Key到本地存储
function saveApiKey(apiType, apiKey) {
    try {
        localStorage.setItem(`enamel_ai_apikey_${apiType}`, apiKey);
    } catch (e) {
        console.warn('无法保存API Key到本地存储:', e);
    }
}

// 从本地存储加载API Key
function getSavedApiKey(apiType) {
    try {
        return localStorage.getItem(`enamel_ai_apikey_${apiType}`) || '';
    } catch (e) {
        console.warn('无法从本地存储读取API Key:', e);
        return '';
    }
}

// 加载所有保存的API Key
function loadSavedApiKeys() {
    // 在打开对话框时自动填充
    const apiTypeSelect = document.getElementById('aiApiType');
    apiTypeSelect.addEventListener('focus', () => {
        const currentType = apiTypeSelect.value;
        if (currentType !== 'demo') {
            const savedKey = getSavedApiKey(currentType);
            if (savedKey) {
                document.getElementById('apiKeyInput').value = savedKey;
            }
        }
    });
}

// 从Blob加载图像
async function loadImageFromBlob(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = params.canvasWidth;
            tempCanvas.height = params.canvasHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            const scale = Math.min(
                tempCanvas.width / img.width,
                tempCanvas.height / img.height
            );
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const offsetX = (tempCanvas.width - scaledWidth) / 2;
            const offsetY = (tempCanvas.height - scaledHeight) / 2;
            
            tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
            
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            resolve({ canvas: tempCanvas, imageData });
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
}

// 初始化
function init() {
    initCanvas();
    initControls();
    initColorPicker();
    initAIGenerate();
    initModeSwitcher();
    initColorCardModal();
    initReferenceColorImport();
    initHelpIcons();
    initDragPattern();

    // --- 绑定生成/切换按钮 ---
    document.getElementById('generateBtn').addEventListener('click', generatePattern);
    
    // 【核心修复】绑定工作坊切换按钮
    const wsNextBtn = document.getElementById('workshopNextBtn');
    if (wsNextBtn) {
        wsNextBtn.onclick = generateWorkshopPattern;
    }

    document.getElementById('uploadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', handleImageUpload);
    
    // --- 换色管理按钮 ---
    document.getElementById('addColorBtn').addEventListener('click', openColorPicker);
    document.getElementById('removeColorBtn').addEventListener('click', () => {
        const selected = document.querySelector('.color-item.selected');
        if (selected && selectedColors.length > 1) {
            const index = parseInt(selected.dataset.index);
            selectedColors.splice(index, 1);
            initColorPalette();
            triggerRender(); // 换色/删色后刷新
        }
    });
    
    // 2. 绑定非遗灵感弹窗控制
    const ichModal = document.getElementById('ichModal');
    const ichBtn = document.getElementById('ichInspirationBtn');
    
    if (ichBtn && ichModal) {
        ichBtn.onclick = () => { ichModal.style.display = 'block'; };
    }

    // 关闭灵感弹窗逻辑
    const closeIchBtn = document.getElementById('closeIchModal');
    if (closeIchBtn) {
        closeIchBtn.onclick = () => { ichModal.style.display = 'none'; };
    }

    // 绑定卡片点击：从文物中提取纹样并直接贴图
    document.querySelectorAll('.ich-card').forEach(card => {
        card.addEventListener('click', function() {
            const motifUrl = this.dataset.motif; // 获取你在 HTML data-motif 里写的路径
            if (ichModal) ichModal.style.display = 'none';
            loadMotifDirectly(motifUrl); // 调用我们刚才写的那个 loadMotifDirectly 函数
        });
    });

    // 3. 颜色管理按钮
    document.getElementById('addColorBtn').addEventListener('click', openColorPicker);
    document.getElementById('removeColorBtn').addEventListener('click', () => {
        const selected = document.querySelector('.color-item.selected');
        if (selected && selectedColors.length > 1) {
            const index = parseInt(selected.dataset.index);
            selectedColors.splice(index, 1);
            initColorPalette();
        }
    });

    document.querySelectorAll('.bg-choice-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 样式高亮切换
            document.querySelectorAll('.bg-choice-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 更新颜色并重绘
            params.canvasBackgroundColor = this.dataset.color;
            triggerRender(); 
        });
    });

    exitAIMode(); // 初始状态
}

// 页面加载完成后初始化
window.addEventListener('load', init);

document.getElementById("generatePreviewBtn")
.addEventListener("click", async () => {
  try {
    // 1. 获取当前画布设计
    const designBase64 = canvas.toDataURL("image/jpeg", 0.9);

    // 2. 存储到 sessionStorage
    sessionStorage.setItem("designImage", designBase64);
    
    // 【核心修复代码】判断当前到底是什么模式
    // 不能直接取 params.pendantShape，因为自由模式下它可能还残留着 "circle" 的值
    let shapeToSave;
    if (params.designType === 'free') {
        shapeToSave = 'free'; // 强制设为 free
    } else {
        shapeToSave = params.pendantShape; 
    }
    
    sessionStorage.setItem("pendantShape", shapeToSave);

    // 3. 跳转到预览页面
    window.location.href = "preview.html";

  } catch (err) {
    console.error(err);
    alert("生成失败");
  }
});

// 【核心函数】直接加载纹样并贴图（不点彩化）
function loadMotifDirectly(imageUrl) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    const img = new Image();
    img.crossOrigin = "anonymous"; 
    img.src = imageUrl;

    img.onload = () => {
        isDirectImageMode = true; 
        
        // 1. 强制重置参数，解决缩放不一致问题
        params.patternScale = 1.0;
        params.patternOffsetX = 0;
        params.patternOffsetY = 0;

        // 2. 同步 UI
        const scaleSlider = document.getElementById('patternScale');
        const scaleValue = document.getElementById('patternScaleValue');
        if (scaleSlider) scaleSlider.value = 100;
        if (scaleValue) scaleValue.textContent = '100%';

        // 3. 【核心修复】不仅存图片，还要存 ImageData
        sourceImage = img;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        // 关键点：必须赋值 originalImageData，否则 resizeCanvas 进不去绘图分支
        originalImageData = tempCtx.getImageData(0, 0, img.width, img.height);

        // 4. 调用重绘
        resizeCanvas();

        if (loadingIndicator) loadingIndicator.style.display = 'none';
    };

    img.onerror = () => {
        alert("纹样图片加载失败");
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    };
}

function renderWorkshopMode() {
    if (!sourceImage || !originalImageData) return;

    // 1. 铺设底色
    const bgColor = getCanvasBackgroundColor();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const palette = getPaletteFromColorLibrary(params.colorCount);
    // 换色逻辑：始终使用排序后的调色板索引以保证稳定
    const sortedPalette = [...palette].sort((a, b) => (a.r + a.g + a.b) - (b.r + b.g + b.b));
    randomSeed = 12345;
    dotColorMap.clear();

    // 2. 绘制散点背景
    const spacing = Math.max(8, 45 - (params.dotDensity / 100) * 40);
    for (let y = 0; y < canvas.height; y += spacing) {
        for (let x = 0; x < canvas.width; x += spacing) {
            if (!isPointInShape(x, y, canvas.width, canvas.height)) continue;
            const rx = x + (seededRandom() - 0.5) * spacing;
            const ry = y + (seededRandom() - 0.5) * spacing;
            const color = sortedPalette[Math.floor(seededRandom() * sortedPalette.length)];
            drawIrregularDot(ctx, rx, ry, params.dotSize * 0.7, color, seededRandom);
        }
    }

    // 3. 绘制平滑图案
    const data = originalImageData.data;
    const imgW = originalImageData.width;
    const imgH = originalImageData.height;
    
    // 【核心计算】基础缩放：将 1024px 缩放到适应画布的 80% 大小
    const baseScale = Math.min(canvas.width / imgW, canvas.height / imgH) * 0.8;
    const finalScale = (canvas.height / originalImageData.height) * 0.8 * params.patternScale;

    const screenData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = screenData.data;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            if (!isPointInShape(x, y, canvas.width, canvas.height)) continue;

            // 计算从当前画布坐标反推到 1024px 原图的采样坐标
            const sampleX = Math.floor((x - canvas.width/2) / finalScale + imgW/2 - params.patternOffsetX / finalScale);
            const sampleY = Math.floor((y - canvas.height/2) / finalScale + imgH/2 - params.patternOffsetY / finalScale);

            if (sampleX >= 0 && sampleX < imgW && sampleY >= 0 && sampleY < imgH) {
                const si = (sampleY * imgW + sampleX) * 4;
                if (data[si + 3] > 50) { 
                    const i = (y * canvas.width + x) * 4;
                    const gray = (data[si] + data[si+1] + data[si+2]) / 3;
                    
                    // 映射颜色索引
                    let colorIdx = Math.min(Math.floor((gray / 256) * sortedPalette.length), sortedPalette.length - 1);
                    
                    // 检查是否有手动换色
                    let drawColor;
                    if (colorReplacements.has(colorIdx)) {
                        drawColor = colorReplacements.get(colorIdx);
                    } else {
                        drawColor = sortedPalette[colorIdx];
                    }

                    d[i] = drawColor.r; d[i+1] = drawColor.g; d[i+2] = drawColor.b; d[i+3] = 255;
                    
                    // 存入 Map 以供点击换色判定 (存索引 colorIdx 是最稳的)
                    dotColorMap.set(`${x},${y}`, { x, y, index: colorIdx });
                }
            }
        }
    }
    ctx.putImageData(screenData, 0, 0);
    drawDefaultBorder(ctx, canvas.width, canvas.height);
}

async function generateWorkshopPattern() {
    workshopPatternIndex = (workshopPatternIndex % 4) + 1;
    const imgPath = `images/workshop/pattern_${workshopPatternIndex}.png`;
    
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imgPath;
    img.onload = () => {
        sourceImage = img;
        isDirectImageMode = false;

        // 【关键】创建一个和原图一样大的临时画布，获取最原始的像素数据
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0);
        
        // 存储原始未缩放的数据
        originalImageData = tempCtx.getImageData(0, 0, img.width, img.height);
        
        // 重置位移
        params.patternOffsetX = 0;
        params.patternOffsetY = 0;
        
        triggerRender(); 
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    };
    img.onerror = () => {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        alert("未找到图片: " + imgPath);
    };
}
