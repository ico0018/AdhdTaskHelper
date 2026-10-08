import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Parent from './parent';
import ParentRecordWidgets from './parent-record-widgets';
import { createDatabase } from '@/lib/flow';
describe('central parent record widgets', () => {
  it('keeps the task heading and add-task action before two own-origin control frames', () => {
    const markup = renderToStaticMarkup(createElement(Parent, {
      db: createDatabase('2026-10-08', Date.now()), today: '2026-10-08',
      onAdd() {}, onEdit() {}, onDelete() {}, commit: () => true,
      recordControls: createElement(ParentRecordWidgets),
    }));
    expect(markup.indexOf('家长端')).toBeLessThan(markup.indexOf('汉字乐园记录管理'));
    expect(markup.indexOf('添加今天的任务')).toBeLessThan(markup.indexOf('汉字乐园记录管理'));
    expect(markup).toContain('https://hanzi.xuebabangbang.cn/parent.html?embedded=1');
    expect(markup).toContain('https://guwen.xuebabangbang.cn/parent.html?embedded=1');
    expect(markup.match(/<iframe /g)).toHaveLength(2);
    expect(markup).toContain('allow-downloads');
  });
});
