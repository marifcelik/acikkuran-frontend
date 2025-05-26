// __mocks__/next-i18next.js
export const useTranslation = jest.fn(() => ({
  t: (key, defaultValue) => defaultValue || key, // Simple mock t function
  i18n: {
    language: 'en',
    changeLanguage: jest.fn(),
  },
}));

export const Trans = ({ i18nKey, components }) => {
  // A simple mock for Trans that tries to render children or a placeholder
  if (components && components.icon) {
    return `[${i18nKey}] with icon`;
  }
  return `[${i18nKey}]`;
};

// If you use serverSideTranslations, you might need to mock it too
export const serverSideTranslations = jest.fn(() => Promise.resolve({}));
