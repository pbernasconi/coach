import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient, bookingWindow, googleCalendarLink } from './client.mjs';

const page = readFileSync(new URL('./fixtures/castro-page.html', import.meta.url), 'utf8');

/** Fake mx3fitness.com: serves the fixture; a reserve for Castro 3 3pm adds it to my_reservations. */
function fakeSite() {
  const sent = [];
  let booked = false;
  const fetchImpl = async (url, init) => {
    sent.push({ method: init.method, url: String(url), body: init.body ?? '' });
    let html = page;
    if (/reserve=202&res_date=2026-10-20&res_time=3:00pm/.test(init.body ?? '')) { booked = true; html = '<a>3:00pm</a>'; }
    else if (booked) html = page.replace('<div id="my_reservations">', `<div id="my_reservations"><div>Castro 3: Tuesday 10/20 at 3:00pm <a href='reserve-castro-station?unreserve=999'>cancel reservation</a></div>`);
    return new Response(html, { status: 200, headers: { 'set-cookie': 'AccelSite_mx3fitness_com=abc; path=/' } });
  };
  return { sent, fetchImpl };
}

const client = (site) => createClient({ username: 'u', password: 'p', fetchImpl: site.fetchImpl });

test('book sends the page\'s own reserve request and confirms it in your list', async () => {
  const site = fakeSite();
  const r = await client(site).book({ date: '2026-10-20', time: '3pm', station: '3' });
  assert.equal(r.ok, true, r.message);
  assert.equal(r.reservation.id, '999');
  const reserve = site.sent.filter((s) => /reserve=/.test(s.body));
  assert.equal(reserve.length, 1);
  assert.match(reserve[0].body, /^v2=true&reserve=202&res_date=2026-10-20&res_time=3:00pm&loadAjax=true&layout=blank&ajax=true$/);
  assert.ok(site.sent.every((s) => !/unreserve/.test(s.body) && !/unreserve/.test(s.url)));
});

test('book on your own slot sends nothing (the site would cancel it)', async () => {
  const site = fakeSite();
  const r = await client(site).book({ date: '2026-10-20', time: '2:00pm', station: 'Castro 3' });
  assert.equal(r.already, true);
  assert.ok(site.sent.every((s) => !/reserve=/.test(s.body)));
});

test('book refuses taken, closed and unknown slots', async () => {
  for (const [time, station] of [['2pm', '1'], ['6am', '3'], ['7am', '3'], ['4pm', '3']]) {
    const site = fakeSite();
    await assert.rejects(client(site).book({ date: '2026-10-20', time, station }));
    assert.ok(site.sent.every((s) => !/reserve=/.test(s.body)), `${station} ${time} sent a reserve`);
  }
});

test('dry run finds the slot and sends nothing', async () => {
  const site = fakeSite();
  const r = await client(site).book({ date: '2026-10-20', time: '1pm', station: 'castro-1', dryRun: true });
  assert.equal(r.dryRun, true);
  assert.equal(r.slot.station, 'Castro 1');
  assert.ok(site.sent.every((s) => !/reserve=/.test(s.body)));
});

test('login posts the form fields the site expects', async () => {
  const site = fakeSite();
  await client(site).overview();
  const body = new URLSearchParams(site.sent[0].body);
  assert.equal(site.sent[0].url, 'https://mx3fitness.com/reserve-castro-station');
  assert.equal(body.get('userName'), 'u');
  assert.equal(body.get('formSubmitFrom'), 'memberLoginForm.php');
});

test('calendar helpers', () => {
  assert.deepEqual(bookingWindow('2026-10-20', '2:00pm'), { start: '2026-10-20T14:00:00', end: '2026-10-20T15:00:00', timeZone: 'America/Los_Angeles' });
  assert.match(googleCalendarLink({ station: 'Castro 3', date: '2026-10-20', time: '2:00pm' }), /dates=20261020T140000%2F20261020T150000/);
});
