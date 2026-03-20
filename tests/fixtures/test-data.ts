// Test Fixtures for TidySnap E2E Tests

export const TEST_USERS = {
  free: {
    email: 'test@tidysnap.test',
    password: 'test123',
    type: 'free',
    analysisUsed: 0,
  },
  freeExhausted: {
    email: 'test2@tidysnap.test',
    password: 'test123',
    type: 'free',
    analysisUsed: 1,
  },
  lifetime: {
    email: 'lifetime@tidysnap.test',
    password: 'test123',
    type: 'lifetime',
    analysisUsed: 5,
  },
};

export const TEST_FILES = {
  desktopMessy: 'tests/fixtures/desktop-messy-1.jpg',
  desktopMessyLarge: 'tests/fixtures/desktop-messy-2.jpg',
  desktopClean: 'tests/fixtures/desktop-clean.jpg',
  mobileMessy: 'tests/fixtures/mobile-messy.jpg',
  oversized: 'tests/fixtures/oversize.jpg',
  wrongType: 'tests/fixtures/wrong-type.pdf',
};

export const STRIPE_TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  insufficient: '4000000000009995',
  expired: '4000000000000069',
};

export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  desktopLarge: { width: 1920, height: 1080 },
};

export const TIMEOUTS = {
  analysisMax: 55000, // 55 seconds (Vercel limit)
  uploadMax: 10000,
  navigation: 30000,
  action: 10000,
};
