import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BrainProvider } from '@/context/BrainContext';
import { SearchPage } from '@/pages/SearchPage';

const renderSearchPage = async () => {
  const result = render(
    <MemoryRouter>
      <BrainProvider>
        <SearchPage />
      </BrainProvider>
    </MemoryRouter>
  );
  await screen.findByRole('heading', { level: 1, name: /Search Your Brain/i });
  return result;
};

describe('SearchPage', () => {
  it('renders search input and initial state with suggestions', async () => {
    await renderSearchPage();

    expect(
      screen.getByRole('heading', { level: 1, name: /Search Your Brain/i })
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Search by keyword, topic, person, or URL/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Start typing to search/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kafka/i })).toBeInTheDocument();
  });

  it('searches and returns matching items and entities', async () => {
    const user = userEvent.setup();
    await renderSearchPage();

    const searchInput = screen.getByPlaceholderText(/Search by keyword, topic, person, or URL/i);
    await user.type(searchInput, 'Kafka');

    // Wait for debounce and search execution
    await waitFor(
      () => {
        expect(
          screen.getByText(/Distributed Systems & Event Streaming with Apache Kafka/i)
        ).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Entity for Apache Kafka topic should also match
    expect(
      screen.getByText(/Distributed event streaming platform capable of handling trillions of events a day/i)
    ).toBeInTheDocument();
  });

  it('displays no-results state when query matches nothing', async () => {
    const user = userEvent.setup();
    await renderSearchPage();

    const searchInput = screen.getByPlaceholderText(/Search by keyword, topic, person, or URL/i);
    await user.type(searchInput, 'NonExistentQueryXYZ123');

    await waitFor(
      () => {
        expect(
          screen.getByText(/No results found for "NonExistentQueryXYZ123"/i)
        ).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(
      screen.getByText(/Try searching with different terms, keywords, or tags/i)
    ).toBeInTheDocument();
  });

  it('triggers search when a suggestion chip is clicked', async () => {
    const user = userEvent.setup();
    await renderSearchPage();

    const suggestionBtn = screen.getByRole('button', { name: /Mumbai/i });
    await user.click(suggestionBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/Mumbai Tech & Coffee Spots/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });
});
