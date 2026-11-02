import { resolve } from './helpers.js';
import type { Entity, Note } from './types.js';
import type { EntityBuilder } from './entity.js';
import { Note as ValidateNote } from '../validate/index.js';

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

  /** Heading shown above the text (1–200 characters). */
  title(value: string) {
    this.note.title = value;
    return this;
  }

  /** Who wrote the text. Omitted, the note is the curators' own. */
  author(value: Entity | EntityBuilder) {
    this.note.author = resolve(value);
    return this;
  }

  build(): Note {
    const out: Note = {
      text: String(this.note.text ?? ''),
      ...(this.note.duration === undefined ? {} : { duration: this.note.duration }),
      ...(this.note.title === undefined ? {} : { title: this.note.title }),
      ...(this.note.author === undefined ? {} : { author: this.note.author }),
    };
    ValidateNote(out);
    return structuredClone(out);
  }
}
