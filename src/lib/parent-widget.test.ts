import { describe, expect, it } from 'vitest';
import { parentWidgetUrl, trustedWidgetSignal } from './parent-widget';
const source = {} as Window;
const target = { origin: 'https://hanzi.xuebabangbang.cn', source };
function message(data: unknown, origin = target.origin, sender: MessageEventSource = source) {
  return { data, origin, source: sender } as MessageEvent;
}
describe('embedded record widget message boundary', () => {
  it('accepts ready or bounded geometry only from the configured iframe', () => {
    expect(trustedWidgetSignal(message({type:'xbb:parent-widget:ready'}),target)).toEqual({type:'xbb:parent-widget:ready'});
    expect(trustedWidgetSignal(message({type:'xbb:parent-widget:height',height:240}),target)).toEqual({type:'xbb:parent-widget:height',height:240});
  });
  it('rejects spoofed origins, other windows, data operations, IDs, URLs and malformed heights', () => {
    expect(trustedWidgetSignal(message({type:'xbb:parent-widget:ready'},'https://evil.example'),target)).toBeNull();
    expect(trustedWidgetSignal(message({type:'xbb:parent-widget:ready'},target.origin,{} as Window),target)).toBeNull();
    for(const payload of [
      {type:'xbb:parent-widget:ready',payload:{secret:true}},
      {type:'xbb:parent-widget:ready',profileId:'other'},
      {type:'xbb:parent-widget:ready',url:'https://evil.example'},
      {type:'xbb:parent-widget:height',height:100000},
      {type:'xbb:parent-widget:height',height:240.5},
      {type:'xbb:parent-widget:height',height:'240'},
      {type:'xbb:parent-widget:import'},
    ]) expect(trustedWidgetSignal(message(payload),target)).toBeNull();
  });
});

describe('configured app-base widget URL', () => {
  it('preserves configured prefixes with or without a trailing slash', () => {
    for (const base of ['https://134.175.136.31/hanzi', 'https://134.175.136.31/hanzi/']) {
      expect(parentWidgetUrl(base).href).toBe('https://134.175.136.31/hanzi/parent.html?embedded=1');
      expect(parentWidgetUrl(base).origin).toBe('https://134.175.136.31');
    }
    expect(parentWidgetUrl('https://134.175.136.31/guwen/').href).toBe('https://134.175.136.31/guwen/parent.html?embedded=1');
    expect(parentWidgetUrl('https://hanzi.xuebabangbang.cn').href).toBe('https://hanzi.xuebabangbang.cn/parent.html?embedded=1');
    expect(parentWidgetUrl('http://localhost:8321').href).toBe('http://localhost:8321/parent.html?embedded=1');
    expect(parentWidgetUrl('https://134.175.136.31/hanzi/?ignored=1#old').href).toBe('https://134.175.136.31/hanzi/parent.html?embedded=1');
  });
  it('rejects executable schemes and credentials rather than expanding the trusted origin boundary', () => {
    expect(() => parentWidgetUrl('javascript:alert(1)')).toThrow();
    expect(() => parentWidgetUrl('https://user:password@example.com/hanzi/')).toThrow();
  });
});
