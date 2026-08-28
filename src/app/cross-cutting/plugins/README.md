# Capacitor plugin tokens

Every Capacitor plugin package the app depends on is imported **here and nowhere else**, and handed
on as an Angular `InjectionToken`. Two places inject such a token, and nothing else does:

- `data/gateways/**` for plugins that are a data source (SQLite, the device calendar).
- `cross-cutting/infrastructure/**` for plugins that are a device capability (haptics, the shake
  gesture, the launcher icon, the OS settings deep link, the emoji picker, the keyboard, the OS
  text scale, the app lifecycle).

ESLint enforces both halves: the package ban outside this folder, and the token ban outside those
two. `device-platform.ts` is the single exemption - it reads the Capacitor _runtime_ rather than a
plugin, and it runs while the application providers are still being assembled, before an injector
exists to hand it anything.

## Why the extra hop

A wrapper that imports its plugin directly cannot be tested. Most of these plugins have no web
implementation, so under jsdom every call rejects with `"<Plugin>.<method>() is not implemented on
web"` - and because the plugin object is a module-level import, a spec has no seam to replace it.
The failure is also not local: a component spec that transitively constructs such a wrapper inherits
those rejections as unhandled errors, which is how a passing suite starts printing noise that says
nothing about the code under test.

With the token, a spec provides a hand-written stub in one line and the real plugin is never
touched:

```ts
TestBed.configureTestingModule({ providers: [{ provide: SHAKE_PLUGIN, useValue: stub }] });
```

Keeping the tokens in their own folder additionally makes the plugin surface countable: the files in
this directory are the complete list of native capabilities the app depends on, and reviewing a new
one is reviewing a single file.

## What belongs here

Only the token and its factory - no logic, no error handling, no mapping. Everything else is the
wrapper's job, including translating plugin types into the app's own. The plugin's types may appear
in this directory and in the one wrapper that injects the token; they must not travel further, so an
interactor or a view never learns which plugin is behind a capability. A plugin enum a wrapper has
to pass back in (`AndroidSettings`, `CalendarPermissionScope`) is re-exported from the token's file
rather than imported at the call site, which keeps the one-import-site rule literally true.

One file per plugin, named `<capability>.plugin.ts`, exporting one `SCREAMING_SNAKE_CASE` token.

## Tokens hold a plain object, not the plugin

Several factories build a small object that forwards the methods the app actually calls, instead of
handing over the plugin itself:

```ts
factory: () => ({ addListener: (eventName, listener) => App.addListener(eventName, listener) });
```

A Capacitor plugin proxy answers _every_ property access, so Angular's DI finds an `ngOnDestroy` on
it and calls that when the injector is destroyed - which rejects with
`"App.ngOnDestroy() is not implemented on web"` in every jsdom spec that reaches the token
transitively, whether or not the test ever uses the plugin. A plain object has no such property. It
also narrows the token's type to the slice the app uses, which is the boundary this folder is for.
