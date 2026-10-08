"use client";
import { useEffect, useRef, useState } from 'react';
import { getCloud } from '@/lib/account-sync';
import { parentIsUnlocked } from '@/lib/parent-auth';
import { trustedWidgetSignal } from '@/lib/parent-widget';
const tools = [
  { key: 'hanzi', name: '汉字乐园', base: process.env.NEXT_PUBLIC_HANZI_URL || 'https://hanzi.xuebabangbang.cn' },
  { key: 'guwen', name: '古文乐园', base: process.env.NEXT_PUBLIC_GUWEN_URL || 'https://guwen.xuebabangbang.cn' },
];
function RecordWidget({ name, base }: { name: string; base: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(220);
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const frameUrl = new URL('/parent.html?embedded=1', base);
  const origin = frameUrl.origin;
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      const signal = trustedWidgetSignal(event, { origin, source: frame.current?.contentWindow || null });
      if (!signal) return;
      if (signal.type === 'xbb:parent-widget:height') { setHeight(Math.max(180, signal.height)); return; }
      window.clearTimeout(timeout);
      setReady(true); setFailed(false);
      if (signal.type === 'xbb:parent-widget:ready' && parentIsUnlocked() && !getCloud()?.sessionUser) frame.current?.contentWindow?.postMessage({ type: 'xbb:parent-widget:activate' }, origin);
    };
    const exit = () => frame.current?.contentWindow?.postMessage({ type: 'xbb:parent-widget:deactivate' }, origin);
    window.addEventListener('message', receive);
    window.addEventListener('xbb:parent-exit', exit);
    const timeout = window.setTimeout(() => setFailed(true), 15000);
    return () => { window.removeEventListener('message', receive); window.removeEventListener('xbb:parent-exit', exit); window.clearTimeout(timeout); };
  }, [origin, version]);
  return <section className="parent-record-widget" aria-label={`${name}记录面板`}>
    <h2>{name}</h2>
    {!ready && <p className="widget-loading">{failed ? '记录面板暂时没有打开。' : '正在打开记录面板…'}</p>}
    {failed && !ready && <button className="secondary" onClick={() => { setFailed(false); setReady(false); setVersion(value => value + 1); }}>重试打开{name}</button>}
    <iframe key={version} ref={frame} title={`${name}记录管理`} src={frameUrl.href} height={height}
      sandbox="allow-scripts allow-same-origin allow-downloads allow-modals" referrerPolicy="no-referrer"
      onLoad={() => { if (parentIsUnlocked() && !getCloud()?.sessionUser) frame.current?.contentWindow?.postMessage({ type: 'xbb:parent-widget:activate' }, origin); }}
      onError={() => setFailed(true)} />
  </section>;
}
export default function ParentRecordWidgets() {
  return <div className="parent-record-widgets">{tools.map(tool => <RecordWidget key={tool.key} name={tool.name} base={tool.base} />)}</div>;
}
