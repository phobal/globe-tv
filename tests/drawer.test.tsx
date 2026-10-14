import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Drawer } from '../src/drawer/Drawer';

afterEach(() => cleanup());

describe('Drawer', () => {
  it('marks the panel hidden when closed', () => {
    render(
      <Drawer open={false} onClose={() => {}} title="选择国家">
        <span>Body Content</span>
      </Drawer>
    );
    const panel = screen.getByRole('dialog', { hidden: true });
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });

  it('opens with the given title and close button', () => {
    render(
      <Drawer open={true} onClose={() => {}} title="选择国家">
        <span>Body</span>
      </Drawer>
    );
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('选择国家');
    expect(screen.getByRole('button', { name: '关闭面板' })).toBeTruthy();
  });

  it('calls onClose when ESC is pressed', () => {
    const onClose = vi.fn();
    render(
      <Drawer open={true} onClose={onClose} title="X">
        <span>Body</span>
      </Drawer>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when scrim is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Drawer open={true} onClose={onClose} title="X">
        <span>Body</span>
      </Drawer>
    );
    const scrim = container.querySelector('div[aria-hidden="true"]')!;
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
