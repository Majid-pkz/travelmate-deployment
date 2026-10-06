const express = require('express');
const { randomUUID } = require('node:crypto');
const multer = require('multer');
const sharp = require('sharp');
const { authMiddleware } = require('../utils/auth');
const access = require('../utils/access');
const { Profile, Trip } = require('../models');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter(req, file, done) {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      const error = new Error('Choose a PNG or JPEG image.');
      error.status = 415;
      return done(error);
    }
    done(null, true);
  },
});

async function requireAccount(req, res, next) {
  try {
    authMiddleware({ req });
    await access.actor(req);
    next();
  } catch {
    res.status(401).json({ error: 'Log in again to continue.' });
  }
}

router.get('/profile/:userId', async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.userId)) return res.sendStatus(404);
    const profile = await Profile.findOne({ profileUser: req.params.userId }).select('+imageData');
    if (!profile?.imageData) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store');
    res.type('jpeg').send(profile.imageData);
  } catch (error) { next(error); }
});

router.get('/profile', requireAccount, async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ profileUser: req.user._id });
    if (!profile) return res.status(404).json({ error: 'Create your profile first.' });
    res.json(profile);
  } catch (error) { next(error); }
});

function readImage(req, res, next) {
  // Check authentication before Multer reads or stores the uploaded data.
  upload.single('image')(req, res, error => {
    if (error) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.status ?? 400;
      return res.status(status).json({
        error: error.code === 'LIMIT_FILE_SIZE' ? 'Choose an image smaller than 2 MB.' : 'Choose one PNG or JPEG image.',
      });
    }
    next();
  });
}

async function resizedImage(req, res, width, height) {
  if (!req.file) {
    res.status(400).json({ error: 'Choose an image to upload.' });
    return null;
  }
  try {
    const decoder = sharp(req.file.buffer, { limitInputPixels: 16_000_000, failOn: 'warning' });
    const metadata = await decoder.metadata();
    if (!['jpeg', 'png'].includes(metadata.format)) throw new Error('Invalid image format');
    return await decoder
      .rotate().resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 80 }).toBuffer();
  } catch {
    res.status(415).json({ error: 'Choose a valid PNG or JPEG image.' });
    return null;
  }
}

router.post('/', requireAccount, readImage, async (req, res, next) => {
  try {
    const imageData = await resizedImage(req, res, 512, 512);
    if (!imageData) return;
    const image = '/api/images/profile/' + req.user._id + '?v=' + randomUUID();
    const profile = await Profile.findOneAndUpdate(
      { profileUser: req.user._id }, { $set: { image, imageData } },
      { new: true, runValidators: true },
    );
    if (!profile) return res.status(404).json({ error: 'Create your profile first.' });
    res.json({ message: 'Profile photo updated.', image });
  } catch (error) { next(error); }
});

async function requireTripOwner(req, res, next) {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.tripId) || !await Trip.exists({ _id: req.params.tripId, creator: req.user._id })) {
      return res.status(404).json({ error: 'Trip was not found, or you do not have permission to change it.' });
    }
    next();
  } catch (error) { next(error); }
}

router.get('/trips/:tripId', async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.tripId)) return res.sendStatus(404);
    const trip = await Trip.findById(req.params.tripId).select('+imageData');
    if (!trip?.imageData) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store');
    res.type('jpeg').send(trip.imageData);
  } catch (error) { next(error); }
});

router.post('/trips/:tripId', requireAccount, requireTripOwner, readImage, async (req, res, next) => {
  try {
    const imageData = await resizedImage(req, res, 1200, 800);
    if (!imageData) return;
    const image = '/api/images/trips/' + req.params.tripId + '?v=' + randomUUID();
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.tripId, creator: req.user._id }, { $set: { image, imageData } },
      { new: true, runValidators: true },
    );
    if (!trip) return res.status(404).json({ error: 'Trip was not found, or you do not have permission to change it.' });
    res.json({ message: 'Trip photo updated.', image });
  } catch (error) { next(error); }
});

module.exports = router;
