import { describe, it, expect } from 'vitest';
import { parseDP1Playlist } from '../src/playlist';

describe('parseDP1Playlist', () => {
  it('should validate input by default', () => {
    const validInput = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      slug: 'my-playlist-1234',
      dpVersion: '1.0.0',
      title: 'My Playlist',
      created: '2024-01-15T14:30:00.000Z',
      items: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          source: 'https://example.com/art.html',
          duration: 300,
          license: 'open',
          created: '2024-01-15T14:30:00.001Z',
        },
      ],
      signature: 'ed25519:0x1234567890abcdef',
    };

    const result = parseDP1Playlist(validInput);

    expect(result.error).toBeUndefined();
    expect(result.playlist).toBeDefined();
  });

  it('should validate complete playlist', () => {
    const validPlaylist = {
      dpVersion: '1.0.0',
      id: '123e4567-e89b-12d3-a456-426614174000',
      slug: 'my-playlist-1234',
      title: 'My Playlist',
      created: '2024-01-15T14:30:00.000Z',
      items: [
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          source: 'https://example.com/art.html',
          duration: 300,
          license: 'open',
          created: '2024-01-15T14:30:00.001Z',
        },
      ],
      signature: 'ed25519:0x1234567890abcdef',
    };

    const result = parseDP1Playlist(validPlaylist);

    expect(result.error).toBeUndefined();
    expect(result.playlist).toBeDefined();
  });

  it('should return an error for invalid input', () => {
    const invalidInput = {
      dpVersion: '1.0.0',
    };

    const result = parseDP1Playlist(invalidInput);

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('validation_error');
    expect(result.error?.message).toContain('title: Required');
    expect(result.error?.details).toBeDefined();
    expect(result.error?.details?.[0].message).toContain('Required');
  });

  it('should return an error for null input', () => {
    const invalidInput = null;

    const result = parseDP1Playlist(invalidInput);

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('invalid_json');
    expect(result.error?.message).toBe('Input must be a valid JSON object');
  });

  it('should return an error for undefined input', () => {
    const result = parseDP1Playlist(undefined);

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('invalid_json');
    expect(result.error?.message).toBe('Input must be a valid JSON object');
  });

  it('should return an error for string input', () => {
    const result = parseDP1Playlist('not an object');

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('invalid_json');
    expect(result.error?.message).toBe('Input must be a valid JSON object');
  });

  it('should return an error for number input', () => {
    const result = parseDP1Playlist(123);

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('invalid_json');
  });

  it('should return an error for array input', () => {
    const result = parseDP1Playlist([]);

    // Arrays are objects in JavaScript, so they pass the object check
    // but fail Zod validation
    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('validation_error');
  });

  it('should handle validation errors with detailed path information', () => {
    const invalidPlaylist = {
      dpVersion: '1.0.0',
      id: 'test-id',
      slug: 'test-slug',
      title: 'Test',
      items: [
        {
          id: 'item-1',
          source: 'invalid-url', // Invalid URL
          duration: -1, // Invalid duration
          license: 'open',
          created: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    const result = parseDP1Playlist(invalidPlaylist);

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('validation_error');
    expect(result.error?.details).toBeDefined();
    expect(result.error?.details?.length).toBeGreaterThan(0);
  });

  it('should handle deeply nested validation errors', () => {
    const invalidPlaylist = {
      dpVersion: '1.0.0',
      id: 'test-id',
      slug: 'test-slug',
      title: 'Test',
      items: [
        {
          id: 'item-1',
          source: 'https://example.com/test',
          duration: 300,
          license: 'open',
          created: '2024-01-01T00:00:00.000Z',
          display: {
            scaling: 'invalid-scaling', // Invalid enum value
          },
        },
      ],
    };

    const result = parseDP1Playlist(invalidPlaylist);

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('validation_error');
    expect(result.error?.details).toBeDefined();
    expect(result.error?.details?.some(d => d.path.includes('display'))).toBe(true);
  });

  it('should handle multiple validation errors', () => {
    const invalidPlaylist = {
      dpVersion: 'invalid-version',
      id: 'test-id',
      slug: '', // Empty slug
      title: '', // Empty title
      items: [], // Empty items array
    };

    const result = parseDP1Playlist(invalidPlaylist);

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('validation_error');
    expect(result.error?.details).toBeDefined();
    expect(result.error?.details?.length).toBeGreaterThan(1);
  });
});
