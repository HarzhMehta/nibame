import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BrainProvider } from '@/context/BrainContext';
import { InboxPage } from '@/pages/InboxPage';

const renderInbox = async () => {
  const result = render(
    <MemoryRouter>
      <BrainProvider>
        <InboxPage />
      </BrainProvider>
    </MemoryRouter>
  );
  await screen.findByRole('heading', { level: 1, name: 'Inbox' });
  return result;
};

describe('InboxPage', () => {
  it('renders page header and filter tabs', async () => {
    await renderInbox();

    expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByText(/Capture first, organize later/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Links/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Notes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Repos/i })).toBeInTheDocument();
  });

  it('displays captured mock items with metadata and tags', async () => {
    await renderInbox();

    expect(
      await screen.findByText(/Distributed Systems & Event Streaming with Apache Kafka/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/apache\/kafka - Mirror and Source Code/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/#Distributed Systems/i).length).toBeGreaterThan(0);
  });

  it('filters items when filter tabs are clicked', async () => {
    const user = userEvent.setup();
    await renderInbox();

    await screen.findByText(/Distributed Systems & Event Streaming with Apache Kafka/i);

    // Click on "Repos" filter
    const repoFilter = screen.getByRole('button', { name: /Repos/i });
    await user.click(repoFilter);

    // The repo should be displayed
    expect(
      screen.getByText(/apache\/kafka - Mirror and Source Code/i)
    ).toBeInTheDocument();

    // The video should be filtered out
    expect(
      screen.queryByText(/Distributed Systems & Event Streaming with Apache Kafka/i)
    ).not.toBeInTheDocument();
  });
});
