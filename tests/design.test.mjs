import test from 'node:test';
import assert from 'node:assert/strict';
const luminance = hex => { const c=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return c[0]*.2126+c[1]*.7152+c[2]*.0722; };
const pairs=[['light ink','27212A','FFFFFF'],['light muted','655D68','FFFFFF'],['light primary','FFFFFF','713B64'],['light danger','A52B39','FFFFFF'],['dark ink','F4EFF5','241F28'],['dark muted','C0B5C5','241F28'],['dark primary','241F28','DBADD0'],['dark danger','FFB1BA','241F28']];
for(const [label,fg,bg] of pairs) test(`${label} text contrast ≥4.5:1`,()=>{ const a=luminance(fg),b=luminance(bg); const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05); assert.ok(ratio>=4.5, `${ratio.toFixed(2)}:1`); });
