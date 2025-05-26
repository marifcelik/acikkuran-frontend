// __tests__/pages/api/bookmark.test.js
import httpMocks from 'node-mocks-http';
import handler from '../../../pages/api/bookmark'; // Adjust path as necessary
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import request from 'graphql-request';

// Mock dependencies
jest.mock('next-auth');
jest.mock('next-auth/jwt');
jest.mock('graphql-request');

const mockSession = {
  user: { id: 'user-123' },
  expires: new Date(Date.now() + 2 * 86400).toISOString(),
};
const mockToken = 'mock-jwt-token';

describe('/api/bookmark handler', () => {
  beforeEach(() => {
    // Reset mocks for each test
    getServerSession.mockReset();
    getToken.mockReset();
    request.mockReset();

    // Default mock implementations
    getServerSession.mockResolvedValue(mockSession);
    getToken.mockResolvedValue(mockToken);
    request.mockResolvedValue({ /* default success response */ });
  });

  it('should return 401 if not signed in (no session)', async () => {
    getServerSession.mockResolvedValueOnce(null);
    const req = httpMocks.createRequest({
      method: 'POST',
      body: JSON.stringify({ action: 'add', bookmarkKey: 'key1' }),
    });
    const res = httpMocks.createResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._getData()).toEqual(expect.objectContaining({
      error: 'You must be signed in to view the protected content on this page.',
    }));
  });

  it('should return 401 if not signed in (no token)', async () => {
    getToken.mockResolvedValueOnce(null);
    const req = httpMocks.createRequest({
      method: 'POST',
      body: JSON.stringify({ action: 'add', bookmarkKey: 'key1' }),
    });
    const res = httpMocks.createResponse();
    
    await handler(req, res);

    expect(res.statusCode).toBe(401);
    // The actual response data might depend on how your handler behaves when token is null
    // For now, let's assume it ends the response without specific data or relies on session check
    // expect(res._isEndCalled()).toBeTruthy(); // or check specific error if any
  });


  describe('Add Bookmark', () => {
    it('should successfully add a new bookmark with labels and notes', async () => {
      const body = {
        action: 'add',
        type: 'verse',
        bookmarkItem: { surah: 1, verse: 1 },
        bookmarkKey: '1:1',
        verseId: 101,
        labels: ['important', 'read-later'],
        notes: 'This is a test note.',
      };
      request.mockResolvedValueOnce({ insert_users_bookmarks_one: { id: 'bookmark-1' } });

      const req = httpMocks.createRequest({ method: 'POST', body: JSON.stringify(body) });
      const res = httpMocks.createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(request).toHaveBeenCalledTimes(1);
      const [endpoint, mutation, variables, headers] = request.mock.calls[0];
      expect(endpoint).toBe(process.env.HASURA_API_ENDPOINT);
      expect(mutation).toContain('insert_users_bookmarks_one');
      expect(variables).toEqual({
        userId: mockSession.user.id,
        type: body.type,
        bookmarkItem: body.bookmarkItem,
        bookmarkKey: body.bookmarkKey,
        verseId: body.verseId,
        labels: body.labels,
        notes: body.notes,
      });
      expect(mutation).toContain('$labels: jsonb');
      expect(mutation).toContain('$notes: String');
      expect(mutation).toContain('labels: $labels');
      expect(mutation).toContain('notes: $notes');
      expect(mutation).toContain('update_columns: [updated_at, labels, notes]');
      expect(headers).toEqual({ authorization: `Bearer ${mockToken}` });
      expect(res._getJSONData()).toEqual({ insert_users_bookmarks_one: { id: 'bookmark-1' } });
    });

    it('should use default values for missing labels and notes when adding', async () => {
      const body = {
        action: 'add',
        type: 'verse',
        bookmarkItem: { surah: 2, verse: 2 },
        bookmarkKey: '2:2',
        verseId: 202,
        // labels and notes are missing
      };
      request.mockResolvedValueOnce({ insert_users_bookmarks_one: { id: 'bookmark-2' } });

      const req = httpMocks.createRequest({ method: 'POST', body: JSON.stringify(body) });
      const res = httpMocks.createResponse();
      await handler(req, res);
      
      expect(res.statusCode).toBe(200);
      const [, , variables] = request.mock.calls[0];
      expect(variables.labels).toEqual([]);
      expect(variables.notes).toBe("");
      expect(res._getJSONData()).toEqual({ insert_users_bookmarks_one: { id: 'bookmark-2' } });
    });

    it('should update an existing bookmark (on_conflict)', async () => {
        const body = {
            action: 'add', // 'add' action is used for upsert
            type: 'verse',
            bookmarkItem: { surah: 1, verse: 1, text: "Updated text" },
            bookmarkKey: '1:1', // Existing key
            verseId: 101,
            labels: ['updated-label'],
            notes: 'Updated note.',
          };
          request.mockResolvedValueOnce({ insert_users_bookmarks_one: { id: 'bookmark-existing' } });
    
          const req = httpMocks.createRequest({ method: 'POST', body: JSON.stringify(body) });
          const res = httpMocks.createResponse();
          await handler(req, res);
    
          expect(res.statusCode).toBe(200);
          expect(request).toHaveBeenCalledTimes(1);
          const [, mutation, variables] = request.mock.calls[0];
          expect(mutation).toContain('on_conflict');
          expect(mutation).toContain('update_columns: [updated_at, labels, notes]');
          expect(variables.labels).toEqual(['updated-label']);
          expect(variables.notes).toBe('Updated note.');
          expect(res._getJSONData()).toEqual({ insert_users_bookmarks_one: { id: 'bookmark-existing' } });
    });
  });

  describe('Remove Bookmark', () => {
    it('should successfully remove a bookmark', async () => {
      const body = {
        action: 'remove',
        bookmarkKey: '1:1',
      };
      request.mockResolvedValueOnce({ delete_users_bookmarks: { affected_rows: 1 } });

      const req = httpMocks.createRequest({ method: 'POST', body: JSON.stringify(body) });
      const res = httpMocks.createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(request).toHaveBeenCalledTimes(1);
      const [, mutation, variables] = request.mock.calls[0];
      expect(mutation).toContain('delete_users_bookmarks');
      expect(variables).toEqual({
        userId: mockSession.user.id,
        bookmarkKey: body.bookmarkKey,
      });
      expect(res._getJSONData()).toEqual({ delete_users_bookmarks: { affected_rows: 1 } });
    });
  });

  it('should handle GraphQL errors', async () => {
    const body = { action: 'add', bookmarkKey: 'error-key' };
    request.mockRejectedValueOnce(new Error('GraphQL Network Error'));
    
    const req = httpMocks.createRequest({ method: 'POST', body: JSON.stringify(body) });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._getData()).toEqual(expect.objectContaining({
        error: "Error while adding/removing bookmark"
    }));
  });
});

// Helper to run handler and return promise
function testApiHandler(req, res, handlerFn) {
  return new Promise((resolve, reject) => {
    res.on('end', () => {
      resolve();
    });
    res.on('error', (err) => {
      reject(err);
    });
    handlerFn(req, res);
  });
}
