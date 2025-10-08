import { PlaylistSchema } from "./schema";
import { Playlist } from "./types";
import { z } from "zod";

export type DP1PlaylistParseResult = {
  playlist?: Playlist;
  error?: {
    type: "invalid_json" | "validation_error";
    message: string;
    details?: Array<{
      path: string;
      message: string;
    }>;
  };
};

/**
 * Parse and validate playlist data from unknown JSON input
 * Returns either the validated playlist or detailed error information
 *
 * @param json - Unknown JSON data to parse
 * @param options - Parsing options
 * @returns Object with either playlist or error
 *
 * @example
 * ```typescript
 * const result = parseDP1Playlist(jsonData);
 * if (result.error) {
 *   console.error(result.error.message);
 * } else {
 *   console.log(result.playlist);
 * }
 * ```
 */
export function parseDP1Playlist(json: unknown): DP1PlaylistParseResult {
  // Validate that input is an object
  if (!json || typeof json !== "object") {
    return {
      error: {
        type: "invalid_json",
        message: "Input must be a valid JSON object",
      },
    };
  }

  try {
    const result = PlaylistSchema.parse(json);

    return { playlist: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format validation errors with detailed path information
      const details = error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      }));

      const errorMessage = details
        .map((d) => `${d.path}: ${d.message}`)
        .join("; ");

      return {
        error: {
          type: "validation_error",
          message: `Invalid playlist data: ${errorMessage}`,
          details,
        },
      };
    }

    // Unexpected error
    return {
      error: {
        type: "invalid_json",
        message:
          error instanceof Error ? error.message : "Unknown parsing error",
      },
    };
  }
}
