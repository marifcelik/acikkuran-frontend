// __tests__/components/modals/BookmarksModal.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from 'styled-components'; // Assuming you use styled-components
import { RecoilRoot } from 'recoil'; // For Recoil state
import BookmarksModal from '../../../components/modals/BookmarksModal'; // Adjust path
import { lightTheme } from '../../../styles/theme'; // Adjust path
import { modalState } from '../../../recoil/atoms'; // Adjust path

// Mocks are automatically handled by Jest due to __mocks__ directory

// Mock fetch globally
global.fetch = jest.fn();

const mockBookmarks = [
  {
    id: '1',
    bookmarkKey: '1:1:1',
    type: 'verse',
    bookmarkItem: { surah: 1, verse: 1 },
    notes: 'Initial note for bookmark 1',
    labels: ['important', 'quran'],
    updated_at: new Date().toISOString(),
    verse: {
      id: 101,
      page: 1,
      surah: { id: 1, name: 'Al-Fatiha', name_en: 'Al-Fatiha' },
      verse_number: 1,
      verse: 'بسم الله الرحمن الرحيم',
      transcription: 'Bismillaahir Rahmaanir Raheem',
      translations: [{ id: 't1', author_id: 105, text: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.' }],
    },
  },
  {
    id: '2',
    bookmarkKey: '1:2:2',
    type: 'verse',
    bookmarkItem: { surah: 2, verse: 2 },
    notes: 'Another note here',
    labels: ['review'],
    updated_at: new Date().toISOString(),
    verse: {
      id: 202,
      page: 2,
      surah: { id: 2, name: 'Al-Baqarah', name_en: 'Al-Baqarah' },
      verse_number: 2,
      verse: 'ذلك الكتاب لا ريب فيه',
      transcription: 'Zalikal Kitaabu laa raiba فيه',
      translations: [{ id: 't2', author_id: 105, text: 'This is the Book about which there is no doubt...' }],
    },
  },
];

// Helper to render with providers
const renderBookmarksModal = (props = {}) => {
  const initialRecoilState = ({ set }) => {
    set(modalState, { openedModal: 'bookmarks', params: {} }); // Ensure modal is "open"
  };
  return render(
    <RecoilRoot initializeState={initialRecoilState}>
      <ThemeProvider theme={lightTheme}>
        <BookmarksModal modalKey="bookmarks" authorId={105} {...props} />
      </ThemeProvider>
    </RecoilRoot>
  );
};


describe('<BookmarksModal />', () => {
  beforeEach(() => {
    fetch.mockClear();
    // Default fetch mock for initial load
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users_bookmarks: mockBookmarks }),
    });
  });

  describe('Display', () => {
    it('should render bookmarks with notes and labels', async () => {
      renderBookmarksModal();
      // Wait for bookmarks to load
      expect(await screen.findByText('Initial note for bookmark 1')).toBeInTheDocument();
      expect(screen.getByText('important')).toBeInTheDocument();
      expect(screen.getByText('quran')).toBeInTheDocument();

      expect(screen.getByText('Another note here')).toBeInTheDocument();
      expect(screen.getByText('review')).toBeInTheDocument();
    });

    it('should display "No bookmarks" message if no bookmarks are present', async () => {
      fetch.mockReset(); // Clear previous default
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users_bookmarks: [] }),
      });
      renderBookmarksModal();
      expect(await screen.findByText('bookmark__no_bookmark_title')).toBeInTheDocument();
    });
  });

  describe('Editing Labels & Notes', () => {
    it('should allow editing and saving notes and labels', async () => {
      renderBookmarksModal();
      expect(await screen.findByText('Initial note for bookmark 1')).toBeInTheDocument();

      // Find edit button for the first bookmark
      // Using a more robust selector might be needed if text isn't unique
      const editButtons = screen.getAllByText('bookmark__edit_button');
      fireEvent.click(editButtons[0]);
      
      // Verify input fields appear with correct initial values
      const noteTextarea = await screen.findByDisplayValue('Initial note for bookmark 1');
      const labelsInput = screen.getByDisplayValue('important, quran');
      expect(noteTextarea).toBeInTheDocument();
      expect(labelsInput).toBeInTheDocument();

      // Simulate typing
      fireEvent.change(noteTextarea, { target: { value: 'Updated note for bookmark 1' } });
      fireEvent.change(labelsInput, { target: { value: 'updated, quran, new-label' } });

      // Mock fetch for the save operation
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ /* mock success response for save if needed by component */ }),
      });
      
      // Click Save
      fireEvent.click(screen.getByText('bookmark__save_button'));

      // Verify API call for save
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          '/api/bookmark',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              bookmarkKey: mockBookmarks[0].bookmarkKey,
              action: 'add',
              verseId: mockBookmarks[0].verse.id,
              type: mockBookmarks[0].type,
              bookmarkItem: mockBookmarks[0].bookmarkItem,
              labels: ['updated', 'quran', 'new-label'],
              notes: 'Updated note for bookmark 1',
            }),
          })
        );
      });

      // Verify display updates and edit mode is exited
      expect(await screen.findByText('Updated note for bookmark 1')).toBeInTheDocument();
      expect(screen.getByText('updated')).toBeInTheDocument();
      expect(screen.getByText('new-label')).toBeInTheDocument();
      expect(screen.queryByText('bookmark__save_button')).not.toBeInTheDocument(); // Save button disappears
    });

    it('should allow canceling edit mode', async () => {
      renderBookmarksModal();
      expect(await screen.findByText('Initial note for bookmark 1')).toBeInTheDocument();
      
      const editButtons = screen.getAllByText('bookmark__edit_button');
      fireEvent.click(editButtons[0]);

      const noteTextarea = await screen.findByDisplayValue('Initial note for bookmark 1');
      fireEvent.change(noteTextarea, { target: { value: 'Temporary change' } });
      
      // Click Cancel
      fireEvent.click(screen.getByText('bookmark__cancel_button'));

      // Verify original note is displayed and edit mode is exited
      expect(screen.getByText('Initial note for bookmark 1')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Temporary change')).not.toBeInTheDocument();
      expect(screen.queryByText('bookmark__save_button')).not.toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('should call API with searchTerm when typing in search bar', async () => {
      renderBookmarksModal();
      await screen.findByText('Initial note for bookmark 1'); // Ensure initial load is done

      const searchInput = screen.getByPlaceholderText('bookmark__search_placeholder');
      
      // Clear the initial fetch call, prepare for search fetch
      fetch.mockClear(); 
      fetch.mockResolvedValueOnce({ // Mock response for search
        ok: true,
        json: async () => ({ users_bookmarks: [mockBookmarks[1]] }), // e.g., search returns only the second bookmark
      });

      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'Another' } });
        // Jest's fake timers might be needed if debouncing is very quick or complex
        // For this example, we'll wait for the fetch call triggered by the debounced handler
        await new Promise(resolve => setTimeout(resolve, 600)); // Wait for debounce (500ms + buffer)
      });
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/bookmarks?author=105&searchTerm=Another',
        expect.anything() // Headers might be present
      );

      // Verify display updates based on search
      expect(await screen.findByText('Another note here')).toBeInTheDocument();
      expect(screen.queryByText('Initial note for bookmark 1')).not.toBeInTheDocument();
    });

    it('should display "No results" message if search yields no bookmarks', async () => {
        renderBookmarksModal();
        await screen.findByText('Initial note for bookmark 1'); // Initial load
  
        const searchInput = screen.getByPlaceholderText('bookmark__search_placeholder');
        
        fetch.mockClear();
        fetch.mockResolvedValueOnce({ // Mock response for search with no results
          ok: true,
          json: async () => ({ users_bookmarks: [] }),
        });
  
        await act(async () => {
          fireEvent.change(searchInput, { target: { value: 'nonexistentsearchterm' } });
          await new Promise(resolve => setTimeout(resolve, 600)); 
        });
        
        expect(await screen.findByText('bookmark__no_results_title')).toBeInTheDocument();
      });
  });

  describe('Login Requirement', () => {
    it('should display login required message if session is not available', async () => {
      // Override useSession mock for this test
      const { useSession } = jest.requireMock('next-auth/react');
      useSession.mockImplementationOnce(() => ({ data: null, status: 'unauthenticated' }));
      
      fetch.mockReset(); // No fetch should be called if not authenticated

      renderBookmarksModal();

      expect(await screen.findByText('bookmark__login_required')).toBeInTheDocument();
      expect(screen.getByText('login__direction_text')).toBeInTheDocument(); // Login button
      expect(fetch).not.toHaveBeenCalled();
    });
  });

});
