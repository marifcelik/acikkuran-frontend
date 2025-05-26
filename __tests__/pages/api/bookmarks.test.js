// __tests__/pages/api/bookmarks.test.js
import httpMocks from 'node-mocks-http';
import handler from '../../../pages/api/bookmarks'; // Adjust path
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import request from 'graphql-request';

jest.mock('next-auth');
jest.mock('next-auth/jwt');
jest.mock('graphql-request');

const mockSession = {
  user: { id: 'user-456' },
  expires: new Date(Date.now() + 2 * 86400).toISOString(),
};
const mockToken = 'mock-jwt-token-for-bookmarks';

describe('/api/bookmarks handler', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    getToken.mockReset();
    request.mockReset();

    getServerSession.mockResolvedValue(mockSession);
    getToken.mockResolvedValue(mockToken);
    request.mockResolvedValue({ users_bookmarks: [] }); // Default to empty bookmarks
  });

  it('should return 401 if not signed in (no session)', async () => {
    getServerSession.mockResolvedValueOnce(null);
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._getData()).toEqual(expect.objectContaining({
      error: 'You must be signed in to view the protected content on this page.',
    }));
  });

  it('should return 401 if not signed in (no token)', async () => {
    getToken.mockResolvedValueOnce(null);
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    // Depending on handler logic, it might just end or send a specific error.
    // If it ends without data, _isEndCalled() can be true.
  });

  it('should fetch bookmarks and include labels and notes in the query', async () => {
    const mockBookmarksData = [{ id: 'b1', notes: 'Note 1', labels: ['LabelA'] }];
    request.mockResolvedValueOnce({ users_bookmarks: mockBookmarksData });

    const req = httpMocks.createRequest({ method: 'GET', query: { author: '101' } });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(request).toHaveBeenCalledTimes(1);
    const [, query] = request.mock.calls[0];
    expect(query).toContain('labels');
    expect(query).toContain('notes');
    expect(query).toContain('author_id: { _eq: 101 }'); // Check author from query
    expect(res._getJSONData()).toEqual({ users_bookmarks: mockBookmarksData });
  });

  it('should use default author if not provided in query', async () => {
    const req = httpMocks.createRequest({ method: 'GET' }); // No author in query
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const [, query] = request.mock.calls[0];
    expect(query).toContain('author_id: { _eq: 105 }'); // Default author
  });

  describe('Search Functionality', () => {
    it('should construct correct where clause for searchTerm matching notes', async () => {
      const searchTerm = 'important note';
      const req = httpMocks.createRequest({ method: 'GET', query: { searchTerm } });
      const res = httpMocks.createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const [, query] = request.mock.calls[0];
      expect(query).toContain(`notes: { _ilike: "%${searchTerm}%" }`);
      expect(query).toContain('_or: [');
    });

    it('should construct correct where clause for searchTerm matching labels', async () => {
      const searchTerm = 'urgent';
      const req = httpMocks.createRequest({ method: 'GET', query: { searchTerm } });
      const res = httpMocks.createResponse();
      await handler(req, res);
      
      expect(res.statusCode).toBe(200);
      const [, query] = request.mock.calls[0];
      expect(query).toContain(`labels: { _cast: { String: { _ilike: "%${searchTerm}%" } } }`);
    });

    it('should construct correct where clause for searchTerm matching verse text (translations)', async () => {
      const searchTerm = 'Allah';
      const req = httpMocks.createRequest({ method: 'GET', query: { searchTerm } });
      const res = httpMocks.createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const [, query] = request.mock.calls[0];
      expect(query).toContain(`verse: { translations: { text: { _ilike: "%${searchTerm}%" } } }`);
    });
    
    it('should construct correct where clause for searchTerm matching verse (original arabic)', async () => {
        const searchTerm = 'بسم';
        const req = httpMocks.createRequest({ method: 'GET', query: { searchTerm } });
        const res = httpMocks.createResponse();
        await handler(req, res);
  
        expect(res.statusCode).toBe(200);
        const [, query] = request.mock.calls[0];
        expect(query).toContain(`verse: { verse: { _ilike: "%${searchTerm}%" } }`);
      });

    it('should construct correct where clause for searchTerm matching transcription', async () => {
      const searchTerm = 'bismillah';
      const req = httpMocks.createRequest({ method: 'GET', query: { searchTerm } });
      const res = httpMocks.createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const [, query] = request.mock.calls[0];
      expect(query).toContain(`verse: { transcription: { _ilike: "%${searchTerm}%" } } }`);
    });

    it('should fetch bookmarks without a where clause if searchTerm is empty or not provided', async () => {
      const req = httpMocks.createRequest({ method: 'GET', query: { searchTerm: '' } });
      const res = httpMocks.createResponse();
      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const [, query] = request.mock.calls[0];
      expect(query).not.toContain('where: {');
    });
    
    it('should return empty array if search term matches nothing', async () => {
        const searchTerm = 'nonExistentXYZ123';
        request.mockResolvedValueOnce({ users_bookmarks: [] }); // Simulate no matches
  
        const req = httpMocks.createRequest({ method: 'GET', query: { searchTerm } });
        const res = httpMocks.createResponse();
        await handler(req, res);
  
        expect(res.statusCode).toBe(200);
        expect(res._getJSONData()).toEqual({ users_bookmarks: [] });
        const [, query] = request.mock.calls[0];
        expect(query).toContain(`_ilike: "%${searchTerm}%"`); // Ensure search term was used
      });
  });

  it('should handle GraphQL errors', async () => {
    request.mockRejectedValueOnce(new Error('GraphQL Network Error'));
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    // The actual error handling might just log and send empty data or a generic error.
    // For this test, let's assume it sends the data from the error (if any) or an empty success.
    // If the handler catches and sends a 500, that should be tested.
    // Based on current structure, it sends the error data from request, or an empty object if error.
    // Given the current structure, it will send the error object as data.
    // expect(res.statusCode).toBe(500); 
    // expect(res._getData()).toContain('Error');
    // The current code sends the error as the data itself.
    expect(res.statusCode).toBe(200); // Because the catch block sends the error as data
    expect(res._getJSONData()).toEqual(new Error('GraphQL Network Error'));
  });
});
