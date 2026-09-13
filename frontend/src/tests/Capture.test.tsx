import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BrainProvider } from '@/context/BrainContext';
import { InboxPage } from '@/pages/InboxPage';
import { CaptureModal } from '@/components/common/CaptureModal';

const renderCaptureApp = async () => {
  const result = render(
    <MemoryRouter>
      <BrainProvider>
        <InboxPage />
        <CaptureModal />
      </BrainProvider>
    </MemoryRouter>
  );
  await screen.findByRole('heading', { level: 1, name: 'Inbox' });
  return result;
};

describe('Capture UI & Validation', () => {
  it('validates empty inputs and prevents submission', async () => {
    const user = userEvent.setup();
    await renderCaptureApp();

    // Open capture modal
    const captureButton = screen.getByRole('button', { name: /Capture Item/i });
    await user.click(captureButton);

    expect(await screen.findByRole('heading', { name: /Capture to Brain/i })).toBeInTheDocument();

    // Submit with empty inputs
    const submitButton = screen.getByRole('button', { name: /Capture to Brain/i });
    await user.click(submitButton);

    // Validation errors should appear
    expect(await screen.findByText(/Title is required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Please provide a URL or some note content/i)
    ).toBeInTheDocument();
  });

  it('successfully captures a new item and displays it in the inbox', async () => {
    const user = userEvent.setup();
    await renderCaptureApp();

    // Open capture modal
    const captureButton = screen.getByRole('button', { name: /Capture Item/i });
    await user.click(captureButton);

    const titleInput = await screen.findByLabelText(/Title/i);
    const contentInput = screen.getByLabelText(/Note \/ Summary/i);
    const tagsInput = screen.getByLabelText(/Tags \(comma-separated\)/i);

    await user.type(titleInput, 'Understanding Paxos Consensus');
    await user.type(contentInput, 'Notes on leader election and multi-decree Paxos quorum.');
    await user.type(tagsInput, 'consensus, distributed-systems');

    const submitButton = screen.getByRole('button', { name: /Capture to Brain/i });
    await user.click(submitButton);

    // Success feedback appears
    expect(await screen.findByText(/Captured to Inbox/i)).toBeInTheDocument();

    // Modal closes and item appears in Inbox
    await waitFor(
      () => {
        expect(screen.getByText('Understanding Paxos Consensus')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(
      screen.getByText(/Notes on leader election and multi-decree Paxos quorum/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/#consensus/i)).toBeInTheDocument();
  });
});
