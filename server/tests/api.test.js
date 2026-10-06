const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const mongoose = require('mongoose');
const sharp = require('sharp');
const bcrypt = require('bcrypt');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { createApp } = require('../app');
const { User, Trip, Profile, Interest } = require('../models');
const { signToken } = require('../utils/auth');

test('account, profile, trip and photo flows enforce ownership against a real disposable MongoDB', { timeout: 90_000 }, async t => {
  const uri = process.env.MONGODB_TEST_URI;
  assert.ok(uri, 'Set MONGODB_TEST_URI to a disposable local travelmate_test_ database.');
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, 'mongodb:');
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname));
  assert.match(parsed.pathname, /^\/travelmate_test_[a-z0-9_]+$/);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await Promise.all([User.init(), Profile.init()]);
  await Promise.all([User.deleteMany({}), Profile.deleteMany({}), Trip.deleteMany({}), Interest.deleteMany({})]);
  let { server, httpServer } = await createApp();
  httpServer.listen(0, '127.0.0.1');
  await once(httpServer, 'listening');
  const base = 'http://127.0.0.1:' + httpServer.address().port;
  t.after(async () => {
    await server.stop();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  async function query(document, variables = {}, token) {
    const response = await fetch(base + '/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ query: document, variables }),
    });
    return response.json();
  }
  function success(result) { assert.equal(result.errors, undefined, JSON.stringify(result.errors)); return result.data; }
  function denied(result, code) {
    assert.ok(result.errors?.length, 'The request must be rejected.');
    if (code) assert.equal(result.errors[0].extensions.code, code);
  }
  const rawPassword = 'Private test password 2026!';
  const registration = 'mutation($first:String!,$email:String!,$password:String!){createUser(firstname:$first,lastname:"Tester",email:$email,password:$password){token user{_id firstname}}}';
  let alice, bob, aliceProfile, bobProfile, aliceTrip, bobTrip, aliceProfileImage, aliceTripImage;
  const profileMutation = 'mutation($owner:ID!){createProfile(profileUser:$owner,location:"Sydney",age:30,bio:"Test traveller"){_id profileUser{_id} tripCount}}';
  const tripMutation = 'mutation($owner:ID!){createTrip(creator:$owner,title:"Test trip",description:"A test trip",departureLocation:"Sydney (West)",destination:"Blue Mountains",startDate:"2027-01-10",endDate:"2027-01-12"){_id creator{_id} travelmates{_id}}}';
  const join = 'mutation($trip:ID!,$user:ID!){joinTrip(id:$trip,userJoining:$user){_id travelmates{_id email}}}';
  const myTrips = 'query($user:ID!){myTrips(travelmates:$user){_id}}';
  async function upload(buffer, type = 'image/png', token, path = '/api/images') {
    const form = new FormData();
    if (buffer) form.append('image', new Blob([buffer], { type }), 'photo.png');
    return fetch(base + path, { method: 'POST', headers: token ? { authorization: 'Bearer ' + token } : {}, body: form });
  }

  await t.test('registration normalizes email and hashes passwords; users cannot self-register as administrators', async () => {
    alice = success(await query(registration, { first: 'Alice', email: 'ALICE@EXAMPLE.COM', password: rawPassword })).createUser;
    bob = success(await query(registration, { first: 'Bob', email: 'bob@example.com', password: rawPassword })).createUser;
    const stored = await User.findById(alice.user._id).select('+password');
    assert.equal(stored.email, 'alice@example.com');
    assert.equal(stored.isAdmin, false);
    assert.notEqual(stored.password, rawPassword);
    assert.ok(await bcrypt.compare(rawPassword, stored.password));
    assert.equal((await User.findById(alice.user._id)).password, undefined);
    denied(await query('mutation{createUser(firstname:"Bad",lastname:"User",email:"bad@example.com",password:"password123",isAdmin:true){token}}'), 'GRAPHQL_VALIDATION_FAILED');
    denied(await query(registration, { first: 'Alice', email: 'alice@example.com', password: rawPassword }), 'BAD_USER_INPUT');
  });
  await t.test('login works and unknown accounts and wrong passwords return the same message', async () => {
    const login = 'mutation($email:String!,$password:String!){login(email:$email,password:$password){token user{_id}}}';
    assert.equal(success(await query(login, { email: ' ALICE@example.com ', password: rawPassword })).login.user._id, alice.user._id);
    const wrong = await query(login, { email: 'alice@example.com', password: 'wrong' });
    const missing = await query(login, { email: 'missing@example.com', password: 'wrong' });
    assert.equal(wrong.errors[0].message, missing.errors[0].message);
  });
  await t.test('profiles are owned by their account and an account can create only one', async () => {
    denied(await query(profileMutation, { owner: alice.user._id }), 'UNAUTHENTICATED');
    denied(await query(profileMutation, { owner: bob.user._id }, alice.token), 'FORBIDDEN');
    assert.equal(success(await query('query($owner:ID!){profileExist(profileUser:$owner){_id}}', { owner: alice.user._id }, alice.token)).profileExist, null);
    aliceProfile = success(await query(profileMutation, { owner: alice.user._id }, alice.token)).createProfile;
    bobProfile = success(await query(profileMutation, { owner: bob.user._id }, bob.token)).createProfile;
    denied(await query(profileMutation, { owner: alice.user._id }, alice.token), 'BAD_USER_INPUT');
    assert.equal(await Profile.countDocuments({ profileUser: alice.user._id }), 1);
  });
  await t.test('users can edit their own profile; account/profile edits and deletion of another account are denied', async () => {
    const edit = 'mutation($id:ID!){updateProfile(id:$id,bio:"Updated bio"){bio}}';
    assert.equal(success(await query(edit, { id: alice.user._id }, alice.token)).updateProfile.bio, 'Updated bio');
    denied(await query(edit, { id: bob.user._id }, alice.token), 'FORBIDDEN');
    denied(await query('mutation($id:ID!){updateUser(id:$id,firstname:"Changed"){firstname}}', { id: bob.user._id }, alice.token), 'FORBIDDEN');
    denied(await query('mutation($id:ID!){deleteUser(id:$id){_id}}', { id: bob.user._id }, alice.token), 'FORBIDDEN');
    denied(await query('mutation($id:ID!){deleteProfile(id:$id){_id}}', { id: bobProfile._id }, alice.token), 'NOT_FOUND');
    assert.equal((await Profile.findById(bobProfile._id)).bio, 'Test traveller');
  });
  await t.test('catalog mutations require a real administrator role', async () => {
    denied(await query('mutation{createInterests(label:"Bad"){_id}}', {}, alice.token), 'FORBIDDEN');
    denied(await query('mutation{createTripType(tripType:"Bad"){_id}}', {}, bob.token), 'FORBIDDEN');
    denied(await query('{users{_id}}', {}, alice.token), 'FORBIDDEN');
    const admin = await User.create({ firstname: 'Admin', lastname: 'Tester', email: 'admin@example.com', password: rawPassword, isAdmin: true });
    const interest = success(await query('mutation{createInterests(label:"Hiking"){_id}}', {}, signToken(admin))).createInterests;
    denied(await query('mutation($id:ID!,$interest:ID!){addAnInterest(id:$id,interestId:$interest){_id}}', { id: bobProfile._id, interest: interest._id }, alice.token), 'NOT_FOUND');
    assert.equal(success(await query('mutation($id:ID!,$interest:ID!){addAnInterest(id:$id,interestId:$interest){interests{label}}}', { id: aliceProfile._id, interest: interest._id }, alice.token)).addAnInterest.interests[0].label[0], 'Hiking');
  });
  await t.test('trip creation binds the organizer to the signed-in account and updates their profile', async () => {
    denied(await query(tripMutation, { owner: bob.user._id }, alice.token), 'FORBIDDEN');
    aliceTrip = success(await query(tripMutation, { owner: alice.user._id }, alice.token)).createTrip;
    bobTrip = success(await query(tripMutation, { owner: bob.user._id }, bob.token)).createTrip;
    assert.equal(aliceTrip.creator._id, alice.user._id);
    assert.equal((await Profile.findById(aliceProfile._id)).tripCount, 1);
    assert.ok(success(await query(myTrips, { user: alice.user._id }, alice.token)).myTrips.some(trip => trip._id === aliceTrip._id));
    denied(await query(myTrips, { user: alice.user._id }), 'UNAUTHENTICATED');
    denied(await query(myTrips, { user: bob.user._id }, alice.token), 'FORBIDDEN');
  });
  await t.test('contact details are private until accounts share a trip, and password fields cannot be queried', async () => {
    const userQuery = 'query($id:ID!){user(id:$id){firstname email}}';
    assert.equal(success(await query(userQuery, { id: alice.user._id })).user.email, null);
    assert.equal(success(await query(userQuery, { id: alice.user._id }, bob.token)).user.email, null);
    denied(await query('query($id:ID!){user(id:$id){password}}', { id: alice.user._id }), 'GRAPHQL_VALIDATION_FAILED');
    denied(await query(join, { trip: aliceTrip._id, user: alice.user._id }, bob.token), 'FORBIDDEN');
    success(await query(join, { trip: aliceTrip._id, user: bob.user._id }, bob.token));
    success(await query(join, { trip: aliceTrip._id, user: bob.user._id }, bob.token));
    assert.equal((await Trip.findById(aliceTrip._id)).travelmates.length, 1);
    assert.equal(success(await query(userQuery, { id: alice.user._id }, bob.token)).user.email, 'alice@example.com');
  });
  await t.test('organizers cannot join their own trip, including legacy records with self-membership', async () => {
    const selfJoin = await query(join, { trip: aliceTrip._id, user: alice.user._id }, alice.token);
    denied(selfJoin, 'FORBIDDEN');
    assert.equal(selfJoin.errors[0].message, "You're already organizing this trip.");
    assert.equal((await Trip.findById(aliceTrip._id)).travelmates.length, 1);
    await Trip.updateOne({ _id: aliceTrip._id }, { $addToSet: { travelmates: alice.user._id } });
    const trip = success(await query('query($id:ID!){trip(id:$id){creator{_id} travelmates{_id}}}', { id: aliceTrip._id })).trip;
    assert.deepEqual(trip.travelmates.map(user => user._id), [bob.user._id]);
    assert.equal((await Trip.findById(aliceTrip._id)).travelmates.length, 2, 'Displaying old records must not delete stored data');
    denied(await query(join, { trip: aliceTrip._id, user: alice.user._id }, alice.token), 'FORBIDDEN');
  });
  await t.test('trip/profile populations and literal searches return valid results', async () => {
    const result = success(await query('query($term:String){searchTrips(departureLocation:$term){_id creator{firstname} travelmates{firstname email}}}', { term: '(West)' }, alice.token));
    assert.equal(result.searchTrips.length, 2);
    assert.equal(success(await query('query($term:String){searchTrips(departureLocation:$term){_id}}', { term: '.*' })).searchTrips.length, 0);
    success(await query('{profiles{createdTrips{creator{firstname} travelmates{firstname}}}}', {}, alice.token));
  });
  await t.test('uploads authenticate first, validate and resize photos, and store them in the database', async () => {
    const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ff9900' } }).png().toBuffer();
    assert.equal((await upload(png)).status, 401);
    assert.equal((await upload()).status, 401);
    assert.equal((await upload(null, 'image/png', alice.token)).status, 400);
    assert.equal((await upload(Buffer.from('not an image'), 'image/png', alice.token)).status, 415);
    assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/png', alice.token)).status, 415);
    assert.equal((await upload(Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png', alice.token)).status, 413);
    const response = await upload(png, 'image/png', alice.token);
    assert.equal(response.status, 200);
    const image = (await response.json()).image;
    aliceProfileImage = image;
    const stored = await Profile.findById(aliceProfile._id).select('+imageData');
    assert.ok(stored.imageData.length > 0);
    assert.equal((await Profile.findById(bobProfile._id)).imageData, undefined);
    const photo = await fetch(base + image);
    assert.equal(photo.headers.get('content-type'), 'image/jpeg');
    const metadata = await sharp(Buffer.from(await photo.arrayBuffer())).metadata();
    assert.ok(metadata.width <= 512 && metadata.height <= 512);
    const privateProfile = await fetch(base + '/api/images/profile', { headers: { authorization: 'Bearer ' + alice.token } });
    assert.equal((await privateProfile.json()).imageData, undefined);
  });
  await t.test('trip cards expose the current organizer photo without exposing private profile data', async () => {
    const result = success(await query('{searchTrips{_id creatorProfileImage creator{email}}}')).searchTrips;
    assert.equal(result.find(trip => trip._id === aliceTrip._id).creatorProfileImage, aliceProfileImage);
    assert.equal(result.find(trip => trip._id === bobTrip._id).creatorProfileImage, null);
    assert.ok(result.every(trip => trip.creator.email === null));
    const own = success(await query('query($user:ID!){myTrips(travelmates:$user){_id creatorProfileImage}}', { user: alice.user._id }, alice.token)).myTrips;
    assert.equal(own[0].creatorProfileImage, aliceProfileImage);
    success(await query('{profiles{createdTrips{creatorProfileImage}}}'));
    await Profile.updateOne({ _id: aliceProfile._id }, { $set: { image: aliceProfileImage + '&replacement=test' } });
    const changed = success(await query('query($id:ID!){trip(id:$id){creatorProfileImage}}', { id: aliceTrip._id })).trip;
    assert.equal(changed.creatorProfileImage, aliceProfileImage + '&replacement=test');
    await Profile.updateOne({ _id: aliceProfile._id }, { $set: { image: aliceProfileImage } });
  });
  await t.test('only the organizer can add or replace a validated trip photo; photos are optional and stay out of JSON', async () => {
    const path = '/api/images/trips/' + aliceTrip._id;
    assert.equal((await upload(null, 'image/png', undefined, path)).status, 401);
    assert.equal((await upload(null, 'image/png', bob.token, path)).status, 404);
    assert.equal((await upload(null, 'image/png', alice.token, path)).status, 400);
    assert.equal((await upload(Buffer.from('invalid'), 'image/png', alice.token, path)).status, 415);
    assert.equal((await upload(Buffer.alloc(2 * 1024 * 1024 + 1), 'image/png', alice.token, path)).status, 413);
    const first = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#ff9900' } }).png().toBuffer();
    const response = await upload(first, 'image/png', alice.token, path);
    assert.equal(response.status, 200);
    const firstImage = (await response.json()).image;
    const stored = await Trip.findById(aliceTrip._id).select('+imageData');
    assert.ok(stored.imageData.length > 0);
    assert.equal((await Trip.findById(aliceTrip._id)).imageData, undefined);
    const photo = await fetch(base + firstImage);
    assert.equal(photo.headers.get('content-type'), 'image/jpeg');
    const metadata = await sharp(Buffer.from(await photo.arrayBuffer())).metadata();
    assert.ok(metadata.width <= 1200 && metadata.height <= 800);
    const second = await sharp({ create: { width: 600, height: 400, channels: 3, background: '#2299cc' } }).png().toBuffer();
    const changed = await upload(second, 'image/png', alice.token, path);
    assert.equal(changed.status, 200);
    aliceTripImage = (await changed.json()).image;
    assert.notEqual(aliceTripImage, firstImage);
    assert.notDeepEqual((await Trip.findById(aliceTrip._id).select('+imageData')).imageData, stored.imageData);
    const result = success(await query('query($id:ID!){trip(id:$id){image}}', { id: bobTrip._id }));
    assert.equal(result.trip.image, null);
    assert.equal((await fetch(base + '/api/images/trips/' + bobTrip._id)).status, 404);
    assert.equal((await fetch(base + '/api/images/trips/invalid')).status, 404);
    assert.equal((await Profile.findById(aliceProfile._id)).image, aliceProfileImage);
  });
  await t.test('profile and trip photos survive an HTTP server restart and remain visible in search and My trips', async () => {
    await server.stop();
    const restarted = await createApp();
    server = restarted.server;
    httpServer = restarted.httpServer;
    httpServer.listen(Number(new URL(base).port), '127.0.0.1');
    await once(httpServer, 'listening');
    assert.equal((await fetch(base + aliceProfileImage)).status, 200);
    assert.equal((await fetch(base + aliceTripImage)).status, 200);
    const downloads = await Promise.all(Array.from({ length: 35 }, async () => {
      const response = await fetch(base + aliceTripImage);
      await response.arrayBuffer();
      return response.status;
    }));
    assert.ok(downloads.every(status => status === 200), 'Loading trip cards must not consume the upload allowance');
    const search = success(await query('{searchTrips(departureLocation:"West"){_id image}}')).searchTrips;
    assert.equal(search.find(trip => trip._id === aliceTrip._id).image, aliceTripImage);
    const own = success(await query('query($user:ID!){myTrips(travelmates:$user){_id image}}', { user: alice.user._id }, alice.token)).myTrips;
    assert.equal(own.find(trip => trip._id === aliceTrip._id).image, aliceTripImage);
  });
  await t.test('password changes stay hashed and revoke the old token across GraphQL and uploads', async () => {
    const nextPassword = 'Updated private test password!';
    success(await query('mutation($id:ID!,$password:String!){updateUser(id:$id,password:$password){_id}}', { id: alice.user._id, password: nextPassword }, alice.token));
    const stored = await User.findById(alice.user._id).select('+password +tokenVersion');
    assert.ok(await bcrypt.compare(nextPassword, stored.password));
    assert.equal(await bcrypt.compare(rawPassword, stored.password), false);
    denied(await query(myTrips, { user: alice.user._id }, alice.token), 'UNAUTHENTICATED');
    assert.equal((await upload(Buffer.from('unused'), 'image/png', alice.token)).status, 401);
    assert.equal((await upload(null, 'image/png', alice.token, '/api/images/trips/' + aliceTrip._id)).status, 401);
    const login = 'mutation($password:String!){login(email:"alice@example.com",password:$password){token}}';
    denied(await query(login, { password: rawPassword }), 'UNAUTHENTICATED');
    alice.token = success(await query(login, { password: nextPassword })).login.token;
  });
  await t.test('only an organizer can remove a trip; cleanup preserves the other account and its trips', async () => {
    const remove = 'mutation($id:ID!){removeTrip(id:$id){_id}}';
    denied(await query(remove, { id: aliceTrip._id }, bob.token), 'NOT_FOUND');
    success(await query(remove, { id: aliceTrip._id }, alice.token));
    assert.equal((await fetch(base + aliceTripImage)).status, 404);
    assert.equal((await Profile.findById(aliceProfile._id)).tripCount, 0);
    assert.ok(await Trip.findById(bobTrip._id));
    success(await query('mutation($id:ID!){deleteUser(id:$id){_id}}', { id: bob.user._id }, bob.token));
    assert.equal(await User.findById(bob.user._id), null);
    assert.equal(await Profile.findById(bobProfile._id), null);
    assert.equal(await Trip.findById(bobTrip._id), null);
    denied(await query(myTrips, { user: bob.user._id }, bob.token), 'UNAUTHENTICATED');
    assert.ok(await User.findById(alice.user._id));
  });
  await t.test('a missing or deleted profile returns null so the client can show the creation form', async () => {
    success(await query('mutation($id:ID!){deleteProfile(id:$id){_id}}', { id: aliceProfile._id }, alice.token));
    const result = success(await query('query($id:ID!){profile(id:$id){_id}}', { id: alice.user._id }, alice.token));
    assert.equal(result.profile, null);
    assert.equal((await fetch(base + '/api/images/profile/' + alice.user._id)).status, 404);
  });
  await t.test('catalogue setup is repeatable and preserves existing accounts, profiles and trips', async () => {
    const { seedCatalogue } = require('../data/seed');
    const before = [await User.countDocuments(), await Profile.countDocuments(), await Trip.countDocuments()];
    await seedCatalogue();
    assert.equal(await seedCatalogue(), 0);
    assert.deepEqual([await User.countDocuments(), await Profile.countDocuments(), await Trip.countDocuments()], before);
  });

  if (process.env.RUN_BROWSER_TESTS === 'true') {
    await t.test('the production UI completes signup, profile/photo editing, trip creation and joining, logout and login', { timeout: 60_000 }, async () => {
      const { createRequire } = require('node:module');
      const clientRequire = createRequire(require.resolve('../../client/package.json'));
      const { chromium } = clientRequire('playwright');
      const browser = await chromium.launch();
      try {
        const context = await browser.newContext({ timezoneId: 'Australia/Sydney', viewport: { width: 1280, height: 800 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
        await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
        await page.route(base + '/api/locations?*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ locations: [
          { id: '2147714', name: 'Sydney', region: 'New South Wales', country: 'Australia' },
          { id: '1850147', name: 'Tokyo', region: 'Tokyo', country: 'Japan' },
        ] }) }));
        async function signup(first, email) {
          await page.goto(base + '/signup');
          await page.getByLabel('First name').fill(first);
          await page.getByLabel('Last name').fill('Browser Tester');
          await page.getByLabel('Email address').fill(email);
          await page.getByLabel('Password', { exact: true }).fill(rawPassword);
          await page.getByLabel('Password', { exact: true }).press('Enter');
          await page.waitForURL(base + '/');
          await page.getByRole('combobox', { name: 'Departure location' }).waitFor();
        }
        async function createProfile() {
          await page.getByRole('link', { name: 'Profile', exact: true }).click();
          await page.getByRole('heading', { name: 'Create your profile' }).waitFor();
          const location = page.getByRole('combobox', { name: 'Location', exact: true });
          await location.fill('syd');
          await page.getByRole('option', { name: /Sydney.*Australia/ }).waitFor();
          await location.press('ArrowDown');
          await location.press('Enter');
          assert.equal(await location.inputValue(), 'Sydney');
          assert.ok(page.url().endsWith('/create-profile'), 'Selecting a city must not submit the profile');
          await page.locator('select[name="gender"]').selectOption('female');
          await page.getByPlaceholder('Age', { exact: true }).fill('32');
          await page.getByPlaceholder('Bio', { exact: true }).fill('Browser test traveller');
          await page.getByRole('combobox').last().fill('Hiking');
          await page.getByRole('combobox').last().press('Enter');
          await page.getByPlaceholder('Age', { exact: true }).press('Enter');
          await page.waitForURL(base + '/my-profile');
          await page.getByRole('heading', { name: 'Traveller information' }).waitFor();
          await page.getByText('Hiking', { exact: true }).waitFor();
        }
        await signup('Carol', 'carol-browser@example.com');
        await createProfile();
        const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#ff9900' } }).png().toBuffer();
        assert.equal(await page.locator('input[type="file"]').count(), 0, 'Photo controls are hidden on a normal profile visit');
        await page.getByRole('button', { name: 'Add profile photo', exact: true }).click();
        await page.getByLabel('Profile photo (PNG or JPEG, up to 2 MB)').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
        await page.getByRole('button', { name: 'Upload photo', exact: true }).click();
        await page.getByText('Profile photo updated.', { exact: true }).waitFor();
        await page.waitForFunction(() => document.querySelector('img[alt="Avatar"]')?.naturalWidth > 0);
        assert.equal(await page.locator('input[type="file"]').count(), 0, 'A successful upload closes the photo editor');
        assert.equal(await page.locator('.profile-avatar').evaluate(element => getComputedStyle(element).borderRadius), '50%');
        await page.reload();
        await page.getByRole('button', { name: 'Change profile photo', exact: true }).waitFor();
        assert.equal(await page.locator('input[type="file"]').count(), 0, 'Revisiting a profile keeps the upload controls hidden');
        await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
        await page.locator('textarea').fill('Updated browser biography');
        await page.locator('textarea').press('Enter');
        assert.equal(await page.getByRole('button', { name: 'Save changes', exact: true }).count(), 1, 'Enter in a biography creates a newline');
        await page.locator('textarea').fill('Updated browser biography');
        await page.getByLabel('Age', { exact: true }).press('Enter');
        await page.getByText('Updated browser biography', { exact: true }).waitFor();

        await page.getByRole('link', { name: 'Start a New Trip', exact: true }).click();
        await page.setViewportSize({ width: 390, height: 844 });
        function displayDate(days) {
          const date = new Date(Date.now() + days * 86_400_000);
          return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
        }
        async function fillTrip(title, departure) {
          await page.getByPlaceholder('Title', { exact: true }).fill(title);
          await page.getByPlaceholder('Description', { exact: true }).fill('A trip created in the real browser test');
          await page.getByPlaceholder('Departure Location', { exact: true }).fill(departure);
          await page.getByPlaceholder('Destination', { exact: true }).fill('Blue Mountains');
          await page.getByPlaceholder('Start Date', { exact: true }).fill(displayDate(7));
          await page.getByPlaceholder('Start Date', { exact: true }).press('Tab');
          await page.getByPlaceholder('End Date', { exact: true }).fill(displayDate(9));
          await page.getByPlaceholder('End Date', { exact: true }).press('Tab');
        }
        await page.getByRole('heading', { name: 'Start a trip', exact: true }).waitFor();
        assert.equal(await page.locator('.form-error').count(), 0, 'New trip forms must not start with red errors');
        await page.getByPlaceholder('Title', { exact: true }).focus();
        await page.getByPlaceholder('Description', { exact: true }).focus();
        await page.getByText('Title is required.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Create trip', exact: true }).click();
        await page.getByText('End date is required.', { exact: true }).waitFor();
        await fillTrip('Browser travellers trip', 'Browser departure');
        await page.getByPlaceholder('End Date', { exact: true }).fill(displayDate(5));
        await page.getByPlaceholder('Title', { exact: true }).focus();
        await page.getByText('End date must be on or after the start date.', { exact: true }).waitFor();
        await page.getByPlaceholder('End Date', { exact: true }).fill(displayDate(9));
        await page.getByLabel('Trip photo (optional)', { exact: true }).setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
        await page.getByText('Choose a PNG or JPEG image.', { exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Create trip', exact: true }).isDisabled(), true);
        await page.getByLabel('Trip photo (optional)', { exact: true }).setInputFiles({ name: 'trip.png', mimeType: 'image/png', buffer: png });
        let photoAttempts = 0;
        await page.route(base + '/api/images/trips/*', route => {
          if (route.request().method() === 'POST' && ++photoAttempts === 1) {
            return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary test upload failure.' }) });
          }
          return route.continue();
        });
        await page.getByPlaceholder('Title', { exact: true }).press('Enter');
        await page.getByRole('heading', { name: 'Trip created', exact: true }).waitFor();
        await page.getByText('Temporary test upload failure.', { exact: true }).waitFor();
        const carol = await User.findOne({ email: 'carol-browser@example.com' });
        assert.equal(await Trip.countDocuments({ creator: carol._id }), 1);
        assert.equal((await Trip.findOne({ creator: carol._id })).startDate.slice(0, 10), displayDate(7), 'Trip calendar dates must not shift in the Sydney timezone');
        await page.getByRole('button', { name: 'Retry photo', exact: true }).click();
        await page.getByText('Trip photo saved.', { exact: true }).waitFor();
        await page.setViewportSize({ width: 1280, height: 800 });
        assert.equal(await Trip.countDocuments({ creator: carol._id }), 1, 'A photo retry must not create another trip');
        await page.getByRole('link', { name: 'My trips', exact: true }).click();
        await page.getByRole('heading', { name: 'Browser travellers trip' }).waitFor();
        await page.waitForFunction(() => document.querySelector('img[alt="Browser travellers trip"]')?.naturalWidth > 0);
        const firstTripImage = await page.getByRole('img', { name: 'Browser travellers trip', exact: true }).getAttribute('src');
        assert.match(firstTripImage, /^\/api\/images\/trips\//);
        await page.getByRole('button', { name: 'Change trip photo', exact: true }).click();
        const blue = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#2299cc' } }).png().toBuffer();
        await page.getByLabel('Trip photo', { exact: true }).setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: blue });
        await page.getByRole('button', { name: 'Upload trip photo', exact: true }).click();
        await page.getByText('Trip photo updated.', { exact: true }).waitFor();
        await page.waitForFunction(previous => {
          const image = document.querySelector('img[alt="Browser travellers trip"]');
          return image?.naturalWidth > 0 && image.getAttribute('src') !== previous;
        }, firstTripImage);
        const updatedTripImage = await page.getByRole('img', { name: 'Browser travellers trip', exact: true }).getAttribute('src');
        await page.getByRole('link', { name: 'Start a New Trip', exact: true }).click();
        await fillTrip('Trip without photo', 'Browser departure');
        await page.getByPlaceholder('Title', { exact: true }).press('Enter');
        await page.getByRole('heading', { name: 'Trip created', exact: true }).waitFor();
        await page.getByRole('link', { name: 'My trips', exact: true }).click();
        await page.getByRole('heading', { name: 'Trip without photo' }).waitFor();
        assert.match(await page.getByRole('img', { name: 'Trip without photo', exact: true }).getAttribute('src'), /oceanView/);
        await page.getByRole('link', { name: 'Logout', exact: true }).click();
        await page.locator('header').getByRole('link', { name: 'Log in', exact: true }).waitFor();

        await signup('Dan', 'dan-browser@example.com');
        await createProfile();
        await page.getByRole('link', { name: 'Start a New Trip', exact: true }).click();
        await fillTrip('Dan organizes a trip', 'Browser departure');
        await page.getByPlaceholder('Title', { exact: true }).press('Enter');
        await page.getByRole('heading', { name: 'Trip created', exact: true }).waitFor();
        await page.goto(base + '/');
        await page.getByRole('combobox', { name: 'Departure location' }).fill('Browser departure');
        await page.getByRole('combobox', { name: 'Departure location', exact: true }).press('Enter');
        await page.getByRole('img', { name: 'Browser travellers trip', exact: true }).waitFor();
        assert.equal(await page.getByRole('img', { name: 'Browser travellers trip', exact: true }).getAttribute('src'), updatedTripImage);
        const tripCard = page.getByRole('article', { name: 'Browser travellers trip', exact: true });
        const ownCard = page.getByRole('article', { name: 'Dan organizes a trip', exact: true });
        await ownCard.getByText('Organizing', { exact: true }).waitFor();
        assert.equal(await ownCard.getByRole('button', { name: 'Join Trip' }).count(), 0);
        await tripCard.getByRole('img', { name: "Carol Browser Tester's profile", exact: true }).waitFor();
        await page.waitForFunction(() => [...document.querySelectorAll('.trip-card__avatar img')].every(image => image.naturalWidth > 0));
        const heightBeforeJoin = (await tripCard.boundingBox()).height;
        await tripCard.getByRole('button', { name: 'Join Trip', exact: true }).click();
        await tripCard.getByText("You're on the list", { exact: false }).waitFor();
        await tripCard.getByText('Joined', { exact: true }).waitFor();
        assert.ok(Math.abs((await tripCard.boundingBox()).height - heightBeforeJoin) < 1, 'Joining must not make the card taller');
        assert.ok(await tripCard.evaluate(card => card.classList.contains('trip-card--joined')));
        await page.reload();
        await tripCard.getByText('Joined', { exact: true }).waitFor();
        assert.equal(await tripCard.getByRole('button', { name: 'Join Trip' }).count(), 0);
        await tripCard.getByRole('link', { name: 'View your trips', exact: true }).click();
        await page.getByRole('heading', { name: 'Browser travellers trip' }).waitFor();
        const joinedSection = page.getByRole('region', { name: 'Joined (1)', exact: true });
        const organizingSection = page.getByRole('region', { name: 'Organizing (1)', exact: true });
        await joinedSection.getByRole('heading', { name: 'Browser travellers trip', exact: true }).waitFor();
        await organizingSection.getByRole('heading', { name: 'Dan organizes a trip', exact: true }).waitFor();
        assert.equal(await joinedSection.getByRole('button', { name: /(?:Add|Change) trip photo/ }).count(), 0);
        assert.equal(await organizingSection.getByRole('button', { name: 'Add trip photo' }).count(), 1);
        await joinedSection.locator('summary').click();
        await joinedSection.getByRole('link', { name: 'dan-browser@example.com', exact: true }).waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'My trips must fit a mobile screen');
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.getByRole('link', { name: 'Logout', exact: true }).click();
        await page.goto(base + '/login');
        await page.getByLabel('Email address').fill('carol-browser@example.com');
        await page.getByLabel('Password', { exact: true }).fill(rawPassword);
        await page.getByLabel('Password', { exact: true }).press('Enter');
        await page.waitForURL(base + '/');
        await page.getByRole('link', { name: 'Profile', exact: true }).click();
        await page.getByText('Updated browser biography', { exact: true }).waitFor();
        await page.getByRole('link', { name: 'My trips', exact: true }).click();
        await page.getByRole('heading', { name: 'Browser travellers trip' }).waitFor();
        assert.equal(await page.getByRole('img', { name: 'Browser travellers trip', exact: true }).getAttribute('src'), updatedTripImage);
        assert.deepEqual(errors, [], 'Real account/trip pages should render without JavaScript errors');
        console.log('Production browser profile redesign, hidden photo controls, delayed validation, city keyboard selection and Enter form submission passed');
      } catch (failure) {
        const page = browser.contexts()[0]?.pages()[0];
        if (page) console.log('Browser failure context:', JSON.stringify({ url: page.url(), text: await page.locator('main').innerText(),
          forms: await page.locator('form').evaluateAll(forms => forms.map(form => ({ noValidate: form.noValidate, controls: [...form.elements].map(input => ({ name: input.name, type: input.type, disabled: input.disabled })) }))) }));
        throw failure;
      } finally { await browser.close(); }
    });
  }
});
