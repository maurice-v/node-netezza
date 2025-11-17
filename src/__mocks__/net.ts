/**
 * Mock implementation of Node.js 'net' module for testing
 */

export let mockSocket: any = null;

export function createConnection(options: any): any {
  if (!mockSocket) {
    throw new Error('Mock socket not configured. Call setMockSocket() first.');
  }

  // Return the configured mock socket
  return mockSocket;
}

/**
 * Configure the mock socket to be returned by createConnection
 */
export function setMockSocket(socket: any): void {
  mockSocket = socket;
}

/**
 * Reset the mock
 */
export function resetMock(): void {
  mockSocket = null;
}
