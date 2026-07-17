import type { Note } from './types.js';
import { validateNoteDraft } from './validate-draft.js';

export class NoteBuilder {
  private note: Partial<Note> = {};

  text(value: string) {
    this.note.text = value;
    return this;
  }

  durationSeconds(value: number) {
    this.note.duration = value;
    return this;
  }

  build(): Note {
    const out: Note = {
      text: String(this.note.text ?? ''),
      ...(this.note.duration === undefined ? {} : { duration: this.note.duration }),
    };
    validateNoteDraft(out);
    return structuredClone(out);
  }
}

