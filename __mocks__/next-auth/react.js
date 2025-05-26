// __mocks__/next-auth/react.js
export const useSession = jest.fn(() => ({
  data: { user: { id: 'test-user-id' } },
  status: 'authenticated',
}));

export const getSession = jest.fn(() => Promise.resolve({
  user: { id: 'test-user-id' },
}));
