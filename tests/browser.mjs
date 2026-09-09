import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), cacheDir: '.vite/browser', server: { host: '127.0.0.1', port: 0 } });
await server.listen(); const port = server.httpServer.address().port, directory = await mkdtemp(join(tmpdir(), 'clay-pointer-'));
let browser;
try {
 browser = await chromium.launch({ channel: 'chromium' });
 const page = await browser.newPage({ viewport: { width: 1440, height: 1040 } }), errors = []; page.on('pageerror', error => errors.push(error.message));
 await page.goto(`http://127.0.0.1:${port}/tests/fixture.html`); await page.waitForFunction(() => window.vertices);
 const canvas = page.locator('canvas'), reset = () => page.getByRole('button', { name: 'Reset clay', exact: true }).click();
 const geometry = () => page.evaluate(() => window.vertices());
 const camera = () => page.evaluate(() => window.lab.ctx.camera.position.toArray());
 async function path(steps, button = 'left', end = true) { const box = await canvas.boundingBox(); await page.mouse.move(box.x + box.width / 2 - 65, box.y + box.height * .45); await page.mouse.down({ button }); await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height * .45, { steps }); if (end) await page.mouse.up({ button }); }
 async function exportMesh(name) { const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export sculpture OBJ', exact: true }).click(); const file = await pending; await file.saveAs(join(directory, name)); return readFile(join(directory, name), 'utf8'); }
 async function defaultPath() { await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox(); await page.mouse.move(box.x + box.width * .44, box.y + box.height * .45); await page.mouse.down(); await page.mouse.move(box.x + box.width * .56, box.y + box.height * .45, { steps: 12 }); await page.mouse.up(); }
 const defaultGeometry = await geometry(); await defaultPath(); assert.notDeepEqual(await geometry(), defaultGeometry);
 await reset(); const original = await geometry(), originalOBJ = await exportMesh('original.obj'), initialCamera = await camera();
 await path(2); const fast = await geometry(), fastOBJ = await exportMesh('fast.obj');
 assert.notDeepEqual(fast, original); assert.deepEqual(await camera(), initialCamera); await expect(page.getByRole('status')).toContainText('1 strokes');
 assert.equal((fastOBJ.match(/^f /gm) || []).length, 20480); assert.ok(!/NaN|Infinity/.test(fastOBJ));
 await page.getByRole('button', { name: 'Undo stroke', exact: true }).click(); assert.deepEqual(await geometry(), original); assert.equal(await exportMesh('undo.obj'), originalOBJ);
 await reset(); await path(60); assert.deepEqual(await geometry(), fast); assert.equal(await exportMesh('slow.obj'), fastOBJ);
 // Holding still must not keep inflating the picked surface as its depth moves.
 await reset(); const b = await canvas.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height * .45;
 await page.mouse.move(x, y); await page.mouse.down(); const pressed = await geometry();
 await canvas.evaluate((element, point) => { for (let i = 0; i < 40; i++) element.dispatchEvent(new PointerEvent('pointermove', { pointerId: window.lastPointerId, clientX: point.x, clientY: point.y, buttons: 1 })); }, { x, y });
 assert.deepEqual(await geometry(), pressed); await page.keyboard.press('Escape'); await page.mouse.up(); assert.deepEqual(await geometry(), original);
 await expect(page.getByRole('button', { name: 'Undo stroke', exact: true })).toBeDisabled();
 await path(10, 'left', false);
 await canvas.evaluate(element => element.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.lastPointerId })));
 await page.mouse.up(); assert.deepEqual(await geometry(), original);
 // Cached-tool deactivation cancels an unfinished transaction without losing mode.
 await path(10, 'left', false); await page.evaluate(() => window.clayTool.deactivate()); await page.mouse.up(); assert.deepEqual(await geometry(), original); await page.evaluate(() => window.clayTool.activate());
 const orbitBefore = await camera(); await path(8, 'right'); assert.notDeepEqual(await camera(), orbitBefore); assert.deepEqual(await geometry(), original);
 const distanceBefore = await page.evaluate(() => window.lab.ctx.camera.position.distanceTo(window.lab.ctx.controls.target));
 await canvas.hover(); await page.mouse.wheel(0, -120);
 await expect.poll(() => page.evaluate(() => window.lab.ctx.camera.position.distanceTo(window.lab.ctx.controls.target))).toBeLessThan(distanceBefore);
 await page.getByRole('combobox', { name: 'Pointer mode', exact: true }).selectOption('Orbit'); const modeCamera = await camera(); await path(8); assert.notDeepEqual(await camera(), modeCamera); assert.deepEqual(await geometry(), original);
 await page.evaluate(() => { window.clayTool.deactivate(); window.clayTool.activate(); }); await expect(canvas).toHaveCSS('cursor', 'grab');
 await page.getByRole('combobox', { name: 'Pointer mode', exact: true }).selectOption('Sculpt'); await reset();
 // Use the real cached-session switcher, including its pointer-cancel handoff.
 await path(10, 'left', false);
 await page.evaluate(() => window.lab.switchExperiment('other', ctx => { ctx.root.add(new ctx.THREE.Mesh(new ctx.THREE.BoxGeometry(), new ctx.THREE.MeshStandardMaterial())); return {}; }));
 await page.mouse.up();
 await page.evaluate(() => window.lab.switchExperiment('default'));
 assert.deepEqual(await geometry(), original);
 await path(8); assert.notDeepEqual(await geometry(), original);
 await page.getByRole('button', { name: 'Undo stroke', exact: true }).click(); assert.deepEqual(await geometry(), original);
 // Brush preview follows the smooth hit normal through parent transforms.
 await page.evaluate(() => { window.lab.ctx.root.rotation.set(.15, .6, .2); window.lab.ctx.root.scale.setScalar(1.2); window.lab.ctx.fit(); });
 const viewport = await canvas.boundingBox(), point = { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height * .45 };
 await page.mouse.move(point.x, point.y);
 const alignment = await page.evaluate(point => {
   const ctx = window.lab.ctx, hit = ctx.pick({ clientX: point.x, clientY: point.y }, [window.clayMesh])[0];
   const ring = ctx.scene.children.flatMap(child => child.children).find(child => child.geometry?.type === 'RingGeometry' && child.visible);
   const normal = hit.normal.clone().applyMatrix3(new ctx.THREE.Matrix3().getNormalMatrix(window.clayMesh.matrixWorld)).normalize();
   return { gap: ring.position.distanceTo(hit.point), alignment: new ctx.THREE.Vector3(0, 0, 1).applyQuaternion(ring.quaternion).dot(normal) };
 }, point);
 assert.ok(Math.abs(alignment.gap - .004) < 1e-5); assert.ok(alignment.alignment > .99999);
 await page.evaluate(() => { window.lab.ctx.root.rotation.set(0, 0, 0); window.lab.ctx.root.scale.setScalar(1); });
 await page.setViewportSize({ width: 390, height: 844 }); await reset();
 const mobileBefore = await geometry(); await defaultPath(); assert.notDeepEqual(await geometry(), mobileBefore);
 assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 assert.deepEqual(errors, []);
 console.log('Pointer regressions passed: exact fast/slow drag exports, undo, stationary input, Escape/cancel, deactivate/activate, orbit handoff, wheel zoom, and transformed smooth-normal cursor.');
} finally { await browser?.close(); await server.close(); await rm(directory, { recursive: true, force: true }); }
