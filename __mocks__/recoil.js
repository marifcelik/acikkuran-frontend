// __mocks__/recoil.js
export const atom = jest.fn((config) => ({
    key: config.key,
    default: config.default,
  }));
  
export const useRecoilState = jest.fn((atomInstance) => {
    // Provide a mock state and a mock setter function
    // You might need to make this more sophisticated if your tests depend on specific state changes
    const mockState = atomInstance.default; // Or some other mock value
    const mockSetState = jest.fn();
    return [mockState, mockSetState];
});
  
export const useRecoilValue = jest.fn((atomInstance) => atomInstance.default);
  
export const useSetRecoilState = jest.fn((atomInstance) => jest.fn());
  
export const selector = jest.fn((config) => ({
    key: config.key,
    get: config.get,
    // Mock 'set' if your selectors have it
}));
