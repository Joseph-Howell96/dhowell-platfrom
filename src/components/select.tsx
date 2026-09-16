"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";

/**
 * A dropdown that stays on the option you chose.
 *
 * Use this instead of a plain <select> on any form that is submitted to the
 * server, because of an awkward React behaviour: once a form has been sent,
 * React empties its fields. For a text box it immediately puts the typed text
 * back, so nothing appears to happen. For a dropdown it does not, so the
 * choice silently snaps back to the first option whenever a submission returns
 * with something to correct.
 *
 * Left alone that is worse than annoying. Setting a rate line to "we pay the
 * customer", getting an unrelated warning, fixing it and saving would quietly
 * store "we charge the customer" instead.
 *
 * The fix is small: after every render, check whether the dropdown on screen
 * still shows what the page thinks it should, and put it back if not.
 */
type Props = ComponentPropsWithoutRef<"select"> & { value: string };

export default function Select({ value, children, ...rest }: Props) {
  const ref = useRef<HTMLSelectElement>(null);

  // No dependency list, so this runs after every render and catches the reset
  // whenever it happens.
  useEffect(() => {
    if (ref.current && ref.current.value !== value) {
      ref.current.value = value;
    }
  });

  return (
    <select ref={ref} value={value} {...rest}>
      {children}
    </select>
  );
}
