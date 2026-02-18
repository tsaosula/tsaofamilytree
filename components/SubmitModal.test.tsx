
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SubmitModal from './SubmitModal';
import { FamilyMember, Gender } from '../types';
import '@testing-library/jest-dom';

// Mock data
const mockMembers: FamilyMember[] = [
  { id: '1', name: 'Test Member', gender: Gender.Male }
];

describe('SubmitModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders correctly when open', () => {
    // FIX: Added missing onCloudSync prop required by Props interface
    render(
      <SubmitModal 
        isOpen={true} 
        onClose={() => {}} 
        members={mockMembers} 
        changeLog={["Test Change Log"]} 
        onCloudSync={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(screen.getByText('提交修改建議')).toBeInTheDocument();
    // Content is inside a textarea, verify it's present in the display value
    expect(screen.getByDisplayValue((content) => content.includes('Test Change Log'))).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    // FIX: Added missing onCloudSync prop required by Props interface
    render(
      <SubmitModal 
        isOpen={false} 
        onClose={() => {}} 
        members={mockMembers} 
        changeLog={[]}
        onCloudSync={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(screen.queryByText('提交修改建議')).not.toBeInTheDocument();
  });

  it('handles Gmail Submit correctly', () => {
    // Mock window.open
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    
    // FIX: Added missing onCloudSync prop required by Props interface
    render(
      <SubmitModal 
        isOpen={true} 
        onClose={() => {}} 
        members={mockMembers} 
        changeLog={["Test Change"]} 
        onCloudSync={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const button = screen.getByText('使用 Gmail 寄出');
    fireEvent.click(button);

    // Verify window.open was called with Gmail composition URL
    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('mail.google.com/mail'),
      '_blank'
    );
  });
});
