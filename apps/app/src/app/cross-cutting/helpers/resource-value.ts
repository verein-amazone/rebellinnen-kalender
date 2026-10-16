import type { Resource } from '@angular/core';

/**
 * A resource's value, or `fallback` while it has none.
 *
 * Reading `value()` of a resource in the error state throws `ResourceValueError` - `value() ?? []`
 * does not catch that. Inside a `computed` or a template binding the throw escapes the whole
 * expression, so the screen's own error branch never renders and the user sees a blank or broken
 * screen instead of „Erneut versuchen“. Every read of a resource value that is not already guarded
 * by `hasValue()` goes through here.
 */
export function valueOr<T, F>(resource: Resource<T>, fallback: F): NonNullable<T> | F {
  return resource.hasValue() ? (resource.value() as NonNullable<T>) : fallback;
}
