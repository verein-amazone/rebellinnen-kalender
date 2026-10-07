import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';

import { DEVELOPER_TOOLS_ENABLED } from '@app/cross-cutting/infrastructure/developer-tools';

/**
 * Keeps the developer-tools routes out of a store build (#119). Hiding the Settings rows is not
 * enough: a remembered URL or a deep link would still reach them. When the routes do not match,
 * the app's wildcard route sends the visitor to the start.
 */
export const developerToolsGuard: CanMatchFn = () => inject(DEVELOPER_TOOLS_ENABLED);
