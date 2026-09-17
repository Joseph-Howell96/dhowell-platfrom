/**
 * Kept apart from actions.ts on purpose. A file marked "use server" is only
 * allowed to export functions that run on the server, so the plain value and
 * the shape below have to live somewhere else.
 */

export type FormState = {
  /** Problems with one named field, shown underneath it. */
  fieldErrors: Record<string, string>;
  /** A problem with the form as a whole, shown at the top. */
  formError: string | null;
  /**
   * Set when a save went through on a form that stays put afterwards, such as
   * settings. Forms that move you on somewhere else never need it.
   */
  success?: string;
};

export const EMPTY_FORM_STATE: FormState = { fieldErrors: {}, formError: null };
