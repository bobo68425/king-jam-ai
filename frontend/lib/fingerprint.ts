/**
 * 裝置指紋收集服務
 * 
 * 用於識別同一裝置的多帳號登入，防止推薦詐騙
 * 
 * 收集的資訊：
 * - 螢幕解析度
 * - 時區
 * - 語言
 * - Canvas 指紋
 * - WebGL 指紋
 * - 已安裝字體
 * - 觸控支援
 * - 硬體並行度
 * - 記憶體大小
 * - 瀏覽器外掛
 */

interface FingerprintComponents {
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  timezone: string;
  timezoneOffset: number;
  language: string;
  languages: string[];
  platform: string;
  hardwareConcurrency: number;
  deviceMemory: number | undefined;
  touchSupport: {
    maxTouchPoints: number;
    touchEvent: boolean;
    touchStart: boolean;
  };
  canvas: string;
  webgl: {
    vendor: string;
    renderer: string;
  };
  audio: string;
  fonts: string[];
}

interface FingerprintResult {
  hash: string;
  components: FingerprintComponents;
}

/**
 * 生成 Canvas 指紋
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    // 繪製文字和圖形
    canvas.width = 200;
    canvas.height = 50;
    
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 100, 20);
    
    ctx.fillStyle = '#069';
    ctx.fillText('KingJam AI 🔐', 2, 15);
    
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Fingerprint', 4, 25);
    
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

/**
 * 獲取 WebGL 資訊
 */
function getWebGLInfo(): { vendor: string; renderer: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return { vendor: '', renderer: '' };
    
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return { vendor: '', renderer: '' };
    
    return {
      vendor: (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '',
      renderer: (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '',
    };
  } catch {
    return { vendor: '', renderer: '' };
  }
}

/**
 * 獲取 Audio 指紋
 */
async function getAudioFingerprint(): Promise<string> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gainNode = audioContext.createGain();
    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    
    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(0);
    
    return new Promise((resolve) => {
      scriptProcessor.onaudioprocess = (event) => {
        const output = event.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < output.length; i++) {
          sum += Math.abs(output[i]);
        }
        
        oscillator.disconnect();
        scriptProcessor.disconnect();
        analyser.disconnect();
        gainNode.disconnect();
        audioContext.close();
        
        resolve(sum.toString());
      };
    });
  } catch {
    return '';
  }
}

/**
 * 檢測可用字體
 */
function getAvailableFonts(): string[] {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia',
    'Comic Sans MS', 'Impact', 'Trebuchet MS', 'Courier New',
    'Palatino', 'Garamond', 'Bookman', 'Avant Garde',
    'Arial Black', 'Arial Narrow', 'Century Gothic',
    // 中文字體
    'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC', 'Source Han Sans TC',
  ];
  
  const testString = 'mmmmmmmmmmlli';
  const testSize = '72px';
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  
  const getTextWidth = (fontFamily: string): number => {
    ctx.font = `${testSize} ${fontFamily}`;
    return ctx.measureText(testString).width;
  };
  
  const baseWidths: Record<string, number> = {};
  baseFonts.forEach((font) => {
    baseWidths[font] = getTextWidth(font);
  });
  
  const detectedFonts: string[] = [];
  
  testFonts.forEach((font) => {
    const detected = baseFonts.some((baseFont) => {
      const testFont = `'${font}', ${baseFont}`;
      return getTextWidth(testFont) !== baseWidths[baseFont];
    });
    
    if (detected) {
      detectedFonts.push(font);
    }
  });
  
  return detectedFonts;
}

/**
 * 簡單的字串雜湊函數
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // 轉換為 hex 並確保長度
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return hex;
}

/**
 * SHA-256 雜湊（使用 Web Crypto API）
 */
async function sha256(message: string): Promise<string> {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // 降級到簡單雜湊
    return simpleHash(message);
  }
}

/**
 * 收集完整裝置指紋
 */
export async function collectFingerprint(): Promise<FingerprintResult> {
  const components: FingerprintComponents = {
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1,
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    language: navigator.language,
    languages: [...(navigator.languages || [navigator.language])],
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory,
    touchSupport: {
      maxTouchPoints: navigator.maxTouchPoints || 0,
      touchEvent: 'ontouchstart' in window,
      touchStart: 'TouchEvent' in window,
    },
    canvas: getCanvasFingerprint(),
    webgl: getWebGLInfo(),
    audio: await getAudioFingerprint(),
    fonts: getAvailableFonts(),
  };
  
  // 生成指紋雜湊
  const fingerprintString = JSON.stringify(components);
  const hash = await sha256(fingerprintString);
  
  return {
    hash,
    components,
  };
}

/**
 * 儲存指紋到本地（用於比對）
 */
export function storeFingerprint(fingerprint: FingerprintResult): void {
  try {
    localStorage.setItem('device_fp', fingerprint.hash);
    localStorage.setItem('device_fp_time', new Date().toISOString());
  } catch {
    // 儲存失敗不影響功能
  }
}

/**
 * 獲取已儲存的指紋
 */
export function getStoredFingerprint(): string | null {
  try {
    return localStorage.getItem('device_fp');
  } catch {
    return null;
  }
}

/**
 * 快速獲取指紋雜湊（用於登入）
 */
export async function getQuickFingerprint(): Promise<{
  hash: string;
  data: FingerprintComponents;
}> {
  const result = await collectFingerprint();
  return {
    hash: result.hash,
    data: result.components,
  };
}
