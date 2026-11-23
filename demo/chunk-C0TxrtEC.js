import{Bi as D,Mr as b$1,Ui as U$1,Wr as g$1,vr as X$1}from"./main-STAZVMJK.js";var g={ALREADY_PRESENTING:`ALREADY_PRESENTING`,NATIVE_UNAVAILABLE:`NATIVE_UNAVAILABLE`,NOT_IMPLEMENTED:`NOT_IMPLEMENTED`};function B(e,t){return Object.assign(t,{locale:e})}var U=B(`en`,async()=>(await import(`./chunk-fbw4gQXh.js`)).default);var E=`en`;var Y=`^1`;var R=/* @__PURE__ */ new Map;var $=/* @__PURE__ */ new Map;function G(e){let t=new Blob([JSON.stringify(e)],{type:`application/json`});return new Promise((n,o)=>{let r=new FileReader;r.onload=()=>n(r.result),r.onerror=()=>o(r.error),r.readAsDataURL(t)})}var p;function J(){return p??(p=fetch(`data:application/json,{}`,{method:`HEAD`}).then(()=>!0,()=>!1)),p}function X(e){return URL.createObjectURL(new Blob([JSON.stringify(e)],{type:`application/json`}))}async function q(e){for(let t of[`emojibase`,`cldr`]){let n=`https://cdn.jsdelivr.net/npm/emoji-picker-element-data@${Y}/${e}/${t}/data.json`,o=await fetch(n);if(o.ok)return o.json()}throw new Error(`Failed to fetch emoji data for locale '${e}'`)}async function W(e){return R.has(e)?R.get(e):e===E?U():q(e)}async function A(e=E){let t=$.get(e);if(t)return t;let n;try{n=await W(e)}catch{if(e===E)throw new Error(`Failed to resolve default emoji locale '${E}'`);return A(E)}let r={locale:e,url:await J()?await G(n):X(n)};return $.set(e,r),r}async function Z(e){try{await import(`./chunk-Dkck-GCd.js`)}catch{throw new Error(g.NOT_IMPLEMENTED)}let t=document.createElement(`emoji-picker`);return t.dataSource=e.dataSource,t.locale=e.locale,t}var F=`emoji-picker-sheet-styles`;var V=200;function Q(){if(document.getElementById(F))return;let e=document.createElement(`style`);e.id=F,e.textContent=`
        dialog.emoji-picker-sheet {
            position: fixed;
            inset: auto 0 0 0;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            width: 100%;
            max-width: 30rem;
            height: min(30rem, 80vh);
            max-height: 80vh;
            padding: 0 max(0.5rem, env(safe-area-inset-right, 0px)) max(0.5rem, env(safe-area-inset-bottom, 0px))
                max(0.5rem, env(safe-area-inset-left, 0px));
            border: none;
            border-radius: 1rem 1rem 0 0;
            overflow: hidden;
            transform: translateY(100%);
            transition: transform ${V}ms ease-out;
        }
        /*
         * Explicit colors rather than the \`Canvas\`/\`CanvasText\` system-color keywords: those rely
         * on the UA knowing the page's color-scheme, which isn't reliably signaled inside a
         * Capacitor WKWebView, so they were silently staying light-only regardless of the resolved
         * theme. Values match emoji-picker-element's own light/dark defaults so the seam between
         * the sheet chrome and the picker itself stays invisible.
         */
        dialog.emoji-picker-sheet--light {
            background-color: #fff;
            color: #1f1f1f;
        }
        dialog.emoji-picker-sheet--dark {
            background-color: #222;
            color: #e8e8e8;
        }
        dialog.emoji-picker-sheet[data-state='open'] {
            transform: translateY(0);
        }
        .emoji-picker-sheet__header {
            flex: 0 0 auto;
            display: flex;
            padding-block: 0.5rem;
        }
        .emoji-picker-sheet__close {
            border: none;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.06);
            color: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            cursor: pointer;
        }
        dialog.emoji-picker-sheet--dark .emoji-picker-sheet__close {
            background: rgba(255, 255, 255, 0.12);
        }
        @media (prefers-reduced-motion: reduce) {
            dialog.emoji-picker-sheet {
                transition: none;
            }
        }
    `,document.head.appendChild(e)}var ee=`#00000066`;var te=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;var oe=0;function re(e){return e!==void 0&&te.test(e)?e:ee}function ne(e){var t;let n=`emoji-picker-backdrop-${++oe}`,o=re(e.color),r=(t=e.blur)!==null&&t!==void 0?t:0,a=document.createElement(`style`);return a.textContent=`
        dialog.${n}::backdrop {
            background: ${o};
            backdrop-filter: ${r>0?`blur(${r}px)`:`none`};
        }
    `,document.head.appendChild(a),{className:n,remove:()=>a.remove()}}function ie(){return typeof window.matchMedia==`function`&&window.matchMedia(`(prefers-reduced-motion: reduce)`).matches}function ae(e){return e===`light`||e===`dark`?e:typeof window.matchMedia==`function`&&window.matchMedia(`(prefers-color-scheme: dark)`).matches?`dark`:`light`}var se={light:`#fff`,dark:`#222`};var ce={xSmall:24,small:32,medium:48,large:64};function le(e){let t=`http://www.w3.org/2000/svg`,n=Math.round(e*.375),o=document.createElementNS(t,`svg`);o.setAttribute(`viewBox`,`0 0 24 24`),o.setAttribute(`width`,String(n)),o.setAttribute(`height`,String(n)),o.setAttribute(`fill`,`none`),o.setAttribute(`stroke`,`currentColor`),o.setAttribute(`stroke-width`,`2.5`),o.setAttribute(`stroke-linecap`,`round`),o.setAttribute(`aria-hidden`,`true`);let r=document.createElementNS(t,`line`);r.setAttribute(`x1`,`5`),r.setAttribute(`y1`,`5`),r.setAttribute(`x2`,`19`),r.setAttribute(`y2`,`19`);let a=document.createElementNS(t,`line`);return a.setAttribute(`x1`,`19`),a.setAttribute(`y1`,`5`),a.setAttribute(`x2`,`5`),a.setAttribute(`y2`,`19`),o.append(r,a),o}function de(e){var t,n;if(e.hidden)return null;let o=ce[(t=e.size)!==null&&t!==void 0?t:`medium`],r=(n=e.position)!==null&&n!==void 0?n:`right`,a=document.createElement(`div`);a.className=`emoji-picker-sheet__header`,a.style.justifyContent=r===`left`?`flex-start`:r===`center`?`center`:`flex-end`;let l=document.createElement(`button`);return l.type=`button`,l.className=`emoji-picker-sheet__close`,l.setAttribute(`aria-label`,`Close`),l.style.width=`${o}px`,l.style.height=`${o}px`,l.appendChild(le(o)),a.appendChild(l),{header:a,button:l}}async function ue(e,t,n){let{default:o}=await import(`./chunk-Dtl5len4.js`);await new o({locale:e,dataSource:n}).setPreferredSkinTone(t)}var H=class{constructor(t={}){var n,o,r;this.createPickerElement=(n=t.createPickerElement)!==null&&n!==void 0?n:Z,this.seedSkinTone=(o=t.seedSkinTone)!==null&&o!==void 0?o:ue,this.getDataSourceUrl=(r=t.getDataSourceUrl)!==null&&r!==void 0?r:A}async present(t={},n={}){var o,r,a,l,y;let{signal:d}=n,L=(o=t.closeButton)!==null&&o!==void 0?o:{},z=((r=t.dismissOnBackdropTap)!==null&&r!==void 0?r:!0)||((a=L.hidden)!==null&&a!==void 0?a:!1),w=ae(t.theme),h=(l=t.locale)!==null&&l!==void 0?l:`en`,v;try{({locale:h,url:v}=await this.getDataSourceUrl(h))}catch{throw new Error(g.NOT_IMPLEMENTED)}t.skinTone!==void 0&&await this.seedSkinTone(h,t.skinTone,v);let s;try{s=await this.createPickerElement({locale:h,dataSource:v}),s.dataSource=v,s.locale=h,s.classList.add(w)}catch{throw new Error(g.NOT_IMPLEMENTED)}Q(),s.style.display=`block`,s.style.width=`100%`,s.style.flex=`1 1 auto`,s.style.minHeight=`0`,s.style.setProperty(`--background`,se[w]),s.style.setProperty(`--border-size`,`0`);let j=ne((y=t.backdrop)!==null&&y!==void 0?y:{}),i=document.createElement(`dialog`);i.className=`emoji-picker-sheet emoji-picker-sheet--${w} ${j.className}`,i.setAttribute(`role`,`dialog`),i.setAttribute(`aria-modal`,`true`),i.setAttribute(`aria-label`,`Emoji picker`);let u=de(L);return u&&(s.style.borderTop=`1px solid rgba(127, 127, 127, 0.3)`),new Promise(b=>{var _;let T=!1,x=!1,k=document.activeElement,K=document.body.style.overflow,S=c=>{var m;document.body.style.overflow=K,i.close(),i.remove(),j.remove(),k instanceof HTMLElement&&document.contains(k)&&((m=k.focus)===null||m===void 0||m.call(k)),b(c)},f=c=>{T||(T=!0,s.removeEventListener(`emoji-click`,N),i.removeEventListener(`pointerdown`,C),i.removeEventListener(`click`,D),i.removeEventListener(`cancel`,O),document.removeEventListener(`keydown`,M),u?.button.removeEventListener(`click`,I),d?.removeEventListener(`abort`,P),i.removeAttribute(`data-state`),ie()?S(c):setTimeout(()=>S(c),V))},N=c=>{var m;f({emoji:(m=c.detail.unicode)!==null&&m!==void 0?m:null})},C=c=>{x=c.target===i},D=c=>{z&&c.target===i&&x&&f({emoji:null})},O=c=>{c.preventDefault(),f({emoji:null})},M=c=>{c.key===`Escape`&&f({emoji:null})},I=()=>{f({emoji:null})},P=()=>{f({emoji:null})};if(d?.aborted){b({emoji:null});return}d?.addEventListener(`abort`,P),s.addEventListener(`emoji-click`,N),i.addEventListener(`pointerdown`,C),i.addEventListener(`click`,D),i.addEventListener(`cancel`,O),document.addEventListener(`keydown`,M),u?.button.addEventListener(`click`,I),u&&i.appendChild(u.header),i.appendChild(s),document.body.appendChild(i),document.body.style.overflow=`hidden`,i.showModal(),requestAnimationFrame(()=>{i.setAttribute(`data-state`,`open`)}),(_=s.focus)===null||_===void 0||_.call(s)})}};var c=class extends Error{constructor(r){super(r),this.name=`IcsUrlInvalidError`}};function b(e,r){let t=e.trim().replace(/^webcals?:\/\//i,`https://`),o;try{o=new URL(t)}catch{throw new c(`Der Link ist keine gültige Adresse.`)}if(o.protocol===`http:`&&!r.allowInsecure)throw new c(`Der Link muss mit https beginnen.`);if(o.protocol!==`https:`&&o.protocol!==`http:`)throw new c(`Der Link muss ein Webkalender-Link sein.`);return o.toString()}function j(e){try{let r=new URL(e),t=r.pathname.length>4?r.pathname.slice(-4):r.pathname;return`${r.origin}/\u2026${t}`}catch{return`…`}}function l(e,r,t){var o,i,n;if(window.CapacitorEmojiPickerAndroidBridge){window.CapacitorEmojiPickerAndroidBridge.onWebResult(e,r,t);return}(n=(i=(o=window.webkit)===null||o===void 0?void 0:o.messageHandlers)===null||i===void 0?void 0:i.capacitorEmojiPickerBridge)===null||n===void 0||n.postMessage({requestId:e,emoji:r,error:t})}function h(e){return e===g.NOT_IMPLEMENTED?e:g.NOT_IMPLEMENTED}function f(e=()=>new H){if(!U$1.isNativePlatform()||window.__CapacitorEmojiPickerPresentWeb)return;let r=/* @__PURE__ */ new Map;window.__CapacitorEmojiPickerPresentWeb=(t,o)=>{try{let i=o?JSON.parse(o):{},n=new AbortController;r.set(t,n),e().present(i,{signal:n.signal}).then(s=>{r.delete(t),l(t,s.emoji,null)}).catch(s=>{r.delete(t),l(t,null,h(s.message))})}catch{l(t,null,g.NOT_IMPLEMENTED)}},window.__CapacitorEmojiPickerDismissWeb=t=>{var o;(o=r.get(t))===null||o===void 0||o.abort(),r.delete(t)}}var u=D(`EmojiPicker`,{web:()=>import(`./chunk-CHoNr9-2.js`).then(e=>new e.EmojiPickerWeb)});f();var P=new b$1(`EMOJI_PICKER_PLUGIN`,{providedIn:`root`,factory:()=>u});var k=class e{plugin=g$1(P);async pickEmoji(){let{emoji:r}=await this.plugin.present();return r}static ɵfac=function(t){return new(t||e)};static ɵprov=X$1({token:e,factory:e.ɵfac,providedIn:`root`})};export{H as a,k as i,c as n,g as o,j as r,b as t};