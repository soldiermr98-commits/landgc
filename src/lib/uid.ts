/** Build-time unique ids for SVG <defs> (gradients) rendered more than once per page. */
let counter = 0;

export function uid(prefix = 'gc'): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}
