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

  it('should return an error for invalid input', () => {
    const invalidInput = null;

    const result = parseDP1Playlist(invalidInput);

    expect(result.error).toBeDefined();
    expect(result.error?.type).toBe('invalid_json');
    expect(result.error?.message).toBe('Input must be a valid JSON object');
  });
});
