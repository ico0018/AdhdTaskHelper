export function parentWidgetUrl(base: string): URL {
  const appBase = new URL(base);
  if (!['https:', 'http:'].includes(appBase.protocol) || appBase.username || appBase.password) {
    throw new Error('记录面板地址格式不正确');
  }
  appBase.pathname = `${appBase.pathname.replace(/\/$/, '')}/`;
  appBase.search = ''; appBase.hash = '';
  return new URL('parent.html?embedded=1', appBase);
}
export interface WidgetTarget { origin: string; source: Window | null }
export type WidgetSignal = { type: 'xbb:parent-widget:ready' } | { type: 'xbb:parent-widget:height'; height: number };
export function trustedWidgetSignal(event: MessageEvent, target: WidgetTarget): WidgetSignal | null {
  if (!target.source || event.source !== target.source || event.origin !== target.origin) return null;
  const data = event.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.type === 'xbb:parent-widget:ready' && Object.keys(data).length === 1) return data;
  if (data.type === 'xbb:parent-widget:height' && Object.keys(data).length === 2 && Number.isInteger(data.height) && data.height >= 120 && data.height <= 760) return data;
  return null;
}
