import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BrainProvider } from '@/context/BrainContext';
import { AppRoutes } from '@/routes';

const renderAppWithRoute = async (initialRoute = '/inbox') => {
  const result = render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <BrainProvider>
        <AppRoutes />
      </BrainProvider>
    </MemoryRouter>
  );
  await screen.findAllByRole('heading', { level: 1 });
  return result;
};

describe('Navigation & Shell', () => {
  it('renders application brand and core navigation items', async () => {
    await renderAppWithRoute('/inbox');

    expect(screen.getAllByText('nibame').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Memory/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Search/i })).toBeInTheDocument();
  });

  it('renders future placeholder sections marked with Soon badge', async () => {
    await renderAppWithRoute('/inbox');

    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getAllByText('Work').length).toBeGreaterThan(0);
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getAllByText('Soon').length).toBe(4);
  });

  it('navigates between routes on user click', async () => {
    const user = userEvent.setup();
    await renderAppWithRoute('/inbox');

    // Currently on Inbox
    expect(screen.getByText(/Capture first, organize later/i)).toBeInTheDocument();

    // Click Memory link
    const memoryLink = screen.getByRole('link', { name: /Memory/i });
    await user.click(memoryLink);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Memory & Context/i })).toBeInTheDocument();
    });

    // Click Search link
    const searchLink = screen.getByRole('link', { name: /Search/i });
    await user.click(searchLink);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Search by keyword, topic, person, or URL/i)
      ).toBeInTheDocument();
    });
  });
});
