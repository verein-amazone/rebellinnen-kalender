# 1.0.0-rc.1 (2026-09-09)


### Bug Fixes

* **a11y:** keep the focus ring inside clipped containers ([5c26d95](https://github.com/verein-amazone/rebellinnen-kalender/commit/5c26d954da2968bc85a122d1a4366c3204b1a7c1))
* **a11y:** stop loading skeletons from widening the page at large text ([61dd1b0](https://github.com/verein-amazone/rebellinnen-kalender/commit/61dd1b0f1ce2b5b5aa619cbee8ddf00b4c0c3378))
* **calendar:** adapt to the nullable plugin types in capacitor-calendar 8.6.0 ([0404370](https://github.com/verein-amazone/rebellinnen-kalender/commit/04043709a544eea9788f8d4144c0d797372c2cc5))
* **content:** consistently escape the gender star in bodyMarkdown ([7bf8641](https://github.com/verein-amazone/rebellinnen-kalender/commit/7bf864140ec26dc0be8a33190fdc3dfa9e473b71))
* **deps:** override uuid dependency minimum version ([be98699](https://github.com/verein-amazone/rebellinnen-kalender/commit/be986999748ac89d4ca7c4dab8812fa56245b6c1))
* **ios:** declare German so the native date picker is localized ([9271c18](https://github.com/verein-amazone/rebellinnen-kalender/commit/9271c189d5b2299ae1ca487d26a9bcdf8f513c8d))
* **navigation:** dismiss focused screens to an explicit target instead of history ([b089c14](https://github.com/verein-amazone/rebellinnen-kalender/commit/b089c145f6cf51943336518359e5008ae0b23a0b))
* **navigation:** hide the live announcer and drop view transitions on iOS ([9b3dbcb](https://github.com/verein-amazone/rebellinnen-kalender/commit/9b3dbcb2bdd8200d3b111fee4d1845fe95990b27)), closes [#13](https://github.com/verein-amazone/rebellinnen-kalender/issues/13)
* **sheet:** make the panel full width and keep its padding ([90110a7](https://github.com/verein-amazone/rebellinnen-kalender/commit/90110a7e70352a9f220ddc15e3502b904b9ee8c9))
* **ui:** address findings from a manual pass over the app ([d42e750](https://github.com/verein-amazone/rebellinnen-kalender/commit/d42e7505ba9685985089217a0b12a38a7e6e82bb))


### Features

* **a11y:** scale text with the OS setting and survive 200% ([2aa935b](https://github.com/verein-amazone/rebellinnen-kalender/commit/2aa935bcbc294203901f9fe8b460bcc57f5d734b)), closes [#21](https://github.com/verein-amazone/rebellinnen-kalender/issues/21)
* **app-icon:** ship the app icon and let users switch between three ([#9](https://github.com/verein-amazone/rebellinnen-kalender/issues/9)) ([f827961](https://github.com/verein-amazone/rebellinnen-kalender/commit/f82796103fbdf59ac0ffe5299f530346b6361cec))
* **app:** add route structure and themeable design tokens ([5505abe](https://github.com/verein-amazone/rebellinnen-kalender/commit/5505abe244eb017a5c5a676751154b5e83cf07c3)), closes [#13](https://github.com/verein-amazone/rebellinnen-kalender/issues/13) [#21](https://github.com/verein-amazone/rebellinnen-kalender/issues/21)
* **app:** work through the first round of Amazone feedback ([8d630bc](https://github.com/verein-amazone/rebellinnen-kalender/commit/8d630bc5c27aa5bafca8d19da2032dfb441e7097))
* **app:** work through the second round of Amazone feedback ([27d3013](https://github.com/verein-amazone/rebellinnen-kalender/commit/27d3013dc6fbb64b109bf2194edc74069f6ddcfe))
* **calendar:** add and manage calendars by link ([#25](https://github.com/verein-amazone/rebellinnen-kalender/issues/25)) ([fd65264](https://github.com/verein-amazone/rebellinnen-kalender/commit/fd652645d6d026191f78a8d02d8ea4f36b10cc81))
* **calendar:** add curated Amazone and partner calendars ([#2](https://github.com/verein-amazone/rebellinnen-kalender/issues/2)) ([a9574f1](https://github.com/verein-amazone/rebellinnen-kalender/commit/a9574f1a7bfd9e24974f5dc50a611ad612d4f2ee))
* **calendar:** browse the calendar in week and month views ([dc08598](https://github.com/verein-amazone/rebellinnen-kalender/commit/dc08598419ef54e6cae4872dcac4910fcb6484f9)), closes [#29](https://github.com/verein-amazone/rebellinnen-kalender/issues/29) [12/#15](https://github.com/verein-amazone/rebellinnen-kalender/issues/15) [#17](https://github.com/verein-amazone/rebellinnen-kalender/issues/17)
* **calendar:** establish the offline calendar data architecture and occurrence layer ([ef9ffe3](https://github.com/verein-amazone/rebellinnen-kalender/commit/ef9ffe356bff0eed0a88c9588577239fcd95fd52))
* **calendar:** filter events by calendar source ([#18](https://github.com/verein-amazone/rebellinnen-kalender/issues/18)) ([c011d14](https://github.com/verein-amazone/rebellinnen-kalender/commit/c011d14d6bb79a90b2ce44e9d1c5d60fa1d1e026))
* **calendar:** manage the app calendar and device calendars ([#20](https://github.com/verein-amazone/rebellinnen-kalender/issues/20)) ([7d8d0f7](https://github.com/verein-amazone/rebellinnen-kalender/commit/7d8d0f7d4607eade772b4c837c7941c2da6a9c5c))
* **calendar:** rework pill styling, emoji picker, and platform gating ([000e922](https://github.com/verein-amazone/rebellinnen-kalender/commit/000e9229079721464a685afbccd6c5b17ad2d72b))
* **calendar:** ship the Amazone Rebell*innen Kalender as a curated source ([c1365b1](https://github.com/verein-amazone/rebellinnen-kalender/commit/c1365b154de762798ef31599c9a5c88142d7e7d7))
* **calendar:** view and manage appointments ([22d9c70](https://github.com/verein-amazone/rebellinnen-kalender/commit/22d9c704e3d78699319fec44cb93c6f47d8de402))
* **content:** add Anlaufstellen support-services screen ([#24](https://github.com/verein-amazone/rebellinnen-kalender/issues/24)) ([5a989d9](https://github.com/verein-amazone/rebellinnen-kalender/commit/5a989d9bf91a9f0862dbf74d3f550d5674d9bead))
* **content:** add content detail extras and My Collection ([#22](https://github.com/verein-amazone/rebellinnen-kalender/issues/22), [#23](https://github.com/verein-amazone/rebellinnen-kalender/issues/23)) ([656ceb4](https://github.com/verein-amazone/rebellinnen-kalender/commit/656ceb486bf92f347e8d2c7900fcf1bf9b171740))
* **design-system:** add a round checkbox and write down the touch-first rules ([e09e32f](https://github.com/verein-amazone/rebellinnen-kalender/commit/e09e32fe8c938e38ba20dbc20f576e44a5ab6e5a))
* **design-system:** add visual primitives, status tokens and a sheet ([1acd085](https://github.com/verein-amazone/rebellinnen-kalender/commit/1acd085aefaa10443234e80faee735d65435816d)), closes [#18](https://github.com/verein-amazone/rebellinnen-kalender/issues/18) [#19](https://github.com/verein-amazone/rebellinnen-kalender/issues/19) [#13](https://github.com/verein-amazone/rebellinnen-kalender/issues/13)
* **ios:** adopt the UIScene life cycle ([1b045cf](https://github.com/verein-amazone/rebellinnen-kalender/commit/1b045cf1c5199093c30a1d6d62b87a248c97db88))
* **navigation:** handle focus, transitions, dismissal and safe areas ([9a9d359](https://github.com/verein-amazone/rebellinnen-kalender/commit/9a9d359306d669995dc563a570a7871d9bb534e3)), closes [#13](https://github.com/verein-amazone/rebellinnen-kalender/issues/13)
* **settings:** add the legal and app information entries ([a37450a](https://github.com/verein-amazone/rebellinnen-kalender/commit/a37450a14d6c37d3e5b9f266b2977d411d7bb48c)), closes [#21](https://github.com/verein-amazone/rebellinnen-kalender/issues/21) [#11](https://github.com/verein-amazone/rebellinnen-kalender/issues/11)
* **today:** add a dynamic closing message to the Today page ([cd941af](https://github.com/verein-amazone/rebellinnen-kalender/commit/cd941af73e49423648cb7e9aa391a691c8265e8f)), closes [#29](https://github.com/verein-amazone/rebellinnen-kalender/issues/29) [#12](https://github.com/verein-amazone/rebellinnen-kalender/issues/12)
* **today:** implement the Today overview ([#46](https://github.com/verein-amazone/rebellinnen-kalender/issues/46)) ([eacc0b7](https://github.com/verein-amazone/rebellinnen-kalender/commit/eacc0b78ae5460614b6e80dd406db6c8feab855f)), closes [#15](https://github.com/verein-amazone/rebellinnen-kalender/issues/15)
* **today:** let the „Nicht vergessen" list be ordered by hand ([005ab42](https://github.com/verein-amazone/rebellinnen-kalender/commit/005ab4271886676ad5bd4ab5fcdf444bbad30617))
* **today:** manage the „Nicht vergessen“ list ([ce08cc6](https://github.com/verein-amazone/rebellinnen-kalender/commit/ce08cc6fa6e157ef259294897e36f2e2b5574792))
* **today:** personalise the greeting with a name and emoji ([#14](https://github.com/verein-amazone/rebellinnen-kalender/issues/14)) ([cf49e5b](https://github.com/verein-amazone/rebellinnen-kalender/commit/cf49e5b938dbf0882d794a9e3ea59ccee2dc080a))
* **today:** show a daily impulse or Rebell*in on the Today page ([aaee624](https://github.com/verein-amazone/rebellinnen-kalender/commit/aaee624cb5dc63f8bddcbb6d7b8a5b825f62e5a4)), closes [#1](https://github.com/verein-amazone/rebellinnen-kalender/issues/1)


### Performance Improvements

* **calendar:** stop redoing derived work that changes nothing ([f0a59af](https://github.com/verein-amazone/rebellinnen-kalender/commit/f0a59af7615517c2f4ad4df93151101ab47b8ed0))
