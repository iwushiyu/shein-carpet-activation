
(function() {
    'use strict';

    // 激活状态管理
    let isActivated = false;
    let activationCheckInProgress = false;

    // 检查激活状态
    async function checkActivationStatus() {
        if (activationCheckInProgress) {
            return false;
        }
        
        activationCheckInProgress = true;
        
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'checkActivation' }, resolve);
            });
            
            isActivated = response.success && response.isActivated;
            return isActivated;
        } catch (error) {
            console.error('检查激活状态失败:', error);
            isActivated = false;
            return false;
        } finally {
            activationCheckInProgress = false;
        }
    }

    // 显示激活提示
    function showActivationDialog() {
        // 移除现有的激活提示
        const existingDialog = document.getElementById('activation-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        // 创建激活提示对话框
        const dialog = document.createElement('div');
        dialog.id = 'activation-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        `;

        const dialogContent = document.createElement('div');
        dialogContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        `;

        dialogContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">🔒</div>
                <h2 style="margin: 0 0 10px; color: #2d3748; font-size: 20px;">插件需要激活</h2>
                <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.5;">SHEIN地毯SKC计算工具需要激活码才能使用，请点击下方按钮进行激活。</p>
            </div>
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="activate-plugin-btn" style="
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 12px 24px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: transform 0.2s;
                ">立即激活</button>
                <button id="close-dialog-btn" style="
                    background: #f7fafc;
                    color: #4a5568;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 12px 24px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                ">稍后激活</button>
            </div>
        `;

        dialog.appendChild(dialogContent);
        document.body.appendChild(dialog);

        // 事件监听
        document.getElementById('activate-plugin-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'openActivationPage' });
            dialog.remove();
        });

        document.getElementById('close-dialog-btn').addEventListener('click', () => {
            dialog.remove();
        });

        // 点击背景关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    // 监听来自background script的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'checkActivationStatus') {
            checkActivationStatus().then(sendResponse);
            return true;
        }
        
        if (request.action === 'activationStatusChanged') {
            isActivated = request.activation && request.activation.status === 'active';
            if (isActivated) {
                // 激活成功，移除激活提示
                const dialog = document.getElementById('activation-dialog');
                if (dialog) {
                    dialog.remove();
                }
                // 重新创建控制面板
                const existingPanel = document.getElementById('skc-calculator-panel');
                if (existingPanel) {
                    existingPanel.remove();
                }
                setTimeout(createControlPanel, 1000);
            }
        }
    });

    // 材质单价映射表（元/平方米）
    const materialPrices = {
        '仿羊绒': 45,
        '细纱仿羊绒':45,
        '硅藻泥':45,
        '水晶绒': 36,
        'zs天鹅绒长方形': 40,
        'zs天鹅绒圆形': 40,


            // 添加其他材质及其单价
    };

    // 添加材质对应的地毯高度映射表
    const materialCarpetHeights = {
        '水晶绒': 0.5,
        '仿羊绒': 1,
        'zs天鹅绒长方形': 0.6,
        'zs天鹅绒圆形': 0.6,
        '细纱仿羊绒': 0.6,
        '硅藻泥': 0.35
        // 可以根据需要添加更多材质的高度
    };


    // 材质默认克重映射表（克/平方米）
    const materialDefaultWeights = {
        '仿羊绒': { top: 650, bottom: 550 },
        '细纱仿羊绒': { top: 650, bottom: 450 },
        '德芙绒': { top: 750, bottom: 300 },
        '硅藻泥': { top: 400, bottom: 1800 },
        '水晶绒': { top: 550, bottom: 500 },
        '水晶绒TPR': { top: 500, bottom: 800 },
        'zs天鹅绒长方形': { top: 550, bottom: 350 },
        'zs天鹅绒圆形': { top: 550, bottom: 350 },
       
        // 可以根据需要添加更多材质的默认克重
    };

    // 修改材质包装尺寸映射表，增加场景维度
    const materialPackageSizes = {
        '仿羊绒': {
            '过审圆形': {
               '直径60': { length: 23, width: 20, height: 7 },
                '直径80': { length: 23, width: 20, height: 13 },
                '直径90': { length: 25.5, width: 24.5, height: 12 },
                '直径100': { length: 26, width: 25.5, height: 13.5 },
                '直径120': { length: 28, width: 26, height: 12 },
                '直径140': { length: 30, width: 27, height: 10 },
                '直径160': { length: 30, width: 29, height: 10 },
                '直径180': { length: 30, width: 30, height: 10 },
                // 其他尺寸...
                //20250615更新
            },
            '长方形': {
                '40*60（小尺寸）': { length: 26, width: 23, height: 5 },
                '50*80': { length: 25, width: 21, height: 8 },
                '60*90': { length: 26, width: 23, height: 12 },
                '80*120': { length: 30, width: 22, height: 16 },
                '100*140': { length: 35, width: 30, height: 14 },
                '120*180': { length: 35, width: 34, height: 22 },
                '140*200': { length: 36, width: 33, height: 26 },
                '160*200': { length: 35, width: 35, height: 34 },
                '160*240': { length: 39, width: 36, height: 29 },
                // 其他尺寸...
            },
            '圆形': {
                    '直径60': { length: 23, width: 20, height: 7 },
                     '直径80': { length: 23, width: 20, height: 13 },
                     '直径90': { length: 25.5, width: 24.5, height: 12 },
                     '直径100': { length: 27, width: 26, height: 13.5 },
                     '直径120': { length: 33, width: 28.5, height: 15 },
                     '直径140': { length: 35, width: 33, height: 22 },
                     '直径160': { length: 36, width: 33, height: 22.5 },
                     // 其他尺寸...
                     //20250615更新
                     '直径180': { length: 36.2, width: 29, height: 27.1},
                    //20250705更新
                 },
            
            '异形': {
                '40*40': { length: 21, width: 21, height: 4 },
                '40*60': { length: 29, width: 20, height: 4 },
                '50*50': { length: 22, width: 22, height: 4 },
                '50*60': { length: 26, width: 22, height: 5 },
                '50*80': { length: 24, width: 23, height: 6 },
                '50*120': { length: 24, width: 23, height: 10 },
                '60*60': { length: 24, width: 18, height: 5 },
                
                '60*90': { length: 27, width: 21, height: 11 },
                '60*100': { length: 30, width: 24, height: 7 },
                '60*120': { length: 32, width: 23, height: 10 },
                '60*140': { length: 29, width: 22, height: 9 },
                '70*70': { length: 23, width: 18, height: 9 },
                '70*80': { length: 27, width: 20, height: 9 },
                '80*80': { length: 28, width: 28, height: 9 },
                '90*100': { length: 28, width: 24, height: 12 },
                '120*120': { length: 33, width: 27, height: 15 },
                
            },
        },

       
        'zs天鹅绒长方形': {
            '过审门垫厨房垫': {
                
                '100*160': { length: 36, width: 27.5, height: 10 },
                '120*180': { length: 40, width: 35, height: 12 },
                '160*200': { length: 50, width: 38.5, height: 11.2},
                '160*230': { length: 50, width: 40.5, height: 12 },
                // 其他尺寸...
                //20250615更新
                '40*60': { length: 22, width: 19, height: 7.5 },
                '40*60（小尺寸）': { length: 22, width: 19, height: 7.5 },
                '50*80': { length: 25, width: 19, height: 8.5 },
                '60*90': { length: 20, width: 19, height: 13.5 },
                '80*120': { length: 27, width: 24, height: 10 },
                '40*120': { length: 31, width: 26, height: 6.5 },
                '45*120': { length: 32, width: 26, height: 6.5 },
                '50*160': { length: 27, width: 25, height: 9 },
                '60*180': { length: 32, width: 32, height: 8 },
            },
            '门垫厨房垫': {
                
                '100*160': { length: 34, width: 24, height: 17 },
                '120*180': { length: 32, width: 26, height: 23 },
                '160*200': { length: 37, width: 34, height: 25.5},
                '160*230': { length: 36, width: 34, height: 28.5 },
                // 其他尺寸...
                //20250615更新
                '40*60': { length: 22, width: 19, height: 7.5 },
                '40*60（小尺寸）': { length: 22, width: 19, height: 7.5 },
                '50*80': { length: 25, width: 19, height: 8.5 },
                '60*90': { length: 20, width: 19, height: 13.5 },
                '80*120': { length: 30, width: 24, height: 13 },
                '40*120': { length: 31, width: 26, height: 7 },
                '45*120': { length: 32, width: 26, height: 7.5 },
                '50*160': { length: 28, width: 22, height: 11 },
                '60*180': { length: 32, width: 32, height: 9.5 },
            },
            
            // '不罚款通道':{
            //     '50*80': { length: 25, width: 19, height: 8.5 },
            //     '50*160': { length: 28, width: 22, height: 11 },
            //     '60*180': { length: 32, width: 32, height: 9.5 },
            //     '80*180': { length: 31, width: 23, height: 15 },
            //     '60*220': { length: 28, width: 25, height: 15.5 },
            //     '80*240': { length: 35, width: 28, height: 17 },
            //     '80*300': { length: 31, width: 28, height: 25 },
            //     '80*360': { length: 35, width: 32, height: 23 },
            // },
           
            '通道':{
                '50*80': { length: 25, width: 19, height: 8.5 },
                '45*120': { length: 32, width: 26, height: 7.5 },
                '50*160': { length: 28, width: 22, height: 11 },
                '60*180': { length: 32, width: 32, height: 9.5 },
                '80*180': { length: 32, width: 30, height: 14.5 },
                '60*220': { length: 33, width: 32, height: 10 },
                '80*240': { length: 41, width: 30, height: 11 },
                '80*300': { length: 42, width: 30, height: 14 },
            },
        },

        'zs天鹅绒圆形': {
            '过审圆形': {
                '直径60': { length: 25, width: 21, height: 6.5 },
                '直径80': { length: 24, width: 19, height: 12 },
                '直径100': { length: 29, width: 22, height: 11 },
                '直径120': { length: 30, width: 27.5, height: 10},
                '直径140': { length: 30, width: 29, height: 10 },
                '直径160': { length: 30, width: 30, height: 10},
                '直径180': { length: 30, width: 30, height: 10},
                // 其他尺寸...
                //20250615更新
            },
            '圆形': {
                '直径60': { length: 25, width: 21, height: 6.5 },
                '直径80': { length: 24, width: 19, height: 12 },
                '直径100': { length: 29, width: 22, height: 11 },
                '直径120': { length: 33.5, width: 28.5, height: 12.5},
                '直径140': { length: 35, width: 31.5, height: 11.5 },
                '直径160': { length: 41, width: 32, height: 14 },
                '直径180': { length: 45, width: 37, height: 14 },
                //20250705更新
            },
        },
        '硅藻泥': {
            '长方形': {
                '40*60': { length: 22, width: 20, height: 5 },
                '50*80': { length: 25, width: 20, height: 6.5 },
                '60*90': { length: 30, width: 23, height: 5 },
                '80*120': { length: 32, width: 25, height: 6 },

                '40*120': { length: 26, width: 24, height: 9 },
                '50*70': { length: 25, width: 19, height: 3 },
                '50*140': { length: 26, width: 26, height: 4 },
                '50*160': { length: 28, width: 28, height: 12 },
                '80*100': { length: 34, width: 27, height: 2 },
                //20250615更新
            }
        },
        '细纱仿羊绒': {
            '过审圆形': {
                '直径60': { length: 23, width: 20, height: 4.5 },
                '直径80': { length: 24, width: 16, height: 7.5 },
                '直径100': { length: 26, width: 23, height: 7.5 },
                '直径120': { length: 29, width: 24, height: 10 },
                '直径140': { length: 30, width: 25, height: 10 },
                '直径160': { length: 30, width: 27, height: 10 },
                '直径180': { length: 30, width: 28, height: 10 },
                //20250615更新
            },
        
            '圆形': {
               '直径60': { length: 23, width: 20, height: 4.5 },
                '直径80': { length: 24, width: 16, height: 7.5 },
                '直径100': { length: 26, width: 23, height: 7.5 },
                '直径120': { length: 33, width: 26, height: 14 },
                '直径140': { length: 34, width: 28, height: 15 },
                '直径160': { length: 34, width: 28, height: 16 },
                '直径180': { length: 34, width: 28, height: 17.5 },
                //20250615更新
            },
            '长方形': {
                '50*80': { length: 23, width: 21, height: 4.5 },
                '60*90': { length: 23, width: 21, height: 6 },
                '80*120': { length: 31, width: 28, height: 9 },
                '100*140': { length: 29, width: 24, height: 10 },
                '120*160': { length: 32, width: 22, height: 15 },
                '140*200': { length: 33, width: 22, height: 20 },

                
                '100*160': { length: 31, width: 30, height: 8 },
                '120*180': { length: 31.5, width: 30, height: 13 },
                '160*200': { length: 41, width: 33, height: 13 },
                '160*230': { length: 42, width: 34, height: 14.5 },
                //20250705更新
            }
        },
        '水晶绒': {
            '通道地毯': {
                '40*60': { length: 22, width: 20, height: 4 },
                '50*80': { length: 25, width: 22, height: 4 },
                '60*180': { length: 30, width: 23, height: 13 },
                '60*240': { length: 32, width: 26, height: 11 },
                '80*240': { length: 30, width: 27, height: 16 },
                '80*300': { length: 31, width: 28, height: 17 },
                '100*300': { length: 35, width: 29, height: 19 },
                '120*300': { length: 35, width: 33, height: 23 },
            },
            '长方形': {
                '40*60': { length: 23, width: 21, height: 3 },
                '50*80': { length: 28, width: 23, height: 5 },
                '60*90': { length: 23, width: 20, height: 9 },
                '80*120': { length: 30, width: 22, height: 9 },
                '100*140': { length: 34, width: 24, height: 10 },
                '100*150': { length: 27, width: 26, height: 16 },
                '120*160': { length: 33, width: 29, height: 11 },
                '140*200': { length: 36, width: 30, height: 16 },
                '160*230': { length: 36, width: 34, height: 26 },
                '180*260': { length: 38, width: 37, height: 28 },
            },
            '异形': {
                '40*50': { length: 26, width: 20, height: 2 },
                '40*60': { length: 22, width: 18, height: 3 },
                '50*80': { length: 25, width: 19, height: 6 },
                '60*60': { length: 21, width: 20, height: 4 },
                '60*70': { length: 25, width: 22, height: 5 },
                '60*90': { length: 21, width: 20, height: 7 },
                '80*80': { length: 23, width: 20, height: 8 },
                '80*120': { length: 30, width: 20, height: 8 },
                '90*90': { length: 24, width: 18, height: 10 },
                '100*100': { length: 22, width: 20, height: 13 },
                '100*140': { length: 29, width: 28, height: 11 },
                '110*110': { length: 26, width: 20, height: 12 },
                '120*120': { length: 28, width: 23, height: 13 },
                '120*160': { length: 33, width: 28, height: 16 },
            },
            '圆形': {
                '直径60': { length: 25, width: 21, height: 6 },
                '直径80': { length: 22, width: 19, height: 9 },
                '直径100': { length: 27, width: 21, height: 17 },
                '直径120': { length: 33, width: 25, height: 12 },
                '直径140': { length: 33, width: 29, height: 17 },
                '直径160': { length: 34, width: 31, height: 24 },
                '直径180': { length: 39, width: 31, height: 20 },
            },
        },
        '水晶绒TPR': {
            '长方形TPR': {
                '40*60': { length: 23, width: 22, height: 4 },
                '50*80': { length: 25, width: 20, height: 6 },
                '60*90': { length: 23, width: 19, height: 9 },
                '80*120': { length: 31, width: 28, height: 6 },
                // 其他尺寸...
            },
            '半圆TPR': {
                '40*60': { length: 22, width: 19, height: 3 },
                '50*80': { length: 25, width: 18, height: 5 },
                '60*90': { length: 22, width: 16, height: 8 },
                '80*120': { length: 35, width: 24, height: 6 },
                // 其他尺寸...
            }
        },
       
        // 其他材质...
    };

    // 材质对应的场景列表
    const materialScenes = {
        '水晶绒': ['长方形','圆形','通道地毯','异形'],
        '新奇特法兰绒': ['长方形'],
        'zs天鹅绒长方形': ['过审门垫厨房垫','门垫厨房垫大地毯','不罚款通道','通道'],
        'zs天鹅绒圆形':['过审圆形','圆形'],
        '仿羊绒': ['过审圆形','圆形','长方形','异形'],
        '硅藻泥': ['长方形'],
        '细纱仿羊绒': ['过审圆形','圆形','长方形'],

        // 其他材质对应的场景...
    };

    // 修改createControlPanel函数，添加场景选择
    function createControlPanel() {
        // 创建控制面板容器
        const panel = document.createElement('div');
        panel.id = 'skc-calculator-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 250px;
            background-color: #f8f8f8;
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 10px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            z-index: 9999;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;

        // 创建拖动句柄
        const handle = document.createElement('div');
        handle.style.cssText = `
            padding: 5px;
            background-color: #e0e0e0;
            border-radius: 3px;
            margin-bottom: 10px;
            text-align: center;
            cursor: move;
            user-select: none;
        `;
        handle.textContent = '地毯SKC计算工具 (拖动移动)';
        panel.appendChild(handle);

        // 材质选择
        const materialLabel = document.createElement('label');
        materialLabel.textContent = '选择材质: ';
        materialLabel.style.display = 'block';
        materialLabel.style.marginBottom = '5px';
        panel.appendChild(materialLabel);

        const materialSelect = document.createElement('select');
        materialSelect.id = 'material-select';
        materialSelect.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 5px;';

        // 添加材质选项
        Object.keys(materialPrices).forEach(material => {
            const option = document.createElement('option');
            option.value = material;
            option.textContent = `${material} (${materialPrices[material]}元/㎡)`;
            materialSelect.appendChild(option);
        });

        panel.appendChild(materialSelect);

        // 新增：场景选择
        const sceneLabel = document.createElement('label');
        sceneLabel.textContent = '使用场景: ';
        sceneLabel.style.display = 'block';
        sceneLabel.style.marginBottom = '5px';
        panel.appendChild(sceneLabel);

        const sceneSelect = document.createElement('select');
        sceneSelect.id = 'scene-select';
        sceneSelect.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 5px;';
        panel.appendChild(sceneSelect);

        // 顶部克重输入
        const topWeightLabel = document.createElement('label');
        topWeightLabel.textContent = '顶部克重(g/㎡): ';
        topWeightLabel.style.display = 'block';
        topWeightLabel.style.marginBottom = '5px';
        panel.appendChild(topWeightLabel);

        const topWeightInput = document.createElement('input');
        topWeightInput.id = 'top-weight-input';
        topWeightInput.type = 'number';
        topWeightInput.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 5px;';
        panel.appendChild(topWeightInput);

        // 底部克重输入
        const bottomWeightLabel = document.createElement('label');
        bottomWeightLabel.textContent = '底部克重(g/㎡): ';
        bottomWeightLabel.style.display = 'block';
        bottomWeightLabel.style.marginBottom = '5px';
        panel.appendChild(bottomWeightLabel);

        const bottomWeightInput = document.createElement('input');
        bottomWeightInput.id = 'bottom-weight-input';
        bottomWeightInput.type = 'number';
        bottomWeightInput.style.cssText = 'width: 100%; margin-bottom: 10px; padding: 5px;';
        panel.appendChild(bottomWeightInput);

        

        // 计算按钮
        const calculateButton = document.createElement('button');
        calculateButton.textContent = '自动计算并填写';
        calculateButton.style.cssText = `
            width: 100%;
            margin: 10px 0 5px;
            padding: 8px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        panel.appendChild(calculateButton);

        // 添加填写地毯尺寸按钮
        const fillDimensionsButton = document.createElement('button');
        fillDimensionsButton.textContent = '填写地毯尺寸';
        fillDimensionsButton.style.cssText = `
            width: 100%;
            margin: 5px 0;
            padding: 8px;
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
        panel.appendChild(fillDimensionsButton);

        // 状态消息
        const statusMessage = document.createElement('div');
        statusMessage.id = 'status-message';
        statusMessage.style.cssText = 'margin-top: 10px; font-size: 12px; color: #666;';
        panel.appendChild(statusMessage);

        // 添加到页面
        document.body.appendChild(panel);

        // 更新场景选择下拉框
        function updateSceneOptions() {
            const selectedMaterial = materialSelect.value;
            sceneSelect.innerHTML = ''; // 清空现有选项

            if (materialScenes[selectedMaterial]) {
                materialScenes[selectedMaterial].forEach(scene => {
                    const option = document.createElement('option');
                    option.value = scene;
                    option.textContent = scene;
                    sceneSelect.appendChild(option);
                });
            } else {
                // 如果没有为该材质定义场景，添加一个默认场景
                const option = document.createElement('option');
                option.value = '默认';
                option.textContent = '默认';
                sceneSelect.appendChild(option);
            }
        }

        // 根据选择的材质设置默认克重
        function updateDefaultWeights() {
            const selectedMaterial = materialSelect.value;
            if (materialDefaultWeights[selectedMaterial]) {
                topWeightInput.value = materialDefaultWeights[selectedMaterial].top;
                bottomWeightInput.value = materialDefaultWeights[selectedMaterial].bottom;
            }

            // 更新场景选项
            updateSceneOptions();
        }

        // 初始设置默认值
        updateDefaultWeights();

        // 监听材质选择变化
        materialSelect.addEventListener('change', updateDefaultWeights);

        // 添加拖动功能
        let isDragging = false;
        let offsetX, offsetY;

        handle.addEventListener('mousedown', function(e) {
            isDragging = true;
            offsetX = e.clientX - panel.getBoundingClientRect().left;
            offsetY = e.clientY - panel.getBoundingClientRect().top;
            handle.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;

            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;

            // 确保面板不会移出视口
            const maxX = window.innerWidth - panel.offsetWidth;
            const maxY = window.innerHeight - panel.offsetHeight;

            panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
            panel.style.right = 'auto'; // 清除right属性，使left生效
        });

        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                handle.style.cursor = 'move';
            }
        });

        // 计算按钮点击事件
        calculateButton.addEventListener('click', async function() {
            // 检查激活状态
            const activated = await checkActivationStatus();
            if (!activated) {
                showActivationDialog();
                return;
            }

            const material = materialSelect.value;
            const scene = sceneSelect.value;
            const topWeight = parseFloat(topWeightInput.value);
            const bottomWeight = parseFloat(bottomWeightInput.value);

            if (isNaN(topWeight) || isNaN(bottomWeight)) {
                statusMessage.textContent = '请输入有效的克重数值！';
                statusMessage.style.color = 'red';
                return;
            }

            // 开始计算
            processAllSKC(material, scene, topWeight, bottomWeight, statusMessage);
        });

         // 填写地毯尺寸按钮点击事件
        fillDimensionsButton.addEventListener('click', async function() {
            // 检查激活状态
            const activated = await checkActivationStatus();
            if (!activated) {
                showActivationDialog();
                return;
            }

            const material = materialSelect.value;
            
            // 开始填写地毯尺寸
            fillCarpetDimensions(material, statusMessage);
        });
    }

    // 修改processAllSKC函数，添加场景参数
    function processAllSKC(material, scene, topWeight, bottomWeight, statusMessage) {
        const materialPrice = materialPrices[material];
        if (!materialPrice) {
            statusMessage.textContent = '未找到材质单价！';
            statusMessage.style.color = 'red';
            return;
        }

        // 获取所有SKC行
        const skcRows = document.querySelectorAll('tr.cilnix');

        if (skcRows.length === 0) {
            statusMessage.textContent = '未找到SKC行！';
            statusMessage.style.color = 'red';
            return;
        }

        statusMessage.textContent = '正在处理...';
        statusMessage.style.color = 'blue';

        let processedCount = 0;
        let missingPackageSizes = []; // 记录未找到包装尺寸的尺寸文本

        // 用于跟踪已处理的SKC，避免重复计数
        const processedSKCs = new Set();

        skcRows.forEach((row, index) => {
            try {
                // 获取尺寸文本
                const sizeCell = row.querySelector('.soui-table-cell-fixed-left.soui-table-cell-fixed-last div > div');
                if (!sizeCell) return;

                const sizeText = sizeCell.textContent.trim();
                if (!sizeText) return;

                // 获取SKC标识，用于避免重复计数
                // 这里使用材质+尺寸作为唯一标识
                const skcIdentifier = sizeText;

                // 如果这个SKC已经处理过，跳过计数增加
                if (processedSKCs.has(skcIdentifier)) {
                    return;
                }

                // 标记这个SKC已经处理过
                processedSKCs.add(skcIdentifier);

                // 解析尺寸
                let area = 0;

                // 检查是否为圆形地毯（直径格式）
                const circleMatch = sizeText.match(/直径(\d+)/);
                if (circleMatch) {
                    // 圆形地毯
                    const diameter = parseInt(circleMatch[1], 10);
                    const width = diameter;
                    const length = diameter;
                    area = diameter * diameter / 10000; // 转换为平方米
                } else {
                    // 修改矩形格式匹配,增加对括号内容的处理
                    const rectMatch = sizeText.match(/(\d+)\s*[*×]\s*(\d+)(?:\s*（[^）]*）)?/);
                    if (rectMatch) {
                        const width = parseInt(rectMatch[1], 10);
                        const length = parseInt(rectMatch[2], 10);
                        area = (width * length) / 10000; // 转换为平方米
                    } else {
                        console.warn(`无法解析尺寸: ${sizeText}`);
                        return;
                    }
                }

                // 计算价格（元）
                const price = (area * materialPrice).toFixed(2);

                // 计算重量（克）- 面积(平方米) * 克重(g/平方米)
                const totalWeight = Math.round(area * (topWeight + bottomWeight));

                // 获取价格输入框
                const priceInput = row.querySelector('.rr-block[class*="supplier_priceClass_"] input');

                // 获取重量输入框
                const weightInput = row.querySelector('[class^="weightClass_"] input');

                // 填写价格和重量
                if (priceInput) {
                    // 模拟真实的用户输入过程
                    priceInput.focus();
                    priceInput.value = price;

                    // 使用React的事件系统（如果SHEIN使用React）
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(priceInput, price);

                    // 触发React的合成事件
                    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
                    priceInput.dispatchEvent(new Event('change', { bubbles: true }));
                    priceInput.blur();
                }

                if (weightInput) {
                    // 模拟真实的用户输入过程
                    weightInput.focus();
                    weightInput.value = totalWeight;

                    // 使用React的事件系统（如果SHEIN使用React）
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(weightInput, totalWeight);

                    // 触发React的合成事件
                    weightInput.dispatchEvent(new Event('input', { bubbles: true }));
                    weightInput.dispatchEvent(new Event('change', { bubbles: true }));
                    weightInput.blur();
                }

               // 新增：填写包装尺寸，考虑场景因素
               let packageSize = null;

               // 检查是否有该材质和场景的包装尺寸数据
               if (materialPackageSizes[material] &&
                   materialPackageSizes[material][scene] &&
                   materialPackageSizes[material][scene][sizeText]) {
                   packageSize = materialPackageSizes[material][scene][sizeText];
               }
               // 如果没有找到特定场景的数据，尝试使用默认场景
               else if (materialPackageSizes[material] &&
                        materialPackageSizes[material]['默认'] &&
                        materialPackageSizes[material]['默认'][sizeText]) {
                   packageSize = materialPackageSizes[material]['默认'][sizeText];
               }

               if (packageSize) {
                   // 获取长度输入框
                   const lengthInput = row.querySelector(`[class^="lengthClass_"] input`);
                   // 获取宽度输入框
                   const widthInput = row.querySelector(`[class^="widthClass_"] input`);
                   // 获取高度输入框
                   const heightInput = row.querySelector(`[class^="heightClass_"] input`);

                   // 填写长度
                   if (lengthInput && packageSize.length) {
                       lengthInput.focus();
                       lengthInput.value = packageSize.length.toFixed(2);
                       const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                       nativeInputValueSetter.call(lengthInput, packageSize.length.toFixed(2));
                       lengthInput.dispatchEvent(new Event('input', { bubbles: true }));
                       lengthInput.dispatchEvent(new Event('change', { bubbles: true }));
                       lengthInput.blur();
                   }

                   // 填写宽度
                   if (widthInput && packageSize.width) {
                       widthInput.focus();
                       widthInput.value = packageSize.width.toFixed(2);
                       const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                       nativeInputValueSetter.call(widthInput, packageSize.width.toFixed(2));
                       widthInput.dispatchEvent(new Event('input', { bubbles: true }));
                       widthInput.dispatchEvent(new Event('change', { bubbles: true }));
                       widthInput.blur();
                   }

                   // 填写高度
                   if (heightInput && packageSize.height) {
                       heightInput.focus();
                       heightInput.value = packageSize.height.toFixed(2);
                       const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                       nativeInputValueSetter.call(heightInput, packageSize.height.toFixed(2));
                       heightInput.dispatchEvent(new Event('input', { bubbles: true }));
                       heightInput.dispatchEvent(new Event('change', { bubbles: true }));
                       heightInput.blur();
                   }
               } else {
                   // 记录未找到包装尺寸的尺寸文本
                   const missingInfo = `${material}-${scene}-${sizeText}`;
                   if (!missingPackageSizes.includes(missingInfo)) {
                       missingPackageSizes.push(missingInfo);
                   }

                   // 高亮显示需要手动填写的包装尺寸输入框
                   const lengthInput = row.querySelector(`[class^="lengthClass_"] input`);
                   const widthInput = row.querySelector(`[class^="widthClass_"] input`);
                   const heightInput = row.querySelector(`[class^="heightClass_"] input`);

                   if (lengthInput) {
                       lengthInput.style.backgroundColor = '#FFFF99'; // 浅黄色背景提示需要手动填写
                   }
                   if (widthInput) {
                       widthInput.style.backgroundColor = '#FFFF99';
                   }
                   if (heightInput) {
                       heightInput.style.backgroundColor = '#FFFF99';
                   }
               }
                

                processedCount++;
            } catch (error) {
                console.error('处理SKC行时出错:', error, error.stack);
            }
        });

        if (processedCount > 0) {
            if (missingPackageSizes.length > 0) {
                statusMessage.textContent = `成功处理 ${processedCount} 个SKC！但以下材质-场景-尺寸未找到包装尺寸数据，请手动填写：${missingPackageSizes.join(', ')}`;
                statusMessage.style.color = 'orange'; // 使用橙色表示警告
                console.warn(`未找到包装尺寸数据的材质-场景-尺寸：${missingPackageSizes.join(', ')}`);
            } else {
                statusMessage.textContent = `成功处理 ${processedCount} 个SKC！`;
                statusMessage.style.color = 'green';
            }
        } else {
            statusMessage.textContent = '未能处理任何SKC，请检查页面结构！';
            statusMessage.style.color = 'red';
        }
    }

     // 新增函数：填写地毯尺寸
     function fillCarpetDimensions(material, statusMessage) {
        // 获取材质对应的地毯高度
        const carpetHeight = materialCarpetHeights[material] || 0.5; // 默认高度为0.5
        
        statusMessage.textContent = '正在填写地毯尺寸...';
        statusMessage.style.color = 'blue';
        
        // 更精确地选择地毯尺寸表格
        // 首先找到包含"尺寸"、"宽度"、"长度"、"高度"和"直径"列标题的表格
        const dimensionTable = Array.from(document.querySelectorAll('.soui-table')).find(table => {
            const headers = table.querySelectorAll('th');
            const headerTexts = Array.from(headers).map(header => header.textContent.trim());
            return headerTexts.includes('尺寸') && 
                   headerTexts.includes('宽度 (cm)') && 
                   headerTexts.includes('长度 (cm)') && 
                   headerTexts.includes('高度 (cm)');
        });
        
        if (!dimensionTable) {
            statusMessage.textContent = '未找到地毯尺寸表格！';
            statusMessage.style.color = 'red';
            return;
        }
        
        // 获取表格中的所有行
        const dimensionRows = dimensionTable.querySelectorAll('tbody tr');
        
        if (dimensionRows.length === 0) {
            statusMessage.textContent = '未找到地毯尺寸行！';
            statusMessage.style.color = 'red';
            return;
        }
        
        let processedCount = 0;
        
        dimensionRows.forEach(row => {
            try {
                // 获取尺寸文本
                const sizeCell = row.querySelector('.soui-table-cell-fixed-left.soui-table-cell-fixed-last');
                if (!sizeCell) return;
                
                const sizeText = sizeCell.textContent.trim();
                if (!sizeText) return;
                
                // 解析尺寸
                let width = 0;
                let length = 0;
                
                // 检查是否为圆形地毯（直径格式）
                const circleMatch = sizeText.match(/直径(\d+)/);
                if (circleMatch) {
                    // 圆形地毯
                    const diameter = parseInt(circleMatch[1], 10);
                    width = diameter;
                    length = diameter;
                } else {
                    // 修改矩形格式匹配,增加对括号内容的处理
                    const rectMatch = sizeText.match(/(\d+)\s*[*×]\s*(\d+)(?:\s*（[^）]*）)?/);
                    if (rectMatch) {
                        width = parseInt(rectMatch[1], 10);
                        length = parseInt(rectMatch[2], 10);
                    } else {
                        console.warn(`无法解析尺寸: ${sizeText}`);
                        return;
                    }
                }
                
                // 获取当前行中的所有输入框
                const inputs = row.querySelectorAll('input');
                
                // 确保有足够的输入框
                if (inputs.length < 3) {
                    console.warn(`行 "${sizeText}" 中没有足够的输入框`);
                    return;
                }
                
                // 根据列的顺序填写宽度、长度和高度
                // 宽度通常是第一个输入框
                const widthInput = inputs[0];
                // 长度通常是第二个输入框
                const lengthInput = inputs[1];
                // 高度通常是第三个输入框
                const heightInput = inputs[2];
                
                // 填写宽度
                if (widthInput) {
                    widthInput.focus();
                    widthInput.value = width;
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(widthInput, width);
                    widthInput.dispatchEvent(new Event('input', { bubbles: true }));
                    widthInput.dispatchEvent(new Event('change', { bubbles: true }));
                    widthInput.blur();
                }
                
                // 填写长度
                if (lengthInput) {
                    lengthInput.focus();
                    lengthInput.value = length;
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(lengthInput, length);
                    lengthInput.dispatchEvent(new Event('input', { bubbles: true }));
                    lengthInput.dispatchEvent(new Event('change', { bubbles: true }));
                    lengthInput.blur();
                }
                
                // 填写高度
                if (heightInput) {
                    heightInput.focus();
                    heightInput.value = carpetHeight;
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(heightInput, carpetHeight);
                    heightInput.dispatchEvent(new Event('input', { bubbles: true }));
                    heightInput.dispatchEvent(new Event('change', { bubbles: true }));
                    heightInput.blur();
                }
                
                processedCount++;
            } catch (error) {
                console.error('处理地毯尺寸行时出错:', error, error.stack);
            }
        });
        
        if (processedCount > 0) {
            statusMessage.textContent = `成功填写 ${processedCount} 个地毯尺寸！`;
            statusMessage.style.color = 'green';
        } else {
            statusMessage.textContent = '未能填写任何地毯尺寸，请检查页面结构！';
            statusMessage.style.color = 'red';
        }
    }



    // 等待页面加载完成
    window.addEventListener('load', async function() {
        // 检查当前URL是否是商品编辑页面
        if (isProductEditPage()) {
            // 先检查激活状态
            const activated = await checkActivationStatus();
            if (activated) {
                setTimeout(createControlPanel, 2000); // 延迟2秒创建控制面板，确保页面元素已加载
            } else {
                // 显示激活提示
                setTimeout(showActivationDialog, 2000);
            }
        }
    });

   // 添加函数：检查当前URL是否是商品编辑页面
   function isProductEditPage() {
       const currentUrl = window.location.href;
       // 检查URL是否包含商品编辑页面的特征
       return currentUrl.includes('/#/spmp/commoditiesInfo') ;
   }

})();